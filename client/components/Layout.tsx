import { useEffect, useRef } from "react";
import { FACTIONS } from "../../shared/game";
import { narrate, playCue, stopNarration } from "../sound";
import { Dialog } from "../Dialog";
import { World } from "../components/TacticalWorld";
import { CaptainPortrait } from "../components/Portraits";
import { GUIDE_CHAPTERS, preview } from "../lib/constants";
import { prefetchWallet } from "../walletLoader";
import { Link, navigate, useIsActive, RouterView } from "../router";
import { api } from "../lib/api";
import { useApp } from "../app/AppState";

const NAV = [
  ["/", "Living world"],
  ["/missions", "Agent missions"],
  ["/play", "Play"],
  ["/captain", "My captain"],
  ["/rankings", "Rankings"],
  ["/armory", "Armory"],
  ["/economy", "Economy"],
] as const;

function NavLink({ to, children }: { to: string; children: string }) {
  const active = useIsActive(to);
  const ref = useRef<HTMLAnchorElement>(null);
  // On narrow screens the nav scrolls sideways; keep the current page's tab in view.
  useEffect(() => {
    if (active) ref.current?.scrollIntoView({ block: "nearest", inline: "nearest" });
  }, [active]);
  return (
    <Link
      ref={ref}
      to={to}
      className={active ? "active" : undefined}
      aria-current={active ? "page" : undefined}
    >
      {children}
    </Link>
  );
}

/** Header, navigation, toasts, footer and app-wide dialogs around the current page. */
export function Layout() {
  const {
    accountOpen,
    boot,
    busy,
    clock,
    connect,
    error,
    finishGuide,
    guideStep,
    narrating,
    notice,
    onboardingStep,
    previewSkin,
    profile,
    purchase,
    quote,
    refresh,
    run,
    setAccountOpen,
    setError,
    setGuideStep,
    setNarrating,
    setNotice,
    setOnboardingStep,
    setPreviewSkin,
    setProfile,
    setQuote,
    setSetupLater,
    setShowGuide,
    setShowHelp,
    setSoundOn,
    setupLater,
    showGuide,
    showHelp,
    soundOn,
    walletStage,
  } = useApp();
  if (!boot)
    return (
      <div className="loading">
        <img
          src="/hood-rivals-logo-480.webp"
          alt="Hood Rivals"
          width="240"
          height="96"
          fetchPriority="high"
          decoding="async"
        />
        <h1>Opening the frontier</h1>
        <p>{error || "Preparing your captain and world…"}</p>
        {error && <button onClick={() => location.reload()}>Retry</button>}
      </div>
    );
  const previewGame = {
    ...preview,
    you: boot.profile.faction,
    factions: preview.factions.map((f: any) =>
      f.id === boot.profile.faction ? { ...f, captain: boot.profile.name } : f,
    ),
  };
  return (
    <>
      <a className="skip-link" href="#main-content">
        Skip to game
      </a>
      <header>
        <Link className="brand" to="/">
          <img
            src="/hood-rivals-logo-480.webp"
            srcSet="/hood-rivals-logo-240.webp 1x, /hood-rivals-logo-480.webp 2x"
            alt="Hood Rivals"
            width="200"
            height="80"
            fetchPriority="high"
            decoding="async"
          />
        </Link>
        <nav aria-label="Main">
          {NAV.map(([to, label]) => (
            <NavLink key={to} to={to}>
              {label}
            </NavLink>
          ))}
          <button
            onClick={() => {
              setGuideStep(0);
              setShowGuide(true);
            }}
          >
            Field guide
          </button>
          <button
            className="sound-toggle"
            aria-label={soundOn ? "Turn game sound off" : "Turn game sound on"}
            aria-pressed={soundOn}
            onClick={() => {
              const next = !soundOn;
              setSoundOn(next);
              localStorage.setItem("hood-rivals-sound", next ? "on" : "off");
              if (next) playCue("advance");
            }}
          >
            {soundOn ? "Sound on" : "Sound off"}
          </button>
        </nav>
        <button
          className="wallet"
          disabled={busy}
          onPointerEnter={() => prefetchWallet()}
          onFocus={() => prefetchWallet()}
          onClick={() => (boot.profile.wallet ? setAccountOpen(true) : run(connect))}
        >
          {boot.profile.wallet
            ? boot.profile.wallet.slice(0, 6) + "…" + boot.profile.wallet.slice(-4)
            : "Log in"}
        </button>
      </header>
      <div className="network">
        <span className="dot" /> {boot.chain.id === 4663 ? "Robinhood Chain" : "Robinhood testnet"}
        <span>Free to play, cosmetics only</span>
        <span className="network-end">Season 00</span>
      </div>
      <RouterView fallback={<main id="main-content" className="content page-loading" aria-busy="true" />} />
      {error && (
        <div role="alert" className="toast error">
          {error}
          <button onClick={() => setError("")}>×</button>
        </div>
      )}
      {notice && (
        <div role="status" className="toast">
          {notice}
          <button onClick={() => setNotice("")}>×</button>
        </div>
      )}
      <footer>
        <span>HOOD RIVALS</span>
        <span>A small world. A long memory. · v{boot.release?.version || "1.3.0"}</span>
        <Link to="/economy">Read the economy</Link>
      </footer>
      {boot.profile.wallet && !boot.profile.onboarded && !setupLater && (
        <Dialog title="Create your captain" onClose={() => setSetupLater(true)}>
          <section className="onboarding">
            <div className="identity-preview">
              <CaptainPortrait faction={profile.faction} />
              <div>
                <strong>{profile.name || "Your story starts here"}</strong>
                <small>CAPTAIN / {boot.profile.id.slice(0, 8).toUpperCase()}</small>
              </div>
            </div>
            <div className="eyebrow">Wallet verified, step {onboardingStep + 1} of 3</div>
            <div className="onboarding-progress" aria-hidden="true">
              <i style={{ width: `${(onboardingStep + 1) * 33.34}%` }} />
            </div>
            {onboardingStep === 0 && (
              <>
                <h2>Your name in the frontier.</h2>
                <p>
                  This captain profile is linked to {boot.profile.wallet.slice(0, 6)}…
                  {boot.profile.wallet.slice(-4)}. Your wallet signature authorized account linking only.
                </p>
                <label>
                  Captain name
                  <input
                    autoFocus
                    maxLength={24}
                    value={profile.name}
                    onChange={(e) => setProfile({ ...profile, name: e.target.value })}
                    placeholder="Choose a name"
                  />
                </label>
              </>
            )}
            {onboardingStep === 1 && (
              <>
                <h2>Choose an outpost.</h2>
                <p>
                  Your captain appears with this faction in the living world. Faction is identity, not a paid
                  advantage.
                </p>
                <div className="onboarding-factions">
                  {FACTIONS.map((f, i) => (
                    <button
                      key={f.name}
                      type="button"
                      className={profile.faction === i ? "selected" : ""}
                      onClick={() => setProfile({ ...profile, faction: i })}
                    >
                      <b style={{ color: f.color }}>{f.symbol}</b>
                      <span>
                        {f.name}
                        <small>{f.doctrine}</small>
                      </span>
                    </button>
                  ))}
                </div>
              </>
            )}
            {onboardingStep === 2 && (
              <>
                <h2>Set your first mandate.</h2>
                <p>Your stance applies to tactical matches. The living world's agents remain autonomous.</p>
                <div className="onboarding-stances">
                  {(
                    [
                      ["balanced", "Balanced", "Adapt to the frontier"],
                      ["bold", "Bold", "Take risks in contests"],
                      ["careful", "Careful", "Defend what you hold"],
                    ] as const
                  ).map(([id, label, description]) => (
                    <button
                      key={id}
                      className={profile.stance === id ? "selected" : ""}
                      onClick={() => setProfile({ ...profile, stance: id })}
                    >
                      <b>{label}</b>
                      <small>{description}</small>
                    </button>
                  ))}
                </div>
                <div className="onboarding-summary">
                  {profile.name} · {FACTIONS[profile.faction].name} · {profile.stance}
                </div>
              </>
            )}
            {error && (
              <p role="alert" className="setup-error">
                {error}
              </p>
            )}
            <div className="onboarding-controls">
              {onboardingStep > 0 && (
                <button disabled={busy} onClick={() => setOnboardingStep(onboardingStep - 1)}>
                  ← Back
                </button>
              )}
              {onboardingStep < 2 ? (
                <button
                  className="primary"
                  disabled={busy || (onboardingStep === 0 && !/^[\w \-']{2,24}$/.test(profile.name.trim()))}
                  onClick={() => setOnboardingStep(onboardingStep + 1)}
                >
                  Continue
                </button>
              ) : (
                <button
                  className="primary"
                  disabled={busy}
                  onClick={() =>
                    run(async () => {
                      await api("/onboarding", {
                        name: profile.name.trim(),
                        faction: profile.faction,
                        stance: profile.stance,
                      });
                      await refresh();
                      setOnboardingStep(0);
                      navigate("/");
                      setNotice("Captain created. Enter the living world.");
                    })
                  }
                >
                  Create captain
                </button>
              )}
            </div>
          </section>
        </Dialog>
      )}
      {walletStage && (
        <div className="wallet-progress" role="status">
          <span className="dot" />
          {walletStage}
        </div>
      )}
      {accountOpen && (
        <Dialog title="Your frontier account" onClose={() => setAccountOpen(false)}>
          <div className="identity-preview">
            <CaptainPortrait faction={boot.profile.faction} />
            <div>
              <strong>{boot.profile.name}</strong>
              <small>{boot.profile.onboarded ? "Captain ready" : "Setup incomplete"}</small>
            </div>
          </div>
          <p className="hash">{boot.profile.wallet}</p>
          <p>
            Your profile and match record are saved by the game server. Reconnect this wallet to restore them.
          </p>
          <div className="account-actions">
            <button
              onClick={() => {
                setAccountOpen(false);
                navigate("/captain");
              }}
            >
              Manage captain
            </button>
            <button
              disabled={busy}
              onClick={() => {
                setAccountOpen(false);
                run(() => connect(false, true));
              }}
            >
              Switch wallet
            </button>
            <button
              disabled={busy}
              onClick={() =>
                run(async () => {
                  await api("/session/logout", {});
                  location.reload();
                })
              }
            >
              Sign out of this device
            </button>
          </div>
          <small>
            Signing out ends this game session. It does not revoke wallet permissions or delete your captain.
          </small>
        </Dialog>
      )}
      {showGuide && (
        <Dialog
          title="Your field guide"
          onClose={() => {
            stopNarration();
            setShowGuide(false);
          }}
        >
          <div className="guide-manual">
            <span className="eyebrow">
              Chapter {guideStep + 1} of {GUIDE_CHAPTERS.length}
            </span>
            <div className="onboarding-progress" aria-hidden="true">
              <i style={{ width: `${((guideStep + 1) * 100) / GUIDE_CHAPTERS.length}%` }} />
            </div>
            <div className="guide-chapter">
              <span className="guide-icon" aria-hidden="true">
                {GUIDE_CHAPTERS[guideStep].icon}
              </span>
              <div>
                <h3>{GUIDE_CHAPTERS[guideStep].title}</h3>
                <p>{GUIDE_CHAPTERS[guideStep].body}</p>
              </div>
            </div>
            <div className="guide-audio">
              <button
                onClick={() => {
                  if (narrating) {
                    stopNarration();
                    setNarrating(false);
                  } else if (
                    narrate(`${GUIDE_CHAPTERS[guideStep].title}. ${GUIDE_CHAPTERS[guideStep].body}`, () =>
                      setNarrating(false),
                    )
                  )
                    setNarrating(true);
                  else
                    setNotice(
                      "Voice narration is not available on this browser. The full captions are shown here.",
                    );
                }}
              >
                {narrating ? "Stop voiceover" : "▶ Read aloud"}
              </button>
              <small>Optional browser voice · subtitles always shown</small>
            </div>
            <div className="guide-controls">
              {guideStep > 0 && (
                <button
                  onClick={() => {
                    if (soundOn) playCue("tap");
                    setGuideStep(guideStep - 1);
                  }}
                >
                  ← Back
                </button>
              )}
              {guideStep < GUIDE_CHAPTERS.length - 1 ? (
                <button
                  className="primary"
                  onClick={() => {
                    if (soundOn) playCue("advance");
                    setGuideStep(guideStep + 1);
                  }}
                >
                  Next chapter
                </button>
              ) : (
                <>
                  <button disabled={busy} onClick={() => run(() => finishGuide(false))}>
                    Explore world
                  </button>
                  <button className="primary" disabled={busy} onClick={() => run(() => finishGuide(true))}>
                    Try guided practice
                  </button>
                </>
              )}
            </div>
          </div>
        </Dialog>
      )}
      {showHelp && (
        <Dialog title="Six rounds. One frontier." onClose={() => setShowHelp(false)}>
          <ol className="rules-list">
            <li>
              <b>Scout</b> reveals a route. It does not capture.
            </li>
            <li>
              <b>Contest</b> claims explored ground. A banner earns one Renown every round you hold it.
            </li>
            <li>
              <b>Develop</b> restores strength or improves supply and defence.
            </li>
            <li>
              <b>Pact</b> works only when both captains offer it to each other that round.
            </li>
            <li>
              <b>Win</b> with the most Renown after six rounds, or hold all three banners at once.
            </li>
          </ol>
          <p>
            All captains plan simultaneously. Inspect the last-round report to understand clashes. Cosmetics
            never change strength.
          </p>
          <button className="primary" onClick={() => setShowHelp(false)}>
            Back to my frontier
          </button>
        </Dialog>
      )}
      {previewSkin !== null && (
        <Dialog
          title={boot.shop.items.find((i: any) => i.id === previewSkin)?.name || "Original captain"}
          onClose={() => setPreviewSkin(null)}
        >
          <p>Try the look on the tactical board. This preview does not purchase or equip it.</p>
          <div className="cosmetic-preview">
            <World game={previewGame} cosmetic={previewSkin} />
          </div>
          <div className="row">
            <button onClick={() => setPreviewSkin(previewSkin ? "" : boot.shop.items[0].id)}>
              {previewSkin ? "Compare original" : "Try Mossbound"}
            </button>
            <button className="primary" onClick={() => setPreviewSkin(null)}>
              Back to Armory
            </button>
          </div>
          <small>Applies to the tactical board. The living-island preview has its own art.</small>
        </Dialog>
      )}
      {quote && (
        <div className="modal-backdrop">
          <section className="modal" role="dialog" aria-modal="true" aria-label="Review cosmetic purchase">
            <div className="eyebrow">Review before signing</div>
            <h2>{boot.shop.items.find((i: any) => i.id === quote.sku)?.name}</h2>
            <h3>{quote.displayAmount}</h3>
            <p>
              Cosmetic access only. Network gas is additional. Signed price expires in{" "}
              {Math.max(0, Math.ceil((quote.order.expires * 1000 - clock) / 1000))} seconds.{" "}
              {quote.asset === "rival" ? "20% retirement / 80% treasury." : "100% treasury."}
            </p>
            <p className="hash">Contract: {quote.store}</p>
            <button
              disabled={busy || quote.order.expires * 1000 <= clock}
              className="primary"
              onClick={() => run(purchase)}
            >
              Approve & purchase
            </button>
            <button disabled={busy} onClick={() => setQuote(null)}>
              Cancel
            </button>
          </section>
        </div>
      )}
    </>
  );
}
