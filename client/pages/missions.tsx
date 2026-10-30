import { useEffect } from "react";
import { playCue } from "../sound";
import { navigate, usePageTitle } from "../router";
import { api } from "../lib/api";
import { useApp } from "../app/AppState";

export default function MissionsPage() {
  const {
    agent,
    boot,
    busy,
    clock,
    connect,
    loadMissions,
    missionApproach,
    missionFood,
    missionObjective,
    missionProof,
    missionRole,
    missions,
    run,
    setMissionApproach,
    setMissionFood,
    setMissionObjective,
    setMissionProof,
    setMissionRole,
    setMissions,
    setNotice,
    soundOn,
  } = useApp();
  usePageTitle("Agent missions");
  useEffect(() => {
    loadMissions().catch(() => {});
  }, []);
  return (
    <main id="main-content" className="content mission-page">
      <div className="eyebrow">Agent missions</div>
      <h1>Outpost orders.</h1>
      <p className="intro">
        Assign a one-minute resource mission while you play tactical matches by hand. Choose a specialist,
        destination and food limit. The server remembers the outcome after you leave.
      </p>
      {!missions ? (
        <div className="mission-empty" role="status">
          Loading the outpost record…
        </div>
      ) : !missions.available ? (
        <section className="mission-empty">
          <h2>Start with a captain.</h2>
          <p>{missions.reason}</p>
          <button
            className="primary"
            onClick={() => (boot.profile.wallet ? navigate("/captain") : run(connect))}
          >
            {boot.profile.wallet ? "Create your captain" : "Log in"}
          </button>
        </section>
      ) : (
        <>
          <section className="mission-resource-grid" aria-label="Saved outpost stores">
            <div>
              <b>▥ {missions.store.wood}</b>
              <span>WOOD</span>
            </div>
            <div>
              <b>◆ {missions.store.stone}</b>
              <span>STONE</span>
            </div>
            <div>
              <b>◈ {missions.store.food}</b>
              <span>FOOD</span>
            </div>
            <div>
              <b>⬡ {missions.store.ore}</b>
              <span>ORE</span>
            </div>
            <div>
              <b>⌁ {missions.store.intel}</b>
              <span>INTEL</span>
            </div>
            <div>
              <b>✧ {missions.store.beacon_level}/3</b>
              <span>BEACON</span>
            </div>
          </section>
          <div className="mission-grid">
            <section className="mission-control">
              <span className="eyebrow">Step 1: set the mandate</span>
              <h2>Where should the runner go?</h2>
              <p>
                Three missions per UTC day, one at a time. Each takes about one minute. Matched specialists
                bring one extra resource. No token reward or ranked advantage.
              </p>
              <label>
                Specialist
                <select value={missionRole} onChange={(e) => setMissionRole(e.target.value)}>
                  <option value="quartermaster">Quartermaster · wood and food</option>
                  <option value="engineer">Engineer · stone and ore</option>
                  <option value="scout">Scout · intel</option>
                </select>
              </label>
              <label>
                Objective
                <select value={missionObjective} onChange={(e) => setMissionObjective(e.target.value)}>
                  <option value="forest">Greenwood · gather wood</option>
                  <option value="quarry">Stone ridge · gather stone</option>
                  <option value="lookout">Eastern lookout · gather food</option>
                  <option value="mine" disabled={missions.store.beacon_level < 1}>
                    Iron hollow · gather ore {missions.store.beacon_level < 1 ? "(beacon 1)" : ""}
                  </option>
                  <option value="relay" disabled={missions.store.beacon_level < 1}>
                    Signal ruins · gather intel {missions.store.beacon_level < 1 ? "(beacon 1)" : ""}
                  </option>
                </select>
              </label>
              <label>
                Approach
                <select value={missionApproach} onChange={(e) => setMissionApproach(e.target.value)}>
                  <option value="careful">Careful · avoid patrols</option>
                  <option value="bold">Bold · try a risky shortcut</option>
                </select>
              </label>
              <label>
                Maximum food spend
                <select value={missionFood} onChange={(e) => setMissionFood(Number(e.target.value))}>
                  <option value={0}>0 food · no spending authorized</option>
                  <option value={1}>1 food · spend only if a rival appears</option>
                </select>
              </label>
              <p className="mission-limit">
                If a bold route meets a patrol and the spend is forbidden or unavailable, the runner withdraws
                with no materials. A safe route always avoids contact.
              </p>
              <button
                className="primary"
                disabled={
                  busy ||
                  !!missions.activeId ||
                  missions.remaining === 0 ||
                  missions.store.food < missionFood ||
                  ((missionObjective === "mine" || missionObjective === "relay") &&
                    missions.store.beacon_level < 1)
                }
                onClick={() =>
                  run(async () => {
                    const result = await api("/missions", {
                      objective: missionObjective,
                      approach: missionApproach,
                      maxFoodSpend: missionFood,
                      role: missionRole,
                    });
                    setMissions({ available: true, ...result.board });
                    setNotice("Specialist assigned. Return in about one minute for the report.");
                    if (soundOn) playCue("advance");
                  })
                }
              >
                {missions.activeId
                  ? "Specialist is away"
                  : missions.remaining === 0
                    ? "Daily limit reached"
                    : "Assign specialist"}
              </button>
              <small>
                {missions.remaining} of 3 assignments left today · resets{" "}
                {new Date(missions.nextReset).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}{" "}
                local time ·{" "}
                {agent?.linked
                  ? `Agent ID #${agent.tokenId} verified at assignment`
                  : "Free outpost runner; Agent ID optional"}
              </small>
            </section>
            <section className="mission-project">
              <span className="eyebrow">Step 2: build a place to return to</span>
              <h2>The signal beacon.</h2>
              <div className={`beacon-art beacon-level-${missions.store.beacon_level}`} aria-hidden="true">
                <span>✦</span>
                <i />
                <i />
                <i />
              </div>
              <p>
                Permanent server-saved outpost project. Level one opens the ore and intel routes. Later levels
                cost both materials and brighten your saved profile beacon; none change ranked combat.
              </p>
              <div className="mission-cost">
                Next level{" "}
                {missions.store.beacon_level < 3
                  ? `${missions.projectCost.wood} wood + ${missions.projectCost.stone} stone${missions.projectCost.ore ? ` + ${missions.projectCost.ore} ore + ${missions.projectCost.intel} intel` : ``}`
                  : "complete"}
              </div>
              <button
                disabled={
                  busy ||
                  missions.store.beacon_level >= 3 ||
                  missions.store.wood < missions.projectCost.wood ||
                  missions.store.stone < missions.projectCost.stone ||
                  missions.store.ore < missions.projectCost.ore ||
                  missions.store.intel < missions.projectCost.intel
                }
                onClick={() =>
                  run(async () => {
                    setMissions({ available: true, ...(await api("/missions/beacon", {})) });
                    setNotice("Beacon upgraded. Your outpost record is saved.");
                    if (soundOn) playCue("finish");
                  })
                }
              >
                Build beacon
              </button>
            </section>
          </div>
          <section className="mission-passes" aria-label="Automation package roadmap">
            <div>
              <span className="eyebrow">Automation preview</span>
              <h2>Make time for the decisions that matter.</h2>
              <p>
                All five resources and specialists are free. Future passes would add capped queues,
                conditional orders and reports for the personal outpost only. Payment is not enabled; no pass
                grants ranked power.
              </p>
            </div>
            <div className="mission-pass-grid">
              <article>
                <strong>Free captain</strong>
                <span>AVAILABLE NOW</span>
                <p>One specialist at a time · three missions daily · full human tactical play.</p>
              </article>
              <article>
                <strong>Scout Pass</strong>
                <span>NOT FOR SALE</span>
                <p>Proposed: a short offline queue, a second specialist slot and return alerts.</p>
              </article>
              <article>
                <strong>Command Pass</strong>
                <span>NOT FOR SALE</span>
                <p>Proposed: conditional job plans, longer capped offline work and a decision report.</p>
              </article>
            </div>
          </section>
          <section className="mission-ledger">
            <div className="mission-ledger-head">
              <div>
                <span className="eyebrow">Step 3: read the runner's record</span>
                <h2>What happened out there.</h2>
              </div>
              <button onClick={() => run(loadMissions)}>Refresh record ↻</button>
            </div>
            {missions.missions.length === 0 ? (
              <p className="mission-empty">
                No missions yet. Choose a specialist and a route to begin your first outpost story.
              </p>
            ) : (
              missions.missions.map((m: any) => (
                <article className="mission-report" key={m.id}>
                  <div className="mission-report-top">
                    <div>
                      <span className="eyebrow">
                        {m.status === "active" ? "● Runner away" : "✓ Returned"},{" "}
                        {m.token_id ? `Agent #${m.token_id}` : "outpost runner"}, {m.role || "runner"}
                      </span>
                      <h3>
                        {
                          (
                            {
                              forest: "The greenwood",
                              quarry: "The stone ridge",
                              lookout: "The eastern lookout",
                              mine: "The iron hollow",
                              relay: "The signal ruins",
                            } as Record<string, string>
                          )[m.objective]
                        }
                      </h3>
                    </div>
                    <div className="mission-report-meta">
                      {m.status === "active"
                        ? `Next decision in ${Math.max(0, Math.ceil((m.next_at - clock) / 1000))}s`
                        : `+${m.gain_wood} wood · +${m.gain_stone} stone · +${m.gain_food} food · +${m.gain_ore} ore · +${m.gain_intel} intel`}
                    </div>
                  </div>
                  <div className="mission-events">
                    {m.events.length ? (
                      m.events.map((event: any) => (
                        <div key={event.seq} className={`mission-event ${event.kind}`}>
                          <span>0{event.seq}</span>
                          <p>{event.detail}</p>
                        </div>
                      ))
                    ) : (
                      <p>The runner is preparing to set out. The first decision will appear soon.</p>
                    )}
                  </div>
                  <footer>
                    <small>
                      {new Date(m.created).toLocaleString()} · {m.approach} · max {m.max_food} food · spent{" "}
                      {m.spent_food}
                    </small>
                    <button
                      onClick={() =>
                        run(async () => {
                          const proof = await api(`/missions/${m.id}/proof`);
                          setMissionProof((p) => ({ ...p, [m.id]: proof }));
                        })
                      }
                    >
                      Check record integrity ↗
                    </button>
                  </footer>
                  {missionProof[m.id] && (
                    <p className="mission-proof" role="status">
                      {missionProof[m.id].intact
                        ? "✓ Saved event hash chain matches"
                        : "⚠ Saved event hash chain does not match"}{" "}
                      · {missionProof[m.id].eventCount} events · {missionProof[m.id].scope}
                    </p>
                  )}
                </article>
              ))
            )}
          </section>
          <p className="mission-boundary">
            Mission resources and the beacon are saved in this game server and visible in the island’s Saved
            Outpost panel. The free specialists share the same daily quota. Ambient island gathering and
            stockpiles remain visual only. Mission receipts are server hash chains, not onchain proof; no
            independent fairness verification is claimed.
          </p>
        </>
      )}
    </main>
  );
}
