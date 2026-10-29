# Hood Rivals v2.1.0 — Robinhood testnet beta source

Read `docs/RELEASE_V2.1.0.md` for verified scope, known limits and the deployment gate.

With Node 24:

```sh
npm ci --ignore-scripts
cp .env.example .env
npm run build
npm test
npm start
```

Open http://localhost:3000. Guest play needs no wallet or contracts. The Agent ID mint requires a separately deployed and opened testnet collection; checkout remains disabled until contracts, signer and assets are deployed and configured. Preserve the SQLite volume across deployments because it holds Agent ID tactical memory. Log in uses RainbowKit. Browser extension wallets work without extra setup. QR pairing needs `VITE_WALLETCONNECT_PROJECT_ID` before the production build.
