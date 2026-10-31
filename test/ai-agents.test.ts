import test from "node:test";
import assert from "node:assert/strict";
import { createApp } from "../server/app";
import { config } from "../server/config";
import {
  agentAIConfig,
  buildPrompt,
  legalMoves,
  parseDecision,
  zeroGBrain,
  type Brain,
} from "../server/agents";
import { rivalCharacter } from "../server/agents/characters";
import { createGame, validateOrder } from "../shared/game";

const AI = agentAIConfig({
  ZG_COMPUTE_API_KEY: "sk-test",
  AGENT_AI_TIMEOUT_MS: "2000",
  AGENT_ARENA_ROUND_MS: "0",
  AGENT_ARENA_PER_USER_PER_DAY: "2",
});

/** A stand-in for 0G Compute: always picks the first legal move. */
const firstMove =
  (calls: string[][] = []): Brain =>
  async (messages) => {
    calls.push(messages.map((m) => m.content));
    return {
      content: '{"move": 1, "reason": "Testing the frontier."}',
      model: "fake-0g",
      responseId: "r1",
      teeVerified: true,
      latencyMs: 5,
    };
  };

async function start(deps: Parameters<typeof createApp>[1]) {
  const runtime = createApp(
    { ...config, db: ":memory:", roundMs: 60000, production: false, origin: "http://test" },
    deps,
  );
  const server = runtime.app.listen(0);
  await new Promise<void>((r) => server.once("listening", r));
  const base = `http://127.0.0.1:${(server.address() as any).port}`;
  let cookie = "",
    csrf = "";
  const call = async (path: string, body?: unknown) => {
    const r = await fetch(base + "/api" + path, {
      method: body ? "POST" : "GET",
      headers: { "content-type": "application/json", origin: "http://test", cookie, "x-csrf-token": csrf },
      body: body ? JSON.stringify(body) : undefined,
    });
    if (r.headers.get("set-cookie")) cookie = r.headers.get("set-cookie")!.split(";")[0];
    const data = await r.json();
    if (data.csrf) csrf = data.csrf;
    return { status: r.status, data };
  };
  await call("/session", {});
  const close = () => {
    server.close();
    runtime.close();
  };
  return { runtime, call, close };
}

const settle = () => new Promise((r) => setTimeout(r, 30));

test("AI answers are parsed only into moves from the legal list", () => {
  const s = createGame("parse");
  const moves = legalMoves(s, 0);
  assert.ok(moves.length > 3);
  for (const m of moves) assert.equal(validateOrder(s, 0, m.order), null, m.label);
  assert.deepEqual(parseDecision('{"move": 2, "reason": "Scout west."}', moves).move, moves[1]);
  assert.equal(parseDecision('Sure!\n```json\n{"move":"1","reason":"Go."}\n```', moves).move, moves[0]);
  assert.throws(() => parseDecision('{"move": 999, "reason": "x"}', moves));
  assert.throws(() => parseDecision("I would scout.", moves));
  assert.throws(() => parseDecision('{"move": 1}', moves));
});

test("prompts carry only what the captain can see", () => {
  const s = createGame("fog");
  s.factions[1].supplies = 77;
  const messages = buildPrompt(s, 0, rivalCharacter(0, "Nox"), legalMoves(s, 0), ["Lost to Ash last time."]);
  const text = messages.map((m) => m.content).join("\n");
  assert.match(text, /Round 1 of 6/);
  assert.match(text, /Lost to Ash last time/);
  assert.doesNotMatch(text, /77/); // rival supplies are hidden information
  assert.doesNotMatch(text, new RegExp(`seen at ${s.factions[1].pos}`)); // rival base is out of sight
});

test("0G brain sends an OpenAI-style request with the key and reads the answer", async () => {
  let seen: any;
  const brain = zeroGBrain(AI, (async (url: string, init: any) => {
    seen = { url, headers: init.headers, body: JSON.parse(init.body) };
    return new Response(
      JSON.stringify({
        id: "chat-1",
        model: "glm-5.2",
        choices: [{ message: { content: '{"move":1,"reason":"ok"}' } }],
        tee_verified: true,
      }),
      { status: 200 },
    );
  }) as any);
  const answer = await brain([{ role: "user", content: "hi" }]);
  assert.equal(seen.url, "https://router-api.0g.ai/v1/chat/completions");
  assert.equal(seen.headers.authorization, "Bearer sk-test");
  assert.equal(seen.body.verify_tee, true);
  assert.equal(answer.teeVerified, true);
  assert.equal(answer.responseId, "chat-1");
  const failing = zeroGBrain(
    AI,
    (async () =>
      new Response(JSON.stringify({ error: { message: "insufficient balance" } }), { status: 402 })) as any,
  );
  await assert.rejects(() => failing([]), /402: insufficient balance/);
  assert.throws(() => agentAIConfig({ ZG_COMPUTE_API_KEY: "mk-management" }), /starts with sk-/);
  assert.equal(agentAIConfig({}).enabled, false);
});

test("AI rivals decide each round; their reasoning stays hidden until the match ends; they remember", async () => {
  const calls: string[][] = [];
  const { runtime, call, close } = await start({ agentAI: AI, brain: firstMove(calls) });
  try {
    const { data } = await call("/matches", { mode: "solo", rivals: "ai" });
    for (let round = 1; round <= 6; round++) {
      await settle();
      const game = (await call("/matches/" + data.id)).data;
      if (game.status === "finished") break;
      assert.equal(game.ai.captains.length, 2);
      assert.deepEqual(game.ai.thoughts, [], "rival reasoning must not leak during play");
      await call(`/matches/${data.id}/orders`, { round: game.round, order: { type: "hold" } });
    }
    await settle();
    const done = (await call("/matches/" + data.id)).data;
    assert.equal(done.status, "finished");
    assert.ok(done.ai.thoughts.length >= 2);
    assert.ok(
      done.ai.thoughts.every(
        (t: any) => t.source === "ai" && t.reason === "Testing the frontier." && t.teeVerified === true,
      ),
    );
    assert.ok((await call("/replays/" + data.id)).data.thoughts.length >= 2);
    const notes = runtime.db.prepare("SELECT * FROM agent_notes").all() as any[];
    assert.equal(notes.length, 2);
    // The next match's prompt includes what they remember.
    const next = (await call("/matches", { mode: "solo", rivals: "ai" })).data;
    await settle();
    assert.ok(calls.at(-1)!.join("\n").includes("Your memories from earlier matches"));
    await call(`/matches/${next.id}/orders`, { round: 1, order: { type: "hold" } });
  } finally {
    close();
  }
});

test("when 0G fails the rule-based policy plays and the match still finishes", async () => {
  const broken: Brain = async () => {
    throw Error("0G Compute 503: unavailable");
  };
  const { runtime, call, close } = await start({ agentAI: AI, brain: broken });
  try {
    const { data } = await call("/matches", { mode: "solo", rivals: "ai" });
    for (let round = 1; round <= 6; round++) {
      await settle();
      const game = (await call("/matches/" + data.id)).data;
      if (game.status === "finished") break;
      await call(`/matches/${data.id}/orders`, { round: game.round, order: { type: "hold" } });
    }
    await settle();
    const done = (await call("/matches/" + data.id)).data;
    assert.equal(done.status, "finished");
    assert.ok(done.ai.thoughts.every((t: any) => t.source === "rules"));
    const errors = runtime.db
      .prepare("SELECT error FROM agent_decisions WHERE error IS NOT NULL")
      .all() as any[];
    assert.ok(errors.some((e) => /503/.test(e.error)));
  } finally {
    close();
  }
});

test("Arena: three AI captains play while the player watches, with a daily limit", async () => {
  const { runtime, call, close } = await start({ agentAI: AI, brain: firstMove() });
  try {
    const { data } = await call("/matches", { mode: "arena" });
    let game: any;
    for (let i = 0; i < 40; i++) {
      await settle();
      runtime.db.prepare("UPDATE matches SET deadline=0 WHERE id=?").run(data.id);
      game = (await call("/matches/" + data.id)).data;
      if (game.status === "finished") break;
      assert.equal(game.spectator, true);
      assert.equal(game.you, -1);
      assert.equal(game.ai.captains.length, 3);
      assert.ok(
        game.ai.thoughts.every((t: any) => t.round < game.round),
        "only resolved rounds are shown",
      );
    }
    assert.equal(game.status, "finished");
    assert.equal(game.ai.thoughts.length, 18); // 3 captains × 6 rounds
    // Watching does not block playing.
    assert.equal((await call("/matches", { mode: "solo" })).status, 200);
    const second = (await call("/matches", { mode: "arena" })).data; // 2 of 2 today
    assert.ok(second.id);
    runtime.db.prepare("UPDATE matches SET status='cancelled' WHERE mode='arena'").run();
    assert.equal((await call("/matches", { mode: "arena" })).status, 429);
  } finally {
    close();
  }
});

test("the daily AI budget is enforced", async () => {
  const calls: string[][] = [];
  const { call, close } = await start({ agentAI: { ...AI, dailyCallLimit: 0 }, brain: firstMove(calls) });
  try {
    const { data } = await call("/matches", { mode: "solo", rivals: "ai" });
    await settle();
    await call(`/matches/${data.id}/orders`, { round: 1, order: { type: "hold" } });
    await settle();
    assert.equal(calls.length, 0);
  } finally {
    close();
  }
});
