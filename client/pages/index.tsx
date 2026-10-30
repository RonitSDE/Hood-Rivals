import { useEffect, useRef } from "react";
import { FACTIONS } from "../../shared/game";
import { CaptainPortrait } from "../components/Portraits";
import { Link, navigate, usePageTitle, useLocation } from "../router";
import { api } from "../lib/api";
import { useApp } from "../app/AppState";

export default function IndexPage() {
  const {
    agent,
    board,
    boot,
    busy,
    loadMissions,
    missions,
    openReplay,
    setBusy,
    setError,
    setGuideStep,
    setMissions,
    setNotice,
    setSetupLater,
    setShowGuide,
    setupLater,
    start,
  } = useApp();
  usePageTitle(undefined);
  const livingFrame = useRef<HTMLIFrameElement>(null);
  const worldActionInFlight = useRef(false);
  const { searchParams } = useLocation();
  const syncLivingCaptain = (p = boot?.profile) => {
    if (!p?.wallet || !p?.onboarded) {
      livingFrame.current?.contentWindow?.postMessage({ type: "OUTPOST_CLEAR_CAPTAIN" }, location.origin);
      return;
    }
    livingFrame.current?.contentWindow?.postMessage(
      {
        type: "OUTPOST_CAPTAIN",
        name: p.name,
        faction: p.faction,
        agentId: agent?.linked ? agent.tokenId : null,
        agentLook: agent?.linked ? agent.look : null,
      },
      location.origin,
    );
  };
  const syncLivingMissions = (board = missions) => {
    const payload = board?.available
      ? {
          available: true,
          store: board.store,
          projectCost: board.projectCost,
          remaining: board.remaining,
          active: board.missions?.find((m: any) => m.id === board.activeId) || null,
        }
      : { available: false, reason: board?.reason || "Checking your saved outpost…" };
    livingFrame.current?.contentWindow?.postMessage(
      { type: "OUTPOST_MISSIONS", board: payload },
      location.origin,
    );
  };
  useEffect(() => {
    syncLivingMissions();
  }, [missions]);
  useEffect(() => {
    if (boot?.profile?.wallet && boot.profile.onboarded) loadMissions().catch(() => setMissions(null));
  }, [boot?.profile?.wallet, boot?.profile?.onboarded]);
  useEffect(() => {
    syncLivingCaptain();
  }, [
    boot?.profile?.wallet,
    boot?.profile?.onboarded,
    boot?.profile?.name,
    boot?.profile?.faction,
    agent?.linked,
    agent?.tokenId,
    agent?.look?.join(","),
  ]);
  useEffect(() => {
    const onWorldAction = async (e: MessageEvent) => {
      if (
        e.origin !== location.origin ||
        e.source !== livingFrame.current?.contentWindow ||
        e.data?.type !== "OUTPOST_WORLD_ACTION"
      )
        return;
      if (e.data.action === "open") {
        navigate("/missions");
        loadMissions().catch(() => {});
        return;
      }
      const roles: Record<string, string> = {
        forest: "quartermaster",
        quarry: "engineer",
        lookout: "quartermaster",
        mine: "engineer",
        relay: "scout",
      };
      if (
        e.data.action !== "beacon" &&
        (e.data.action !== "mission" || !Object.hasOwn(roles, e.data.objective))
      )
        return;
      if (worldActionInFlight.current) return;
      worldActionInFlight.current = true;
      setBusy(true);
      setError("");
      let message = "";
      try {
        if (e.data.action === "beacon") {
          setMissions({ available: true, ...(await api("/missions/beacon", {})) });
          message = "Beacon built and saved. Your new routes are ready.";
        } else {
          const objective = e.data.objective as string;
          const result = await api("/missions", {
            objective,
            role: roles[objective],
            approach: "careful",
            maxFoodSpend: 0,
          });
          setMissions({ available: true, ...result.board });
          message = "Specialist sent. The saved report will update as they travel.";
        }
        setNotice(message);
      } catch (err: any) {
        message = err.message || "Could not update the outpost.";
        setError(message);
        loadMissions().catch(() => {});
      } finally {
        worldActionInFlight.current = false;
        setBusy(false);
        livingFrame.current?.contentWindow?.postMessage(
          { type: "OUTPOST_MISSION_RESULT", message },
          location.origin,
        );
      }
    };
    window.addEventListener("message", onWorldAction);
    return () => window.removeEventListener("message", onWorldAction);
  }, []);
  const focusCaptain = () => {
    if (searchParams.get("focus") === "captain")
      livingFrame.current?.contentWindow?.postMessage({ type: "OUTPOST_FOCUS_CAPTAIN" }, location.origin);
  };
  return (
    <main id="main-content" className="living-shell">
      <section className="living-intro">
        <div>
          <div className="eyebrow">Season 00 · The first frontier</div>
          <h1>
            Your frontier.
            <br /> <em>A story in every pixel.</em>
          </h1>
          <p>
            Meet captains with loyalties, grudges and a plan. Then lead your own through six rounds of
            territory, tactics and betrayal.
          </p>
        </div>
        <div className="living-actions">
          <button
            className="primary"
            disabled={busy}
            onClick={() => start(boot.profile.played === 0 ? "training" : "solo")}
          >
            {boot.profile.played === 0 ? "Guided Human practice" : "Play as Human"}
          </button>
          {agent?.linked && (
            <button disabled={busy} onClick={() => start("solo", "agent")}>
              Watch Agent #{agent.tokenId} play
            </button>
          )}
          <button disabled={busy} onClick={() => start("room")}>
            Challenge a friend
          </button>
          <small>No wallet needed · Free to play · Three rival factions</small>
        </div>
      </section>
      <div className="world-section-heading">
        <div>
          <span className="eyebrow">The living island</span>
          <h2>Everyone has a reason.</h2>
        </div>
        <span className="simulation-chip">Local simulation · 15 agents</span>
      </div>
      <div className="living-frame">
        <iframe
          ref={livingFrame}
          title="Hood Rivals living isometric world"
          src="/observatory.html?embedded=1"
          onLoad={() => {
            syncLivingCaptain();
            syncLivingMissions();
            focusCaptain();
            livingFrame.current?.contentWindow?.postMessage(
              { type: "OUTPOST_VISIBILITY", visible: true },
              location.origin,
            );
          }}
        />
      </div>
      {missions?.available && (
        <div className="saved-outpost-bar">
          <strong>Saved outpost</strong>
          <span>▥ {missions.store.wood} wood</span>
          <span>◆ {missions.store.stone} stone</span>
          <span>◈ {missions.store.food} food</span>
          <span>⬡ {missions.store.ore} ore</span>
          <span>⌁ {missions.store.intel} intel</span>
          <button
            onClick={() => {
              navigate("/missions");
              loadMissions().catch(() => {});
            }}
          >
            Assign a specialist
          </button>
        </div>
      )}
      <p className="living-caption">
        The Saved Outpost panel and beacon inside the island reflect your server record; its specialist orders
        spend and earn real saved mission materials. The other 15 roaming agents, their PX and local
        stockpiles are a visual simulation that resets on refresh. They are not online players or transferable
        rewards.
      </p>
      {boot.profile.wallet && boot.profile.onboarded && (
        <section className="captain-pass" aria-label="Saved captain account">
          <div className="captain-pass-identity">
            <CaptainPortrait faction={boot.profile.faction} />
            <span className="captain-pass-sigil" style={{ color: FACTIONS[boot.profile.faction].color }}>
              {FACTIONS[boot.profile.faction].symbol}
            </span>
            <div>
              <small>Wallet-linked captain</small>
              <h2>{boot.profile.name}</h2>
              <span>
                {FACTIONS[boot.profile.faction].name} · {boot.profile.stance} stance
              </span>
            </div>
          </div>
          <div className="captain-pass-stats" aria-label="Persisted tactical record">
            <span>
              <b>{boot.profile.played}</b>
              <small>Matches</small>
            </span>
            <span>
              <b>{boot.profile.wins}</b>
              <small>Wins</small>
            </span>
            <span>
              <b>{boot.profile.xp}</b>
              <small>XP</small>
            </span>
            <span>
              <b>{boot.inventory.length}</b>
              <small>Cosmetics</small>
            </span>
          </div>
          <div className="captain-pass-actions">
            {boot.history.some((h: any) => ["active", "lobby"].includes(h.status)) ? (
              <button
                className="primary"
                onClick={() =>
                  navigate(
                    "/play?match=" +
                      encodeURIComponent(
                        boot.history.find((h: any) => ["active", "lobby"].includes(h.status)).id,
                      ),
                  )
                }
              >
                Resume match
              </button>
            ) : (
              <button className="primary" disabled={busy} onClick={() => start("solo")}>
                Play a match
              </button>
            )}
            <button disabled={busy} onClick={() => start("weekly")}>
              Daily challenge
            </button>
            {agent?.linked && (
              <button disabled={busy} onClick={() => start("solo", "agent")}>
                Agent solo
              </button>
            )}
          </div>
          <p>These stats are saved by the game server. The island below runs locally in this browser.</p>
        </section>
      )}
      <div className="home-board">
        <section className="mission-teaser" aria-label="Agent missions">
          <div>
            <span className="eyebrow">Agent missions</span>
            <h2>Give your agent a mission.</h2>
            <p>
              Set an objective and a spending limit. The runner acts on the server clock; return to see each
              choice and what came home.
            </p>
          </div>
          <div className="mission-teaser-action">
            <span>
              {missions?.activeId
                ? "Mission in progress"
                : missions?.available
                  ? `${missions.remaining} missions left today`
                  : "Log in to send a runner"}
            </span>
            <button className="primary" onClick={() => navigate("/missions")}>
              {missions?.activeId ? "Follow the mission" : "Open mission control"}
            </button>
          </div>
        </section>
        <section className="rankings-teaser" aria-label="Seven-day ranked leaderboard">
          <div className="rankings-teaser-head">
            <div>
              <span className="eyebrow">Daily challenge, last 7 days</span>
              <h2>Rivals at the top.</h2>
            </div>
            <Link className="button" to="/rankings">
              Full standings
            </Link>
          </div>
          {board.loading ? (
            <p>Loading standings…</p>
          ) : board.error ? (
            <p>Standings unavailable. Try again from Rankings.</p>
          ) : board.entries.length ? (
            <div className="rankings-teaser-list">
              {board.entries.slice(0, 3).map((p: any) => (
                <div className="leader row" key={p.rank}>
                  <span>
                    <b>#{p.rank}</b> {p.name}
                  </span>
                  <strong>{p.score} renown</strong>
                  <Link to={"/replay/" + encodeURIComponent(p.matchId)}>Replay</Link>
                </div>
              ))}
            </div>
          ) : (
            <p>No completed ranked matches yet. Be the first captain on the board.</p>
          )}
          {!board.loading && !board.error && (
            <div className="rankings-teaser-foot">
              <small>{board.total} ranked captains · Best completed score counts · No token rewards</small>
              {board.me && (
                <span>
                  Your place: #{board.me.rank} · {board.me.score} renown
                </span>
              )}
            </div>
          )}
        </section>
        {boot.profile.wallet && !boot.profile.onboarded && setupLater && (
          <div className="invite-banner">
            <span>Your wallet is linked. Give your captain an identity.</span>
            <button onClick={() => setSetupLater(false)}>Finish captain setup</button>
          </div>
        )}
        <section className="campaign-journal" aria-label="Saved campaign journal">
          <div className="campaign-title">
            <div>
              <span className="eyebrow">Your campaign</span>
              <h2>A frontier that remembers.</h2>
            </div>
            <button disabled={busy} onClick={() => start("solo")}>
              {boot.campaign?.length ? "Start the next chapter" : "Begin your story"}
            </button>
          </div>
          <p>
            Six rounds leave a record. Revisit your turning points, then face the factions that remember your
            choices.
          </p>
          <div className="campaign-rivals">
            {Object.entries(boot.profile.rivalMemory || {})
              .filter(([id]) => Number(id) !== boot.profile.faction)
              .map(([id, value]) => (
                <span key={id} style={{ borderColor: FACTIONS[Number(id)]?.color }}>
                  <b>{FACTIONS[Number(id)]?.name}</b> ·{" "}
                  {Number(value) < 0
                    ? "Holds a grudge"
                    : Number(value) > 0
                      ? "Remembers your alliance"
                      : "Neutral"}{" "}
                  ({Number(value)})
                </span>
              ))}
          </div>
          {boot.campaign?.length ? (
            <div className="campaign-entries">
              {boot.campaign.map((entry: any) => (
                <article key={entry.match_id}>
                  <span className="eyebrow">
                    {entry.won ? "Victory" : "Expedition"}, {entry.score} renown
                  </span>
                  <h3>{entry.moment}</h3>
                  <time dateTime={new Date(entry.created).toISOString()}>
                    {new Date(entry.created).toLocaleDateString()}
                  </time>
                  <button onClick={() => openReplay(entry.match_id)}>Watch the real replay</button>
                </article>
              ))}
            </div>
          ) : (
            <div className="campaign-empty">
              Your journal is empty. Complete a solo, friend or ranked match to save its turning point.
              Practice earns no campaign entry.
            </div>
          )}
        </section>
        <section className="resource-trail" aria-label="How resources work">
          <div>
            <span className="eyebrow">The outpost loop</span>
            <h2>Assign. Gather. Build.</h2>
            <p>
              Open Saved Outpost inside the island. Send a specialist, collect server-saved materials and
              build your beacon. Ambient agents harvest visually, but cannot credit your store.
            </p>
          </div>
          <div className="resource-trail-items">
            <span>
              <b>▥</b> Wood <small>mission: forest</small>
            </span>
            <span>
              <b>◆</b> Stone <small>mission: quarry</small>
            </span>
            <span>
              <b>◈</b> Food <small>mission: lookout</small>
            </span>
          </div>
          <button
            onClick={() => {
              setGuideStep(1);
              setShowGuide(true);
            }}
          >
            Learn the loop
          </button>
        </section>
      </div>
    </main>
  );
}
