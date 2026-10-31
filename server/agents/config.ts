/**
 * Settings for AI agents on 0G Compute. Without ZG_COMPUTE_API_KEY the AI is off and every
 * agent plays with the built-in rule-based policy, so the game always works.
 */
export type AgentAIConfig = {
  /** 0G Compute Router API key (`sk-…`, created at https://pc.0g.ai). */
  apiKey: string;
  /** OpenAI-compatible base URL of the 0G Compute Router. */
  baseUrl: string;
  /** Model id from the 0G model catalogue, e.g. `glm-5.2`. */
  model: string;
  /** Ask the router to verify the provider's TEE signature for each answer. */
  verifyTee: boolean;
  /** Give up on one AI decision after this long and use the rules instead. */
  timeoutMs: number;
  /** Upper bound on tokens per answer (the answer is one small JSON object). */
  maxTokens: number;
  /** Hard cap on AI calls per UTC day across the whole server (cost control). */
  dailyCallLimit: number;
  /** Arena (AI-only) matches one player may start per UTC day. */
  arenaPerUserPerDay: number;
  /** Minimum time an Arena round stays on screen so spectators can follow it. */
  arenaRoundMs: number;
  enabled: boolean;
};

function number(value: string | undefined, fallback: number, min: number, max: number, name: string) {
  if (value === undefined || value === "") return fallback;
  const n = Number(value);
  if (!Number.isFinite(n) || n < min || n > max)
    throw Error(`${name} must be a number from ${min} to ${max}`);
  return n;
}

export function agentAIConfig(env: Record<string, string | undefined> = process.env): AgentAIConfig {
  const apiKey = (env.ZG_COMPUTE_API_KEY || "").trim();
  const baseUrl = (env.ZG_COMPUTE_BASE_URL || "https://router-api.0g.ai/v1").replace(/\/+$/, "");
  if (!/^https?:\/\//.test(baseUrl)) throw Error("ZG_COMPUTE_BASE_URL must be an http(s) URL");
  if (apiKey && !apiKey.startsWith("sk-"))
    throw Error("ZG_COMPUTE_API_KEY must be a 0G Compute Router inference key (starts with sk-)");
  const disabled = ["0", "false", "off"].includes((env.AGENT_AI || "").toLowerCase());
  return {
    apiKey,
    baseUrl,
    model: (env.ZG_COMPUTE_MODEL || "glm-5.2").trim(),
    verifyTee: !["0", "false", "off"].includes((env.ZG_COMPUTE_VERIFY_TEE || "true").toLowerCase()),
    timeoutMs: number(env.AGENT_AI_TIMEOUT_MS, 9000, 1000, 60000, "AGENT_AI_TIMEOUT_MS"),
    maxTokens: number(env.AGENT_AI_MAX_TOKENS, 300, 64, 4000, "AGENT_AI_MAX_TOKENS"),
    dailyCallLimit: number(env.AGENT_AI_DAILY_CALL_LIMIT, 3000, 0, 1_000_000, "AGENT_AI_DAILY_CALL_LIMIT"),
    arenaPerUserPerDay: number(env.AGENT_ARENA_PER_USER_PER_DAY, 5, 0, 1000, "AGENT_ARENA_PER_USER_PER_DAY"),
    arenaRoundMs: number(env.AGENT_ARENA_ROUND_MS, 7000, 0, 120000, "AGENT_ARENA_ROUND_MS"),
    enabled: !!apiKey && !disabled,
  };
}
