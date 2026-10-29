# v1.5.1 release notes and deployment gate

## Implemented
- Saved campaign journal: server records each completed non-practice match once, with its real turning point, score, date and replay. Personal records survive browser refresh and deploys when the SQLite volume is retained. Wallet-linked accounts can restore access; guests depend on their session.
- Responsive journal cards and visible faction trust/grudges on the world page, with next-match and replay actions.
- Match creation rechecks active matches inside the transaction after asynchronous market loading. Concurrent starts return the same match.
- Declined convoy offers no longer count as successful pacts in the recap.
- Account APIs send no-store; production adds HSTS; camera, microphone and location permissions are disabled.
- Checkout confirmations and token decimals reject invalid configuration. Preflight now requires and checks the configured quote signer.
- Compose uses a read-only root filesystem, writable data volume and temporary directory, drops capabilities and prevents privilege escalation.

## Verified locally on 2026-10-26
16/16 tests pass, including concurrent starts, one-time campaign rewards, private campaign history, unauthorized orders, CSRF/origin/session boundaries and local EVM checkout. TypeScript/Vite production build and contract compilation pass. 1,200 deterministic bot matches finish with zero recorded invariant violations. Logs in reports/*v1.5.0* and reports/simulation.json.

## Dependency changes
Patched the request-body parser. Removed the optional WalletConnect QR dependency because its transitive validation dependency has an unresolved advisory. EIP-6963 browser extensions and injected mobile wallet browsers remain; QR connection is unavailable. Development-only Ganache dependencies have known advisories and must never be shipped or exposed as a public RPC. Production Docker omits development dependencies.

Clean production-only npm ci and npm audit report zero known vulnerabilities. Full clean npm ci, tests, build and contract compilation were repeated successfully. Removed extraneous Ganache shrinkwrap records that caused Linux clean installs to reject a macOS-only package.

## Explicit scope
The island remains an ambient browser simulation. This release adds persistent campaign history around it; it does not turn all 15 visual agents into a server-authoritative multiplayer world. Campaign records start with matches completed after this upgrade; historical matches still have their existing history/replays. Grudges are faction-level, not independent AI personalities. No new reward token, financial yield, or combat advantage was added.

## Developer deployment
1. Back up the existing SQLite database using npm run backup. Run one application replica with a durable data volume. New campaign table is created automatically; old records are retained.
2. Set the exact HTTPS APP_ORIGIN, NODE_ENV=production, DB_PATH, and correct TRUST_PROXY_HOPS for your reverse proxy. Configure TLS using deploy/Caddyfile. Keep keys outside the image/repository.
3. Start a free closed beta first; verify healthz, readyz, guest practice, wallet restore, room join, completed match journal, replay and logout using the deployed URL. Confirm backup restore on a separate copy.
4. For paid testnet checkout, deploy contracts with the existing deployment scripts, set addresses, decimals, treasury, dedicated quote signer and RPC. Run npm run preflight. Execute a real testnet purchase, confirm inventory once, reload, and test recovery. Do not substitute local EVM receipts for this evidence.
5. Before mainnet paid launch, independently review contracts/key operations, load-test hosting, verify wallet flows on mobile and record live receipts. Container startup, TLS, current wallet-provider compatibility and Robinhood network transactions were not verified in this update.

No external audit, live deployment, retention study or token-price guarantee is implied. Existing large Three.js bundle warning remains. Earlier reports remain historical and are not evidence of this release.

## v1.5.1 live acceptance (2026-10-27)
The packaged app was installed from its ZIP and run with SQLite. Two guest accounts completed a room match, verified the replay, then a ranked match and its one-attempt limit. Campaign entries persisted after a server restart. The wallet picker and docs now accurately state that QR pairing is unavailable. A clean test suite, build, compile, simulation and production audit were repeated. The browser-only frontend could not be visually inspected in this isolated runtime; complete real-wallet and mobile UI acceptance on the public host before launch.
