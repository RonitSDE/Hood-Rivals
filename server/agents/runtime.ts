import type { DatabaseSync } from "node:sqlite";
import { agentOrder, type AgentStyle } from "../../shared/agent";
import { botOrder, validateOrder, type GameState, type Order } from "../../shared/game";
import type { Brain } from "./brain";
import { agentCharacter, rivalCharacter, type Character } from "./characters";
import type { AgentAIConfig } from "./config";
import { parseDecision } from "./decide";
import { describeOrder, legalMoves } from "./moves";
import { buildPrompt } from "./prompt";

export type AISlot = { slot: number; character: Character; fallback: (s: GameState) => Order };

export type Thought = {
  round: number;
  slot: number;
  captain: string;
  action: string;
  reason: string;
  source: "ai" | "rules";
  model: string | null;
  teeVerified: boolean | null;
  latencyMs: number | null;
};

const MEMORY_NOTES = 5;
const dayStart = (now: number) => new Date(new Date(now).toISOString().slice(0, 10)).getTime();

/**
 * Runs AI captains. Decisions are requested asynchronously when a round opens and stored in
 * `agent_decisions`; the synchronous round resolver then reads them. Anything missing, slow,
 * invalid or over budget is played by the rule-based policy instead, so a match never stalls.
 */
export function createAgentRuntime(opts: {
  db: DatabaseSync;
  config: AgentAIConfig;
  brain: Brain | null;
  /** Called after a decision settles so the round can resolve without waiting for a poll. */
  onSettled?: (matchId: string) => void;
  now?: () => number;
}) {
  const { db, config, brain } = opts;
  const now = opts.now ?? Date.now;
  const enabled = config.enabled && !!brain;
  const inFlight = new Set<string>();

  /** Which slots in this match are played by AI captains, and who they are. */
  function slots(row: any, players: any[], s: GameState): AISlot[] {
    const human = new Set(players.filter((p) => p.slot >= 0).map((p) => p.slot));
    const out: AISlot[] = [];
    if (row.mode === "arena") {
      for (const f of s.factions)
        out.push({
          slot: f.id,
          character: { ...rivalCharacter(f.id, f.captain), key: `arena:${f.id}:${row.host}` },
          fallback: (state) => botOrder(state, f.id),
        });
      return out;
    }
    if (row.mode === "solo" && row.control === "agent" && row.agent_token_id) {
      const host = players.find((p) => p.user_id === row.host);
      const agent = db
        .prepare("SELECT style,played FROM agent_memories WHERE token_id=?")
        .get(row.agent_token_id) as any;
      if (host && agent)
        out.push({
          slot: host.slot,
          character: agentCharacter(
            row.agent_token_id,
            host.slot,
            s.factions[host.slot].captain,
            agent.style as AgentStyle,
          ),
          fallback: (state) => agentOrder(state, host.slot, agent.style as AgentStyle, agent.played),
        });
    }
    if (row.mode === "solo" && row.rivals === "ai")
      for (const f of s.factions)
        if (!human.has(f.id))
          out.push({
            slot: f.id,
            character: { ...rivalCharacter(f.id, f.captain), key: `rival:${f.id}:${row.host}` },
            fallback: (state) => botOrder(state, f.id),
          });
    return out;
  }

  function callsToday() {
    const row = db
      .prepare("SELECT COUNT(*) AS n FROM agent_decisions WHERE source='ai' AND created>=?")
      .get(dayStart(now())) as any;
    return Number(row?.n ?? 0) + inFlight.size;
  }

  function memories(character: string) {
    return (
      db
        .prepare("SELECT note FROM agent_notes WHERE character=? ORDER BY created DESC LIMIT ?")
        .all(character, MEMORY_NOTES) as any[]
    ).map((r) => r.note as string);
  }

  /** Starts AI decisions for every AI slot of the current round that has none yet. Never throws. */
  function schedule(row: any, players: any[], s: GameState) {
    if (!enabled || row.status !== "active") return;
    for (const ai of slots(row, players, s)) {
      const key = `${row.id}:${s.round}:${ai.slot}`;
      if (inFlight.has(key)) continue;
      if (
        db
          .prepare("SELECT 1 FROM agent_decisions WHERE match_id=? AND round=? AND slot=?")
          .get(row.id, s.round, ai.slot)
      )
        continue;
      if (callsToday() >= config.dailyCallLimit) return;
      const moves = legalMoves(s, ai.slot);
      db.prepare(
        "INSERT OR IGNORE INTO agent_decisions(match_id,round,slot,character,status,created) VALUES (?,?,?,?,'pending',?)",
      ).run(row.id, s.round, ai.slot, ai.character.key, now());
      inFlight.add(key);
      const messages = buildPrompt(s, ai.slot, ai.character, moves, memories(ai.character.key));
      void (async () => {
        try {
          const answer = await brain!(messages);
          const { move, reason } = parseDecision(answer.content, moves);
          db.prepare(
            "UPDATE agent_decisions SET status='done',source='ai',order_json=?,reason=?,model=?,response_id=?,tee_verified=?,latency_ms=? WHERE match_id=? AND round=? AND slot=? AND status='pending'",
          ).run(
            JSON.stringify(move.order),
            reason,
            answer.model,
            answer.responseId,
            answer.teeVerified === null ? null : answer.teeVerified ? 1 : 0,
            answer.latencyMs,
            row.id,
            s.round,
            ai.slot,
          );
        } catch (error: any) {
          db.prepare(
            "UPDATE agent_decisions SET status='failed',error=? WHERE match_id=? AND round=? AND slot=? AND status='pending'",
          ).run(String(error?.message || error).slice(0, 300), row.id, s.round, ai.slot);
        } finally {
          inFlight.delete(key);
          try {
            opts.onSettled?.(row.id);
          } catch (error) {
            console.error("Round resolution after AI decision failed", row.id, error);
          }
        }
      })();
    }
  }

  /** True when no AI decision for this round is still being worked on. */
  function settled(matchId: string, round: number, ai: AISlot[]) {
    if (!enabled) return true;
    return ai.every((a) => {
      const d = db
        .prepare("SELECT status FROM agent_decisions WHERE match_id=? AND round=? AND slot=?")
        .get(matchId, round, a.slot) as any;
      return d && d.status !== "pending";
    });
  }

  /** The order an AI slot plays this round: its AI decision if usable, otherwise the rules. */
  function orderFor(matchId: string, s: GameState, ai: AISlot): Order {
    const d = db
      .prepare("SELECT * FROM agent_decisions WHERE match_id=? AND round=? AND slot=?")
      .get(matchId, s.round, ai.slot) as any;
    if (d?.status === "done" && d.order_json) {
      const order = JSON.parse(d.order_json) as Order;
      if (!validateOrder(s, ai.slot, order)) return order;
    }
    const order = ai.fallback(s);
    const why =
      d?.status === "failed"
        ? "AI unavailable, rule-based policy played"
        : enabled
          ? "AI did not answer in time, rule-based policy played"
          : `Rule-based ${ai.character.style} policy`;
    db.prepare(
      `INSERT INTO agent_decisions(match_id,round,slot,character,status,source,order_json,reason,error,created) VALUES (?,?,?,?,'done','rules',?,?,?,?)
       ON CONFLICT(match_id,round,slot) DO UPDATE SET status='done',source='rules',order_json=excluded.order_json,reason=excluded.reason,error=COALESCE(agent_decisions.error,excluded.error)`,
    ).run(matchId, s.round, ai.slot, ai.character.key, JSON.stringify(order), why, d?.error ?? null, now());
    return order;
  }

  /** Decisions shown to a viewer. `visibleSlots` limits which captains' thoughts are revealed. */
  function thoughts(
    matchId: string,
    s: GameState,
    opts: { throughRound: number; slots?: Set<number> },
  ): Thought[] {
    const rows = db
      .prepare(
        "SELECT * FROM agent_decisions WHERE match_id=? AND round<=? AND status='done' ORDER BY round,slot",
      )
      .all(matchId, opts.throughRound) as any[];
    return rows
      .filter((r) => !opts.slots || opts.slots.has(r.slot))
      .map((r) => ({
        round: r.round,
        slot: r.slot,
        captain: s.factions[r.slot]?.captain ?? "Captain",
        action: r.order_json ? describeOrder(s, JSON.parse(r.order_json)) : "held position",
        reason: r.reason ?? "",
        source: r.source === "ai" ? "ai" : "rules",
        model: r.model ?? null,
        teeVerified: r.tee_verified === null || r.tee_verified === undefined ? null : !!r.tee_verified,
        latencyMs: r.latency_ms ?? null,
      }));
  }

  /** Per-slot status for the current round: who is still thinking. */
  function progress(matchId: string, round: number, ai: AISlot[]) {
    return ai.map((a) => {
      const d = db
        .prepare("SELECT status FROM agent_decisions WHERE match_id=? AND round=? AND slot=?")
        .get(matchId, round, a.slot) as any;
      return { slot: a.slot, thinking: enabled && (!d || d.status === "pending") };
    });
  }

  /** After a match, each AI captain keeps a short note about it for future prompts. */
  function remember(row: any, players: any[], s: GameState) {
    const ai = slots(row, players, s);
    const ranked = [...s.factions].sort((a, b) => b.score - a.score);
    for (const { slot, character } of ai) {
      const me = s.factions[slot];
      const place = ranked.findIndex((f) => f.id === slot) + 1;
      const parts = [
        s.winner === slot
          ? `Won with ${me.score} Renown.`
          : `Finished ${place === 2 ? "second" : "third"} with ${me.score} Renown; ${(s.factions[s.winner ?? -1] ?? ranked[0]).captain} ${s.factions[s.winner ?? -1] ? "won" : "led"}.`,
      ];
      for (const e of s.events.filter(
        (e) => e.actors.includes(slot) && (e.kind === "betrayal" || e.kind === "pact"),
      ))
        parts.push(e.text);
      const note = parts.join(" ").slice(0, 300);
      db.prepare("INSERT OR REPLACE INTO agent_notes(character,match_id,created,note) VALUES (?,?,?,?)").run(
        character.key,
        row.id,
        now(),
        note,
      );
    }
  }

  function status() {
    return {
      enabled,
      provider: "0G Compute",
      model: enabled ? config.model : null,
      callsToday: callsToday(),
      dailyCallLimit: config.dailyCallLimit,
    };
  }

  return { enabled, config, slots, schedule, settled, orderFor, thoughts, progress, remember, status };
}

export type AgentRuntime = ReturnType<typeof createAgentRuntime>;
