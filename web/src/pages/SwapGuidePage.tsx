import { Helmet } from "react-helmet-async";
import { Link, Navigate, useParams } from "react-router-dom";

import { BlocksRenderer } from "../components/BlocksRenderer";
import type { SwapPair } from "../content/swap-pairs.mjs";
import { swapPairBySlug, swapPairs } from "../content/swap-pairs.mjs";

const BASE = "https://app.puddleswap.org";

function SwapGuide({ pair }: { pair: SwapPair }) {
  const canonical = `${BASE}/swap/${pair.slug}`;
  const related = swapPairs
    .filter(
      (p) =>
        p.slug !== pair.slug &&
        (p.from.slug === pair.from.slug ||
          p.to.slug === pair.to.slug ||
          p.from.slug === pair.to.slug ||
          p.to.slug === pair.from.slug),
    )
    .slice(0, 4);

  return (
    <article className="intro-section learn-article">
      <Helmet>
        <title>{`${pair.title} · PuddleSwap`}</title>
        <meta name="description" content={pair.description} />
        <link rel="canonical" href={canonical} />
        <meta property="og:url" content={canonical} />
        <meta property="og:title" content={pair.title} />
        <meta property="og:description" content={pair.description} />
        <meta property="og:type" content="article" />
        <meta name="twitter:title" content={pair.title} />
        <meta name="twitter:description" content={pair.description} />
      </Helmet>

      <nav aria-label="Breadcrumb" className="breadcrumb">
        <Link to="/">PuddleSwap</Link>
        <span aria-hidden="true"> / </span>
        <Link to="/learn">Learn</Link>
        <span aria-hidden="true"> / </span>
        <span>
          {pair.from.symbol} to {pair.to.symbol}
        </span>
      </nav>

      <span className="section-label">~ swap guide ~</span>
      <h1 className="section-title">{pair.h1}</h1>
      <p className="learn-meta">
        {pair.readingTime} · Updated{" "}
        <time dateTime={pair.datePublished}>{pair.datePublished}</time>
      </p>

      <div className="intro-copy learn-body">
        <BlocksRenderer blocks={pair.blocks} />
      </div>

      {pair.faqs && pair.faqs.length > 0 && (
        <section
          className="learn-faq"
          aria-labelledby={`faq-${pair.slug}`}
        >
          <h2
            id={`faq-${pair.slug}`}
            className="section-title"
            style={{ fontSize: 20 }}
          >
            FAQ
          </h2>
          <dl>
            {pair.faqs.map((f, i) => (
              <div key={i} className="learn-faq-item">
                <dt>{f.q}</dt>
                <dd>{f.a}</dd>
              </div>
            ))}
          </dl>
        </section>
      )}

      {related.length > 0 && (
        <aside className="learn-related" aria-label="Related swap guides">
          <h2 className="section-title" style={{ fontSize: 20 }}>
            Related swap guides
          </h2>
          <ul className="learn-related-list">
            {related.map((r) => (
              <li key={r.slug}>
                <Link to={`/swap/${r.slug}`}>
                  <strong>{r.h1}</strong>
                  <span>{r.summary}</span>
                </Link>
              </li>
            ))}
          </ul>
        </aside>
      )}
    </article>
  );
}

export function SwapGuidePage() {
  const { slug = "" } = useParams();
  const pair = swapPairBySlug[slug];

  if (!pair) {
    return <Navigate to="/learn/swap-tokens-on-monad" replace />;
  }

  return <SwapGuide pair={pair} />;
}
