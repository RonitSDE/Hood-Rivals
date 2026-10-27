import { existsSync } from "node:fs";
if (existsSync(".env")) process.loadEnvFile(".env");
export const config = {
  port: Number(process.env.PORT || 3000),
  db: process.env.DB_PATH || "data/outpost.sqlite",
  origin: process.env.APP_ORIGIN || "http://localhost:3000",
  production: process.env.NODE_ENV === "production",
  roundMs: Number(process.env.ROUND_SECONDS || 40) * 1000,
  chainId: Number(process.env.CHAIN_ID || 46630),
  rpc: process.env.RPC_URL || "https://rpc.testnet.chain.robinhood.com",
  store: process.env.STORE_ADDRESS || "",
  token: process.env.TOKEN_ADDRESS || "",
  stable: process.env.STABLE_ADDRESS || "",
  treasury: process.env.TREASURY_ADDRESS || "",
  signer: process.env.QUOTE_SIGNER_PRIVATE_KEY || "",
  marketMode: process.env.MARKET_MODE || "scenario",
  symbol: process.env.MARKET_SYMBOL || "NVDA",
  confirmations: Number(process.env.CONFIRMATIONS || 3),
  tokenUnitsPerDollar: process.env.TOKEN_UNITS_PER_DOLLAR || "",
  tokenDecimals: Number(process.env.TOKEN_DECIMALS || 18),
  stableDecimals: Number(process.env.STABLE_DECIMALS || 6),
};
if (
  !Number.isFinite(config.port) ||
  config.roundMs < 1000 ||
  !Number.isFinite(config.roundMs)
)
  throw Error("Invalid port or round duration");
if (![4663, 46630].includes(config.chainId))
  throw Error("Only Robinhood Chain mainnet (4663) and testnet (46630) are supported");
if (config.production && !config.origin.startsWith("https://"))
  throw Error("Production APP_ORIGIN must use HTTPS");
export type Config = typeof config;

if (!Number.isInteger(config.confirmations) || config.confirmations < 1 || config.confirmations > 100)
  throw Error("CONFIRMATIONS must be an integer from 1 to 100");
for (const decimals of [config.tokenDecimals, config.stableDecimals])
  if (!Number.isInteger(decimals) || decimals < 0 || decimals > 36) throw Error("Invalid token decimals");
const appURL = new URL(config.origin);
if (appURL.origin !== config.origin || appURL.username || appURL.password)
  throw Error("APP_ORIGIN must be an exact origin without a path or credentials");
