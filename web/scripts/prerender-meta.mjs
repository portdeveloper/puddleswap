import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const DIST = join(ROOT, "dist");
const BASE = "https://app.puddleswap.org";

const routes = [
  {
    path: "/",
    file: "index.html",
    title: "Monad Testnet Swap · PuddleSwap DEX",
    description:
      "Swap tokens on Monad Testnet free. PuddleSwap is an unaudited DEX with star routing through USDC, USDT, and WMON — built for builders testing on Monad.",
  },
  {
    path: "/pools",
    file: "pools/index.html",
    title: "Monad Testnet Liquidity Pools · PuddleSwap",
    description:
      "Browse active liquidity pools on Monad Testnet. PuddleSwap routes swaps through USDC, USDT, and WMON.",
  },
  {
    path: "/pool/new",
    file: "pool/new/index.html",
    title: "Create Liquidity Pool · PuddleSwap · Monad Testnet",
    description:
      "Deploy a new Uniswap V2 pair and seed initial liquidity on Monad Testnet with PuddleSwap.",
  },
];

const template = readFileSync(join(DIST, "index.html"), "utf8");

function patch(html, { title, description, canonical }) {
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
    );
}

for (const r of routes) {
  const canonical = `${BASE}${r.path}`;
  const html = patch(template, { title: r.title, description: r.description, canonical });
  const outPath = join(DIST, r.file);
  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(outPath, html);
  console.log(`  prerendered ${r.path} -> dist/${r.file}`);
}
