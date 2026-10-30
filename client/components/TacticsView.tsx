import { FACTIONS, cost, validateOrder } from "../../shared/game";
import { matchRecap, trainingMove } from "../../shared/experience";
import { downloadBattleCard } from "../share";
import { World } from "../components/TacticalWorld";
import { AgentPortrait } from "../components/Portraits";
import { preview } from "../lib/constants";
import { navigate } from "../router";
import { api } from "../lib/api";
import { useApp } from "../app/AppState";

/** The tactical board, shared by /play (live match) and /replay/:id (step-through replay). */
export function TacticsView({ isReplay = false }: { isReplay?: boolean }) {
  const {
    agent,
    boot,
    busy,
    changeControl,
    clock,
    game,
    guideHidden,
    leave,
    match,
    openReplay,
    order,
    replay,
    room,
    run,
    selected,
    setGame,
    setGuideHidden,
    setMatch,
    setNotice,
    setOrder,
    setProfile,
    setRoom,
    setSelected,
    setShowHelp,
    setStep,
    share,
    start,
    step,
  } = useApp();
  const self = game?.factions?.[game.you],
    showGame = !isReplay && game,
    shown = isReplay && replay ? { ...replay.snapshots[step]?.state, you: 0 } : showGame ? game : preview;
  const chosenTile = shown.tiles?.find((t: any) => t.id === selected);
  const legalTargets =
    game?.status === "active" && ["scout", "contest"].includes(order.type)
      ? game.tiles
          .filter((t: any) => !validateOrder(game, game.you, { ...order, target: t.id }))
          .map((t: any) => t.id)
      : [];
  const availableAction =
    game?.status === "active" && selected
      ? !validateOrder(game, game.you, { type: "contest", target: selected })
        ? "contest"
        : !validateOrder(game, game.you, { type: "scout", target: selected })
          ? "scout"
          : null
      : null;
  const selectHex = (id: string) => {
    setSelected(id);
    if (game?.status !== "active" || game.submitted) return;
    if (["scout", "contest"].includes(order.type) && !validateOrder(game, game.you, { ...order, target: id }))
      return;
    if (!validateOrder(game, game.you, { type: "contest", target: id })) setOrder({ type: "contest" });
    else if (!validateOrder(game, game.you, { type: "scout", target: id })) setOrder({ type: "scout" });
  };
  const plannedOrder = { ...order, target: selected || undefined };
  const orderIssue = game?.status === "active" ? validateOrder(game, game.you, plannedOrder) : null;
  const orderCost = game?.status === "active" ? cost(game, game.you, plannedOrder) : 0;
  const recap = game?.status === "finished" ? matchRecap(game.events, game.you) : null;
  const guide = game?.status === "active" && game.mode === "training" ? trainingMove(game, game.you) : null;
  return (
    <main id="main-content" className={"frontier " + (showGame ? "in-match" : "")}>
      {room && !showGame && !isReplay && (
        <section className="invite-banner">
          <div>
            <span className="eyebrow">A rival is waiting</span>
            <h2>Join room {room}</h2>
            <p>Choose your orders together. Your wallet is optional.</p>
          </div>
          <button
            className="primary"
            disabled={busy}
            onClick={() =>
              run(async () => {
                const r = await api("/rooms/join", { code: room });
                setMatch(r.id);
                setGame(await api("/matches/" + r.id));
                setRoom("");
              })
            }
          >
            Join this frontier
          </button>
        </section>
      )}
      <div className="hero-copy">
        {showGame ? (
          <>
            <div className="eyebrow">
              {game.mode === "training"
                ? "Guided practice"
                : game.mode === "weekly"
                  ? "Daily ranked challenge"
                  : "Live frontier"}
              , room {game.code}
            </div>
            <h1>
              {game.status === "lobby"
                ? "Gather your rivals."
                : game.status === "finished"
                  ? game.winner === -1
                    ? "A divided frontier."
                    : game.winner === game.you
                      ? "The frontier is yours."
                      : "A rival takes the frontier."
                  : "Every order leaves a mark."}
            </h1>
            <p>
              {game.status === "lobby"
                ? "Share your room code. The host can start with up to three players; empty seats become agents."
                : game.status === "finished"
                  ? "The match is complete. Your captain carries this history into the next encounter."
                  : game.mode === "training"
                    ? "Take your time. Follow the field guide, then choose your own orders."
                    : "Commit one order. Rivals plan at the same time. Unsubmitted orders hold when the timer expires."}
            </p>
          </>
        ) : isReplay ? (
          <>
            <div className="eyebrow">The war archive</div>
            <h1>Every rivalry has a history.</h1>
            <p>
              {replay?.verified
                ? "Replay hash chain checks out."
                : "Replay integrity has not been established."}{" "}
              Server receipts, not onchain gameplay verification.
            </p>
          </>
        ) : (
          <>
            <div className="eyebrow">A six-round strategy game</div>
            <h1>
              A small world.
              <br />A long <em>memory.</em>
            </h1>
            <p>
              Lead a captain. Scout the unknown. Make a pact—or break one. Three rivals. One frontier. Every
              decision matters.
            </p>
            <div className="hero-buttons">
              <button className="primary" disabled={busy} onClick={() => start("solo")}>
                Enter the frontier <span>↗</span>
              </button>
              {agent?.linked && (
                <button className="secondary" disabled={busy} onClick={() => start("solo", "agent")}>
                  Agent plays solo ↗
                </button>
              )}
              <button className="secondary" onClick={() => start("room")}>
                Play with friends
              </button>
            </div>
            <div className="micro">
              No wallet needed <span>·</span> six rounds <span>·</span> three factions
            </div>
          </>
        )}
        {showGame && game.status === "lobby" && (
          <section className="panel">
            <h3>Room {game.code}</h3>
            {game.players.map((p: any) => (
              <p key={p.slot}>◈ {p.name}</p>
            ))}
            <button
              onClick={() => {
                navigator.clipboard?.writeText(location.origin + "/?room=" + game.code);
                setNotice("Room link copied.");
              }}
            >
              Copy invite
            </button>
            {game.host && (
              <button className="text-button" disabled={busy} onClick={leave}>
                Close room
              </button>
            )}
            {game.host && (
              <button
                className="primary"
                onClick={() =>
                  run(async () => {
                    await api("/matches/" + match + "/start", {});
                    setGame(await api("/matches/" + match));
                  })
                }
              >
                Start match
              </button>
            )}
          </section>
        )}
        {showGame && game.status === "active" && (
          <section className="order-card">
            {guide && !guideHidden && (
              <div className="training-guide" role="region" aria-label="Practice guidance">
                <div className="row">
                  <span className="eyebrow">Field guide, round {game.round}</span>
                  <button
                    className="text-button"
                    onClick={() => setGuideHidden(true)}
                    aria-label="Hide guidance"
                  >
                    ×
                  </button>
                </div>
                <h3>{guide.title}</h3>
                <p>{guide.detail}</p>
                <button
                  disabled={busy || game.submitted}
                  onClick={() => {
                    setOrder(guide.order);
                    setSelected(guide.order.target || "");
                  }}
                >
                  Highlight suggested order ↗
                </button>
                <small>Practice has no timer, XP or ranked score.</small>
              </div>
            )}
            <div className="match-objective">
              <b>Hold banners. Earn Renown.</b>
              <button className="text-button" onClick={() => setShowHelp(true)}>
                Rules ?
              </button>
            </div>
            <div className="row">
              <b>Round {game.round} of 6</b>
              <span className="timer">
                {game.mode === "training"
                  ? "Your pace"
                  : `${Math.max(0, Math.ceil((game.deadline - clock) / 1000))}s`}
              </span>
            </div>
            <div className="stats">
              <span>
                <b>{self.supplies}</b>Supply
              </span>
              <span>
                <b>{self.hp}/4</b>Squad
              </span>
              <span>
                <b>{self.score}</b>Renown
              </span>
            </div>
            {game.mode === "solo" && (
              <div className="control-switch">
                <b>
                  {game.control === "agent"
                    ? `Agent mode: Agent #${game.agentTokenId} is playing`
                    : "Human mode: you control this captain"}
                </b>
                <button
                  disabled={busy || game.submitted || (game.control === "human" && !agent?.linked)}
                  onClick={() => run(() => changeControl(game.control === "agent" ? "human" : "agent"))}
                >
                  {game.control === "agent" ? "Take Human control" : "Delegate to my Agent ID"}
                </button>
              </div>
            )}
            {game.control === "agent" && (
              <div className="agent-turn" role="status">
                <AgentPortrait look={agent?.look || [0, 0, 0]} />
                <div>
                  <h3>Watching your agent think.</h3>
                  <p>
                    {game.lastAgentOrder
                      ? `Last choice: ${game.lastAgentOrder.type}${game.lastAgentOrder.target ? " at " + game.lastAgentOrder.target : ""}.`
                      : "It is reading the frontier and preparing its first move."}{" "}
                    Its {agent?.style || "balanced"} style and remembered rival relationships shape legal solo
                    orders.
                  </p>
                  <small>
                    Next decision in {Math.max(0, Math.ceil((game.deadline - clock) / 1000))}s · No wallet
                    signature or spending is delegated.
                  </small>
                </div>
              </div>
            )}
            <div hidden={game.control === "agent"}>
              <div className="order-types">
                {["scout", "contest", "develop", "pact", "hold"].map((type) => (
                  <button
                    key={type}
                    className={order.type === type ? "selected" : ""}
                    onClick={() => {
                      setSelected("");
                      setOrder({
                        type: type as any,
                        upgrade: "income",
                        partner: (game.you + 1) % 3,
                      });
                    }}
                  >
                    <span aria-hidden="true">
                      {{ scout: "◇", contest: "⚑", develop: "▣", pact: "↔", hold: "·" }[type]}
                    </span>{" "}
                    {type}
                  </button>
                ))}
              </div>
              <p className="hint">
                {order.type === "scout"
                  ? "Reveal terrain within two hexes. Scouting does not capture."
                  : order.type === "contest"
                    ? "Capture an explored hex within two steps. Squads clash if they meet."
                    : order.type === "develop"
                      ? "Improve supply income, fortifications or squad health."
                      : order.type === "pact"
                        ? "Both captains must offer a pact to each other this round to receive the reward."
                        : "Spend nothing. Hold your current ground."}
              </p>
              {["scout", "contest"].includes(order.type) && (
                <label>
                  Destination
                  <select value={selected} onChange={(e) => setSelected(e.target.value)}>
                    <option value="">Choose a hex on the map</option>
                    {game.tiles
                      .filter((t: any) => legalTargets.includes(t.id))
                      .map((t: any) => (
                        <option key={t.id} value={t.id}>
                          {t.id} ·{" "}
                          {t.kind === "flag" ? "banner" : t.kind === "cache" ? "supply post" : t.kind}
                        </option>
                      ))}
                  </select>
                </label>
              )}
              {order.type === "develop" && (
                <select
                  value={order.upgrade}
                  onChange={(e) => setOrder({ ...order, upgrade: e.target.value as any })}
                >
                  <option value="income">Supply income +1 (cap +2)</option>
                  <option value="fortify">Fortification +1</option>
                  <option value="heal">Restore 2 squad strength</option>
                </select>
              )}
              {order.type === "pact" && (
                <select
                  value={order.partner}
                  onChange={(e) => setOrder({ ...order, partner: Number(e.target.value) })}
                >
                  {game.factions
                    .filter((f: any) => f.id !== game.you)
                    .map((f: any) => (
                      <option key={f.id} value={f.id}>
                        {f.captain}
                      </option>
                    ))}
                </select>
              )}
              <p className="hint">
                Cost: <b>{orderCost} Supply</b> · {orderIssue || "Order is valid. Ready to commit."}
              </p>
              <button
                disabled={busy || game.submitted || !!orderIssue}
                className="primary full"
                onClick={() =>
                  run(async () => {
                    await api("/matches/" + match + "/orders", {
                      round: game.round,
                      order: { ...order, target: selected || undefined },
                    });
                    setGame(await api("/matches/" + match));
                    setSelected("");
                  })
                }
              >
                {game.submitted ? "Order sealed · waiting for rivals" : "Seal this order"}
              </button>
              <button
                className="text-button"
                disabled={busy || game.submitted}
                onClick={() =>
                  run(async () => {
                    await api("/matches/" + match + "/orders", {
                      round: game.round,
                      order: { type: "hold" },
                    });
                    setGame(await api("/matches/" + match));
                  })
                }
              >
                Hold this round
              </button>
            </div>
            {game.mode === "training" && (
              <button className="text-button" disabled={busy} onClick={leave}>
                Leave practice
              </button>
            )}
            {game.round > 1 && (
              <div className="round-receipt">
                <span className="eyebrow">Last round</span>
                {game.events
                  .filter((e: any) => e.round === game.round - 1 && e.actors.includes(game.you))
                  .slice(-2)
                  .map((e: any, i: number) => (
                    <p key={i}>{e.text}</p>
                  ))}
              </div>
            )}
          </section>
        )}
        {showGame && game.status === "finished" && recap && (
          <section className="panel battle-recap">
            <span className="eyebrow">
              {game.mode === "training" ? "Practice complete" : "Your battle report"}
            </span>
            <div className="stats">
              {game.factions.map((f: any) => (
                <span key={f.id}>
                  <b>{f.score}</b>
                  {f.captain}
                </span>
              ))}
            </div>
            <div className="decisive-moment">
              <small>
                {recap.moment
                  ? `ROUND ${recap.moment.round} / ${recap.moment.kind.toUpperCase()}`
                  : "Your frontier"}
              </small>
              <h3>{recap.moment?.text || "Six rounds written into the archive."}</h3>
            </div>
            <p>
              {recap.captures} captures · {recap.clashes} clashes · {recap.pacts} mutual pacts
            </p>
            <p className="hint">
              {game.mode === "training"
                ? "Ready for the frontier? Practice does not award XP or change your saved rival memory."
                : game.mode === "weekly"
                  ? "Ranked play starts equal. Your result is recorded on the daily challenge."
                  : "Your captain’s faction relationships carry into unranked matches."}
            </p>
            <div className="result-actions">
              <button className="primary" disabled={busy} onClick={() => start("solo")}>
                {game.mode === "training" ? "Play your first match" : "Run it back"}
              </button>
              {agent?.linked && (
                <button disabled={busy} onClick={() => start("solo", "agent")}>
                  Let Agent #{agent.tokenId} play
                </button>
              )}
              <button disabled={busy} onClick={() => start("room")}>
                Invite a rival
              </button>
              <button disabled={busy} onClick={share}>
                Share this battle ↗
              </button>
              <button
                onClick={() =>
                  run(() => downloadBattleCard(game, recap.moment?.text || "Six rounds. Three rivals."))
                }
              >
                Save battle card
              </button>
              <button onClick={() => openReplay(game.id)}>Watch replay</button>
            </div>
          </section>
        )}
        {isReplay && replay && (
          <section className="panel">
            <label>
              Round {replay.snapshots[step]?.round}
              <input
                type="range"
                min="0"
                max={replay.snapshots.length - 1}
                value={step}
                onChange={(e) => setStep(Number(e.target.value))}
              />
            </label>
            <p className="hash">SHA-256 {replay.digest}</p>
            <button
              onClick={() => {
                const blob = new Blob([JSON.stringify(replay, null, 2)], {
                  type: "application/json",
                });
                const url = URL.createObjectURL(blob),
                  a = document.createElement("a");
                a.href = url;
                a.download = "hood-rivals-replay.json";
                a.click();
                URL.revokeObjectURL(url);
              }}
            >
              Download receipts
            </button>
            <button
              onClick={() => {
                setGame(null);
                setMatch("");
                navigate("/play");
              }}
            >
              Play your own frontier
            </button>
          </section>
        )}
      </div>
      <div className="map-wrap">
        <div className="map-heading">
          <h2>The first frontier</h2>
          <span>{showGame ? `Round ${game.round} of 6` : "37 hexes, three rivals"}</span>
        </div>
        <World
          game={shown}
          cosmetic={boot.profile.skin}
          selected={selected}
          reachable={legalTargets}
          onSelect={selectHex}
        />
        {chosenTile && (
          <div className="tile-intel" role="status">
            <div className="tile-intel-top">
              <span>HEX {selected}</span>
              <button aria-label="Clear selected hex" onClick={() => setSelected("")}>
                ×
              </button>
            </div>
            <h3>
              {chosenTile.kind === "flag"
                ? "Banner point"
                : chosenTile.kind === "cache"
                  ? "Supply post"
                  : chosenTile.kind === "base"
                    ? "Home outpost"
                    : chosenTile.kind === "fog"
                      ? "Uncharted terrain"
                      : chosenTile.kind === "forest"
                        ? "Forest passage"
                        : chosenTile.kind === "rock"
                          ? "Stone ridge"
                          : "Open ground"}
            </h3>
            <p>
              {chosenTile.kind === "flag"
                ? "Held banners score each round."
                : chosenTile.kind === "cache"
                  ? "Captured posts add Supply each round."
                  : chosenTile.kind === "fog"
                    ? "Scout this hex to reveal its ground."
                    : chosenTile.kind === "base"
                      ? "Home outposts cannot be captured."
                      : "Terrain can be contested after it is explored."}
            </p>
            {chosenTile.owner >= 0 && (
              <span
                className="owner-chip"
                style={{
                  borderColor: FACTIONS[chosenTile.owner].color,
                  color: FACTIONS[chosenTile.owner].color,
                }}
              >
                ◆ {FACTIONS[chosenTile.owner].name}
              </span>
            )}
            {game?.status === "active" && (
              <div className="tile-intel-action">
                {availableAction
                  ? `Available: ${availableAction} · ${cost(game, game.you, { type: availableAction, target: selected })} Supply`
                  : "Inspect only · no legal move this round"}
              </div>
            )}
          </div>
        )}
        <div className="map-caption">
          <span>Scout, develop, contest.</span>
          <span>
            {showGame ? "Tap a glowing hex to plan your order" : "Drag to move, select a hex to inspect"}
          </span>
        </div>
        {showGame && (
          <div className="rival-strip">
            {game.factions.map((f: any) => (
              <div key={f.id}>
                <i style={{ background: FACTIONS[f.id].color }} />
                <b>{f.captain}</b>
                <span>{f.score} renown</span>
              </div>
            ))}
          </div>
        )}
      </div>
      <div className="frontier-bottom">
        <section className="weather">
          <span className="eyebrow">
            {(showGame ? game.market : boot.market).status === "live"
              ? "Today's frontier conditions"
              : "Frontier conditions"}
          </span>
          <h3>{(showGame ? game.market : boot.market).label}</h3>
          <p>{(showGame ? game.market : boot.market).detail}</p>
          <small className="hint">
            Captured {new Date((showGame ? game.market : boot.market).timestamp).toLocaleString()}
          </small>
        </section>
        {showGame ? (
          <section className="journal">
            <div className="eyebrow">Field notes</div>
            {game.events.slice(-4).map((e: any, i: number) => (
              <p key={i}>
                <span>R{e.round}</span> {e.text}
              </p>
            ))}
            {!game.events.length && <p>Your story starts with the first order.</p>}
          </section>
        ) : (
          <section className="join">
            <div className="eyebrow">Got a room code from a rival?</div>
            <div className="row">
              <input
                aria-label="Room code"
                placeholder="Room code"
                maxLength={8}
                value={room}
                onChange={(e) => setRoom(e.target.value.toUpperCase())}
              />
              <button
                disabled={busy || !room}
                onClick={() =>
                  run(async () => {
                    const r = await api("/rooms/join", { code: room });
                    setMatch(r.id);
                  })
                }
              >
                Join
              </button>
            </div>
          </section>
        )}
      </div>
      {!showGame && !isReplay && (
        <div className="factions">
          {FACTIONS.map((f, i) => (
            <button
              className={"faction " + (boot.profile.faction === i ? "chosen" : "")}
              key={f.name}
              onClick={() => {
                navigate("/captain");
                setProfile({ ...boot.profile, faction: i });
              }}
            >
              <span className="faction-symbol" style={{ color: f.color }}>
                {f.symbol}
              </span>
              <div>
                <small>Faction</small>
                <h3>{f.name}</h3>
                <p>{f.tag}</p>
              </div>
              <span>↗</span>
            </button>
          ))}
        </div>
      )}
    </main>
  );
}
