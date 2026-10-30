// The wallet stack (RainbowKit, wagmi, WalletConnect) is ~1 MB of JavaScript.
// It is only needed once a captain logs in, so it is loaded on demand instead of
// blocking the first paint of every page.
type WalletModule = typeof import("./wallet");
let loading: Promise<WalletModule> | null = null;

export function loadWallet(): Promise<WalletModule> {
  loading ??= import("./wallet").then(async (m) => {
    await m.mountWallet();
    return m;
  });
  loading.catch(() => (loading = null));
  return loading;
}

/** Warm the wallet chunk without blocking the page (used on hover/focus and for linked captains). */
export function prefetchWallet(delayMs = 0) {
  if (loading) return;
  const start = () => void loadWallet().catch(() => {});
  const idle = (window as any).requestIdleCallback as
    | undefined
    | ((cb: () => void, o?: { timeout: number }) => void);
  window.setTimeout(() => (idle ? idle(start, { timeout: 4000 }) : start()), delayMs);
}
