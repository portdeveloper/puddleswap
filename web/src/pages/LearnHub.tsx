import { Helmet } from "react-helmet-async";
import { Link } from "react-router-dom";

import { learnEntries } from "../content/learn.mjs";

const BASE = "https://app.puddleswap.org";

export function LearnHub() {
  const canonical = `${BASE}/learn`;
  const title = "Learn: Monad Testnet DEX Concepts";
  const description =
    "Short guides to Monad Testnet, star routing, WMON, and the parts behind PuddleSwap.";

  return (
    <section className="intro-section learn-hub">
      <Helmet>
        <title>{`${title} · PuddleSwap`}</title>
        <meta name="description" content={description} />
        <link rel="canonical" href={canonical} />
        <meta property="og:url" content={canonical} />
        <meta property="og:title" content={title} />
        <meta property="og:description" content={description} />
        <meta name="twitter:title" content={title} />
        <meta name="twitter:description" content={description} />
      </Helmet>

      <nav aria-label="Breadcrumb" className="breadcrumb">
        <Link to="/">PuddleSwap</Link>
        <span aria-hidden="true"> / </span>
        <span>Learn</span>
      </nav>

      <span className="section-label">~ learn ~</span>
      <h1 className="section-title">PuddleSwap Learn</h1>
      <p className="section-sub">
        Short guides to the parts behind a Monad Testnet DEX.
      </p>

      <ul className="learn-hub-list">
        {learnEntries.map((entry) => (
          <li key={entry.slug}>
            <Link to={`/learn/${entry.slug}`}>
              <strong>{entry.h1}</strong>
              <span>{entry.summary}</span>
              <span className="learn-meta">{entry.readingTime}</span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
