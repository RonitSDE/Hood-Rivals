# Wallet-to-captain journey

The landing page is the autonomous isometric island. Anyone can watch it without connecting. The island is a separate browser-local simulation and does not spend funds or grant token rewards.

## First connection

1. Player chooses **Connect wallet**, then selects an EIP-6963 discovered wallet, injected fallback or mobile wallet in-app browser.
2. Wallet switches to the configured Robinhood Chain network (testnet 46630 by default). The player signs an EIP-191 challenge bound to this app's host, chain ID, address, nonce and expiry. This is an account-link signature, not a transaction or allowance.
3. Server verifies the signature once, creates or restores a wallet-linked session, and sends an HttpOnly cookie. A new wallet sees a three-step captain setup: name, outpost (Emberhold / Tidewatch / Sunreach), and tactical stance. POST `/api/onboarding` can succeed only once per wallet-linked account. The saved choice can later be edited through the profile page.
4. The landing page shows the saved captain record: tactical matches, wins, nontransferable XP and owned cosmetics. A same-origin message projects the saved name and faction into the local island. The selected island captain is a visualization, not a persistent agent or owned onchain object.
5. The player can start or resume a **separate server-authoritative tactical match**. Match results update the saved account. A returning wallet restores the existing account; guest match progress from another account is not merged.

For databases from v1.1, the first v1.2 start adds the `onboarded` column. Existing wallet accounts are asked to pick their new outpost identity once; their match history, XP and inventory remain associated with the same account. Back up the database before migration.

The backend rejects match creation and cosmetic quotes for a linked wallet until captain setup is complete. Guests can still play tactical matches without a wallet. The Armory additionally requires deployed contracts, configured assets, quote signer, and a successful live RPC check before checkout buttons are enabled.

## Manual acceptance on testnet

- Incognito guest: island and tactical match open without wallet; captain setup endpoint rejects guest.
- New injected wallet: correct network prompt, rejected signature leaves guest usable; accepted signature opens setup; invalid names fail; choose each faction and verify the matching island captain; refresh retains saved identity and tactical stats.
- Returning wallet: restores the correct account after a new guest session; old guest progress is not shown as wallet progress; an unfinished guest match is cleared in the client.
- Wallet account or chain change: pending quote is cleared; reverify before another payment. Test on desktop and mobile wallet browsers.
- Local island: two browsers can show different seasons and PX; no UI suggests these values are server saved or redeemable.
- Testnet Armory: after contracts and assets are configured, quote, approve, purchase, confirm, equip, reload, retry a pending receipt, and reject a wrong account or network.

## Public release boundary

The source compiles and local EVM receipt tests pass. A real Robinhood wallet purchase and public host have **not** been verified in this package. The island remains local and therefore cannot support shared seasons, consequential player actions, fair rewards or token-linked outcomes. Before promising those, move its simulation and economic decisions into an authoritative service, add persistence, recovery and abuse resistance, and test the resulting game independently. A paid/token launch also needs the live contract, security, legal and operational gates in `docs/DEPLOYMENT.md`.

## v1.3 configuration

QR pairing is unavailable in v1.5.1. Use an EIP-6963 browser extension or open the site in a mobile wallet app browser. Cancel returns to free play. Network/account changes invalidate the displayed payment context. Test a real mobile wallet before release.
