# Hood Rivals v1.9.0 — public ranked frontier

The ranked board is now an intentional player and social experience. The homepage shows the top three and replay links; `/rankings` is a public page with a pixel-inspired podium, top 30, personal standing for linked captains, dates from the completed matches, a share action, and an exportable 1200×630 PNG card. The public page includes social preview metadata. Sharing copies a caption and URL or invokes the device's native share sheet; it never posts to a social account automatically.

`GET /api/leaderboard` and completed replay reads are public and rate limited for visitors without a session. The board exposes the best ranked match ID, score and completion time, not wallet addresses or private account IDs. Results require finished server-owned ranked matches from onboarded wallet accounts in the last rolling seven days. A replay proves only server hash-chain consistency. It does not prove independent or onchain execution, uniqueness of humans, or absence of multiple wallets.

Deploy this source to a durable, single-replica HTTPS host. Open `/rankings` in an incognito browser and verify public social metadata and replay links. Complete one ranked match with a real linked wallet, confirm it appears publicly and persists after restart, then export the PNG and test mobile sharing. Only post a screenshot with a matching public URL and match replay. Follow `RELEASE_V1.8.0.md` and `RELEASE_V1.7.0.md` for wallet, payment and contract smoke gates before enabling paid checkout.

The existing static visual preview is older sample data and does not demonstrate this live public board. This package contains no public hosted backend or Robinhood testnet payment receipt.
