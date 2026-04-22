import { Helmet } from "react-helmet-async";
import { Link } from "react-router-dom";

import { TokenIcon } from "../components/TokenIcon";
import { tokenEntries } from "../content/tokens.mjs";

const BASE = "https://app.puddleswap.org";

export function TokenHub() {
  const canonical = `${BASE}/tokens`;
  const title = "Core Tokens on Monad Testnet — PuddleSwap";
  const description =
    "The four core tokens on PuddleSwap: MON, WMON, USDC, USDT. Addresses, decimals, and what each token is for on Monad Testnet.";

  return (
    <section className="intro-section token-hub">
      <Helmet>
        <title>{title}</title>
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
        <span>Tokens</span>
      </nav>

      <span className="section-label">~ tokens ~</span>
      <h1 className="section-title">Core Tokens on Monad Testnet</h1>
      <p className="section-sub">
        The four tokens at the center of PuddleSwap's routing graph. Every pool pairs against one
        of these.
      </p>

      <ul className="token-hub-list">
        {tokenEntries.map((entry) => (
          <li key={entry.slug}>
            <Link to={`/tokens/${entry.slug}`}>
              <div className="token-hub-icon">
                <TokenIcon symbol={entry.symbol} size={44} />
              </div>
              <div className="token-hub-copy">
                <strong>
                  {entry.symbol} <span className="token-hub-name">— {entry.name}</span>
                </strong>
                <span>{entry.summary}</span>
                <span className="token-hub-meta">
                  {entry.decimals} decimals
                  {entry.isNative ? " · native" : " · ERC-20"}
                  {entry.isCore ? " · core" : ""}
                </span>
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
