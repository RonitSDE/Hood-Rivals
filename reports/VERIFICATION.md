# v1.4.1 security patch

See `SECURITY_V1.4.1.md`. The contract now rejects a second purchase for the same cosmetic, checkout verifies the configured treasury, production responses mask unexpected internal errors, and the production container prunes developer tools. Build, compile and 14 tests pass; zero production dependency advisories. No Docker image or live network transaction was tested here.

---

# v1.4 verification — 2026-10-20

- TypeScript and production build: passed.
- Automated suite: 13/13 passed, including 600 deterministic game simulations and wallet identity isolation/logout/restoration assertions.
- Local Chromium desktop 1440×1000 and mobile 390×844: guest entry, directory search, guided practice through recap, cosmetic preview and wallet picker cancellation passed. No page errors reported; document width remained 390px on mobile home and match views.
- Injected EIP1193 provider with a real randomly generated signing key: wallet choice, challenge signature, three-step onboarding, refresh persistence, account menu and sign-out passed. This is a simulated provider, not a real extension or onchain transaction.
- Island persists across profile navigation. Inspector toggles and outpost travel passed. Minimap contains rendered pixels. Mobile drawer toggles passed. Screenshots reviewed internally.
- Pinch gesture handling implemented; physical multi-touch device/wallet QA remains for developers.
- No public host update, live contract deployment or real testnet checkout performed in this release.
- No new payment/economic features in v1.4. Earlier contract and economic results below are historical, not fresh public-network proof.

---

# Verification — v1.3 developer candidate

## Executed

- Production build: TypeScript + Vite PASS. Initial main bundle approximately86KB gzip; Three.js world loads separately (~140KB gzip). Optional wallet modules load on demand. Chunk size warning remains.
- Automated suite:13 tests passed,0 failed. Includes600 seeded games, fog/order rules, HTTP sessions/CSRF, wallet nonce/restoration, room authority, SQLite persistence, local EVM checkout/receipt fulfilment, payment boundaries, practice no-timer/no-rewards and rival-memory restoration/ranked isolation.
- Separate simulation:1,200 completed agent matches,0 tested invariant violations;365/346/351 faction wins,138draws. These are policy simulations, not proof of human balance, retention or token demand.
- Contracts compile PASS. No Robinhood broadcast was made.
- Headless Chromium desktop1440×1000 and mobile390×844: agent search, guided first order, completed practice/actual recap, cosmetic preview, wallet-picker cancellation and real Three.js canvas. Mobile document width390px, no horizontal overflow. See browser.log for final run.

- Browser wallet test: injected picker → real cryptographic account-link signature through a simulated EIP-1193 provider → captain setup → refresh persistence PASS. No live wallet extension or chain transaction. The first harness assertion matched toast text too strictly (close-button text included); checking persisted onboarding state and reloading passed. Logs retain that initial harness timeout for transparency.

## Outstanding

Real injected-wallet hardware/browser behavior, WalletConnect relay pairing and real Robinhood purchases require deployment testing. No production secrets, live contract receipts, public deployment update, security audit, external load test or real-device frame-rate measurements are included. Local EVM checkout is not proof of live venue/network execution. Headless viewport checks are not physical phone testing.

The island remains a local15-agent simulation. Tactical matches and captain records are persisted on one SQLite application instance. This is a beta/testnet candidate, not a shared-world scaling release or a token-price guarantee.

Ganache used its JavaScript fallback because its native uWebSockets binary did not match Node24. Test results passed. Detailed command logs are included. Follow docs/FINAL_HANDOFF.md before accepting payments.
