// Static content for the core-token pages. The token metadata below (symbol,
// decimals, address) is the source of truth for prerender — runtime React code
// still reads the chain for live state. Keep addresses in sync with
// src/config/generated.ts.

export const TOKENS_BASE_PATH = "/tokens";

export const tokenEntries = [
  {
    slug: "mon",
    symbol: "MON",
    name: "Monad",
    address: null, // native asset, no ERC-20 contract
    decimals: 18,
    isNative: true,
    isCore: true,
    title: "MON — Monad Testnet Native Token",
    description:
      "MON is Monad's native gas token. On testnet, MON is free from the faucet and pays for every transaction. Wrap to WMON for ERC-20 interop.",
    h1: "MON — Native Gas Token of Monad Testnet",
    summary:
      "Monad's native token. Pays for gas on every transaction. Wrap to WMON to use it in ERC-20 contexts.",
    blocks: [
      {
        type: "p",
        parts: [
          { b: "MON" },
          " is the native token of the Monad blockchain. On ",
          { a: { href: "/learn/monad-testnet", text: "Monad Testnet" } },
          " (chain ID ",
          { code: "10143" },
          "), test MON has no real economic value but is still required to pay transaction gas. Every contract call — including swaps on PuddleSwap — burns a small amount of test MON as gas.",
        ],
      },
      { type: "h2", text: "MON at a glance" },
      {
        type: "ul",
        items: [
          { parts: [{ b: "Symbol:" }, " ", { code: "MON" }] },
          { parts: [{ b: "Decimals:" }, " ", { code: "18" }] },
          { parts: [{ b: "Type:" }, " native gas asset (not ERC-20)"] },
          {
            parts: [
              { b: "Testnet chain ID:" },
              " ",
              { code: "10143" },
            ],
          },
          { parts: [{ b: "Value:" }, " test MON has no economic value"] },
        ],
      },
      { type: "h2", text: "Getting test MON" },
      {
        type: "p",
        parts: [
          "Monad operates official faucets that distribute a small amount of test MON per wallet per day. Claim some MON, add Monad Testnet to your wallet, and you're ready to swap.",
        ],
      },
      { type: "h2", text: "Why MON isn't an ERC-20 (and why that matters)" },
      {
        type: "p",
        parts: [
          "Native gas tokens aren't ERC-20s — they predate the standard and are handled by the protocol directly. Most DeFi primitives (DEX pools, lending markets, bridges) expect ERC-20 interfaces, so native MON has to be ",
          { a: { href: "/learn/wmon", text: "wrapped to WMON" } },
          " before it can enter those contracts. PuddleSwap's router wraps and unwraps automatically as part of each swap — you never have to touch WMON directly unless you want to.",
        ],
      },
      { type: "h2", text: "Swapping with MON on PuddleSwap" },
      {
        type: "p",
        parts: [
          "Select MON as the input or output on the ",
          { a: { href: "/", text: "swap widget" } },
          ". If you're selling MON, the router wraps it to WMON mid-transaction. If you're buying MON, the router unwraps WMON back to native MON at the end. The route shown in the UI will display WMON as the hop — that's the wrapped form passing through a pool.",
        ],
      },
      {
        type: "p",
        parts: [
          "Looking for wrapped MON instead? ",
          { a: { href: "/tokens/wmon", text: "See WMON" } },
          ".",
        ],
      },
    ],
  },
  {
    slug: "wmon",
    symbol: "WMON",
    name: "Wrapped Monad",
    address: "0x97B3070F9Da6C002343862b35E68Bd8e22608943",
    decimals: 18,
    isNative: false,
    isCore: true,
    title: "WMON — Wrapped Monad on Monad Testnet",
    description:
      "WMON is Wrapped Monad, an ERC-20 version of native MON on Monad Testnet. 1:1 redeemable. Core routing token on PuddleSwap.",
    h1: "WMON — Wrapped Monad on Monad Testnet",
    summary:
      "ERC-20 wrapper for native MON, 1:1 redeemable. Acts as a core routing hub on PuddleSwap.",
    blocks: [
      {
        type: "p",
        parts: [
          { b: "WMON" },
          " is Wrapped Monad — an ERC-20 token that represents 1 MON, exchangeable 1:1 at any time. On PuddleSwap, WMON is one of the three ",
          { a: { href: "/learn/star-routing", text: "core routing tokens" } },
          " that sit at the center of the star — every pool must pair against WMON, USDC, or USDT to be reachable by the router.",
        ],
      },
      { type: "h2", text: "WMON at a glance" },
      {
        type: "ul",
        items: [
          { parts: [{ b: "Symbol:" }, " ", { code: "WMON" }] },
          { parts: [{ b: "Name:" }, " Wrapped Monad"] },
          { parts: [{ b: "Decimals:" }, " ", { code: "18" }] },
          {
            parts: [
              { b: "Contract:" },
              " ",
              { code: "0x97B3070F9Da6C002343862b35E68Bd8e22608943" },
            ],
          },
          { parts: [{ b: "Role:" }, " core routing token"] },
        ],
      },
      { type: "h2", text: "Wrapping and unwrapping" },
      {
        type: "p",
        parts: [
          "Call ",
          { code: "deposit()" },
          " with N native MON to receive N WMON. Call ",
          { code: "withdraw(uint256)" },
          " to burn N WMON and receive N native MON. The ratio is always 1:1 and the contract always holds 100% reserves in native MON.",
        ],
      },
      { type: "h2", text: "Why WMON exists" },
      {
        type: "p",
        parts: [
          "UniswapV2 pools — the primitive PuddleSwap is built on — require both sides of a pair to be ERC-20 tokens. Native MON can't be put into a pool directly, so the router wraps MON to WMON mid-transaction whenever MON appears as an input or output. For a longer explanation, see ",
          { a: { href: "/learn/wmon", text: "the Learn article on WMON" } },
          ".",
        ],
      },
      { type: "h2", text: "Pools involving WMON" },
      {
        type: "p",
        parts: [
          "As a core token, WMON typically sits in the deepest pools on PuddleSwap. Browse ",
          { a: { href: "/pools", text: "all active pools" } },
          " to see which token pairs use WMON as their liquidity counterpart.",
        ],
      },
      {
        type: "p",
        parts: [
          { a: { href: "/", text: "Swap WMON on PuddleSwap" } },
          " or pair it in a ",
          { a: { href: "/pool/new", text: "new liquidity pool" } },
          ".",
        ],
      },
    ],
  },
  {
    slug: "usdc",
    symbol: "USDC",
    name: "USD Coin",
    address: "0x534b2f3A21130d7a60830c2Df862319e593943A3",
    decimals: 6,
    isNative: false,
    isCore: true,
    title: "USDC — Test USD Coin on Monad Testnet",
    description:
      "USDC is a test USD-pegged stablecoin on Monad Testnet, used as a core routing token on PuddleSwap. 6 decimals, free from the faucet.",
    h1: "USDC — Test USD Coin on Monad Testnet",
    summary:
      "Test USD-pegged stablecoin. One of three core routing tokens on PuddleSwap. 6 decimals.",
    blocks: [
      {
        type: "p",
        parts: [
          { b: "USDC" },
          " on Monad Testnet is a test stablecoin — a USD-pegged ERC-20 deployed specifically for the testnet environment. It is ",
          { b: "not" },
          " the same contract as mainnet USDC and has no real economic value. On PuddleSwap, test USDC is one of three ",
          { a: { href: "/learn/star-routing", text: "core routing tokens" } },
          ", so any registered token with a pool against it is automatically tradeable.",
        ],
      },
      { type: "h2", text: "USDC at a glance" },
      {
        type: "ul",
        items: [
          { parts: [{ b: "Symbol:" }, " ", { code: "USDC" }] },
          { parts: [{ b: "Name:" }, " USD Coin (test)"] },
          { parts: [{ b: "Decimals:" }, " ", { code: "6" }] },
          {
            parts: [
              { b: "Contract:" },
              " ",
              { code: "0x534b2f3A21130d7a60830c2Df862319e593943A3" },
            ],
          },
          { parts: [{ b: "Role:" }, " core routing token"] },
        ],
      },
      { type: "h2", text: "Getting test USDC" },
      {
        type: "p",
        parts: [
          "Test USDC can be minted through the stable faucet contract, or received via swaps on PuddleSwap. Since it's a core token, plenty of pairs are available — swap MON for USDC in one transaction from the ",
          { a: { href: "/", text: "swap widget" } },
          ".",
        ],
      },
      { type: "h2", text: "Decimals caveat" },
      {
        type: "p",
        parts: [
          "USDC uses ",
          { code: "6" },
          " decimals instead of the usual 18 — consistent with mainnet USDC. When you quote or add liquidity, PuddleSwap handles the decimal conversion automatically, but if you're writing your own contract or script, make sure to read ",
          { code: "decimals()" },
          " from the token rather than assuming 18.",
        ],
      },
      { type: "h2", text: "Pools involving USDC" },
      {
        type: "p",
        parts: [
          "Because USDC is a core token, most new tokens choose to pair against it. Browse ",
          { a: { href: "/pools", text: "all active pools" } },
          " to see which ones.",
        ],
      },
      {
        type: "p",
        parts: [
          { a: { href: "/", text: "Swap USDC on PuddleSwap" } },
          " or ",
          { a: { href: "/pool/new", text: "create a pool" } },
          " paired with it.",
        ],
      },
    ],
  },
  {
    slug: "usdt",
    symbol: "USDT",
    name: "Tether USD",
    address: "0x1314b22df27BDcD4F8D11a0f4185943e55748917",
    decimals: 6,
    isNative: false,
    isCore: true,
    title: "USDT — Test Tether USD on Monad Testnet",
    description:
      "USDT is a test USD-pegged stablecoin on Monad Testnet, used as a core routing token on PuddleSwap. 6 decimals, free from the faucet.",
    h1: "USDT — Test Tether USD on Monad Testnet",
    summary:
      "Test USD-pegged stablecoin (testUSDT). One of three core routing tokens on PuddleSwap. 6 decimals.",
    blocks: [
      {
        type: "p",
        parts: [
          { b: "USDT" },
          " on Monad Testnet (internally ",
          { code: "testUSDT" },
          ") is a USD-pegged ERC-20 deployed for the testnet environment. Like the other stablecoin on the testnet, it is ",
          { b: "not" },
          " connected to mainnet USDT — it's a separate contract with no economic value. USDT is one of PuddleSwap's three ",
          { a: { href: "/learn/star-routing", text: "core routing tokens" } },
          ".",
        ],
      },
      { type: "h2", text: "USDT at a glance" },
      {
        type: "ul",
        items: [
          { parts: [{ b: "Symbol:" }, " ", { code: "USDT" }] },
          { parts: [{ b: "Name:" }, " Tether USD (test)"] },
          { parts: [{ b: "Decimals:" }, " ", { code: "6" }] },
          {
            parts: [
              { b: "Contract:" },
              " ",
              { code: "0x1314b22df27BDcD4F8D11a0f4185943e55748917" },
            ],
          },
          { parts: [{ b: "Role:" }, " core routing token"] },
        ],
      },
      { type: "h2", text: "Getting test USDT" },
      {
        type: "p",
        parts: [
          "Test USDT can be minted from the stable faucet on the testnet, or received via swaps on PuddleSwap. Since USDT is a core token, liquidity is usually available in both directions — swap MON for USDT or USDC for USDT in one transaction.",
        ],
      },
      { type: "h2", text: "Decimals caveat" },
      {
        type: "p",
        parts: [
          "USDT uses ",
          { code: "6" },
          " decimals. If you're reading balances or computing amounts in your own code, don't assume 18 — read ",
          { code: "decimals()" },
          " from the token contract. PuddleSwap handles this transparently in the UI.",
        ],
      },
      { type: "h2", text: "USDT vs. USDC" },
      {
        type: "p",
        parts: [
          "Both are test stablecoins with 6 decimals and core-token status. Pick whichever matches the pool you want to trade against — the router will choose the best routing path between the core tokens automatically. ",
          { a: { href: "/tokens/usdc", text: "See the USDC page" } },
          " for the counterpart.",
        ],
      },
      {
        type: "p",
        parts: [
          { a: { href: "/", text: "Swap USDT on PuddleSwap" } },
          " or ",
          { a: { href: "/pool/new", text: "create a pool" } },
          " paired with it.",
        ],
      },
    ],
  },
];

export const tokenBySlug = Object.fromEntries(
  tokenEntries.map((e) => [e.slug, e])
);

// ---------- HTML serialization (shared with learn.mjs) ----------

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function partToHtml(part) {
  if (typeof part === "string") return escapeHtml(part);
  if ("b" in part) return `<strong>${escapeHtml(part.b)}</strong>`;
  if ("code" in part) return `<code>${escapeHtml(part.code)}</code>`;
  if ("a" in part)
    return `<a href="${escapeHtml(part.a.href)}">${escapeHtml(part.a.text)}</a>`;
  return "";
}

function partsToHtml(parts) {
  return parts.map(partToHtml).join("");
}

export function tokenBlocksToHtml(blocks) {
  return blocks
    .map((block) => {
      if (block.type === "p") return `        <p>${partsToHtml(block.parts)}</p>`;
      if (block.type === "h2") return `        <h2>${escapeHtml(block.text)}</h2>`;
      if (block.type === "ul") {
        const items = block.items
          .map((item) => `          <li>${partsToHtml(item.parts)}</li>`)
          .join("\n");
        return `        <ul>\n${items}\n        </ul>`;
      }
      return "";
    })
    .join("\n");
}
