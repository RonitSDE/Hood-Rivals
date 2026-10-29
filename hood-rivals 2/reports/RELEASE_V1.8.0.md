# Hood Rivals v1.8.0 verification — 2026-10-28

- `npm test`: 17/17 passing. Added a leaderboard API test covering empty board, top 30, personal rank outside top 30, best-of-week scoring, deterministic tie order, exclusion of guest and expired results, and no public wallet address. Existing API test checks guest ranked rejection, result persistence and daily limit.
- `npm run build`: TypeScript and Vite passed. The tactical Three.js chunk remains approximately 555 kB minified / 140 kB gzip and loads lazily.
- `npm run contracts:compile`: passed. `npm run simulate`: 1,200 deterministic matches, no tested rule invariant violations. This does not validate human retention or resistance to multiple wallets.
- No real Robinhood testnet smoke purchase, device/browser test of this exact leaderboard UI, public full-stack deployment, or independent security review was performed in this release. The earlier static visual preview is sample data and does not include the leaderboard changes.

Before public beta, deploy the exact build on HTTPS with a persistent single-replica SQLite volume. Play a ranked match with a real linked test wallet, verify its score survives a server restart, test another wallet and a blocked second daily attempt, and complete the separate contract/payment smoke gate described in `docs/RELEASE_V1.7.0.md` if enabling checkout.
