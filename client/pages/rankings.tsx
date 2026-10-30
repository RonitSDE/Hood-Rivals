import { useEffect } from "react";
import { shareRankings, downloadRankingsCard } from "../share";
import { navigate, usePageTitle, Link } from "../router";
import { useApp } from "../app/AppState";

export default function RankingsPage() {
  const { board, boot, busy, connect, loadBoard, openReplay, run, setNotice, setSetupLater, start } =
    useApp();
  usePageTitle("Rankings");
  useEffect(() => {
    run(loadBoard);
  }, []);
  return (
    <main className="content rankings-page" id="main-content">
      <div className="rankings-hero">
        <div>
          <div className="eyebrow">Ranked, live from the server</div>
          <h1>
            Every score
            <br />
            <em>has a story.</em>
          </h1>
          <p>
            A public board of completed equal-start matches. Follow any result to its replay and server
            hash-chain receipt.
          </p>
        </div>
        <div className="rankings-share-actions">
          <button
            disabled={board.loading || board.error}
            onClick={() => run(async () => setNotice(await shareRankings(board)))}
          >
            Share public board
          </button>
          <button
            disabled={board.loading || board.error}
            onClick={() =>
              run(async () => {
                await downloadRankingsCard(board);
                setNotice("PNG saved. Add the public rankings link to your post.");
              })
            }
          >
            Save social card
          </button>
          <small>Share link: {location.origin}/rankings</small>
        </div>
      </div>
      <div className="rankings-layout">
        <section className="panel rankings-main">
          <div className="rankings-teaser-head">
            <div>
              <span className="eyebrow">Seven-day standings</span>
              <h2>{board.loading || board.error ? "Ranked captains" : `${board.total} ranked captains`}</h2>
            </div>
            <button disabled={busy} onClick={() => run(loadBoard)}>
              Refresh
            </button>
          </div>
          {board.loading ? (
            <p>Loading standings…</p>
          ) : board.error ? (
            <p>Standings unavailable. Refresh to retry.</p>
          ) : board.entries.length ? (
            <>
              <div className="rankings-podium">
                {board.entries.slice(0, 3).map((p: any) => (
                  <article className={"rankings-tile rank-" + p.rank} key={p.rank}>
                    <span className="rankings-place">#{p.rank}</span>
                    <span className="rankings-pixel-tower" aria-hidden="true">
                      ▟▙
                    </span>
                    <h3>{p.name}</h3>
                    <strong>
                      {p.score} <small>renown</small>
                    </strong>
                    <time dateTime={new Date(p.created).toISOString()}>
                      {new Date(p.created).toLocaleDateString(undefined, {
                        day: "numeric",
                        month: "short",
                        timeZone: "UTC",
                      })}{" "}
                      UTC
                    </time>
                    <Link to={"/replay/" + encodeURIComponent(p.matchId)}>Open match replay</Link>
                  </article>
                ))}
              </div>
              <div className="rankings-list">
                {board.entries.slice(3).map((p: any) => (
                  <div className="rankings-line" key={p.rank}>
                    <span className="rankings-number">#{p.rank}</span>
                    <b>{p.name}</b>
                    <span>{p.score} Renown</span>
                    <time dateTime={new Date(p.created).toISOString()}>
                      {new Date(p.created).toLocaleDateString(undefined, {
                        day: "numeric",
                        month: "short",
                        timeZone: "UTC",
                      })}{" "}
                      UTC
                    </time>
                    <Link to={"/replay/" + encodeURIComponent(p.matchId)}>Replay</Link>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="rankings-empty">
              <b>The board is waiting for its first captain.</b>
              <p>Finish a ranked match to set the opening score.</p>
            </div>
          )}
          {!board.loading && !board.error && board.me && (
            <p className="rankings-me">
              Your place: #{board.me.rank} · {board.me.score} Renown · {board.me.attempts} attempt
              {board.me.attempts === 1 ? "" : "s"}{" "}
              <Link to={"/replay/" + encodeURIComponent(board.me.matchId)}>Open your best match</Link>
            </p>
          )}
          <p className="rankings-proof">
            Server-recorded standings. Replays check a server hash chain; neither the scores nor receipts are
            independently verified or onchain. No cash or token rewards.
          </p>
        </section>
        <aside className="rankings-aside">
          <section className="panel">
            <h2>Daily equal-start challenge</h2>
            <p>
              Same map seed. Same faction and stance. Neutral market costs. One ranked attempt per linked
              wallet each UTC day. Best score in the last seven days ranks.
            </p>
            <button
              className="primary"
              disabled={busy}
              onClick={() =>
                !boot.profile.wallet
                  ? run(connect)
                  : !boot.profile.onboarded
                    ? (navigate("/"), setSetupLater(false))
                    : start("weekly")
              }
            >
              {!boot.profile.wallet
                ? "Link wallet for ranked"
                : !boot.profile.onboarded
                  ? "Create your captain"
                  : "Begin today’s attempt"}
            </button>
            <p className="hint">No cash or token rewards. Wallet limits are not proof of unique humans.</p>
          </section>
          <section className="panel">
            <h2>Your field archive</h2>
            {boot.history.length ? (
              boot.history.map((h: any) => (
                <div className="leader row" key={h.id}>
                  <span>
                    {h.mode} · {h.status}
                    <small>{new Date(h.created).toLocaleDateString()}</small>
                  </span>
                  <button
                    onClick={() =>
                      h.status === "finished"
                        ? openReplay(h.id)
                        : navigate("/play?match=" + encodeURIComponent(h.id))
                    }
                  >
                    {h.status === "finished" ? "Replay" : "Resume"}
                  </button>
                </div>
              ))
            ) : (
              <p>Your finished games will appear here.</p>
            )}
          </section>
        </aside>
      </div>
    </main>
  );
}
