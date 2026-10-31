/**
 * App-wide state and actions shared by every page: the session, captain profile,
 * wallet, active match, missions, leaderboard and dialogs.
 *
 * Pages read what they need with `useApp()`.
 */
import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { matchRecap } from "../../shared/experience";
import { type Order } from "../../shared/game";
import { STORE_ABI, ERC20_ABI } from "../../shared/checkout";
import { api, setCsrf } from "../lib/api";
import { AGENT_ID_ABI } from "../lib/constants";
import { shareBattle } from "../share";
import { playCue, stopNarration } from "../sound";
import { loadWallet, prefetchWallet } from "../walletLoader";
import { navigate } from "../router";

function useAppController() {
  const completedRefresh = useRef("");
  const [previewSkin, setPreviewSkin] = useState<string | null>(null);
  const [showHelp, setShowHelp] = useState(false);
  const [showGuide, setShowGuide] = useState(false);
  const [guideStep, setGuideStep] = useState(0);
  const [narrating, setNarrating] = useState(false);
  const [soundOn, setSoundOn] = useState(() => {
    try {
      return localStorage.getItem("hood-rivals-sound") === "on";
    } catch {
      return false;
    }
  });
  const lastSound = useRef("");
  const [agent, setAgent] = useState<any>(null);
  const [missions, setMissions] = useState<any>(null);
  const [missionObjective, setMissionObjective] = useState("forest");
  const [missionApproach, setMissionApproach] = useState("careful");
  const [missionFood, setMissionFood] = useState(0);
  const [missionRole, setMissionRole] = useState("quartermaster");
  const [missionProof, setMissionProof] = useState<Record<string, any>>({});
  const [lookChoice, setLookChoice] = useState<[number, number, number]>([0, 0, 0]);
  const [accountOpen, setAccountOpen] = useState(false);
  const [setupLater, setSetupLater] = useState(false);
  const [walletStage, setWalletStage] = useState("");
  const [guideHidden, setGuideHidden] = useState(false);
  // Rival captains in solo play: AI characters on 0G Compute, or the classic rule-based rivals.
  const [aiRivals, setAiRivalsState] = useState(() => {
    try {
      return localStorage.getItem("hood-rivals-ai-rivals") !== "off";
    } catch {
      return true;
    }
  });
  const setAiRivals = (on: boolean) => {
    setAiRivalsState(on);
    try {
      localStorage.setItem("hood-rivals-ai-rivals", on ? "on" : "off");
    } catch {}
  };
  const [boot, setBoot] = useState<any>(),
    [game, setGame] = useState<any>(),
    [match, setMatch] = useState(""),
    [selected, setSelected] = useState(""),
    [order, setOrder] = useState<Order>({ type: "scout" }),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [busy, setBusy] = useState(false),
    [clock, setClock] = useState(Date.now()),
    [board, setBoard] = useState<any>({
      entries: [],
      me: null,
      total: 0,
      since: 0,
      loading: true,
      error: false,
    }),
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
  const loadAgent = async () => {
    try {
      const a = await api("/agent");
      setAgent(a);
      if (a.look) setLookChoice(a.look as [number, number, number]);
      return a;
    } catch (e: any) {
      setAgent({ available: false, error: e.message });
      return null;
    }
  };
  const loadMissions = async () => {
    const result = await api("/missions");
    setMissions(result);
    return result;
  };
  const refresh = async () => {
    const b = await api("/bootstrap");
    setBoot(b);
    setProfile(b.profile);
    setAgent(null);
    loadAgent();
    loadMissions().catch(() => setMissions(null));
    return b;
  };
  const loadBoard = async () => {
    try {
      setBoard({ ...(await api("/leaderboard")), loading: false, error: false });
    } catch (e) {
      setBoard((old: any) => ({ ...old, loading: false, error: true }));
      throw e;
    }
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
      setCsrf(s.csrf);
      const b = await refresh();
      // Linked captains get the wallet stack warmed in the background so account switches are still detected.
      if (b?.profile?.wallet) prefetchWallet(1200);
      loadBoard().catch(() => {});
      const invite = new URLSearchParams(location.search).get("room");
      if (invite) setRoom(invite.toUpperCase());
    });
  }, []);
  useEffect(() => {
    if (!match) return;
    let alive = true;
    const poll = async () => {
      try {
        const g = await api("/matches/" + match);
        if (alive) setGame((old: any) => (JSON.stringify(old) === JSON.stringify(g) ? old : g));
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
    if (!missions?.activeId) return;
    const t = setInterval(() => loadMissions().catch(() => {}), 5000);
    return () => clearInterval(t);
  }, [missions?.activeId]);
  useEffect(() => {
    const resume = () => {
      if (document.visibilityState === "visible" && boot?.profile?.wallet && boot.profile.onboarded)
        loadMissions().catch(() => {});
    };
    document.addEventListener("visibilitychange", resume);
    return () => document.removeEventListener("visibilitychange", resume);
  }, [boot?.profile?.wallet, boot?.profile?.onboarded]);
  useEffect(() => {
    const key = game ? `${game.id}:${game.round}:${game.status}` : "";
    if (key && key !== lastSound.current) {
      if (lastSound.current && soundOn) playCue(game.status === "finished" ? "finish" : "round");
      lastSound.current = key;
    }
  }, [game?.id, game?.round, game?.status, soundOn]);
  useEffect(() => {
    stopNarration();
    setNarrating(false);
  }, [guideStep, showGuide]);
  useEffect(() => {
    if (boot?.profile?.wallet && boot.profile.onboarded && !boot.profile.guideSeen) {
      setGuideStep(0);
      setShowGuide(true);
    }
  }, [boot?.profile?.wallet, boot?.profile?.onboarded, boot?.profile?.guideSeen]);
  useEffect(() => {
    const changed = () => {
      setQuote(null);
      setNotice("Wallet changed. Connect again to verify the active address.");
    };
    window.addEventListener("outpost:wallet-change", changed);
    return () => window.removeEventListener("outpost:wallet-change", changed);
  }, []);
  useEffect(() => {
    if (game?.status === "finished" && completedRefresh.current !== game.id) {
      completedRefresh.current = game.id;
      refresh()
        .then(loadBoard)
        .catch(() => {});
    }
  }, [game?.status, game?.id]);
  const start = (mode: string, control: "human" | "agent" = "human") =>
    run(async () => {
      const rivals = mode === "solo" && aiRivals && boot?.ai?.enabled ? "ai" : "classic";
      const r = await api("/matches", { mode, control, rivals });
      setGame(await api("/matches/" + r.id));
      setMatch(r.id);
      setOrder({ type: "scout" });
      setGuideHidden(false);
      setReplay(null);
      setSelected("");
      navigate("/play?match=" + encodeURIComponent(r.id));
    });
  async function connect(forPurchase = false, rechoose = false) {
    setWalletStage("1 / 3 · Choose your wallet");
    const { walletConfig, connectWithRainbowKit, disconnect, getAccount, signMessage, switchChain } =
      await loadWallet();
    if (rechoose && getAccount(walletConfig).isConnected) await disconnect(walletConfig);
    if (!getAccount(walletConfig).isConnected) await connectWithRainbowKit();
    setWalletStage("2 / 3 · Confirm the network in your wallet");
    const chainId = boot.chain.id as 4663 | 46630;
    if (getAccount(walletConfig).chainId !== chainId) await switchChain(walletConfig, { chainId });
    const account = getAccount(walletConfig);
    if (!account.isConnected || !account.connector)
      throw Error("Wallet disconnected. Choose a wallet to continue.");
    const { BrowserProvider } = await import("ethers");
    const provider = new BrowserProvider((await account.connector.getProvider()) as any);
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
    setCsrf(verified.csrf);
    const updated = await refresh();
    await loadBoard();
    if (verified.restored) {
      setMatch("");
      setGame(null);
      setRoom("");
    }
    if (!updated.profile.onboarded && /^Captain [0-9a-f]{4}$/i.test(updated.profile.name))
      setProfile({ ...updated.profile, name: "" });
    if (!forPurchase) {
      navigate("/");
      setOnboardingStep(0);
      setSetupLater(false);
      setNotice(
        updated.profile.onboarded
          ? verified.restored
            ? "Existing captain restored. Guest match progress is not merged."
            : "Welcome back. Your captain is ready."
          : "Wallet verified. Create your captain to save your identity.",
      );
    }
    return { provider, signer, profile: updated.profile };
  }
  async function purchase() {
    if (!quote) return;
    const { Contract } = await import("ethers");
    const { provider, signer } = await connect(true);
    if ((await signer.getAddress()).toLowerCase() !== quote.order.payer.toLowerCase())
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
    const tx = await new Contract(quote.store, STORE_ABI, signer).purchase(quote.order, quote.signature);
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
  async function agentContract() {
    if (!boot.chain.agentId || !boot.profile.wallet || !boot.profile.onboarded)
      throw Error("Create your wallet-linked captain and deploy the Agent ID collection first.");
    const { signer } = await connect(true);
    if ((await signer.getAddress()).toLowerCase() !== boot.profile.wallet.toLowerCase())
      throw Error("Reconnect the wallet linked to this captain.");
    const { Contract } = await import("ethers");
    return {
      nft: new Contract(boot.chain.agentId, AGENT_ID_ABI, signer),
      address: await signer.getAddress(),
    };
  }
  async function mintAgent() {
    const { nft, address } = await agentContract();
    if (BigInt(await nft.identityOf(address)) !== 0n)
      throw Error("This wallet already has an Agent ID. Bind it instead.");
    setNotice("Confirm the free Agent ID mint in your wallet. Network gas applies.");
    await (await nft.mint(...lookChoice)).wait(boot.chain.id === 46630 ? 1 : 3);
    const tokenId = Number(await nft.identityOf(address));
    await api("/agent/bind", { tokenId });
    await loadAgent();
    setNotice(
      `Agent ID #${tokenId} minted and linked. Its tactical memory begins with your next delegated match.`,
    );
  }
  async function customizeAgent() {
    if (!agent?.linked) throw Error("Bind your Agent ID first.");
    const { nft, address } = await agentContract();
    if (Number(await nft.identityOf(address)) !== agent.tokenId)
      throw Error("This wallet no longer owns the linked Agent ID.");
    setNotice("Confirm the cosmetic change in your wallet. Network gas applies.");
    await (await nft.customize(agent.tokenId, ...lookChoice)).wait(boot.chain.id === 46630 ? 1 : 3);
    await loadAgent();
    setNotice("Agent look updated onchain. Tactical strength is unchanged.");
  }
  async function changeControl(control: "human" | "agent") {
    await api("/matches/" + match + "/control", { control });
    setGame(await api("/matches/" + match));
    setNotice(
      control === "agent"
        ? "Your Agent ID now chooses solo orders. Watch its decisions and take over any round."
        : "You control the next order.",
    );
  }
  async function finishGuide(practice: boolean) {
    stopNarration();
    await api("/guide/complete", {});
    await refresh();
    setShowGuide(false);
    if (practice) start("training");
  }
  const openReplay = (id: string) => navigate("/replay/" + encodeURIComponent(id));
  function share() {
    return run(async () =>
      setNotice(
        await shareBattle(
          game,
          matchRecap(game.events, game.you).moment?.text || "Six rounds. Three rivals. Your move.",
        ),
      ),
    );
  }
  const leave = () =>
    run(async () => {
      await api("/matches/" + match + "/leave", {});
      setGame(null);
      setMatch("");
      navigate("/");
      await refresh();
    });
  return {
    aiRivals,
    setAiRivals,
    accountOpen,
    agent,
    agentContract,
    board,
    boot,
    busy,
    changeControl,
    clock,
    connect,
    customizeAgent,
    error,
    finishGuide,
    game,
    guideHidden,
    guideStep,
    leave,
    loadAgent,
    loadBoard,
    loadMissions,
    lookChoice,
    match,
    mintAgent,
    missionApproach,
    missionFood,
    missionObjective,
    missionProof,
    missionRole,
    missions,
    narrating,
    notice,
    onboardingStep,
    openReplay,
    order,
    pending,
    previewSkin,
    profile,
    purchase,
    quote,
    refresh,
    replay,
    room,
    run,
    selected,
    setAccountOpen,
    setAgent,
    setBoard,
    setBoot,
    setBusy,
    setClock,
    setError,
    setGame,
    setGuideHidden,
    setGuideStep,
    setLookChoice,
    setMatch,
    setMissionApproach,
    setMissionFood,
    setMissionObjective,
    setMissionProof,
    setMissionRole,
    setMissions,
    setNarrating,
    setNotice,
    setOnboardingStep,
    setOrder,
    setPending,
    setPreviewSkin,
    setProfile,
    setQuote,
    setReplay,
    setRoom,
    setSelected,
    setSetupLater,
    setShowGuide,
    setShowHelp,
    setSoundOn,
    setStep,
    setWalletStage,
    setupLater,
    share,
    showGuide,
    showHelp,
    soundOn,
    start,
    step,
    walletStage,
  };
}

export type AppState = ReturnType<typeof useAppController>;
const AppContext = createContext<AppState | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const value = useAppController();
  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp(): AppState {
  const value = useContext(AppContext);
  if (!value) throw Error("useApp must be used inside <AppProvider>");
  return value;
}
