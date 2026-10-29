# v1.4 update

Start with `UX_V14.md`. This version improves world presentation, continuity, wallet onboarding and captain identity. Read `../reports/VERIFICATION.md` for current evidence. Public deployment and a real testnet purchase are still required. Existing database columns are compatible; back up your persistent SQLite volume before deployment.

---

# Final developer handoff — v1.3

## Ship this beta

The core journey is watch → guided practice → six-round match → actual battle report → rematch/invite. Wallet connection is optional for free play. Keep the local-world label visible. There are 15 local rule-based island agents, not 15 online users or a public agent hosting network.

## Deployment sequence

1. Back up the current SQLite database before starting v1.3. The server adds `rival_memory` automatically and retains existing records. Use one app replica and a persistent volume. Test restoring the backup.
2. Install Node24 dependencies from the lockfile, run build/test/simulate/contracts:compile, and deploy the same source archive. Set `BUILD_SHA` to your release commit. Configure APP_ORIGIN to the exact HTTPS origin.
3. Set TRUST_PROXY_HOPS only to the verified number of trusted proxy hops. With a direct server keep 0. Do not enable arbitrary forwarded-IP trust. Session issuance is IP limited; authenticated reads/writes are account limited. This is not comprehensive anti-Sybil protection.
4. Use injected wallets or mobile wallet app browsers. QR pairing is unavailable in v1.5.1. Test rejected signature, account switch, chain switch, refresh and returning wallet on real phones.
5. Deploy test-only MockToken assets and OutpostStore to the intended Robinhood testnet using the included scripts. Verify current official network parameters before signing. Set contract addresses, signer, treasury, decimals and confirmations; run preflight.
6. Prove approve → buy → canonical receipt → inventory → equip on real testnet. Test expired quote, wrong wallet/network, duplicate receipt, reload during pending purchase and RPC outage. Preserve explorer links. Local EVM tests are not this proof.
7. Check an incognito two-browser invite, reconnect, six-round replay, mobile practice, download/share fallback and Armory previews on the public host. Practice must award no XP/ranked credit. Ranked must not overwrite solo rival memory.
8. Measure real-phone frame rate and public-host latency. Set monitoring, backups, abuse controls and an incident owner before promotion. External load/capacity and security review remain outstanding.

## Product boundaries

- Wallet signing links identity. Cosmetic checkout is the only payment path. No combat advantage, token rewards, yield or guaranteed appreciation.
- RIVAL quantity is a merchant tariff, not a live exchange oracle. Leave the tariff blank to disable RIVAL checkout independently of stablecoin checkout.
- 20% token retirement goes to a dead address; it does not reduce ERC20 totalSupply. Do not call it automatic price support.
- Ranked guest limits are not Sybil resistant. Do not attach cash prizes to them.
- Replay hashes check consistency of server records; they are not trustless execution or onchain game proofs.
- A larger shared agent world requires server-owned simulation, durable agent state, scheduling, sharding and abuse controls. Search/filter UI alone does not provide that infrastructure.

## Mainnet is a separate gate

Review current launchpad requirements and the unsigned plan before signing. Never deploy the test mock as the canonical token. Use the real launch token, multisig owner/treasury, isolated signer, reviewed contracts and a small verified purchase. This archive does not claim a token listing, Robinhood endorsement or readiness to accept funds without those checks.
