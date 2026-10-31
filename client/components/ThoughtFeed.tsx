import { useState } from "react";
import { FACTIONS } from "../../shared/game";

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

/** Where a decision came from, in plain words. */
function Source({ t }: { t: Thought }) {
  if (t.source === "rules") return <span className="thought-source rules">Rule-based</span>;
  return (
    <span className="thought-source ai" title={t.model ? `Model: ${t.model}` : undefined}>
      0G AI{t.teeVerified ? " · TEE verified" : ""}
    </span>
  );
}

/** The reasoning AI captains gave for their orders, newest round first. */
export function ThoughtFeed({
  thoughts,
  title = "Captain thoughts",
  empty = "The captains are still deciding.",
}: {
  thoughts: Thought[];
  title?: string;
  empty?: string;
}) {
  const [all, setAll] = useState(false);
  const every = [...new Set(thoughts.map((t) => t.round))].sort((a, b) => b - a);
  const rounds = all ? every : every.slice(0, 2);
  return (
    <section className="panel thought-feed" aria-live="polite">
      <h3>{title}</h3>
      {rounds.length === 0 && <p className="thought-empty">{empty}</p>}
      {rounds.map((round) => (
        <div className="thought-round" key={round}>
          <span className="eyebrow">Round {round}</span>
          {thoughts
            .filter((t) => t.round === round)
            .map((t) => (
              <article
                className="thought"
                key={`${t.round}:${t.slot}`}
                style={{ borderColor: FACTIONS[t.slot]?.color }}
              >
                <div className="thought-head">
                  <b style={{ color: FACTIONS[t.slot]?.color }}>{t.captain}</b>
                  <span>{t.action}</span>
                  <Source t={t} />
                </div>
                {t.reason && <p>“{t.reason}”</p>}
              </article>
            ))}
        </div>
      ))}
      {every.length > rounds.length && (
        <button className="text-button" onClick={() => setAll(true)}>
          Show earlier rounds ({every.length - rounds.length})
        </button>
      )}
    </section>
  );
}
