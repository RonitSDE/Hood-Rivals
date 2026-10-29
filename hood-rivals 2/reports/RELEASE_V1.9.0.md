# Hood Rivals v1.9.0 verification — 2026-10-28

- `npm test`: 17/17 passed. The ranked HTTP test now requests standings and the winning replay without a session, checks a real completed match ID and score, and checks the server hash-chain label. The existing rank, tie, privacy, daily-limit, wallet and checkout tests passed.
- `npm run build`: TypeScript and Vite passed after the share page and responsive style changes.
- A same-process HTTP smoke returned 200 for `/rankings`, unauthenticated `/api/leaderboard`, and `/healthz`; the social page contained the expected title and absolute preview image URL.
- The `v1.8.0` 1,200-game simulation and contract compile are unchanged by this release. This release modifies the leaderboard exposure and presentation, not rules or contracts.
- No real hosted wallet journey, mobile visual QA, social crawler inspection, exported PNG inspection, Robinhood testnet purchase or independent security review was performed. The static visual preview predates this release and is not proof of the public board.

Before posting, deploy the exact source to HTTPS, complete a real ranked match, verify the live board and replay, open the public URL in incognito, export the image on a real browser, and confirm the social preview on the platform where it will be posted. Keep checkout off until the separate testnet payment gate passes.
