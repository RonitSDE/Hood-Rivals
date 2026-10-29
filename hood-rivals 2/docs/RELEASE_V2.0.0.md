# Hood Rivals v2.0.0 — testnet handoff

## New journey

After wallet connection and captain setup, a four-part Field Guide appears once and stays accessible from navigation. The Captain page lets a wallet mint one Agent ID from a capped 3,333 collection, choose palette, crest and accent, and bind the token to the saved captain. A linked ID can choose Balanced, Explorer, Fortifier or Diplomat and delegate solo rounds; the owner can take back Human control. Ranked and rooms remain human-controlled. The agent follows deterministic legal game rules, not an LLM or a trading bot. Delegation does not give the server the wallet key.

The NFT's ownership, visual traits and generated SVG metadata are onchain. Tactical memory, played count, wins and style are stored in the application's SQLite database keyed by token ID. A new owner must connect and bind after a transfer. The previous owner's active match must finish before the new owner can bind, so avoid transferring in the middle of a match. Back up and persist SQLite. Losing it loses the offchain memory. The local isometric island displays the verified token number in the linked captain inspector; its simulated island events remain local and are not the saved tactical memory.

## Developer deployment and checks

1. Run Node 24, `npm ci --ignore-scripts`, `npm test`, `npm run build`, `npm run contracts:compile`. Review `docs/DEPLOYMENT.md`, configure HTTPS, session origin, exact trusted proxy hops and a durable SQLite volume. Guest practice works without contracts.
2. On Robinhood **testnet chain 46630**, fund the deployer with test ETH. Set `RPC_URL`, `CHAIN_ID=46630` and `OWNER_ADDRESS` in an isolated operator environment. Run `npm run contracts:deploy -- --agent-id-only` to inspect a dry run. Then set `DEPLOYER_PRIVATE_KEY` in that isolated shell and run `npm run contracts:deploy -- --agent-id-only --broadcast`. Record the returned transaction and contract address. Mint starts closed.
3. Set `AGENT_ID_ADDRESS` on the app host and restart. Verify address, cap, owner and mint status with `npm run agent:collection`. From the isolated **owner** shell, set `OWNER_PRIVATE_KEY` and run `npm run agent:collection -- --open --broadcast`. Save the confirmed testnet explorer link. Do not put owner or deployer private keys on the hosted app or in client variables.
4. On the public HTTPS host, connect a funded test wallet, finish captain setup and Field Guide, mint one ID, bind it, customize a look and verify tokenURI metadata onchain. Check its number in the island inspector. Delegate a solo match and poll until it finishes; verify replay, Agent ID played count and memory. Switch Human → Agent → Human during another solo match. Confirm rooms/ranked reject delegation and a second mint from the same wallet fails. Transfer the ID to a new wallet after finishing all matches, bind from the new owner and verify memory follows the token. Test desktop and mobile wallets in real browsers.
5. Cosmetic checkout is separately gated by Store, assets and quote signer configuration. Follow the existing contract smoke and preflight procedures before opening it. No mainnet collection or token launch is performed by this package.

## Verification and boundaries

Local EVM integration tests use Ganache, not Robinhood testnet. They cover mint closed/open, one-wallet ownership, look range and customization, tokenURI, authenticated binding, transfer/rebinding, guide state, delegated solo match, legal orders and memory persistence. The full suite, build and compiler should pass before deployment. They do not prove live testnet fills, wallet compatibility, mainnet gas cost, independent security or browser visual quality. Obtain live transaction URLs and an external contract review before a public paid release.

The NFT is cosmetic identity and control for a game mode. No gameplay stat boost, financial right or expected price appreciation is promised. The 3,333 cap does not promise scarcity-derived returns. No payments or private keys are entrusted to the agent.
