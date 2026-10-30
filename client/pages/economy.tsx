import { usePageTitle } from "../router";
import { useApp } from "../app/AppState";

export default function EconomyPage() {
  const { boot } = useApp();
  usePageTitle("Economy");
  return (
    <main id="main-content" className="content">
      <div className="eyebrow">Economy</div>
      <h1>
        Play is free.
        <br />
        Style funds the frontier.
      </h1>
      <p className="intro">
        RIVAL is optional cosmetic utility. There are no promised returns, paid combat boosts, passive yield
        or inflationary play-to-earn rewards.
      </p>
      <div className="economy-grid">
        <section className="panel">
          <small>CANONICAL TOKEN</small>
          <h2>RIVAL</h2>
          <p>
            Planned o1 Standard launch on Robinhood Chain. Fixed launch supply: 1 billion. The launch pool
            receives the supply; there is no separate team or gameplay-rewards allocation in this design.
          </p>
          <p className="hash">{boot.chain.token || "Token not deployed / configured"}</p>
          {boot.chain.token && (
            <a target="_blank" rel="noreferrer" href={boot.chain.explorer + "/token/" + boot.chain.token}>
              Inspect token ↗
            </a>
          )}
        </section>
        <section className="panel">
          <small>RIVAL COSMETIC CHECKOUT</small>
          <h2>80% / 20%</h2>
          <div className="split">
            <i />
            <i />
          </div>
          <p>
            80% goes to the operating treasury. 20% is sent to the disclosed dead address. Retirement does not
            reduce the ERC-20 totalSupply counter.
          </p>
          <p>USDG checkout: 100% treasury. Launchpad trading fees are separate from game checkout.</p>
        </section>
        <section className="panel">
          <small>NO FINANCIAL SHORTCUTS</small>
          <h2>Earn reputation.</h2>
          <p>
            Wins earn nontransferable XP. Purchases unlock visual identity only. More token holders do not
            guarantee more players, revenue, liquidity or token appreciation.
          </p>
          <p>
            Creator marketplace splits are supported by the contract but creator publishing is not enabled in
            this release.
          </p>
        </section>
      </div>
      <section className="panel">
        <h3>Where real-world assets fit</h3>
        <p>
          Optional Robinhood underlying equity prices influence a daily, capped Supply cost. The game does not
          sell equities, hold player deposits, offer a vault or distribute investment yield. If fresh quotes
          cannot be verified, the cost modifier is neutral.
        </p>
        <p>
          Current mode: <b>{boot.market.status}</b> · {boot.market.source}
        </p>
      </section>
    </main>
  );
}
