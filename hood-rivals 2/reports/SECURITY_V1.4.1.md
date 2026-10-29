# Outpost Rivals v1.4.1 security pass — 2026-10-20

## Findings addressed

1. **Duplicate cosmetic charges.** The checkout contract now tracks `purchasedSku[payer][sku]` and rejects a second signed order for the same cosmetic, even if the orders use different assets. The API checks the onchain status before issuing a quote. A live contract lacking the guard disables checkout during preflight; this contract must be deployed afresh. One SKU is a one-time purchase for each wallet.
2. **Payout configuration.** Checkout now requires `TREASURY_ADDRESS` and verifies that it matches the contract's immutable treasury. The deployment preflight checks the same address.
3. **Runtime dependencies.** The Docker runtime stage copies only the compiled client, server/shared code, package metadata and production dependencies. `tsx` remains a runtime dependency; Ganache and the contract compiler are build/test tooling and are pruned. `npm audit --omit=dev` reported zero advisories with this lockfile. The full developer dependency tree still has advisories under Ganache and is not for the production image.
4. **Error disclosure.** Only deliberately public validation and business errors are returned from the API in production. Unexpected database/RPC errors receive a generic response. Checkout readiness does not reflect arbitrary RPC exception text to the browser.

## Verification performed

- TypeScript/Vite build and Solidity compile passed.
- 14/14 automated tests passed. New cases cover duplicate signed orders across accepted payment assets, production Origin/CSRF rejection, secure session cookie flags, invalid profile input and logout invalidation.
- `npm audit --omit=dev`: zero vulnerabilities reported.
- `npm ci --dry-run` and `npm prune --omit=dev --dry-run` passed. Prune lists Ganache for removal and keeps `tsx`.
- Production mode server startup, `/healthz` and `/readyz` passed locally.
- Static review: authorization for matches, rooms and checkout; nonce binding; cookie flags; CSP; replay exposure; canonical receipt matching; contract reentrancy guard and payout splits.
- No plaintext private key matching `PRIVATE_KEY=0x`, PEM or `mnemonic=` patterns found in application source or packaged docs. This is a narrow scan, not proof of absence.

## Still required before paid launch

- Docker was unavailable in this environment, so build and scan the actual container image in CI and confirm the pruned runtime boots.
- Deploy the **new** contract to the intended Robinhood testnet; set `TREASURY_ADDRESS`, assets, signer and network; run preflight and actual two-order duplicate rejection and successful purchase/receipt/inventory tests. The current public host has not been updated.
- Independent smart-contract review before mainnet funds; verify trusted token contracts, owner/multisig key custody and quote signer rotation/compromise procedures.
- Keep SQLite on a durable volume, one server replica or a proper shared datastore; back up and restore-test. In-memory rate limits reset on restart and do not provide Sybil resistance.
- Load and abuse test real deployment (wallet, session creation, order issuance, receipt RPC errors). Physical mobile wallet QA remains.

This is a targeted security review, not a formal audit, penetration test or proof of deployed network execution. Keep checkout disabled until the live gates pass. Free gameplay beta can be deployed separately.
