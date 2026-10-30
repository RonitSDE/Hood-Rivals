import { useEffect } from "react";
import { FACTIONS } from "../../shared/game";
import { CaptainPortrait, AgentPortrait } from "../components/Portraits";
import { Link, usePageTitle } from "../router";
import { api } from "../lib/api";
import { useApp } from "../app/AppState";

export default function CaptainPage() {
  const {
    agent,
    boot,
    busy,
    connect,
    customizeAgent,
    loadAgent,
    lookChoice,
    mintAgent,
    profile,
    refresh,
    run,
    setLookChoice,
    setNotice,
    setProfile,
    start,
  } = useApp();
  usePageTitle("My captain");
  useEffect(() => {
    run(refresh);
  }, []);
  return (
    <main id="main-content" className="content">
      <div className="eyebrow">My captain</div>
      <h1>A captain with history.</h1>
      <section className="passport">
        <CaptainPortrait faction={profile.faction} />
        <div>
          <span className="eyebrow">{boot.profile.wallet ? "Wallet-linked captain" : "Guest captain"}</span>
          <h2>{profile.name || "Your next chapter"}</h2>
          <p>
            {FACTIONS[profile.faction].name} · {boot.profile.xp} XP · {boot.profile.wins} wins
          </p>
          <code>CAPTAIN / {boot.profile.id.slice(0, 8).toUpperCase()}</code>
        </div>
        <div className="passport-actions">
          <button
            onClick={() =>
              run(async () => {
                await navigator.clipboard.writeText(boot.profile.id);
                setNotice("Full captain ID copied.");
              })
            }
          >
            Copy captain ID
          </button>
          <Link className="button" to="/?focus=captain">
            Visit my outpost
          </Link>
          {!boot.profile.wallet && <button onClick={() => run(connect)}>Link wallet to return later</button>}
        </div>
      </section>
      <p className="intro">
        Choose Human play or delegate a solo match to a wallet-linked Agent ID. Its rule-based policy
        remembers alliances and clashes. It never controls your wallet.
      </p>
      <section className="agent-id-panel" aria-label="Agent ID collection and controls">
        <div className="agent-id-visual">
          <AgentPortrait look={lookChoice} />
          <span className="agent-id-stamp">
            {agent?.tokenId ? `AGENT #${String(agent.tokenId).padStart(4, "0")}` : "YOUR AGENT ID"}
          </span>
        </div>
        <div className="agent-id-details">
          <span className="eyebrow">Agent ID, 3,333 in total, one per wallet</span>
          <h2>A rival with a memory.</h2>
          <p>
            Pick its look and decision style. Ownership and visual traits are onchain. Alliances, rivalries
            and match experience stay on this game server, keyed by token ID and checked against wallet
            ownership.
          </p>
          {!boot.profile.wallet ? (
            <button onClick={() => run(connect)}>Connect wallet to begin</button>
          ) : !boot.profile.onboarded ? (
            <p>Finish captain setup to link an Agent ID.</p>
          ) : agent === null ? (
            <p>Checking Agent ID…</p>
          ) : agent.error ? (
            <p role="status">{agent.error}</p>
          ) : !agent.available ? (
            <p>
              The collection is not deployed on this host yet. Human play and guided practice are available.
            </p>
          ) : (
            <>
              <div className="agent-looks">
                <label>
                  Palette
                  <select
                    value={lookChoice[0]}
                    onChange={(e) => setLookChoice([Number(e.target.value), lookChoice[1], lookChoice[2]])}
                  >
                    {["Lime", "Teal", "Gold", "Violet"].map((x, i) => (
                      <option key={x} value={i}>
                        {x}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Crest
                  <select
                    value={lookChoice[1]}
                    onChange={(e) => setLookChoice([lookChoice[0], Number(e.target.value), lookChoice[2]])}
                  >
                    {["H", "X", "V", "O"].map((x, i) => (
                      <option key={x} value={i}>
                        {x}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Accent
                  <select
                    value={lookChoice[2]}
                    onChange={(e) => setLookChoice([lookChoice[0], lookChoice[1], Number(e.target.value)])}
                  >
                    {["Core", "Star", "Cross", "Peak"].map((x, i) => (
                      <option key={x} value={i}>
                        {x}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <div className="agent-id-actions">
                {!agent.tokenId ? (
                  <button
                    className="primary"
                    disabled={busy || !agent.mintOpen || agent.minted >= 3333}
                    onClick={() => run(mintAgent)}
                  >
                    {agent.mintOpen ? "Mint Agent ID (gas only)" : "Mint not open yet"}
                  </button>
                ) : !agent.linked ? (
                  <button
                    className="primary"
                    disabled={busy}
                    onClick={() =>
                      run(async () => {
                        await api("/agent/bind", { tokenId: agent.tokenId });
                        await loadAgent();
                        setNotice("Owned Agent ID linked to your captain.");
                      })
                    }
                  >
                    Bind owned Agent #{agent.tokenId}
                  </button>
                ) : (
                  <>
                    <button disabled={busy} onClick={() => run(customizeAgent)}>
                      Save look onchain ↗
                    </button>
                    <button className="primary" disabled={busy} onClick={() => start("solo", "agent")}>
                      Delegate a solo match
                    </button>
                  </>
                )}
              </div>
              <small>
                {agent.minted}/3,333 minted ·{" "}
                {agent.linked
                  ? `${agent.played} agent matches · ${agent.wins} wins`
                  : "No Agent ID linked yet"}{" "}
                · No gameplay stat boost
              </small>
              {agent.linked && (
                <label className="agent-style">
                  Automation playbook · all free
                  <select
                    value={agent.style}
                    onChange={(e) =>
                      run(async () => {
                        await api("/agent/style", { style: e.target.value });
                        await loadAgent();
                      })
                    }
                  >
                    <option value="balanced">Balanced · follow objectives</option>
                    <option value="explorer">Explorer · reveal unknown ground</option>
                    <option value="fortifier">Fortifier · reinforce and recover</option>
                    <option value="diplomat">Diplomat · favor trusted rivals</option>
                  </select>
                  <small>
                    Styles choose different legal tactics. None speeds up play or increases rewards.
                  </small>
                </label>
              )}
            </>
          )}
        </div>
      </section>
      <div className="columns">
        <section className="panel">
          <h2>Captain’s mandate</h2>
          <label>
            Name
            <input
              maxLength={24}
              value={profile.name}
              onChange={(e) => setProfile({ ...profile, name: e.target.value })}
            />
          </label>
          <label>
            Faction
            <select
              value={profile.faction}
              onChange={(e) => setProfile({ ...profile, faction: Number(e.target.value) })}
            >
              {FACTIONS.map((f, i) => (
                <option value={i} key={i}>
                  {f.name} · {f.doctrine}
                </option>
              ))}
            </select>
          </label>
          <label>
            Combat stance
            <select
              value={profile.stance}
              onChange={(e) => setProfile({ ...profile, stance: e.target.value })}
            >
              <option value="balanced">Balanced</option>
              <option value="bold">Bold: +1 strength; Contest costs +1</option>
              <option value="careful">Careful: +1 defending owned terrain</option>
            </select>
          </label>
          <label>
            Equipped cosmetic
            <select value={profile.skin} onChange={(e) => setProfile({ ...profile, skin: e.target.value })}>
              <option value="">Frontier uniform</option>
              {boot.inventory.map((id: string) => (
                <option key={id} value={id}>
                  {boot.shop.items.find((i: any) => i.id === id)?.name || id}
                </option>
              ))}
            </select>
          </label>
          <button
            className="primary"
            disabled={busy}
            onClick={() =>
              run(async () => {
                await api(
                  "/profile",
                  {
                    name: profile.name,
                    faction: profile.faction,
                    stance: profile.stance,
                    skin: profile.skin,
                  },
                  "PATCH",
                );
                await refresh();
                setNotice("Captain saved. Changes apply to new matches.");
              })
            }
          >
            Save captain
          </button>
        </section>
        <section className="panel captain-card">
          <div className="captain-emblem" style={{ color: FACTIONS[profile.faction].color }}>
            {FACTIONS[profile.faction].symbol}
          </div>
          <h2>{profile.name}</h2>
          <p>{FACTIONS[profile.faction].name}</p>
          <div className="stats">
            <span>
              <b>{profile.played}</b>Matches
            </span>
            <span>
              <b>{profile.wins}</b>Wins
            </span>
            <span>
              <b>{profile.xp}</b>XP
            </span>
          </div>
          <h3>How rivals remember you</h3>
          <p className="hint">
            Solo rivals carry their opinion of your captain into the next encounter. Ranked games start
            neutral.
          </p>
          {Object.entries(boot.profile.rivalMemory || {})
            .filter(([id]) => Number(id) !== boot.profile.faction)
            .map(([id, value]) => (
              <p key={"rival-" + id}>
                <b>{FACTIONS[Number(id)]?.name}</b>:{" "}
                {Number(value) > 0 ? "Trust +" + value : Number(value) < 0 ? "Grudge " + value : "Neutral"}
              </p>
            ))}
          {!Object.keys(boot.profile.rivalMemory || {}).length && (
            <p>No history yet. Meet a rival in a solo match.</p>
          )}
          <h3>Your captain’s memory</h3>
          {Object.entries(profile.memory).length ? (
            Object.entries(profile.memory).map(([i, value]) => (
              <p key={i}>
                {FACTIONS[Number(i)]?.name}:{" "}
                {Number(value) > 0 ? "Trust +" + value : Number(value) < 0 ? "Grudge " + value : "Neutral"}
              </p>
            ))
          ) : (
            <p>No shared history yet. Play a frontier to begin.</p>
          )}
          <p className="hint">
            Ranked play resets stances and memory for equal starts. Guest profiles stay on this browser; link
            a wallet to restore your account elsewhere.
          </p>
        </section>
      </div>
    </main>
  );
}
