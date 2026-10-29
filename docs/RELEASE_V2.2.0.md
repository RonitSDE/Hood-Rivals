# Hood Rivals v2.2.0 — Agent Missions

## Player journey

The Living World now points to **Agent missions**. A wallet-linked captain chooses greenwood (wood), stone ridge (stone), or lookout (food), a careful or bold route, and a maximum food spend of zero or one. The server runs three decisions at 20-second intervals. The player may close the page and return for the record. If a bold route meets a patrol, the worker may spend one available provision only when the owner authorized it; otherwise it refuses and returns empty. Careful routes avoid the patrol. One runner at a time, three missions per UTC day. Resources persist in SQLite and can be spent on a three-level beacon. The beacon is a saved profile project, not an island mesh upgrade.

When a configured Agent ID is linked, mission assignment checks its current onchain ownership and records its token ID as the runner's identity. Unlinked or undeployed collections use the free outpost runner. Token ownership is checked at assignment; a transfer during the minute does not reassign or cancel the in-progress simulation. Neither identity has better yield. No key, asset, token or transaction authority is delegated. The simulation is deterministic rule-based gameplay, not an LLM agent.

The report shows the route, patrol decision or refusal, return, costs and earned resources. The captain's last patrol encounter changes the next bold route: the runner recognizes it and avoids spending food. This is a small deterministic memory rule, not independent LLM reasoning or portable NFT memory. The proof button recomputes the server event hash chain. This detects accidental or partial tampering of stored events but **does not prove fairness or commit results onchain**. The server can rewrite its database. Mission resources never enter ranked matches or the local island resource counters.

## API and persistence

- `GET /api/missions` returns the authenticated captain's store, daily quota, latest three reports and scheduled active mission.
- `POST /api/missions` assigns `{objective,approach,maxFoodSpend}` with strict input validation, CSRF, wallet-linked onboarding, active and daily caps, provision limit, and optional live Agent ID ownership verification.
- `POST /api/missions/beacon` atomically spends the current tier's wood and stone.
- `GET /api/missions/:id/proof` checks only the requesting captain's mission event chain and reports its exact scope.
- `server/missions.ts` resolves due missions from a server timer and also catches up after restart or on read. SQLite transactions prevent double rewards; retain the database volume and back it up. Use one app replica, as before.

## Deployment gate

Run `npm ci`, `npm run build`, `npm test`, `npm run simulate`, and the existing contract/testnet preflight. Follow `docs/RELEASE_V2.0.0.md` for wallet, contract, signer and paid checkout gates, and `docs/RELEASE_V2.1.0.md` for narration and mobile QA. Manually inspect Agent Missions on desktop and mobile: assign, close the tab, return after a minute, reload, refuse a zero-spend bold encounter, build the beacon, then confirm ranked starts with equal resources. For a token-labeled runner, deploy and bind the collection on testnet and test ownership transfer. No live network transaction or visual browser QA is claimed by the source package.
