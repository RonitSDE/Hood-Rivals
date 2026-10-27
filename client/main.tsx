import React, { useEffect, useRef, useState, lazy, Suspense, useMemo } from "react";
import { createRoot } from "react-dom/client";
const LazyWorld=lazy(()=>import('./World').then(m=>({default:m.World})));
function World(props:any){const snapshot=JSON.stringify(props.game);const stableGame=useMemo(()=>props.game,[snapshot]);return <Suspense fallback={<div className="world world-loading" role="status">Preparing your tactical world…</div>}><LazyWorld {...props} game={stableGame}/></Suspense>}
import { Dialog } from "./Dialog";
import { matchRecap, trainingMove } from "../shared/experience";
import { shareBattle, downloadBattleCard } from "./share";
import { WalletProviders, connectWithRainbowKit, walletConfig } from "./wallet";
import { disconnect, getAccount, signMessage, switchChain } from "@wagmi/core";
import {
  createGame,
  FACTIONS,
  cost,
  validateOrder,
  type Order,
} from "../shared/game";
import { STORE_ABI, ERC20_ABI } from "../shared/checkout";
import "./style.css";
declare global {
  interface Window {
    ethereum?: any;
  }
}
let csrf = "";
async function api(path: string, body?: any, method = body ? "POST" : "GET") {
  const r = await fetch("/api" + path, {
    method,
    credentials: "same-origin",
    headers: {
      "Content-Type": "application/json",
      ...(csrf ? { "X-CSRF-Token": csrf } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await r.json();
  if (!r.ok) throw Error(data.error || "Request failed");
  return data;
}
const preview = createGame("outpost-preview");
preview.tiles.forEach((t, i) => {
  if (t.kind !== "base" && i % 7 === 0) t.owner = i % 3;
});
function CaptainPortrait({faction=0}:{faction?:number}) {
  return <svg className="captain-portrait" viewBox="0 0 32 32" role="img" aria-label="Pixel captain portrait" shapeRendering="crispEdges"><rect width="32" height="32" fill="#172a29"/><path d="M0 26L16 18 32 26V32H0" fill="#263d34"/><path d="M8 23H24V32H8Z" fill={FACTIONS[faction].color}/><path d="M11 9H21V21H11Z" fill="#e6b889"/><path d="M9 7H23V12H9ZM11 5H21V7H11Z" fill="#e3ca88"/><path d="M9 12H12V18H9ZM20 12H23V18H20Z" fill="#514033"/><path d="M13 14H15V16H13ZM18 14H20V16H18Z" fill="#182b29"/><path d="M14 20H19V23H14Z" fill="#ba8b68"/><path d="M14 24H19V32H14Z" fill="#e3ca88"/></svg>
}
function App() {
  const livingFrame = useRef<HTMLIFrameElement>(null);
  const completedRefresh = useRef("");
  const [previewSkin,setPreviewSkin]=useState<string|null>(null);
  const [showHelp,setShowHelp]=useState(false);
  const [accountOpen,setAccountOpen]=useState(false);
  const [setupLater,setSetupLater]=useState(false);
  const [walletStage,setWalletStage]=useState("");
  const [guideHidden,setGuideHidden]=useState(false);
  const [boot, setBoot] = useState<any>(),
    [page, setPage] = useState("observatory"),
    [game, setGame] = useState<any>(),
    [match, setMatch] = useState(""),
    [selected, setSelected] = useState(""),
    [order, setOrder] = useState<Order>({ type: "scout" }),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [busy, setBusy] = useState(false),
    [clock, setClock] = useState(Date.now()),
    [board, setBoard] = useState<any[]>([]),
    [replay, setReplay] = useState<any>(),
    [step, setStep] = useState(0),
    [room, setRoom] = useState(""),
    [profile, setProfile] = useState<any>(),
    [onboardingStep, setOnboardingStep] = useState(0),
    [quote, setQuote] = useState<any>(),
    [pending, setPending] = useState<any>(() => {
      try {
        return JSON.parse(localStorage.getItem("pending-purchase") || "null");
      } catch {
        return null;
      }
    });
  const refresh = async () => {
    const b = await api("/bootstrap");
    setBoot(b);
    setProfile(b.profile);
    return b;
  };
  const syncLivingCaptain = (p = boot?.profile) => {
    if (!p?.wallet || !p?.onboarded) {livingFrame.current?.contentWindow?.postMessage({type:"OUTPOST_CLEAR_CAPTAIN"},location.origin);return;}
    livingFrame.current?.contentWindow?.postMessage({
      type: "OUTPOST_CAPTAIN", name: p.name, faction: p.faction
    }, location.origin);
  };
  const run = async (fn: () => Promise<any>) => {
    setBusy(true);
    setError("");
    try {
      await fn();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
      setWalletStage("");
    }
  };
  useEffect(() => {
    run(async () => {
      const s = await api("/session", {});
      csrf = s.csrf;
      await refresh();
      const params = new URLSearchParams(location.search);
      if (params.get("replay")) {
        const r = await api("/replays/" + params.get("replay"));
        setReplay(r);
        setPage("replay");
      }
      if (params.get("room")) { setRoom(params.get("room")!.toUpperCase());setPage("tactics"); }
    });
  }, []);
  useEffect(() => {
    if (!match) return;
    let alive = true;
    const poll = async () => {
      try {
        const g = await api("/matches/" + match);
        if (alive)
          setGame((old: any) =>
            JSON.stringify(old) === JSON.stringify(g) ? old : g,
          );
      } catch (e: any) {
        if (alive) setError(e.message);
      }
    };
    poll();
    const t = setInterval(poll, 1500);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, [match]);
  useEffect(() => {
    const t = setInterval(() => setClock(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  useEffect(() => {
    livingFrame.current?.contentWindow?.postMessage({type:"OUTPOST_VISIBILITY",visible:page==="observatory"},location.origin);
  },[page,boot?.profile?.id]);
  useEffect(() => {
    syncLivingCaptain();
  }, [boot?.profile?.wallet, boot?.profile?.onboarded, boot?.profile?.name, boot?.profile?.faction]);
  useEffect(() => {
    const changed = () => { setQuote(null); setNotice("Wallet changed. Connect again to verify the active address."); };
    window.addEventListener('outpost:wallet-change',changed);
    return () => window.removeEventListener('outpost:wallet-change',changed);
  }, []);
  useEffect(()=>{
    if(game?.status==='finished' && completedRefresh.current!==game.id){completedRefresh.current=game.id;refresh().catch(()=>{});}
  },[game?.status,game?.id]);
  const start = (mode: string) =>
    run(async () => {
      const r = await api("/matches", { mode });
      setGame(await api("/matches/"+r.id));
      setMatch(r.id);
      setOrder({type:"scout"});setGuideHidden(false);
      setReplay(null);
      setPage("tactics");
      setSelected("");
    });
  async function connect(forPurchase = false, rechoose = false) {
    setWalletStage("1 / 3 · Choose your wallet");
    if (rechoose && getAccount(walletConfig).isConnected) await disconnect(walletConfig);
    if (!getAccount(walletConfig).isConnected) await connectWithRainbowKit();
    setWalletStage("2 / 3 · Confirm the network in your wallet");
    const chainId = boot.chain.id as 4663 | 46630;
    if (getAccount(walletConfig).chainId !== chainId) await switchChain(walletConfig, { chainId });
    const account = getAccount(walletConfig);
    if (!account.isConnected || !account.connector) throw Error("Wallet disconnected. Choose a wallet to continue.");
    const { BrowserProvider } = await import("ethers");
    const provider = new BrowserProvider(await account.connector.getProvider() as any);
    const signer = await provider.getSigner();
    if (Number((await provider.getNetwork()).chainId) !== chainId)
      throw Error("Switch to the configured Robinhood network");
    const address = await signer.getAddress();
    if (boot.profile.wallet?.toLowerCase() === address.toLowerCase()) {
      if (!forPurchase) setNotice("Welcome back. Your captain is ready.");
      return { provider, signer, profile: boot.profile };
    }
    setWalletStage("3 / 3 · Sign to verify ownership. No payment.");
    const challenge = await api("/wallet/challenge", { address });
    const signature = await signMessage(walletConfig, { message: challenge.message });
    const verified = await api("/wallet/verify", {
      nonce: challenge.nonce,
      signature,
    });
    csrf = verified.csrf;
    const updated = await refresh();
    if (verified.restored) {
      setMatch("");
      setGame(null);
      setRoom("");
    }
    if (!updated.profile.onboarded && /^Captain [0-9a-f]{4}$/i.test(updated.profile.name))
      setProfile({ ...updated.profile, name: "" });
    if (!forPurchase) {
      setPage("observatory");
      setOnboardingStep(0);
      setSetupLater(false);
      setNotice(updated.profile.onboarded
        ? verified.restored
          ? "Existing captain restored. Guest match progress is not merged."
          : "Welcome back. Your captain is ready."
        : "Wallet verified. Create your captain to save your identity.");
    }
    return { provider, signer, profile: updated.profile };
  }
  async function purchase() {
    if (!quote) return;
    const { Contract } = await import("ethers");
    const { provider, signer } = await connect(true);
    if (
      (await signer.getAddress()).toLowerCase() !==
      quote.order.payer.toLowerCase()
    )
      throw Error("Wallet changed. Request a new quote.");
    const token = new Contract(quote.order.asset, ERC20_ABI, signer),
      amount = BigInt(quote.order.amount);
    if ((await token.balanceOf(quote.order.payer)) < amount)
      throw Error("Insufficient payment asset balance");
    if ((await token.allowance(quote.order.payer, quote.store)) < amount) {
      setNotice("Confirm the exact token allowance in your wallet.");
      await (await token.approve(quote.store, amount)).wait();
    }
    setNotice("Confirm cosmetic purchase in your wallet.");
    const tx = await new Contract(quote.store, STORE_ABI, signer).purchase(
      quote.order,
      quote.signature,
    );
    const p = { id: quote.order.orderId, hash: tx.hash };
    setPending(p);
    localStorage.setItem("pending-purchase", JSON.stringify(p));
    await tx.wait(3);
    await api("/shop/orders/" + p.id + "/confirm", { hash: p.hash });
    localStorage.removeItem("pending-purchase");
    setPending(null);
    setQuote(null);
    setNotice("Cosmetic unlocked. Equip it in Captain.");
    await refresh();
    provider.destroy();
  }
  const openReplay = (id: string) =>
    run(async () => {
      const r = await api("/replays/" + id);
      setReplay(r);
      setStep(0);
      setPage("replay");
    });
  function share() { return run(async()=>setNotice(await shareBattle(game,matchRecap(game.events,game.you).moment?.text || "Six rounds. Three rivals. Your move."))); }
  const leave = () => run(async()=>{await api("/matches/"+match+"/leave",{});setGame(null);setMatch("");setPage("observatory");await refresh()});
  if (!boot)
    return (
      <div className="loading">
        <img src="/mark.svg" />
        <h1>Opening the frontier</h1>
        <p>{error || "Preparing your captain and world…"}</p>
        {error && <button onClick={() => location.reload()}>Retry</button>}
      </div>
    );
  const self = game?.factions?.[game.you],
    showGame = page === "tactics" && game,
    shown =
      page === "replay" && replay
        ? { ...replay.snapshots[step]?.state, you: 0 }
        : showGame
          ? game
          : preview;
  const chosenTile = shown.tiles?.find((t: any) => t.id === selected);
  const legalTargets = game?.status === "active" && ["scout", "contest"].includes(order.type)
    ? game.tiles.filter((t: any) => !validateOrder(game, game.you, { ...order, target: t.id })).map((t: any) => t.id)
    : [];
  const availableAction = game?.status === "active" && selected
    ? !validateOrder(game, game.you, { type: "contest", target: selected }) ? "contest"
      : !validateOrder(game, game.you, { type: "scout", target: selected }) ? "scout" : null
    : null;
  const selectHex = (id: string) => {
    setSelected(id);
    if (game?.status !== "active" || game.submitted) return;
    if (["scout", "contest"].includes(order.type) && !validateOrder(game, game.you, { ...order, target: id })) return;
    if (!validateOrder(game, game.you, { type: "contest", target: id })) setOrder({ type: "contest" });
    else if (!validateOrder(game, game.you, { type: "scout", target: id })) setOrder({ type: "scout" });
  };
  const plannedOrder = { ...order, target: selected || undefined };
  const orderIssue =
    game?.status === "active"
      ? validateOrder(game, game.you, plannedOrder)
      : null;
  const orderCost =
    game?.status === "active" ? cost(game, game.you, plannedOrder) : 0;
  const recap=game?.status==='finished'?matchRecap(game.events,game.you):null;
  const guide=game?.status==='active'&&game.mode==='training'?trainingMove(game,game.you):null;
  const previewGame={...preview,you:boot.profile.faction,factions:preview.factions.map((f:any)=>f.id===boot.profile.faction?{...f,captain:boot.profile.name}:f)};
  return (
    <>
      <a className="skip-link" href="#main-content">Skip to game</a>
      <header>
        <a
          className="brand"
          href="/"
          onClick={(e) => {
            e.preventDefault();
            setPage("observatory");
          }}
        >
          <img src="/mark.svg" />
          <span>
            HOOD<span className="subbrand">RIVALS</span>
          </span>
        </a>
        <nav>
          {[
            ["observatory", "Living world"],
            ["tactics", "Play"],
            ["captain", "My captain"],
            ["warroom", "Rankings"],
            ["armory", "Armory"],
            ["economy", "Economy"],
          ].map(([id, label]) => (
            <button
              className={page === id ? "active" : ""}
              key={id}
              onClick={() => {
                setPage(id);
                if (id === "warroom")
                  run(async () => setBoard(await api("/leaderboard")));
                if (id === "captain" || id === "armory") run(refresh);
              }}
            >
              {label}
            </button>
          ))}
        </nav>
        <button className="wallet" disabled={busy} onClick={() => boot.profile.wallet ? setAccountOpen(true) : run(connect)}>
          {boot.profile.wallet
            ? boot.profile.wallet.slice(0, 6) +
              "…" +
              boot.profile.wallet.slice(-4)
            : "Log in"}
          <span>↗</span>
        </button>
      </header>
      <div className="network">
        <span className="dot" />{" "}
        {boot.chain.id === 4663 ? "ROBINHOOD CHAIN" : "ROBINHOOD TESTNET"}
        <span>FREE TO PLAY · COSMETICS ONLY</span>
        <span className="network-end">SEASON 00 / THE FIRST FRONTIER</span>
      </div>
      {(
        <main id={page==="observatory"?"main-content":undefined} className="living-shell" hidden={page!=="observatory"}>
          <section className="living-intro">
            <div>
              <div className="eyebrow">WATCH THE WORLD. MAKE YOUR MOVE.</div>
              <h1>Your frontier.<br/> <em>A story in every pixel.</em></h1>
              <p>Meet captains with loyalties, grudges and a plan. Then lead your own through six rounds of territory, tactics and betrayal.</p>
            </div>
            <div className="living-actions">
              <button className="primary" disabled={busy} onClick={()=>start(boot.profile.played===0?'training':'solo')}>{boot.profile.played===0?'Learn by playing':'Enter the frontier'} <span>↗</span></button>
              <button disabled={busy} onClick={()=>start('room')}>Challenge a friend</button>
              <small>No wallet needed · Free to play · Three rival factions</small>
            </div>
          </section>
          {boot.profile.wallet && boot.profile.onboarded && (
            <section className="captain-pass" aria-label="Saved captain account">
              <div className="captain-pass-identity"><CaptainPortrait faction={boot.profile.faction}/>
                <span className="captain-pass-sigil" style={{color:FACTIONS[boot.profile.faction].color}}>{FACTIONS[boot.profile.faction].symbol}</span>
                <div><small>WALLET LINKED · GAME ACCOUNT</small><h2>{boot.profile.name}</h2>
                  <span>{FACTIONS[boot.profile.faction].name} · {boot.profile.stance} stance</span></div>
              </div>
              <div className="captain-pass-stats" aria-label="Persisted tactical record">
                <span><b>{boot.profile.played}</b><small>Matches</small></span>
                <span><b>{boot.profile.wins}</b><small>Wins</small></span>
                <span><b>{boot.profile.xp}</b><small>XP</small></span>
                <span><b>{boot.inventory.length}</b><small>Cosmetics</small></span>
              </div>
              <div className="captain-pass-actions">
                {boot.history.some((h:any)=>["active","lobby"].includes(h.status))
                  ? <button className="primary" onClick={()=>{setMatch(boot.history.find((h:any)=>["active","lobby"].includes(h.status)).id);setPage("tactics")}}>Resume match →</button>
                  : <button className="primary" disabled={busy} onClick={()=>start("solo")}>Play a match →</button>}
                <button disabled={busy} onClick={()=>start("weekly")}>Daily challenge</button>
              </div>
              <p>These stats are saved by the game server. The island below runs locally in this browser.</p>
            </section>
          )}
          {boot.profile.wallet&&!boot.profile.onboarded&&setupLater&&<div className="invite-banner"><span>Your wallet is linked. Give your captain an identity.</span><button onClick={()=>setSetupLater(false)}>Finish captain setup →</button></div>}
          <section className="campaign-journal" aria-label="Saved campaign journal">
            <div className="campaign-title"><div><span className="eyebrow">YOUR CAMPAIGN · SERVER SAVED</span><h2>A frontier that remembers.</h2></div><button disabled={busy} onClick={()=>start('solo')}>{boot.campaign?.length?'Start the next chapter →':'Begin your story →'}</button></div>
            <p>Six rounds leave a record. Revisit your turning points, then face the factions that remember your choices.</p>
            <div className="campaign-rivals">{Object.entries(boot.profile.rivalMemory||{}).filter(([id])=>Number(id)!==boot.profile.faction).map(([id,value])=><span key={id} style={{borderColor:FACTIONS[Number(id)]?.color}}><b>{FACTIONS[Number(id)]?.name}</b> · {Number(value)<0?'Holds a grudge':Number(value)>0?'Remembers your alliance':'Neutral'} ({Number(value)})</span>)}</div>
            {boot.campaign?.length ? <div className="campaign-entries">{boot.campaign.map((entry:any)=><article key={entry.match_id}><span className="eyebrow">{entry.won?'VICTORY':'EXPEDITION'} · {entry.score} RENOWN</span><h3>{entry.moment}</h3><time dateTime={new Date(entry.created).toISOString()}>{new Date(entry.created).toLocaleDateString()}</time><button onClick={()=>openReplay(entry.match_id)}>Watch the real replay ↗</button></article>)}</div> : <div className="campaign-empty">Your journal is empty. Complete a solo, friend or ranked match to save its turning point. Practice earns no campaign entry.</div>}
          </section>
          <div className="world-section-heading"><div><span className="eyebrow">THE LIVING ISLAND</span><h2>Everyone has a reason.</h2></div><span className="simulation-chip">Local simulation · 15 agents</span></div>
          <div className="living-frame">
            <iframe ref={livingFrame} title="Hood Rivals living isometric world" src="/observatory.html?embedded=1" onLoad={() => {syncLivingCaptain();livingFrame.current?.contentWindow?.postMessage({type:"OUTPOST_VISIBILITY",visible:page==="observatory"},location.origin)}} />
          </div>
          <p className="living-caption">Explore a local simulation: these 15 agents and their PX are not other online players or transferable rewards. Your captain identity and tactical match record are saved separately. The island stays with you between tabs and pauses while you are away. Refreshing the browser starts a new local world.</p>
        </main>
      )}
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
      {(page === "tactics" || page === "replay") && (
        <main id="main-content" className={"frontier " + (showGame ? "in-match" : "")}>
          {room && !showGame && page==='tactics' && <section className="invite-banner"><div><span className="eyebrow">A RIVAL IS WAITING</span><h2>Join room {room}</h2><p>Choose your orders together. Your wallet is optional.</p></div><button className="primary" disabled={busy} onClick={()=>run(async()=>{const r=await api('/rooms/join',{code:room});setMatch(r.id);setGame(await api('/matches/'+r.id));setRoom('')})}>Join this frontier →</button></section>}
          <div className="hero-copy">
            {showGame ? (
              <>
                <div className="eyebrow">
                  {game.mode === "training" ? "GUIDED PRACTICE" : game.mode === "weekly"
                    ? "DAILY RANKED CHALLENGE"
                    : "LIVE FRONTIER"}{" "}
                  / {game.code}
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
                      : game.mode==='training' ? "Take your time. Follow the field guide, then choose your own orders." : "Commit one order. Rivals plan at the same time. Unsubmitted orders hold when the timer expires."}
                </p>
              </>
            ) : page === "replay" ? (
              <>
                <div className="eyebrow">THE WAR ARCHIVE</div>
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
                <div className="eyebrow">A SIX-ROUND STRATEGY GAME</div>
                <h1>
                  A small world.
                  <br />A long <em>memory.</em>
                </h1>
                <p>
                  Lead a captain. Scout the unknown. Make a pact—or break one.
                  Three rivals. One frontier. Every decision matters.
                </p>
                <div className="hero-buttons">
                  <button
                    className="primary"
                    disabled={busy}
                    onClick={() => start("solo")}
                  >
                    Enter the frontier <span>↗</span>
                  </button>
                  <button className="secondary" onClick={() => start("room")}>
                    Play with friends
                  </button>
                </div>
                <div className="micro">
                  NO WALLET NEEDED <span>·</span> SIX ROUNDS <span>·</span>{" "}
                  THREE FACTIONS
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
                    navigator.clipboard?.writeText(
                      location.origin + "/?room=" + game.code,
                    );
                    setNotice("Room link copied.");
                  }}
                >
                  Copy invite
                </button>
                {game.host && <button className="text-button" disabled={busy} onClick={leave}>Close room</button>}
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
                {guide && !guideHidden && <div className="training-guide" role="region" aria-label="Practice guidance"><div className="row"><span className="eyebrow">FIELD GUIDE / ROUND {game.round}</span><button className="text-button" onClick={()=>setGuideHidden(true)} aria-label="Hide guidance">×</button></div><h3>{guide.title}</h3><p>{guide.detail}</p><button disabled={busy||game.submitted} onClick={()=>{setOrder(guide.order);setSelected(guide.order.target||'')}}>Highlight suggested order ↗</button><small>Practice has no timer, XP or ranked score.</small></div>}
                <div className="match-objective"><b>Hold banners. Earn Renown.</b><button className="text-button" onClick={()=>setShowHelp(true)}>Rules ?</button></div>
                <div className="row">
                  <b>ROUND {game.round} / 6</b>
                  <span className="timer">
                    {game.mode==='training'?'Your pace':`${Math.max(0, Math.ceil((game.deadline - clock) / 1000))}s`}
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
                <div className="order-types">
                  {["scout", "contest", "develop", "pact", "hold"].map(
                    (type) => (
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
                        <span aria-hidden="true">{{scout:"◇",contest:"⚑",develop:"▣",pact:"↔",hold:"·"}[type]}</span> {type}
                      </button>
                    ),
                  )}
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
                    <select
                      value={selected}
                      onChange={(e) => setSelected(e.target.value)}
                    >
                      <option value="">Choose a hex on the map</option>
                      {game.tiles.filter((t: any) => legalTargets.includes(t.id)).map((t: any) => (
                        <option key={t.id} value={t.id}>
                          {t.id} · {t.kind === "flag" ? "banner" : t.kind === "cache" ? "supply post" : t.kind}
                        </option>
                      ))}
                    </select>
                  </label>
                )}
                {order.type === "develop" && (
                  <select
                    value={order.upgrade}
                    onChange={(e) =>
                      setOrder({ ...order, upgrade: e.target.value as any })
                    }
                  >
                    <option value="income">Supply income +1 (cap +2)</option>
                    <option value="fortify">Fortification +1</option>
                    <option value="heal">Restore 2 squad strength</option>
                  </select>
                )}
                {order.type === "pact" && (
                  <select
                    value={order.partner}
                    onChange={(e) =>
                      setOrder({ ...order, partner: Number(e.target.value) })
                    }
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
                  Cost: <b>{orderCost} Supply</b> ·{" "}
                  {orderIssue || "Order is valid. Ready to commit."}
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
                  {game.submitted
                    ? "Order sealed · waiting for rivals"
                    : "Seal this order →"}
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
                {game.mode==='training' && <button className="text-button" disabled={busy} onClick={leave}>Leave practice</button>}
                {game.round>1 && <div className="round-receipt"><span className="eyebrow">LAST ROUND</span>{game.events.filter((e:any)=>e.round===game.round-1&&e.actors.includes(game.you)).slice(-2).map((e:any,i:number)=><p key={i}>{e.text}</p>)}</div>}
              </section>
            )}
            {showGame && game.status === "finished" && recap && (
              <section className="panel battle-recap">
                <span className="eyebrow">{game.mode==='training'?'PRACTICE COMPLETE':'YOUR BATTLE REPORT'}</span>
                <div className="stats">{game.factions.map((f:any)=><span key={f.id}><b>{f.score}</b>{f.captain}</span>)}</div>
                <div className="decisive-moment"><small>{recap.moment?`ROUND ${recap.moment.round} / ${recap.moment.kind.toUpperCase()}`:'YOUR FRONTIER'}</small><h3>{recap.moment?.text||'Six rounds written into the archive.'}</h3></div>
                <p>{recap.captures} captures · {recap.clashes} clashes · {recap.pacts} mutual pacts</p>
                <p className="hint">{game.mode==='training'?'Ready for the frontier? Practice does not award XP or change your saved rival memory.':game.mode==='weekly'?'Ranked play starts equal. Your result is recorded on the daily challenge.':'Your captain’s faction relationships carry into unranked matches.'}</p>
                <div className="result-actions"><button className="primary" disabled={busy} onClick={()=>start('solo')}>{game.mode==='training'?'Play your first match':'Run it back'} →</button><button disabled={busy} onClick={()=>start('room')}>Invite a rival</button><button disabled={busy} onClick={share}>Share this battle ↗</button><button onClick={()=>run(()=>downloadBattleCard(game,recap.moment?.text||'Six rounds. Three rivals.'))}>Save battle card</button><button onClick={()=>openReplay(game.id)}>Watch replay</button></div>
              </section>
            )}
            {page === "replay" && replay && (
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
                    setPage("tactics");
                  }}
                >
                  Play your own frontier
                </button>
              </section>
            )}
          </div>
          <div className="map-wrap">
            <div className="map-heading">
              <span><span className="map-sigil">✥</span> THE FIRST FRONTIER</span>
              <span>
                {showGame ? "TACTICAL VIEW" : "37 HEXES · INFINITE RIVALRIES"}
              </span>
            </div>
            <World
              game={shown}
              cosmetic={boot.profile.skin}
              selected={selected}
              reachable={legalTargets}
              onSelect={selectHex}
            />
            {chosenTile && <div className="tile-intel" role="status">
              <div className="tile-intel-top"><span>HEX {selected}</span><button aria-label="Clear selected hex" onClick={() => setSelected("")}>×</button></div>
              <h3>{chosenTile.kind === "flag" ? "Banner point" : chosenTile.kind === "cache" ? "Supply post" : chosenTile.kind === "base" ? "Home outpost" : chosenTile.kind === "fog" ? "Uncharted terrain" : chosenTile.kind === "forest" ? "Forest passage" : chosenTile.kind === "rock" ? "Stone ridge" : "Open ground"}</h3>
              <p>{chosenTile.kind === "flag" ? "Held banners score each round." : chosenTile.kind === "cache" ? "Captured posts add Supply each round." : chosenTile.kind === "fog" ? "Scout this hex to reveal its ground." : chosenTile.kind === "base" ? "Home outposts cannot be captured." : "Terrain can be contested after it is explored."}</p>
              {chosenTile.owner >= 0 && <span className="owner-chip" style={{borderColor:FACTIONS[chosenTile.owner].color,color:FACTIONS[chosenTile.owner].color}}>◆ {FACTIONS[chosenTile.owner].name}</span>}
              {game?.status === "active" && <div className="tile-intel-action">{availableAction ? `Available: ${availableAction} · ${cost(game,game.you,{type:availableAction,target:selected})} Supply` : "Inspect only · no legal move this round"}</div>}
            </div>}
            <div className="map-caption">
              <span>◈ Scout. Develop. Contest.</span>
              <span>
                {showGame
                  ? "Tap a glowing hex to plan"
                  : "Drag to orbit · select to inspect"}
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
                  ? "DAILY QUOTE SNAPSHOT"
                  : (showGame
                      ? game.market
                      : boot.market
                    ).status.toUpperCase()}{" "}
                / FRONTIER CONDITIONS
              </span>
              <h3>{(showGame ? game.market : boot.market).label}</h3>
              <p>{(showGame ? game.market : boot.market).detail}</p>
              <small className="hint">
                Captured{" "}
                {new Date(
                  (showGame ? game.market : boot.market).timestamp,
                ).toLocaleString()}
              </small>
            </section>
            {showGame ? (
              <section className="journal">
                <div className="eyebrow">FIELD NOTES</div>
                {game.events.slice(-4).map((e: any, i: number) => (
                  <p key={i}>
                    <span>R{e.round}</span> {e.text}
                  </p>
                ))}
                {!game.events.length && (
                  <p>Your story starts with the first order.</p>
                )}
              </section>
            ) : (
              <section className="join">
                <div className="eyebrow">A RIVAL SENT YOU A CODE?</div>
                <div className="row">
                  <input
                    aria-label="Room code"
                    placeholder="ROOM CODE"
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
                    Join →
                  </button>
                </div>
              </section>
            )}
          </div>
          {!showGame && page !== "replay" && (
            <div className="factions">
              {FACTIONS.map((f, i) => (
                <button
                  className={
                    "faction " + (boot.profile.faction === i ? "chosen" : "")
                  }
                  key={f.name}
                  onClick={() => {
                    setPage("captain");
                    setProfile({ ...boot.profile, faction: i });
                  }}
                >
                  <span className="faction-symbol" style={{ color: f.color }}>
                    {f.symbol}
                  </span>
                  <div>
                    <small>FACTION 0{i + 1}</small>
                    <h3>{f.name}</h3>
                    <p>{f.tag}</p>
                  </div>
                  <span>↗</span>
                </button>
              ))}
            </div>
          )}
        </main>
      )}
      {page === "captain" && (
        <main className="content">
          <div className="eyebrow">YOUR PERSISTENT AGENT</div>
          <h1>A captain with history.</h1>
          <section className="passport"><CaptainPortrait faction={profile.faction}/><div><span className="eyebrow">{boot.profile.wallet?"WALLET-LINKED CAPTAIN":"GUEST CAPTAIN"}</span><h2>{profile.name || "Your next chapter"}</h2><p>{FACTIONS[profile.faction].name} · {boot.profile.xp} XP · {boot.profile.wins} wins</p><code>CAPTAIN / {boot.profile.id.slice(0,8).toUpperCase()}</code></div><div className="passport-actions"><button onClick={()=>run(async()=>{await navigator.clipboard.writeText(boot.profile.id);setNotice("Full captain ID copied.")})}>Copy captain ID</button><button onClick={()=>{setPage("observatory");livingFrame.current?.contentWindow?.postMessage({type:"OUTPOST_FOCUS_CAPTAIN"},location.origin)}}>Visit my outpost ↗</button>{!boot.profile.wallet&&<button onClick={()=>run(connect)}>Link wallet to return later</button>}</div></section>
          <p className="intro">
            Rivals use deterministic tactical policies. Their memories record
            alliances and clashes. You choose your captain’s orders; no AI
            controls your wallet.
          </p>
          <div className="columns">
            <section className="panel">
              <h2>Captain’s mandate</h2>
              <label>
                Name
                <input
                  maxLength={24}
                  value={profile.name}
                  onChange={(e) =>
                    setProfile({ ...profile, name: e.target.value })
                  }
                />
              </label>
              <label>
                Faction
                <select
                  value={profile.faction}
                  onChange={(e) =>
                    setProfile({ ...profile, faction: Number(e.target.value) })
                  }
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
                  onChange={(e) =>
                    setProfile({ ...profile, stance: e.target.value })
                  }
                >
                  <option value="balanced">Balanced</option>
                  <option value="bold">
                    Bold: +1 strength; Contest costs +1
                  </option>
                  <option value="careful">
                    Careful: +1 defending owned terrain
                  </option>
                </select>
              </label>
              <label>
                Equipped cosmetic
                <select
                  value={profile.skin}
                  onChange={(e) =>
                    setProfile({ ...profile, skin: e.target.value })
                  }
                >
                  <option value="">Frontier uniform</option>
                  {boot.inventory.map((id: string) => (
                    <option key={id} value={id}>
                      {boot.shop.items.find((i: any) => i.id === id)?.name ||
                        id}
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
                Save captain →
              </button>
            </section>
            <section className="panel captain-card">
              <div
                className="captain-emblem"
                style={{ color: FACTIONS[profile.faction].color }}
              >
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
              <p className="hint">Solo rivals carry their opinion of your captain into the next encounter. Ranked games start neutral.</p>
              {Object.entries(boot.profile.rivalMemory||{}).filter(([id])=>Number(id)!==boot.profile.faction).map(([id,value])=><p key={'rival-'+id}><b>{FACTIONS[Number(id)]?.name}</b>: {Number(value)>0?'Trust +'+value:Number(value)<0?'Grudge '+value:'Neutral'}</p>)}
              {!Object.keys(boot.profile.rivalMemory||{}).length&&<p>No history yet. Meet a rival in a solo match.</p>}
              <h3>Your captain’s memory</h3>
              {Object.entries(profile.memory).length ? (
                Object.entries(profile.memory).map(([i, value]) => (
                  <p key={i}>
                    {FACTIONS[Number(i)]?.name}:{" "}
                    {Number(value) > 0
                      ? "Trust +" + value
                      : Number(value) < 0
                        ? "Grudge " + value
                        : "Neutral"}
                  </p>
                ))
              ) : (
                <p>No shared history yet. Play a frontier to begin.</p>
              )}
              <p className="hint">
                Ranked play resets stances and memory for equal starts. Guest
                profiles stay on this browser; link a wallet to restore your
                account elsewhere.
              </p>
            </section>
          </div>
        </main>
      )}
      {page === "warroom" && (
        <main className="content">
          <div className="eyebrow">THE WAR ROOM</div>
          <h1>Earn your place.</h1>
          <div className="columns">
            <section className="panel">
              <h2>Daily equal-start challenge</h2>
              <p>
                Same map seed. Same faction and stance. Neutral market costs.
                One ranked attempt per account each UTC day. Best score in the
                last seven days ranks.
              </p>
              <button
                className="primary"
                disabled={busy}
                onClick={() => start("weekly")}
              >
                Begin today’s attempt →
              </button>
              <p className="hint">
                No cash or token rewards. Account limits are not proof of unique
                humans.
              </p>
              <h3>Seven-day standings</h3>
              {board.length ? (
                board.map((p, i) => (
                  <div className="leader row" key={i}>
                    <span>
                      {String(i + 1).padStart(2, "0")} · {p.name}
                    </span>
                    <b>{p.score} renown</b>
                  </div>
                ))
              ) : (
                <p>No completed ranked attempts yet. Set the first score.</p>
              )}
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
                          : (setMatch(h.id), setPage("tactics"))
                      }
                    >
                      {h.status === "finished" ? "Replay ↗" : "Resume →"}
                    </button>
                  </div>
                ))
              ) : (
                <p>Your finished games will appear here.</p>
              )}
            </section>
          </div>
        </main>
      )}
      {page === "armory" && (
        <main className="content">
          <div className="eyebrow">THE ARMORY</div>
          <h1>Make your mark.</h1>
          <p className="intro">
            Distinctive looks. Equal strength. Every item is cosmetic, with no
            effect on combat, supply or ranked scoring.
          </p>
          <div className="status-panel">
            {boot.shop.enabled
              ? "Onchain checkout configured"
              : boot.shop.reason}{" "}
            ·{" "}
            {boot.chain.id === 46630
              ? "Testnet assets have no intended monetary value."
              : "Prices are merchant-set, not an exchange quote."}
          </div>
          <div className="shop-grid">
            {boot.shop.items.map((item: any) => (
              <section className="shop-card" key={item.id}>
                <div
                  className={"item-art " + item.kind}
                  style={{ color: item.color }}
                >
                  <span>
                    {item.kind === "banner"
                      ? "⚑"
                      : item.kind === "theme"
                        ? "☾"
                        : item.kind === "badge"
                          ? "✧"
                          : "♜"}
                  </span>
                </div>
                <button className="preview-button" onClick={()=>setPreviewSkin(item.id)}>Preview in the world ↗</button>
                <small>{item.category}</small>
                <h3>{item.name}</h3>
                <p>{item.description}</p>
                <div className="row">
                  <b>{(item.priceCents / 100).toFixed(2)} USDG</b>
                  <span>Cosmetic</span>
                </div>
                {boot.inventory.includes(item.id) ? (
                  <button disabled>Owned · equip in Captain</button>
                ) : (
                  <div className="row">
                    <button
                      disabled={busy || !boot.shop.enabled}
                      onClick={() =>
                        run(async () => {
                          if (!boot.profile.wallet) {
                            const linked = await connect();
                            if (!linked.profile.onboarded) return;
                          }
                          if (!boot.profile.onboarded && boot.profile.wallet)
                            throw Error("Create your captain before checkout");
                          setQuote(
                            await api("/shop/orders", {
                              sku: item.id,
                              asset: "stable",
                            }),
                          );
                        })
                      }
                    >
                      USDG
                    </button>
                    <button
                      disabled={busy || !boot.shop.enabled || !boot.shop.rivalEnabled}
                      onClick={() =>
                        run(async () => {
                          if (!boot.profile.wallet) {
                            const linked = await connect();
                            if (!linked.profile.onboarded) return;
                          }
                          if (!boot.profile.onboarded && boot.profile.wallet)
                            throw Error("Create your captain before checkout");
                          setQuote(
                            await api("/shop/orders", {
                              sku: item.id,
                              asset: "rival",
                            }),
                          );
                        })
                      }
                    >
                      RIVAL
                    </button>
                  </div>
                )}
              </section>
            ))}
          </div>
          {pending && (
            <section className="panel">
              <h3>Purchase awaiting confirmation</h3>
              <p className="hash">{pending.hash}</p>
              <button
                onClick={() =>
                  run(async () => {
                    await api("/shop/orders/" + pending.id + "/confirm", {
                      hash: pending.hash,
                    });
                    setPending(null);
                    localStorage.removeItem("pending-purchase");
                    await refresh();
                    setNotice("Purchase confirmed.");
                  })
                }
              >
                Retry receipt confirmation
              </button>
            </section>
          )}
        </main>
      )}
      {page === "economy" && (
        <main className="content">
          <div className="eyebrow">TRANSPARENT BY DESIGN</div>
          <h1>
            Play is free.
            <br />
            Style funds the frontier.
          </h1>
          <p className="intro">
            RIVAL is optional cosmetic utility. There are no promised returns,
            paid combat boosts, passive yield or inflationary play-to-earn
            rewards.
          </p>
          <div className="economy-grid">
            <section className="panel">
              <small>CANONICAL TOKEN</small>
              <h2>RIVAL</h2>
              <p>
                Planned o1 Standard launch on Robinhood Chain. Fixed launch
                supply: 1 billion. The launch pool receives the supply; there is
                no separate team or gameplay-rewards allocation in this design.
              </p>
              <p className="hash">
                {boot.chain.token || "Token not deployed / configured"}
              </p>
              {boot.chain.token && (
                <a
                  target="_blank"
                  rel="noreferrer"
                  href={boot.chain.explorer + "/token/" + boot.chain.token}
                >
                  Inspect token ↗
                </a>
              )}
            </section>
            <section className="panel">
              <small>RIVAL COSMETIC CHECKOUT</small>
              <h2>80% / 20%</h2>
              <div className="split">
                <i />
                <i />
              </div>
              <p>
                80% goes to the operating treasury. 20% is sent to the disclosed
                dead address. Retirement does not reduce the ERC-20 totalSupply
                counter.
              </p>
              <p>
                USDG checkout: 100% treasury. Launchpad trading fees are
                separate from game checkout.
              </p>
            </section>
            <section className="panel">
              <small>NO FINANCIAL SHORTCUTS</small>
              <h2>Earn reputation.</h2>
              <p>
                Wins earn nontransferable XP. Purchases unlock visual identity
                only. More token holders do not guarantee more players, revenue,
                liquidity or token appreciation.
              </p>
              <p>
                Creator marketplace splits are supported by the contract but
                creator publishing is not enabled in this release.
              </p>
            </section>
          </div>
          <section className="panel">
            <h3>Where real-world assets fit</h3>
            <p>
              Optional Robinhood underlying equity prices influence a daily,
              capped Supply cost. The game does not sell equities, hold player
              deposits, offer a vault or distribute investment yield. If fresh
              quotes cannot be verified, the cost modifier is neutral.
            </p>
            <p>
              Current mode: <b>{boot.market.status}</b> · {boot.market.source}
            </p>
          </section>
        </main>
      )}
      <footer>
        <span>HOOD RIVALS</span>
        <span>A small world. A long memory. · v{boot.release?.version||'1.3.0'}</span>
        <button onClick={() => setPage("economy")}>Read the economy ↗</button>
      </footer>
      {boot.profile.wallet && !boot.profile.onboarded && !setupLater && (
        <Dialog title="Create your captain" onClose={()=>setSetupLater(true)}>
          <section className="onboarding">
            <div className="identity-preview"><CaptainPortrait faction={profile.faction}/><div><strong>{profile.name||"Your story starts here"}</strong><small>CAPTAIN / {boot.profile.id.slice(0,8).toUpperCase()}</small></div></div>
            <div className="eyebrow">WALLET VERIFIED · STEP {onboardingStep + 1} OF 3</div>
            <div className="onboarding-progress" aria-hidden="true"><i style={{width: `${(onboardingStep + 1) * 33.34}%`}} /></div>
            {onboardingStep === 0 && <>
              <h2>Your name in the frontier.</h2>
              <p>This captain profile is linked to {boot.profile.wallet.slice(0, 6)}…{boot.profile.wallet.slice(-4)}. Your wallet signature authorized account linking only.</p>
              <label>Captain name
                <input autoFocus maxLength={24} value={profile.name}
                  onChange={e => setProfile({...profile,name:e.target.value})}
                  placeholder="Choose a name" />
              </label>
            </>}
            {onboardingStep === 1 && <>
              <h2>Choose an outpost.</h2>
              <p>Your captain appears with this faction in the living world. Faction is identity, not a paid advantage.</p>
              <div className="onboarding-factions">
                {FACTIONS.map((f,i)=><button key={f.name}
                  type="button" className={profile.faction===i?"selected":""}
                  onClick={()=>setProfile({...profile,faction:i})}>
                  <b style={{color:f.color}}>{f.symbol}</b><span>{f.name}<small>{f.doctrine}</small></span>
                </button>)}
              </div>
            </>}
            {onboardingStep === 2 && <>
              <h2>Set your first mandate.</h2>
              <p>Your stance applies to tactical matches. The living world's agents remain autonomous.</p>
              <div className="onboarding-stances">
                {([["balanced","Balanced","Adapt to the frontier"],["bold","Bold","Take risks in contests"],["careful","Careful","Defend what you hold"]] as const)
                  .map(([id,label,description])=><button key={id} className={profile.stance===id?"selected":""}
                    onClick={()=>setProfile({...profile,stance:id})}><b>{label}</b><small>{description}</small></button>)}
              </div>
              <div className="onboarding-summary">{profile.name} · {FACTIONS[profile.faction].name} · {profile.stance}</div>
            </>}
            {error&&<p role="alert" className="setup-error">{error}</p>}
            <div className="onboarding-controls">
              {onboardingStep>0 && <button disabled={busy} onClick={()=>setOnboardingStep(onboardingStep-1)}>← Back</button>}
              {onboardingStep<2
                ? <button className="primary" disabled={busy||(onboardingStep===0&&!/^[\w \-']{2,24}$/.test(profile.name.trim()))}
                  onClick={()=>setOnboardingStep(onboardingStep+1)}>Continue →</button>
                : <button className="primary" disabled={busy} onClick={()=>run(async()=>{
                    await api("/onboarding",{name:profile.name.trim(),faction:profile.faction,stance:profile.stance});
                    const b=await refresh();
                    setOnboardingStep(0);
                    setPage("observatory");
                    syncLivingCaptain(b.profile);
                    setNotice("Captain created. Enter the living world.");
                  })}>Create captain →</button>}
            </div>
          </section>
        </Dialog>
      )}
      {walletStage && <div className="wallet-progress" role="status"><span className="dot"/>{walletStage}</div>}
      {accountOpen && <Dialog title="Your frontier account" onClose={()=>setAccountOpen(false)}><div className="identity-preview"><CaptainPortrait faction={boot.profile.faction}/><div><strong>{boot.profile.name}</strong><small>{boot.profile.onboarded?"Captain ready":"Setup incomplete"}</small></div></div><p className="hash">{boot.profile.wallet}</p><p>Your profile and match record are saved by the game server. Reconnect this wallet to restore them.</p><div className="account-actions"><button onClick={()=>{setAccountOpen(false);setPage("captain")}}>Manage captain</button><button disabled={busy} onClick={()=>{setAccountOpen(false);run(()=>connect(false,true))}}>Switch wallet</button><button disabled={busy} onClick={()=>run(async()=>{await api("/session/logout",{});location.reload()})}>Sign out of this device</button></div><small>Signing out ends this game session. It does not revoke wallet permissions or delete your captain.</small></Dialog>}
      {showHelp && <Dialog title="Six rounds. One frontier." onClose={()=>setShowHelp(false)}><ol className="rules-list"><li><b>Scout</b> reveals a route. It does not capture.</li><li><b>Contest</b> claims explored ground. A banner earns one Renown every round you hold it.</li><li><b>Develop</b> restores strength or improves supply and defence.</li><li><b>Pact</b> works only when both captains offer it to each other that round.</li><li><b>Win</b> with the most Renown after six rounds, or hold all three banners at once.</li></ol><p>All captains plan simultaneously. Inspect the last-round report to understand clashes. Cosmetics never change strength.</p><button className="primary" onClick={()=>setShowHelp(false)}>Back to my frontier</button></Dialog>}
      {previewSkin!==null && <Dialog title={boot.shop.items.find((i:any)=>i.id===previewSkin)?.name||'Original captain'} onClose={()=>setPreviewSkin(null)}><p>Try the look on the tactical board. This preview does not purchase or equip it.</p><div className="cosmetic-preview"><World game={previewGame} cosmetic={previewSkin}/></div><div className="row"><button onClick={()=>setPreviewSkin(previewSkin?'':boot.shop.items[0].id)}>{previewSkin?'Compare original':'Try Mossbound'}</button><button className="primary" onClick={()=>setPreviewSkin(null)}>Back to Armory</button></div><small>Same frontier art as the match and replay. The living island keeps its own simulation.</small></Dialog>}
      {quote && (
        <div className="modal-backdrop">
          <section
            className="modal"
            role="dialog"
            aria-modal="true"
            aria-label="Review cosmetic purchase"
          >
            <div className="eyebrow">REVIEW BEFORE SIGNING</div>
            <h2>
              {boot.shop.items.find((i: any) => i.id === quote.sku)?.name}
            </h2>
            <h3>{quote.displayAmount}</h3>
            <p>
              Cosmetic access only. Network gas is additional. Signed price
              expires in {Math.max(0,Math.ceil((quote.order.expires*1000-clock)/1000))} seconds.{" "}
              {quote.asset === "rival"
                ? "20% retirement / 80% treasury."
                : "100% treasury."}
            </p>
            <p className="hash">Contract: {quote.store}</p>
            <button
              disabled={busy || quote.order.expires*1000<=clock}
              className="primary"
              onClick={() => run(purchase)}
            >
              Approve & purchase →
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
createRoot(document.getElementById("root")!).render(<WalletProviders><App /></WalletProviders>);
