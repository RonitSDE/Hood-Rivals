import type { AgentAIConfig } from "./config";
import type { ChatMessage } from "./prompt";

export type BrainAnswer = {
  content: string;
  model: string;
  /** Response id from the router, kept as a receipt. */
  responseId: string | null;
  /** True/false when the router reported a TEE verification result, null when it did not say. */
  teeVerified: boolean | null;
  latencyMs: number;
};

export type Brain = (messages: ChatMessage[]) => Promise<BrainAnswer>;

/** Calls the 0G Compute Router (OpenAI-compatible chat completions). Throws on timeout or error. */
export function zeroGBrain(config: AgentAIConfig, fetchImpl: typeof fetch = fetch): Brain {
  return async (messages) => {
    const started = Date.now();
    const response = await fetchImpl(`${config.baseUrl}/chat/completions`, {
      method: "POST",
      signal: AbortSignal.timeout(config.timeoutMs),
      headers: { "content-type": "application/json", authorization: `Bearer ${config.apiKey}` },
      body: JSON.stringify({
        model: config.model,
        messages,
        max_tokens: config.maxTokens,
        temperature: 0.7,
        ...(config.verifyTee ? { verify_tee: true } : {}),
      }),
    });
    const body: any = await response.json().catch(() => ({}));
    if (!response.ok) {
      const detail = body?.error?.message || body?.error || response.statusText;
      throw Error(`0G Compute ${response.status}: ${String(detail).slice(0, 200)}`);
    }
    const content = body?.choices?.[0]?.message?.content;
    if (typeof content !== "string" || !content.trim()) throw Error("0G Compute returned an empty answer");
    const tee = body?.tee_verified ?? body?.trace?.tee_verified ?? response.headers.get("x-tee-verified");
    return {
      content,
      model: typeof body.model === "string" ? body.model : config.model,
      responseId: typeof body.id === "string" ? body.id : null,
      teeVerified: tee === undefined || tee === null ? null : tee === true || tee === "true",
      latencyMs: Date.now() - started,
    };
  };
}
