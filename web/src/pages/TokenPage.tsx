import { useMemo } from "react";
import { Helmet } from "react-helmet-async";
import { Link, Navigate, useParams } from "react-router-dom";

import { BlocksRenderer } from "../components/BlocksRenderer";
import { TokenIcon } from "../components/TokenIcon";
import { useAllPools, type PoolInfo } from "../hooks/useAllPools";
import type { TokenEntry } from "../content/tokens.mjs";
import { tokenBySlug, tokenEntries } from "../content/tokens.mjs";

const BASE = "https://app.puddleswap.org";
const WMON_ADDRESS = "0x97B3070F9Da6C002343862b35E68Bd8e22608943";

function abbreviate(n: string): string {
  const num = Number(n);
  if (Number.isNaN(num) || num === 0) return "0";
  if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(2)}M`;
  if (num >= 1_000) return `${(num / 1_000).toFixed(2)}K`;
  if (num >= 1) return num.toFixed(2);
  return num.toPrecision(4);
}

function PoolListRow({ pool }: { pool: PoolInfo }) {
  return (
    <Link to={`/pool/${pool.pairAddress}`} className="token-pool-row">
      <div className="token-pool-pair">
        <TokenIcon symbol={pool.symbol0} size={24} />
        <TokenIcon symbol={pool.symbol1} size={24} />
        <span className="token-pool-name">
          {pool.symbol0} / {pool.symbol1}
        </span>
      </div>
      <span className="token-pool-stat">
        {abbreviate(pool.reserve0Formatted)} {pool.symbol0} · {abbreviate(pool.reserve1Formatted)}{" "}
        {pool.symbol1}
      </span>
    </Link>
  );
}

function filterPoolsForToken(pools: PoolInfo[] | undefined, entry: TokenEntry): PoolInfo[] {
  if (!pools) return [];
  // Native MON has no ERC-20 address; show WMON pools since that's what it routes through.
  const targetAddress = entry.isNative ? WMON_ADDRESS : entry.address;
  if (!targetAddress) return [];
  const lower = targetAddress.toLowerCase();
  return pools.filter(
    (p) => p.token0.toLowerCase() === lower || p.token1.toLowerCase() === lower
  );
}

function TokenArticle({ entry }: { entry: TokenEntry }) {
  const canonical = `${BASE}/tokens/${entry.slug}`;
  const poolsQuery = useAllPools();
  const pools = useMemo(
    () => filterPoolsForToken(poolsQuery.data, entry),
    [poolsQuery.data, entry]
  );

  const related = tokenEntries.filter((t) => t.slug !== entry.slug);

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
        <Link to="/tokens">Tokens</Link>
        <span aria-hidden="true"> / </span>
        <span>{entry.symbol}</span>
      </nav>

      <div className="token-page-header">
        <TokenIcon symbol={entry.symbol} size={56} />
        <div>
          <span className="section-label">~ token ~</span>
          <h1 className="section-title">{entry.h1}</h1>
          <p className="learn-meta" style={{ fontStyle: "normal" }}>
            {entry.name} · {entry.decimals} decimals
            {entry.isCore && " · core routing token"}
          </p>
        </div>
      </div>

      <div className="intro-copy learn-body">
        <BlocksRenderer blocks={entry.blocks} />
      </div>

      <section className="token-live-pools" aria-labelledby="live-pools-heading">
        <h2 id="live-pools-heading" className="section-title" style={{ fontSize: 20 }}>
          Live pools with {entry.symbol}
        </h2>
        {poolsQuery.isLoading && (
          <p className="learn-meta" role="status">
            Loading pools from chain…
          </p>
        )}
        {!poolsQuery.isLoading && pools.length === 0 && (
          <p className="learn-meta">
            No active pools found containing{" "}
            {entry.isNative ? "WMON (native MON routes through WMON)" : entry.symbol}.{" "}
            <Link to="/pool/new">Create one</Link>?
          </p>
        )}
        {pools.length > 0 && (
          <div className="token-pool-list">
            {pools.slice(0, 10).map((pool) => (
              <PoolListRow key={pool.pairAddress} pool={pool} />
            ))}
          </div>
        )}
      </section>

      {related.length > 0 && (
        <aside className="learn-related" aria-label="Other core tokens">
          <h2 className="section-title" style={{ fontSize: 20 }}>
            Other core tokens
          </h2>
          <ul className="learn-related-list">
            {related.map((t) => (
              <li key={t.slug}>
                <Link to={`/tokens/${t.slug}`}>
                  <strong>{t.symbol} — {t.name}</strong>
                  <span>{t.summary}</span>
                </Link>
              </li>
            ))}
          </ul>
        </aside>
      )}
    </article>
  );
}

export function TokenPage() {
  const { slug = "" } = useParams();
  const entry = tokenBySlug[slug];

  if (!entry) {
    return <Navigate to="/tokens" replace />;
  }

  return <TokenArticle entry={entry} />;
}
