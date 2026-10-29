# Hood Rivals v1.7.0 verification — 2026-10-27

- Clean `npm ci --ignore-scripts --no-audit` succeeded on Node 24.22.1.
- `npm run build` completed TypeScript and Vite; the tactical Three.js module is lazy loaded. The 555 kB uncompressed World chunk remains a build-size warning, approximately 140 kB gzip.
- `npm test`: 16/16 passed, including API/session/CSRF and local Ganache EIP-712 checkout, replay, payer, asset, expiry, pause, duplicate SKU, treasury and receipt fulfilment checks.
- `npm run contracts:compile` passed. `npm run simulate`: 1,200 games with zero tested rule invariant violations. These simulations do not predict retention or prove fair competition.
- `npm run economics` generated the assumption-driven scenarios in `reports/economics.json`; they are not token price or revenue forecasts.
- `npm audit --omit=dev --audit-level=high` reported zero known production dependency vulnerabilities on this date. This is a registry advisory check, not a security audit.
- Local Express smoke: `/healthz`, `/readyz`, `/` and the selected PNG returned 200; guest session/bootstrap returned Robinhood testnet chain 46630 and checkout disabled when no contract configuration was present.
- Private browser visual QA: the selected PNG rendered on the first screen, the local island rendered and the no-WebGL tactical fallback displayed an interactive hex map with selected-tile details. This preview uses sample data, no server/payment/wallet. The cloud browser has WebGL disabled, so the Three.js tactical scene still needs device QA.
- `npm run testnet:smoke` without `--broadcast` refused to transact as intended. The real transaction path could not run: no funded Robinhood testnet key, deployed store/token addresses or public full-stack HTTPS host were provided. There is no real chain receipt in this release.

Before paid beta, operate the exact v1.7.0 source at an HTTPS origin, deploy test contracts, run `npm run preflight`, then run the guarded smoke purchase from a separate funded test wallet. Retain actual explorer hashes and verify inventory/equip in a real wallet. Perform device, load and independent contract/security review before expanding access.
