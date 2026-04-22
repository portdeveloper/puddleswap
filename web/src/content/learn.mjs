// Glossary / learn content. Imported by React components and the prerender
// script. Each article is structured as an ordered list of blocks; React
// renders them as JSX, the prerender script renders the same blocks as HTML.

export const LEARN_BASE_PATH = "/learn";

// Block shapes:
//   { type: "p",  parts: Part[] }
//   { type: "h2", text: string }
//   { type: "ul", items: { parts: Part[] }[] }
//
// Part shapes:
//   string
//   { b:    string }         bold
//   { code: string }         inline code
//   { a:    { href: string, text: string } }   internal or external link

export const learnEntries = [
  {
    slug: "monad-testnet",
    title: "What is Monad Testnet? Chain ID, RPC, Faucet",
    description:
      "Monad Testnet is Monad's public test network, chain ID 10143. Free test MON, full EVM, open RPC. Everything you need to start testing dapps.",
    h1: "What is Monad Testnet?",
    summary:
      "Monad's public test network — chain ID 10143, free MON from the faucet, full EVM compatibility.",
    readingTime: "3 min read",
    datePublished: "2026-04-22",
    blocks: [
      {
        type: "p",
        parts: [
          "Monad is a high-performance parallel-EVM Layer 1 blockchain. ",
          { b: "Monad Testnet" },
          " is its public test network — chain ID ",
          { code: "10143" },
          " — where anyone can deploy contracts, run dapps, and move test tokens before Monad mainnet launches.",
        ],
      },
      { type: "h2", text: "Chain details" },
      {
        type: "ul",
        items: [
          {
            parts: [
              { b: "Chain ID:" },
              " ",
              { code: "10143" },
            ],
          },
          {
            parts: [
              { b: "Native token:" },
              " ",
              { code: "MON" },
              " (test, no real value)",
            ],
          },
          {
            parts: [
              { b: "Public RPC:" },
              " ",
              { code: "https://testnet-rpc.monad.xyz" },
            ],
          },
          {
            parts: [
              { b: "Explorers:" },
              " Monadscan, MonadVision, Socialscan",
            ],
          },
          {
            parts: [
              { b: "EVM equivalence:" },
              " full — anything that runs on Ethereum runs on Monad",
            ],
          },
        ],
      },
      { type: "h2", text: "How to add Monad Testnet to your wallet" },
      {
        type: "p",
        parts: [
          "Most wallets support adding a custom network. Open the network settings, add a new network, and use the chain details above. MetaMask, Rabby, Frame, and Rainbow all work. When you connect a wallet to PuddleSwap, the app will offer to switch your wallet to Monad Testnet automatically.",
        ],
      },
      { type: "h2", text: "Getting test MON" },
      {
        type: "p",
        parts: [
          "Test MON has no real value but you still need a small balance to pay gas. Monad operates official faucets where you can claim a small amount of test MON per wallet per day. Once you have MON, you can wrap it to WMON or swap it for any registered token on PuddleSwap.",
        ],
      },
      { type: "h2", text: "What you can do on Monad Testnet" },
      {
        type: "p",
        parts: [
          "The testnet is a full mirror of the execution layer Monad mainnet will ship with: deploy any Solidity contract, call any precompile, trade on DEXes like PuddleSwap, test protocol integrations end-to-end. The only things missing are real economic value and the mainnet chain ID.",
        ],
      },
      { type: "h2", text: "Monad Testnet vs. Monad mainnet" },
      {
        type: "p",
        parts: [
          "Monad mainnet is a separate chain with its own chain ID and economic token. Any state, balances, or deployed contracts on testnet do not carry over. Use testnet as a staging environment: build, test, and only move to mainnet when you're confident.",
        ],
      },
      {
        type: "p",
        parts: [
          { a: { href: "/", text: "Start swapping on Monad Testnet with PuddleSwap" } },
          " — the testnet DEX built for builders.",
        ],
      },
    ],
  },
  {
    slug: "star-routing",
    title: "What is Star Routing? PuddleSwap's Routing Model",
    description:
      "Star routing is PuddleSwap's approach: every token pool must pair with a core token (USDC, USDT, or WMON), which lets any pair swap in one hop.",
    h1: "What is Star Routing?",
    summary:
      "PuddleSwap's routing model — every pool pairs with a core token, so any two tokens can swap in one hop.",
    readingTime: "3 min read",
    datePublished: "2026-04-22",
    blocks: [
      {
        type: "p",
        parts: [
          { b: "Star routing" },
          " is PuddleSwap's approach to swap routing on Monad Testnet. Instead of supporting arbitrary pools between arbitrary tokens, PuddleSwap designates a small set of ",
          { b: "core tokens" },
          " as hubs — USDC, USDT, and WMON — and requires every liquidity pool to pair against at least one of them.",
        ],
      },
      { type: "h2", text: "Why \"star\"?" },
      {
        type: "p",
        parts: [
          "If you draw it out, core tokens sit at the center of a star. Every other token connects only to the hubs, not to each other directly. Swapping between two non-core tokens routes through a hub: ",
          { code: "TOKEN_A → CORE → TOKEN_B" },
          ". This is one hop through an intermediate, never more.",
        ],
      },
      { type: "h2", text: "The tradeoff" },
      {
        type: "p",
        parts: [
          "Star routing trades flexibility for simplicity. On a mature mainnet DEX like Uniswap, arbitrary pools exist (WETH/PEPE, SHIB/USDC, etc.) and the router searches multi-hop paths for the best rate. PuddleSwap deliberately constrains that: liquidity is concentrated in the hubs, routing is deterministic, gas is predictable, and new tokens become tradeable as soon as they have a pool against any core token.",
        ],
      },
      { type: "h2", text: "How PuddleSwap picks the best route" },
      {
        type: "p",
        parts: [
          "For a swap of token A to token B, the quote engine considers every path through every available core token and picks the one with the highest output:",
        ],
      },
      {
        type: "ul",
        items: [
          { parts: [{ code: "A → WMON → B" }] },
          { parts: [{ code: "A → USDC → B" }] },
          { parts: [{ code: "A → USDT → B" }] },
          { parts: [{ code: "A → B" }, " (direct, if both are core tokens)"] },
        ],
      },
      {
        type: "p",
        parts: [
          "The winning path is shown in the Route row of the swap widget, and you can expand the \"Routing table\" diagnostic to see quotes from every path — live, failed, or absent.",
        ],
      },
      { type: "h2", text: "What this means for liquidity providers" },
      {
        type: "p",
        parts: [
          "If you create a pool, pair your token against a core token to make it reachable by every other token in the registry. Pools between two non-core tokens won't be routed to, even if they exist.",
        ],
      },
      {
        type: "p",
        parts: [
          { a: { href: "/", text: "Try a swap on PuddleSwap" } },
          " and watch the route resolve in real time, or ",
          { a: { href: "/pool/new", text: "create a new pool" } },
          " paired with a core token.",
        ],
      },
    ],
  },
  {
    slug: "wmon",
    title: "What is WMON? Wrapped MON on Monad Testnet",
    description:
      "WMON is Wrapped MON — an ERC-20 version of Monad's native token, 1:1 redeemable. UniswapV2 pools need ERC-20s, so WMON bridges native MON into them.",
    h1: "What is WMON (Wrapped Monad)?",
    summary:
      "Wrapped MON — an ERC-20 wrapper for native MON so it can participate in ERC-20-only smart contracts like UniswapV2 pools.",
    readingTime: "2 min read",
    datePublished: "2026-04-22",
    blocks: [
      {
        type: "p",
        parts: [
          { b: "WMON" },
          " is Wrapped MON — an ERC-20 token that represents 1 MON, one-to-one, redeemable any time. It exists because most smart contract interfaces, including UniswapV2, expect ERC-20 tokens, while Monad's native gas token (MON) is not an ERC-20.",
        ],
      },
      { type: "h2", text: "Why wrapping exists" },
      {
        type: "p",
        parts: [
          "Native tokens like MON (or ETH on Ethereum) are handled by the protocol itself, not by an ERC-20 contract. Many DeFi primitives — routers, pools, lending markets — are built around the ERC-20 interface. Wrapping converts native MON into an ERC-20 equivalent so those contracts can hold, transfer, and approve it like any other token.",
        ],
      },
      { type: "h2", text: "Wrapping and unwrapping" },
      {
        type: "p",
        parts: ["The WMON contract has two functions:"],
      },
      {
        type: "ul",
        items: [
          {
            parts: [
              { code: "deposit()" },
              " — send N native MON, receive N WMON.",
            ],
          },
          {
            parts: [
              { code: "withdraw(uint256)" },
              " — burn N WMON, receive N native MON.",
            ],
          },
        ],
      },
      {
        type: "p",
        parts: [
          "The ratio is always 1:1, with no fee. The contract holds 100% reserves in native MON at all times.",
        ],
      },
      { type: "h2", text: "How PuddleSwap handles this for you" },
      {
        type: "p",
        parts: [
          "When you select MON as the input or output of a swap, PuddleSwap's router wraps or unwraps automatically as part of the same transaction. You never have to manually wrap MON unless you want WMON as the literal output token. If a route shows WMON as a hop, that's the wrapped form participating in the pool.",
        ],
      },
      { type: "h2", text: "When to use WMON directly" },
      {
        type: "ul",
        items: [
          {
            parts: [
              "You want to hold WMON as an ERC-20 balance (transfers to other addresses, approvals).",
            ],
          },
          {
            parts: [
              "You're adding liquidity to a MON-based pool — the underlying pair is WMON, so you deposit WMON alongside the other token.",
            ],
          },
          {
            parts: [
              "You're building a contract that expects ERC-20 inputs.",
            ],
          },
        ],
      },
      {
        type: "p",
        parts: [
          { a: { href: "/", text: "Swap MON on PuddleSwap" } },
          " — the router wraps and unwraps automatically. For contract details and live pools, see the ",
          { a: { href: "/tokens/wmon", text: "WMON token page" } },
          ".",
        ],
      },
    ],
  },
];

export const learnBySlug = Object.fromEntries(
  learnEntries.map((e) => [e.slug, e])
);

// ---------- HTML serialization (used by the prerender script) ----------

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

export function blocksToHtml(blocks) {
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
