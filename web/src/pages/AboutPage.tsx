import { Helmet } from "react-helmet-async";
import { Link } from "react-router-dom";

const BASE = "https://app.puddleswap.org";

export function AboutPage() {
  const canonical = `${BASE}/about`;
  const title = "About PuddleSwap";
  const description =
    "PuddleSwap is a static, no-backend DEX for Monad Testnet built by port. No accounts, no backend, no tracking cookies. Source on GitHub.";

  return (
    <article className="intro-section learn-article">
      <Helmet>
        <title>{`${title} · Monad Testnet DEX`}</title>
        <meta name="description" content={description} />
        <link rel="canonical" href={canonical} />
        <meta property="og:url" content={canonical} />
        <meta property="og:title" content={title} />
        <meta property="og:description" content={description} />
        <meta property="og:type" content="website" />
        <meta name="twitter:title" content={title} />
        <meta name="twitter:description" content={description} />
      </Helmet>

      <nav aria-label="Breadcrumb" className="breadcrumb">
        <Link to="/">PuddleSwap</Link>
        <span aria-hidden="true"> / </span>
        <span>About</span>
      </nav>

      <span className="section-label">~ about ~</span>
      <h1 className="section-title">About PuddleSwap</h1>

      <div className="intro-copy learn-body">
        <p>
          PuddleSwap is a static, no-backend DEX for{" "}
          <Link to="/learn/monad-testnet">Monad Testnet</Link>. It runs entirely
          in your browser and talks to the Monad RPC directly. There is no app
          server, no account, and no KYC. The only telemetry is privacy-friendly
          Cloudflare Web Analytics for aggregate page-view counts — no cookies,
          no IP storage, no cross-site tracking.
        </p>

        <h2>Why this exists</h2>
        <p>
          Monad Testnet needs a working DEX before mainnet so builders can test
          the parts of their dapp that depend on a live AMM: routing, slippage,
          LP token handling, MEV exposure, integrations with other contracts.
          PuddleSwap is one of those parts. It is a UniswapV2 fork deployed to
          Monad Testnet, deliberately constrained to{" "}
          <Link to="/learn/star-routing">star routing</Link> through three core
          tokens so the routing surface stays small and predictable.
        </p>
        <p>
          If your dapp needs a DEX to test against on Monad Testnet, this is
          one. If it needs more than one, please use more than one.
        </p>

        <h2>Who built it</h2>
        <p>
          PuddleSwap is built and maintained by{" "}
          <a
            href="https://x.com/port_dev"
            target="_blank"
            rel="noopener noreferrer"
            translate="no"
          >
            port
          </a>
          . Source is on{" "}
          <a
            href="https://github.com/portdeveloper/puddleswap"
            target="_blank"
            rel="noopener noreferrer"
          >
            GitHub
          </a>{" "}
          and contributions are welcome.
        </p>

        <h2>What is and is not collected</h2>
        <p>
          The frontend is a static React app served from Vercel. The wallet
          talks directly to the Monad Testnet RPC (
          <code translate="no">testnet-rpc.monad.xyz</code> by default) for chain
          reads and to your wallet for signed transactions. PuddleSwap does not
          run an indexer, does not link wallet activity to identity, does not
          set tracking cookies, and does not have a login or account system.
        </p>
        <p>
          For traffic counts, the site loads Cloudflare Web Analytics. It is
          cookieless, does not store IP addresses, and only records aggregate
          page views and basic device/country information. It cannot identify
          individual users or follow them across sites.
        </p>
        <p>What you see in your network tab while using PuddleSwap:</p>
        <ul>
          <li>Calls to the Monad RPC for chain reads.</li>
          <li>Vercel-hosted static asset requests for the page itself.</li>
          <li>
            A Cloudflare Web Analytics beacon request to{" "}
            <code translate="no">cloudflareinsights.com</code> per page view.
          </li>
          <li>Optional WalletConnect calls if you connect via WalletConnect.</li>
        </ul>
        <p>That is the entire data path.</p>

        <h2>Unaudited software</h2>
        <p>
          PuddleSwap is unaudited. Testnet tokens have no real value, but the
          contract code is still real code. Inspect any pool or token you have
          not registered yourself before adding liquidity. The smart contracts
          are stock UniswapV2 fork code; the sources are verified on Monadscan,
          MonadVision, and Socialscan.
        </p>

        <h2>Contact</h2>
        <p>
          For bugs, feature requests, or questions, the fastest path is the{" "}
          <a
            href="https://github.com/portdeveloper/puddleswap/issues"
            target="_blank"
            rel="noopener noreferrer"
          >
            GitHub issues page
          </a>{" "}
          or DMs on{" "}
          <a
            href="https://x.com/port_dev"
            target="_blank"
            rel="noopener noreferrer"
            translate="no"
          >
            X
          </a>
          . PuddleSwap does not have a Discord, support email, or other contact
          surfaces.
        </p>

        <p>
          Ready to use it? <Link to="/">Open the swap</Link>, browse{" "}
          <Link to="/pools">active pools</Link>, or start with{" "}
          <Link to="/learn/add-monad-testnet-to-metamask">
            How to Add Monad Testnet to MetaMask
          </Link>
          .
        </p>
      </div>
    </article>
  );
}
