# Hood Rivals v1.8.0 — leaderboard and testnet handoff

## What changed

- The homepage now shows the top three real completed ranked results and the current captain's place. The Rankings page shows the top 30, total eligible captains, personal rank even beyond 30, and a refresh control. Empty, loading and unavailable states are distinct.
- Ranked entry requires a wallet-linked, onboarded captain. Guest practice, solo matches and rooms remain playable. The one-attempt-per-UTC-day rule applies per account, not per human; multiple wallets can still enter.
- The board uses only finished server-owned weekly match results from the last rolling seven days. Each captain's best score counts. Ties use victory, then earlier completion, then a stable account ID. Training and solo games cannot rank. Public board entries exclude wallet addresses and account IDs.

## Deployment gate

Run Node 24 `npm ci --ignore-scripts`, `npm test`, `npm run build`, `npm run contracts:compile`, `npm run simulate`, and `npm run preflight` with your actual protected configuration. Follow `RELEASE_V1.7.0.md` for contract deployment, separate funded buyer, testnet smoke and device acceptance. In particular, confirm a real ranked result appears on the public host after a wallet-linked match finishes, persists across process restart, and that the daily second entry is refused. Back up the SQLite volume before upgrading.

The leaderboard is server-calculated and needs the live API and durable SQLite database. The private sample-data visual preview cannot demonstrate it. No live Robinhood testnet contract address, transaction receipt or paid public host is included. Local build and tests do not certify production security or resistance to multiple wallets.
