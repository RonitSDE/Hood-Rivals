import { z } from "zod";
import type { Move } from "./moves";

const answerSchema = z.object({
  move: z.coerce.number().int(),
  reason: z.string().trim().min(1).max(400),
});

/**
 * Turns the model's text into one of the offered moves. Accepts a bare JSON object or one
 * wrapped in prose / code fences. Throws when the answer is unusable, so the caller falls back.
 */
export function parseDecision(text: string, moves: Move[]) {
  const json = text.slice(text.indexOf("{"), text.lastIndexOf("}") + 1);
  if (!json) throw Error("Answer did not contain JSON");
  const answer = answerSchema.parse(JSON.parse(json));
  const move = moves[answer.move - 1];
  if (!move) throw Error(`Move ${answer.move} is not on the list of ${moves.length}`);
  const reason = answer.reason.replace(/\s+/g, " ").slice(0, 160);
  return { move, reason };
}
