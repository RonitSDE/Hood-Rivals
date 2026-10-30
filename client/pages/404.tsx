import { Link, usePageTitle } from "../router";

export default function NotFoundPage() {
  usePageTitle("Page not found");
  return (
    <main id="main-content" className="content not-found">
      <span className="eyebrow">Off the map</span>
      <h1>There is no frontier here.</h1>
      <p className="intro">
        The link may be old or mistyped. Head back to the living island or start a match.
      </p>
      <div className="row">
        <Link className="button primary" to="/">
          Back to the island
        </Link>
        <Link className="button" to="/play">
          Play a match
        </Link>
      </div>
    </main>
  );
}
