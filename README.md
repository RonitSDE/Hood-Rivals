# Hood Rivals — v1.6.0

**A small world. A long memory.** The front door is a 64×64 isometric island where three outposts and their agents act autonomously. Wallet connection on Robinhood Chain leads to a saved captain and a separate, authoritative six-round tactical game. React, Three.js, Express, SQLite, EVM cosmetic checkout and o1 token launch preparation are included.

## What this release actually does

- Explore the pixel-art living world: Emberhold, Tidewatch and Sunreach, agent memories, gathering, monsters, duels, capture, a feed and minimap. This island runs **locally in each browser**. Its decisions, PX and outcomes are **not** shared or saved by the server.
- Connect a discovered EVM wallet or injected wallet app browser, sign a one-use account-link message, create a named captain, choose one of the three outposts and a stance. Returning wallets restore their captain. The connected name and faction appear in the local island. A saved account card shows tactical matches, wins, XP and cosmetics.
- Play a distinct six-round tactical match against two autonomous agents, or create a room with up to three humans. Empty seats become agents. Orders resolve simultaneously; 40-second timeout holds absent players. The tactical game uses a Three.js hex board, server-owned rules, replay and SQLite persistence.
- Daily equal-start challenge, seven-day leaderboard, completed match replay with downloadable hash-chain receipts.
- Optional wallet identity, exact-allowance cosmetic checkout, signed expiring orders, persisted pending purchase recovery, canonical receipt confirmation and owned cosmetic equipment. The Armory is unavailable until contracts, assets and signer pass live RPC checks; a new wallet must finish captain setup before a quote is issued.
- Cosmetic token payments split 80% treasury / 20% dead-address retirement. USDG payments go 100% treasury. No combat boosts, yield, vaults or guaranteed appreciation.
- Optional Robinhood equity quote adapter for capped daily scenario costs. Defaults to explicit **scenario** mode. Stale/unavailable quotes produce neutral costs.

This is source for developer deployment. **No Robinhood contracts, token, public app or o1 launch have been deployed by this package.** The isometric island is a browser simulation, not authoritative gameplay. Local tests are not a contract audit or proof of real network integration. Read `docs/WALLET_JOURNEY.md` and `reports/VERIFICATION.md` for the flow and exact validation scope.

## Experience and campaign

- Free guided practice with legal suggestions, no timer and no progression rewards.
- Search/filter/pin local agents, intentional camera follow, mobile detail panels and background-tab pause.
- Explicit distinction between local island exploration and saved tactical play.
- Rival agents remember prior solo encounters; ranked and practice do not overwrite solo memory.
- Recaps from actual match events, rematch/invite actions, replay sharing and downloadable battle cards.
- Three.js cosmetic previews, quote-expiry feedback, injected wallet discovery; QR pairing is currently unavailable.
- Three.js loads on demand. Account-scoped API limits replace a shared-IP polling bottleneck.

Read `docs/RELEASE_V1.5.1.md` before deployment. This release does not turn the island into a shared multiplayer service.

## Run locally

Node **24** and npm required.

```sh
npm ci
cp .env.example .env
npm run build
npm start
```

Open `http://localhost:3000`. The living island and guest tactical game need no wallet, API key or blockchain. `APP_ORIGIN` defaults to `http://localhost:3000` for this path. The Armory is disabled until contract configuration passes RPC checks.

For development use two terminals: `npm run dev` and `npm run dev:ui`. Set `APP_ORIGIN=http://localhost:5173`. Production serves the Vite bundle and API from the same origin.

```sh
npm test
npm run simulate
npm run economics
npm run contracts:compile
```

## Developer launch order

1. Deploy gameplay on HTTPS with a persistent volume. Follow `docs/DEPLOYMENT.md`; one application replica only.
2. On **Robinhood testnet 46630**, fund a deployer with test ETH, set owner/treasury/quote signer addresses, then run `npm run contracts:deploy -- --testnet-mocks` (dry run), followed by `--testnet-mocks --broadcast` when ready. Mock supply belongs to deployer; transfer test assets to QA wallets.
3. Set returned contract addresses plus server quote signer secret. Restart. Run `npm run preflight`. Complete real wallet allowance → purchase → receipt → equip tests on desktop and mobile.
4. Review token economics, brand, terms, signer custody and contract security. Never market price appreciation or reward investment returns.
5. Prepare the canonical **o1 Standard / USDG / Robinhood mainnet 4663** token with `npm run launch:prepare`. This only saves an unsigned plan. Review fresh config, simulation, launch fees, expiry, supply and each wallet transaction. Developer signs the reviewed plan separately through the current o1 flow.
6. Use the resulting canonical token address; do **not** deploy MockToken on mainnet. USDG reference address is in `docs/INTEGRATIONS.md` and must be verified onchain.
7. Deploy OutpostStore on mainnet with a multisig owner and treasury and a dedicated low-balance quote signer. Configure assets/pricing, run preflight, then complete a tiny real purchase before opening checkout.
8. Back up SQLite, monitor errors and RPC, set incident ownership, and perform the release checklist. Only then announce.

No server endpoint launches tokens or holds a player's private key. No production secret is included.

## Repository

| Path | Purpose |
|---|---|
| `shared/game.ts` | Pure deterministic game rules and fog projection |
| `server/app.ts` | Session/auth, authoritative rounds, rooms, ranked, replay API |
| `server/db.ts` | SQLite schema and transactions |
| `server/shop.ts` | Merchant quotes and verified purchase fulfilment |
| `server/market.ts` | Optional Robinhood price snapshot adapter |
| `public/observatory.html`, `public/observatory.js` | Isometric living island; independent browser simulation |
| `client/` | Wallet-to-captain journey, saved account, Armory, tactical Three.js world |
| `contracts/OutpostStore.sol` | Signed cosmetic payment split contract |
| `contracts/MockToken.sol` | Test fixture; not a mainnet token |
| `scripts/` | Compile, deploy, preflight, backup, simulation, economics, launch preparation |
| `test/` | Engine, HTTP service and EVM integration tests |

## Boundaries

Agents are rule-based policies, not LLM traders. The living island does not write world outcomes to the server; only captain identity and the separate tactical game are persisted. Human tactical orders are manually committed. No real equity ownership, prediction-market trading, RWA vault, bridging, staking, revenue share, mobile native app or creator publishing UI is included. Contract creator splits exist for a later separately reviewed creator marketplace. There is no transferable land or item NFT in this release: the server grants cosmetic access after a valid receipt.

Replay integrity proves that saved server receipts form a consistent hash chain; the server can rewrite its own history. It is not trustless gameplay execution, blockchain anchoring or independent anti-cheat proof. Ranked guest limits are not Sybil-resistant, so no money is awarded.

The code is a deployable MVP, not an audited financial product. Human playtesting, visual/browser QA, real Robinhood/o1 smoke tests, and operational security review are required before public paid launch. No token-price or virality guarantee is made.
