import { FLAGS, MAX_ROUNDS, viewGame, type GameState } from "../../shared/game";
import type { Character } from "./characters";
import type { Move } from "./moves";

export type ChatMessage = { role: "system" | "user"; content: string };

const RULES = `You are a captain in Hood Rivals, a six-round strategy game for three factions on a small hex island.
- Every round all captains choose one order at the same time; orders then resolve together.
- Scout: move up to two steps and reveal the area. It does not capture.
- Contest: fight for a tile you have already explored. Banners give +1 Renown for every round you hold them.
- Develop: income (+1 Supply per round), fortify (defend outposts) or heal (restore squad strength).
- Pact: succeeds only if the other captain offers you a pact in the same round. Raiding someone who offered you a pact is a betrayal they remember.
- Most Renown after round ${MAX_ROUNDS} wins; holding all three banners at once wins immediately.
You only know what your captain can see. Play to win, in character.`;

/** Builds the chat messages for one decision. Only fog-of-war information for `slot` is included. */
export function buildPrompt(
  s: GameState,
  slot: number,
  who: Character,
  moves: Move[],
  memories: string[],
): ChatMessage[] {
  const view: any = viewGame(s, slot);
  const me = s.factions[slot];
  const rivals = view.factions
    .filter((f: any) => f.id !== slot)
    .map(
      (f: any) =>
        `- ${f.captain} (${f.name}): ${f.score} Renown, ${f.pos ? `seen at ${f.pos}, strength ${f.hp}/4` : "position unknown"}, your trust in them ${me.memory[String(f.id)] ?? 0}`,
    );
  const banners = FLAGS.map((id) => {
    const tile = view.tiles.find((t: any) => t.id === id);
    const owner =
      tile?.kind === "fog"
        ? "unknown"
        : tile.owner === slot
          ? "you"
          : tile.owner >= 0
            ? s.factions[tile.owner].captain
            : "nobody";
    return `${id}: ${owner}`;
  });
  const events = (view.events as any[]).slice(-8).map((e) => `- Round ${e.round}: ${e.text}`);
  const situation = [
    `Round ${s.round} of ${MAX_ROUNDS}.`,
    `You: ${me.captain} of ${me.name} at ${me.pos}. Renown ${me.score}, Supplies ${me.supplies}, income +${me.income}/round, squad strength ${me.hp}/4.`,
    `Rivals:\n${rivals.join("\n")}`,
    `Banners (${FLAGS.length}): ${banners.join(", ")}.`,
    events.length
      ? `What you have seen recently:\n${events.join("\n")}`
      : "Nothing notable has happened near you yet.",
    memories.length ? `Your memories from earlier matches:\n${memories.map((m) => `- ${m}`).join("\n")}` : "",
    `Your legal orders this round:\n${moves.map((m, i) => `${i + 1}. ${m.label}`).join("\n")}`,
    `Answer with JSON only, no other text: {"move": <number from the list>, "reason": "<one sentence in your voice, max 140 characters>"}`,
  ]
    .filter(Boolean)
    .join("\n\n");
  return [
    { role: "system", content: `${RULES}\n\nYour character — ${who.name}: ${who.personality}` },
    { role: "user", content: situation },
  ];
}
