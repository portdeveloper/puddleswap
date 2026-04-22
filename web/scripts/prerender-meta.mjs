import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const DIST = join(ROOT, "dist");
const BASE = "https://app.puddleswap.org";
const TODAY = new Date().toISOString().slice(0, 10);

const DEFAULT_DESCRIPTION =
  "Swap tokens on Monad Testnet. An unaudited DEX with star routing through USDC, USDT, and WMON, built for builders testing on Monad.";

function webApplicationLd(url) {
  return {
    "@context": "https://schema.org",
    "@type": "WebApplication",
    name: "PuddleSwap",
    alternateName: "Puddle",
    url,
    description: DEFAULT_DESCRIPTION,
    applicationCategory: "FinanceApplication",
    operatingSystem: "Web",
    offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
    image: `${BASE}/og.png`,
    sameAs: [
      "https://github.com/portdeveloper/puddleswap",
      "https://x.com/port_dev",
    ],
    publisher: {
      "@type": "Organization",
      name: "PuddleSwap",
      url: `${BASE}/`,
    },
  };
}

function breadcrumbLd(items) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: item.name,
      item: `${BASE}${item.path}`,
    })),
  };
}

function faqLd(faqs) {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqs.map((f) => ({
      "@type": "Question",
      name: f.q,
      acceptedAnswer: { "@type": "Answer", text: f.a },
    })),
  };
}

function renderLd(...objects) {
  return objects
    .map(
      (obj) =>
        `<script type="application/ld+json">\n${JSON.stringify(obj, null, 2)}\n    </script>`
    )
    .join("\n    ");
}

const homeFaqs = [
  {
    q: "Is PuddleSwap audited?",
    a: "No. PuddleSwap is unaudited software deployed only on Monad Testnet. Testnet tokens have no real value, but use at your own risk and inspect any pool or token you have not registered yourself.",
  },
  {
    q: "What is Monad Testnet?",
    a: "Monad Testnet is Monad's public test network for builders, chain ID 10143. It runs the full Monad execution layer with test MON as the native token and free faucets.",
  },
  {
    q: "What tokens can I swap on PuddleSwap?",
    a: "MON, WMON, USDC, USDT, or any ERC-20 token that has a liquidity pool against one of the core tokens (USDC, USDT, or WMON). You can also paste an arbitrary token address in Advanced mode.",
  },
  {
    q: "What is star routing?",
    a: "PuddleSwap routes every swap through the core tokens — USDC, USDT, and WMON — acting as hubs. Any token with a pool against a core token is reachable from any other token with a single intermediate hop.",
  },
  {
    q: "Does PuddleSwap charge fees?",
    a: "PuddleSwap itself charges no app-level fee. The underlying UniswapV2 pools charge the standard 0.30% LP fee. Monad Testnet gas is paid in test MON, which is free from faucets.",
  },
  {
    q: "How do I connect to PuddleSwap?",
    a: "Connect any injected wallet (MetaMask, Rabby, etc.) configured for Monad Testnet. PuddleSwap will prompt to switch to chain ID 10143 if needed. There is no signup, no KYC, and no backend collecting data.",
  },
];

const homeBody = `
      <section class="prerender-intro" aria-label="About PuddleSwap">
        <h1>About PuddleSwap — the Monad Testnet DEX</h1>
        <p>Want to swap tokens on Monad Testnet without waiting for a mainnet DEX? PuddleSwap is a static, no-backend DEX that lets builders trade test tokens and seed their own liquidity pools directly on Monad's public testnet (chain ID 10143).</p>
        <p>Every swap runs through <strong>star routing</strong>: core tokens (USDC, USDT, and WMON) act as hubs, so any token with a pool against one of them is tradeable against any other. You can swap MON, WMON, USDC, USDT, or any registered ERC-20 in a few clicks — no account, no signup, just a wallet connected to Monad Testnet.</p>
        <p>Under the hood, PuddleSwap is a stock UniswapV2 fork deployed on Monad Testnet. The frontend talks to the blockchain directly via RPC — zero backend means zero downtime risk, zero KYC, zero data collection. All contracts are verified on MonadVision, Socialscan, and Monadscan.</p>
        <p>PuddleSwap is <strong>unaudited</strong>. Testnet tokens have no real value, but the usual warning applies: use at your own risk, and inspect any pool or token you haven't registered yourself.</p>
      </section>
`;

const poolsBody = `
      <section class="prerender-intro" aria-label="Monad Testnet liquidity pools">
        <h1>Monad Testnet Liquidity Pools</h1>
        <p>Browse active UniswapV2-style liquidity pools on Monad Testnet. Every pool on PuddleSwap routes through the core tokens (USDC, USDT, or WMON) for star routing, and every pair is permissionlessly deployable.</p>
        <p>Each row shows the current on-chain reserves and your LP share if you have added liquidity.</p>
      </section>
`;

const createPoolBody = `
      <section class="prerender-intro" aria-label="Create a liquidity pool on Monad Testnet">
        <h1>Create a Liquidity Pool on Monad Testnet</h1>
        <p>Deploy a new UniswapV2-style pair on Monad Testnet and seed it with your initial liquidity in one transaction. Paste any two ERC-20 addresses (or pick a core token), set the amounts, approve, and add liquidity — you receive LP tokens representing your share of the pool.</p>
        <p>Pools are permissionless: anyone can create any pair. PuddleSwap is unaudited; use at your own risk on testnet only.</p>
      </section>
`;

const routes = [
  {
    path: "/",
    file: "index.html",
    title: "Monad Testnet Swap · PuddleSwap DEX",
    description:
      "Swap tokens on Monad Testnet free. PuddleSwap is an unaudited DEX with star routing through USDC, USDT, and WMON — built for builders testing on Monad.",
    body: homeBody,
    ld: renderLd(webApplicationLd(`${BASE}/`), faqLd(homeFaqs)),
    priority: "1.0",
    changefreq: "weekly",
  },
  {
    path: "/pools",
    file: "pools/index.html",
    title: "Monad Testnet Liquidity Pools · PuddleSwap",
    description:
      "Browse active liquidity pools on Monad Testnet. PuddleSwap routes swaps through USDC, USDT, and WMON.",
    body: poolsBody,
    ld: renderLd(
      webApplicationLd(`${BASE}/pools`),
      breadcrumbLd([
        { name: "PuddleSwap", path: "/" },
        { name: "Pools", path: "/pools" },
      ])
    ),
    priority: "0.8",
    changefreq: "weekly",
  },
  {
    path: "/pool/new",
    file: "pool/new/index.html",
    title: "Create Liquidity Pool · PuddleSwap · Monad Testnet",
    description:
      "Deploy a new Uniswap V2 pair and seed initial liquidity on Monad Testnet with PuddleSwap.",
    body: createPoolBody,
    ld: renderLd(
      webApplicationLd(`${BASE}/pool/new`),
      breadcrumbLd([
        { name: "PuddleSwap", path: "/" },
        { name: "Pools", path: "/pools" },
        { name: "Create Pool", path: "/pool/new" },
      ])
    ),
    priority: "0.6",
    changefreq: "monthly",
  },
];

const template = readFileSync(join(DIST, "index.html"), "utf8");

function patchHead(html, { title, description, canonical, ld }) {
  return html
    .replace(/<title>[^<]*<\/title>/, `<title>${title}</title>`)
    .replace(
      /(<meta name="description" content=")[^"]*(")/,
      `$1${description}$2`
    )
    .replace(/(<link rel="canonical" href=")[^"]*(")/, `$1${canonical}$2`)
    .replace(/(<meta property="og:url" content=")[^"]*(")/, `$1${canonical}$2`)
    .replace(/(<meta property="og:title" content=")[^"]*(")/, `$1${title}$2`)
    .replace(
      /(<meta property="og:description" content=")[^"]*(")/,
      `$1${description}$2`
    )
    .replace(/(<meta name="twitter:title" content=")[^"]*(")/, `$1${title}$2`)
    .replace(
      /(<meta name="twitter:description" content=")[^"]*(")/,
      `$1${description}$2`
    )
    .replace(
      /<script type="application\/ld\+json">[\s\S]*?<\/script>/,
      ld
    );
}

function patchBody(html, body) {
  return html.replace(/<div id="root">[\s\S]*?<\/div>/, `<div id="root">${body}    </div>`);
}

for (const r of routes) {
  const canonical = `${BASE}${r.path}`;
  let html = patchHead(template, {
    title: r.title,
    description: r.description,
    canonical,
    ld: r.ld,
  });
  html = patchBody(html, r.body);
  const outPath = join(DIST, r.file);
  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(outPath, html);
  console.log(`  prerendered ${r.path} -> dist/${r.file}`);
}

// Pool detail fallback for /pool/:addr — served by Vercel rewrite.
// Goal: non-JS crawlers immediately see noindex; React/Helmet manages the rest.
const fallbackTitle = "Liquidity Pool · PuddleSwap · Monad Testnet";
const fallbackDescription =
  "Liquidity pool details on Monad Testnet. View reserves, add or remove liquidity.";
const fallbackHtml = template
  .replace(/<title>[^<]*<\/title>/, `<title>${fallbackTitle}</title>`)
  .replace(
    /(<meta name="description" content=")[^"]*(")/,
    `$1${fallbackDescription}$2`
  )
  .replace(
    /<link rel="canonical" href="[^"]*"\s*\/>/,
    `<meta name="robots" content="noindex, nofollow" />`
  )
  .replace(/(<meta property="og:title" content=")[^"]*(")/, `$1${fallbackTitle}$2`)
  .replace(
    /(<meta property="og:description" content=")[^"]*(")/,
    `$1${fallbackDescription}$2`
  )
  .replace(/(<meta name="twitter:title" content=")[^"]*(")/, `$1${fallbackTitle}$2`)
  .replace(
    /(<meta name="twitter:description" content=")[^"]*(")/,
    `$1${fallbackDescription}$2`
  )
  .replace(/<script type="application\/ld\+json">[\s\S]*?<\/script>\s*/, "");

const fallbackPath = join(DIST, "pool", "_fallback", "index.html");
mkdirSync(dirname(fallbackPath), { recursive: true });
writeFileSync(fallbackPath, fallbackHtml);
console.log(`  prerendered /pool/:addr fallback -> dist/pool/_fallback/index.html`);

// Sitemap with dynamic lastmod
const sitemapEntries = routes
  .map(
    (r) =>
      `  <url>\n    <loc>${BASE}${r.path}</loc>\n    <lastmod>${TODAY}</lastmod>\n    <changefreq>${r.changefreq}</changefreq>\n    <priority>${r.priority}</priority>\n  </url>`
  )
  .join("\n");
const sitemapXml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${sitemapEntries}
</urlset>
`;
writeFileSync(join(DIST, "sitemap.xml"), sitemapXml);
console.log(`  generated sitemap.xml with lastmod=${TODAY}`);
