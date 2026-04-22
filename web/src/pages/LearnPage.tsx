import { Helmet } from "react-helmet-async";
import { Link, Navigate, useParams } from "react-router-dom";

import { BlocksRenderer } from "../components/BlocksRenderer";
import type { LearnEntry } from "../content/learn.mjs";
import { learnBySlug, learnEntries } from "../content/learn.mjs";

const BASE = "https://app.puddleswap.org";

function LearnArticle({ entry }: { entry: LearnEntry }) {
  const canonical = `${BASE}/learn/${entry.slug}`;
  const related = learnEntries.filter((e) => e.slug !== entry.slug);

  return (
    <article className="intro-section learn-article">
      <Helmet>
        <title>{`${entry.title} · PuddleSwap`}</title>
        <meta name="description" content={entry.description} />
        <link rel="canonical" href={canonical} />
        <meta property="og:url" content={canonical} />
        <meta property="og:title" content={entry.title} />
        <meta property="og:description" content={entry.description} />
        <meta property="og:type" content="article" />
        <meta name="twitter:title" content={entry.title} />
        <meta name="twitter:description" content={entry.description} />
      </Helmet>

      <nav aria-label="Breadcrumb" className="breadcrumb">
        <Link to="/">PuddleSwap</Link>
        <span aria-hidden="true"> / </span>
        <Link to="/learn">Learn</Link>
        <span aria-hidden="true"> / </span>
        <span>{entry.h1}</span>
      </nav>

      <span className="section-label">~ learn ~</span>
      <h1 className="section-title">{entry.h1}</h1>
      <p className="learn-meta">
        {entry.readingTime} · Updated{" "}
        <time dateTime={entry.datePublished}>{entry.datePublished}</time>
      </p>

      <div className="intro-copy learn-body">
        <BlocksRenderer blocks={entry.blocks} />
      </div>

      {related.length > 0 && (
        <aside className="learn-related" aria-label="More learn articles">
          <h2 className="section-title" style={{ fontSize: 20 }}>
            More from Learn
          </h2>
          <ul className="learn-related-list">
            {related.map((r) => (
              <li key={r.slug}>
                <Link to={`/learn/${r.slug}`}>
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

export function LearnPage() {
  const { slug = "" } = useParams();
  const entry = learnBySlug[slug];

  if (!entry) {
    return <Navigate to="/learn" replace />;
  }

  return <LearnArticle entry={entry} />;
}
