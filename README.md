# Hood Rivals — v2.4.0

**A small world. A long memory.** The front door is a 64×64 isometric island where three outposts and their agents act autonomously. Wallet connection on Robinhood Chain leads to a saved captain and a separate, authoritative six-round tactical game. React, Three.js, Express, SQLite, EVM cosmetic checkout and o1 token launch preparation are included.

## What this release actually does

- Explore the pixel-art living world: Emberhold, Tidewatch and Sunreach, agent memories, gathering, monsters, duels, capture, a feed and minimap. This island runs **locally in each browser**. Its decisions, PX and outcomes are **not** shared or saved by the server.
- Connect a discovered EVM wallet or injected wallet app browser, sign a one-use account-link message, create a named captain, choose one of the three outposts and a stance. Returning wallets restore their captain. The connected name and faction appear in the local island. A saved account card shows tactical matches, wins, XP and cosmetics.
- A five-chapter Field Guide appears after a new wallet-linked captain joins. It covers the local resource loop, six-round tactical play, Human/Agent choice and the Agent ID. Captions are always visible; optional browser voice narration and short synthesized sound cues are opt-in. Completion is saved with the captain; the guide stays available in navigation.
- The optional Agent ID contract caps minting at 3,333, one per wallet. A wallet can mint a pixel identity with three mutable visual traits, bind it to a captain, select a rule-based decision style and delegate solo tactical rounds. Its verified ID also appears in the local island inspector. Agent tactical memory is stored in SQLite under token ID and follows a newly verified owner after transfer; preserve and back up the database. Agent play never signs wallet transactions, never enters ranked and gives no combat advantage.
- Wallet-linked captains can assign a free Quartermaster, Engineer or Scout on a one-minute **Agent Mission** with a chosen resource, careful/bold approach and maximum food spend. Wood, stone and food start unlocked; the level-one beacon opens ore and intel. Matched specialists earn one extra unit, and later beacon levels consume the new materials. The server resolves three scheduled decisions while the browser is closed. A verified linked Agent ID labels the runner if present; an NFT is optional. Three assignments per UTC day, one active at a time. These resources persist in SQLite and provide no ranked advantage, cash, token or transferable reward. The island's Saved Outpost panel shows this balance, accepts careful zero-spend specialist orders and builds the server-saved beacon; the beacon appears at the linked captain's base. Ambient island agents remain local visual simulation.
- Free, Scout Pass and Command Pass are shown as **package design previews**. Paid automation, recurring passes, offline queues and entitlement payments have not been implemented and cannot be purchased.
- Play a distinct six-round tactical match against two autonomous agents, or create a room with up to three humans. Empty seats become agents. Orders resolve simultaneously; 40-second timeout holds absent players. The tactical game uses a Three.js hex board, server-owned rules, replay and SQLite persistence.
- Daily equal-start challenge for wallet-linked captains, a visible seven-day leaderboard with top three on the homepage and personal rank, completed match replay with downloadable hash-chain receipts. `/rankings` is a public shareable page; scores link to server replay receipts, and the page can export a PNG social card. One attempt per linked account per UTC day; multiple wallets remain possible.
- Optional wallet identity, exact-allowance cosmetic checkout, signed expiring orders, persisted pending purchase recovery, canonical receipt confirmation and owned cosmetic equipment. The Armory is unavailable until contracts, assets and signer pass live RPC checks; a new wallet must finish captain setup before a quote is issued.
- Cosmetic token payments split 80% treasury / 20% dead-address retirement. USDG payments go 100% treasury. No combat boosts, yield, vaults or guaranteed appreciation.
- Optional Robinhood equity quote adapter for capped daily scenario costs. Defaults to explicit **scenario** mode. Stale/unavailable quotes produce neutral costs.

This is source for developer deployment. **No Robinhood contracts, token, Agent ID collection, paid public app or o1 launch have been deployed by this package.** The roaming isometric island is a browser simulation; its Saved Outpost panel displays and controls the authoritative server mission store. Local tests are not a contract audit or proof of real network integration. Read `docs/RELEASE_V2.2.0.md` for the testnet gate.

## Experience and campaign

- Free guided practice with legal suggestions, no timer and no progression rewards.
- Search/filter/pin local agents, intentional camera follow, mobile detail panels and background-tab pause.
- Explicit distinction between local island exploration and saved tactical play.
- Rival agents remember prior solo encounters; ranked and practice do not overwrite solo memory.
- Recaps from actual match events, rematch/invite actions, replay sharing and downloadable battle cards.
- Pixel tactical board, quote-expiry feedback, and RainbowKit login. QR pairing needs `VITE_WALLETCONNECT_PROJECT_ID` at build time.
- Three.js loads on demand. Account-scoped API limits replace a shared-IP polling bottleneck.

Read `docs/RELEASE_V2.2.0.md` before deployment. This release does not turn the island into a shared multiplayer service.

## Run locally

Node **24** recommended (22.13 is the minimum; older versions lack the built-in SQLite the game uses). `npm run dev` and `npm start` first check Node, installed packages, `.env` and free ports, and print the exact fix if something is wrong.

**Development** (live reload, one command):

```sh
npm ci
cp .env.example .env
npm run dev
```

Open `http://localhost:5173`. This runs the API on :3000 and the Vite dev server on :5173 together; keep `APP_ORIGIN=http://localhost:3000`.

**Production-style** (what Docker runs):

```sh
npm run build
npm start
```

Open `http://localhost:3000`. `npm start` serves whatever is in `dist/`, so run `npm run build` again after changing client code; the server prints a warning when `dist/` is missing or older than the source.

The living island and guest tactical game need no wallet, API key or blockchain. The Armory is disabled until contract configuration passes RPC checks.

```sh
npm test
npm run simulate
npm run economics
npm run contracts:compile
```

## Developer launch order

1. Deploy gameplay on HTTPS with a persistent volume. Follow `docs/DEPLOYMENT.md`; one application replica only.
2. On **Robinhood testnet 46630**, fund a deployer with test ETH, set owner/treasury/quote signer addresses, then run `npm run contracts:deploy -- --testnet-mocks` (dry run), followed by `--testnet-mocks --broadcast` when ready. Mock supply belongs to deployer; transfer test assets to QA wallets.
3. Set returned contract addresses plus server quote signer secret. Restart. Run `npm run preflight`. Run the guarded `npm run testnet:smoke -- --broadcast` with a funded test buyer, then test equip and wallet recovery on desktop/mobile. Keep the explorer link.
3a. Separately deploy `RivalAgentID` to Robinhood testnet with `npm run contracts:deploy -- --agent-id-only` (dry run) then `--agent-id-only --broadcast`. Set `AGENT_ID_ADDRESS` on the app and verify with `npm run agent:collection`. The owner must open mint from an isolated operator shell with `npm run agent:collection -- --open --broadcast`. Keep deployer and owner keys off the hosted app. See `docs/RELEASE_V2.1.0.md`.
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
| `server/db.ts`, `server/missions.ts` | SQLite schema, saved outpost projects and scheduled mission decisions |
| `server/shop.ts` | Merchant quotes and verified purchase fulfilment |
| `server/market.ts` | Optional Robinhood price snapshot adapter |
| `public/observatory.html`, `public/observatory.js` | Isometric living island; independent browser simulation |
| `client/pages/` | One file per URL: `index.tsx` → `/`, `missions.tsx` → `/missions`, `replay/[id].tsx` → `/replay/:id`, `404.tsx` for unknown paths |
| `client/router.tsx` | File-based router: builds routes from `client/pages/`, lazy-loads each page, `Link`/`navigate`/`useParams` |
| `client/app/AppState.tsx` | Shared session, captain, wallet, match and mission state; pages read it with `useApp()` |
| `client/components/` | Layout (header, nav, dialogs), tactical board view shared by Play and Replay, portraits |
| `client/lib/` | API client and shared constants |
| `client/theme.css` | Design tokens and the visual system (loaded after the legacy `style.css`) |
| `client/sound.ts` | Optional browser narration and small synthesized cues |
| `contracts/OutpostStore.sol` | Signed cosmetic payment split contract |
| `contracts/RivalAgentID.sol` | Optional 3,333 customizable onchain Agent IDs |
| `shared/agent.ts` | Legal rule-based delegated solo decisions |
| `contracts/MockToken.sol` | Test fixture; not a mainnet token |
| `scripts/` | Compile, deploy, preflight, backup, simulation, economics, launch preparation |
| `test/` | Engine, HTTP service and EVM integration tests |

### Adding a page

Create `client/pages/<name>.tsx` with a default-exported component; it is served at `/<name>` with no other wiring. Use `[param].tsx` for dynamic segments and read them with `useParams()`. Link to it with `<Link to="/<name>">`. Add it to `NAV` in `client/components/Layout.tsx` if it belongs in the header.

## Boundaries

Agents are rule-based policies, not LLM traders. The living island does not write world outcomes to the server; captain identity, Agent ID tactical memory and the separate tactical game are persisted. Human tactical orders are manually committed. Delegated orders use the same authoritative rules and only enter solo matches. No real equity ownership, prediction-market trading, RWA vault, bridging, staking, revenue share, mobile native app or creator publishing UI is included. Contract creator splits exist for a later separately reviewed creator marketplace. Agent IDs are transferable, while land and items are not NFTs in this release; the server grants cosmetic access after a valid receipt.

The island's ambient wood, stone and food gathering still resets on refresh. **Saved Outpost in the island reads the separate, server-saved mission store** and can order specialists or build its beacon; the matching beacon sprite reflects the saved level. Ambient agents do not deposit materials into that store. The tactical game's supply posts produce match Supplies only. Agent solo play is active-match delegation. There is no paid automation package, transferable resource yield or onchain mission settlement. The four automation playbooks are free tactics. Audio uses browser speech synthesis and Web Audio, so voice availability and sound quality vary by device.

Replay integrity proves that saved server receipts form a consistent hash chain; the server can rewrite its own history. It is not trustless gameplay execution, blockchain anchoring or independent anti-cheat proof. Ranked requires a linked wallet and captain, but multiple wallets can still enter, so no money is awarded.

Mission event integrity has the same limit: `GET /api/missions/:id/proof` checks the server's stored event hash chain, but the server can rewrite that history. Mission materials and the beacon do not affect the ranked starting state.

The code is a deployable MVP, not an audited financial product. Human playtesting, visual/browser QA, real Robinhood/o1 smoke tests, and operational security review are required before public paid launch. No token-price or virality guarantee is made.
