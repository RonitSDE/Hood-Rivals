# Hood Rivals v1.6.0 — brand update

Historical release note. The draft SVG marks described below were superseded by the team's selected PNG in v1.7.0; see `RELEASE_V1.7.0.md`.

Original pixel H crest and transparent wordmark are in public/mark.svg and public/hood-rivals-wordmark.svg. The standalone island, main app navigation, favicon, page metadata, social battle card, share text, wallet-link message, optional token metadata and product docs display Hood Rivals. Existing session cookie, database schema, contract identifiers, and RIVAL ticker remain stable.

This is an independent game on Robinhood Chain, not Robinhood's official brand. Clear Hood Rivals and the token name before public token launch.

The static Sites preview uses sample account/match data and the real browser-local island renderer. It has no backend, live wallet or payment. The packaged deployable app retains its actual Express/SQLite backend. The UI preview may show the tactical 2D fallback when WebGL is disabled in the browser.

Run: npm ci --ignore-scripts; npm test; npm run build; npm run contracts:compile. Paid checkout still requires live network and contract acceptance checks in docs/RELEASE_V1.5.1.md.
