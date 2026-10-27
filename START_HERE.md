# Hood Rivals v1.6.0 — beta deployment candidate

Read `docs/RELEASE_V1.6.0.md` for verified scope, known limits and the deployment gate.

With Node 24:

```sh
npm ci --ignore-scripts
cp .env.example .env
npm run build
npm test
npm start
```

Open http://localhost:3000. Guest play needs no wallet or contracts. Checkout remains disabled until contracts, signer and assets are deployed and configured. Preserve the SQLite volume across deployments. Use a browser extension or the in-app browser of a mobile wallet; QR pairing is unavailable in this release.
