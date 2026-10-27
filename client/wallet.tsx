import { useEffect, useRef, type ReactNode } from "react";
import "@rainbow-me/rainbowkit/styles.css";
import { RainbowKitProvider, darkTheme, getDefaultConfig } from "@rainbow-me/rainbowkit";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { getAccount, type GetAccountReturnType } from "@wagmi/core";
import { WagmiProvider, useAccount } from "wagmi";
import { useConnectModal } from "@rainbow-me/rainbowkit";
import type { Chain } from "wagmi/chains";

const projectId = import.meta.env.VITE_WALLETCONNECT_PROJECT_ID || "00000000000000000000000000000000";

export const robinhood = {
  id: 4663,
  name: "Robinhood Chain",
  nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
  rpcUrls: { default: { http: ["https://rpc.mainnet.chain.robinhood.com"] } },
  blockExplorers: { default: { name: "Robinhood Chain", url: "https://robinhoodchain.blockscout.com" } },
} as const satisfies Chain;

export const robinhoodTestnet = {
  id: 46630,
  name: "Robinhood Chain Testnet",
  nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
  rpcUrls: { default: { http: ["https://rpc.testnet.chain.robinhood.com"] } },
  blockExplorers: { default: { name: "Robinhood Testnet", url: "https://explorer.testnet.chain.robinhood.com" } },
} as const satisfies Chain;

export const walletConfig = getDefaultConfig({
  appName: "Hood Rivals",
  projectId,
  chains: [robinhoodTestnet, robinhood],
  ssr: false,
});

const queryClient = new QueryClient();
const theme = darkTheme({
  accentColor: "#c3e796",
  accentColorForeground: "#162615",
  borderRadius: "medium",
});

type Pending = {
  resolve: (address: string) => void;
  reject: (error: Error) => void;
};
let pending: Pending | null = null;
let sawModal = false;

export function connectWithRainbowKit() {
  const current = getAccount(walletConfig);
  if (current.isConnected && current.address) return Promise.resolve(current.address);
  return new Promise<string>((resolve, reject) => {
    if (!openConnect) {
      reject(Error("Wallet login is still loading. Try again."));
      return;
    }
    pending = { resolve, reject };
    sawModal = false;
    openConnect();
  });
}

let openConnect: (() => void) | null = null;

function WalletBridge() {
  const { openConnectModal, connectModalOpen } = useConnectModal();
  const { address, isConnected } = useAccount();
  const previous = useRef<string | undefined>(undefined);
  useEffect(() => {
    openConnect = openConnectModal ?? null;
  }, [openConnectModal]);
  useEffect(() => {
    if (previous.current && address && previous.current.toLowerCase() !== address.toLowerCase())
      window.dispatchEvent(new Event("outpost:wallet-change"));
    if (previous.current && !address) window.dispatchEvent(new Event("outpost:wallet-change"));
    previous.current = address;
    if (pending && isConnected && address) {
      pending.resolve(address);
      pending = null;
      sawModal = false;
    }
  }, [address, isConnected]);
  useEffect(() => {
    if (connectModalOpen) sawModal = true;
    if (!connectModalOpen && sawModal && pending) {
      const waiting = pending;
      window.setTimeout(() => {
        if (pending !== waiting) return;
        const account: GetAccountReturnType = getAccount(walletConfig);
        if (account.isConnected && account.address) {
          pending.resolve(account.address);
          pending = null;
          return;
        }
        pending.reject(Error("Wallet connection cancelled. Your game is still available."));
        pending = null;
        sawModal = false;
      }, 400);
    }
  }, [connectModalOpen]);
  return null;
}

export function WalletProviders({ children }: { children: ReactNode }) {
  return (
    <WagmiProvider config={walletConfig}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider initialChain={robinhoodTestnet} theme={theme} modalSize="compact">
          <WalletBridge />
          {children}
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}
