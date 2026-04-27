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
      "Monad's public test network: chain ID 10143, free MON from the faucet, full EVM compatibility.",
    readingTime: "3 min read",
    datePublished: "2026-04-22",
    blocks: [
      {
        type: "p",
        parts: [
          "Monad is a parallel-EVM Layer 1 blockchain. ",
          { b: "Monad Testnet" },
          " is its public test network. Its chain ID is ",
          { code: "10143" },
          ", and anyone can deploy contracts, run dapps, and move test tokens before Monad mainnet launches.",
        ],
      },
      { type: "h2", text: "Chain details" },
      {
        type: "ul",
        items: [
          {
            parts: [{ b: "Chain ID:" }, " ", { code: "10143" }],
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
            parts: [{ b: "Explorers:" }, " Monadscan, MonadVision, Socialscan"],
          },
          {
            parts: [
              { b: "EVM equivalence:" },
              " full. Anything that runs on Ethereum runs on Monad",
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
          "Test MON has no real value but you still need a small balance to pay gas. Monad operates official faucets where you can claim a small amount of test MON per wallet per day. Once you have ",
          { a: { href: "/tokens/mon", text: "MON" } },
          ", you can ",
          { a: { href: "/learn/wmon", text: "wrap it to WMON" } },
          " or swap it for any registered token on PuddleSwap.",
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
      { type: "h2", text: "Wallets that work with Monad Testnet" },
      {
        type: "p",
        parts: [
          "Most EVM-compatible wallets accept Monad Testnet through their custom-network flow. Confirmed wallets:",
        ],
      },
      {
        type: "ul",
        items: [
          {
            parts: [
              { b: "MetaMask:" },
              " Add via Settings > Networks > Add Network with the chain details above.",
            ],
          },
          {
            parts: [
              { b: "Rabby:" },
              " Auto-detects custom chains when a dapp prompts to switch. Good for tracking many chains at once.",
            ],
          },
          {
            parts: [
              { b: "Frame:" },
              " Desktop wallet with hardware-wallet support. Good for cold-signed testing.",
            ],
          },
          {
            parts: [
              { b: "Rainbow:" },
              " Mobile-first wallet that supports custom chains in recent versions.",
            ],
          },
        ],
      },
      {
        type: "p",
        parts: [
          "If your wallet is not listed, check whether it accepts a custom RPC URL and arbitrary chain IDs. Most modern wallets do.",
        ],
      },
      { type: "h2", text: "Common mistakes" },
      {
        type: "ul",
        items: [
          {
            parts: [
              "Setting the chain ID to a value other than ",
              { code: "10143" },
              ". A common error is copying a chain config for the wrong network.",
            ],
          },
          {
            parts: [
              "Treating testnet behavior as a guarantee for mainnet. Testnet state, balances, and contracts do not migrate. Mainnet will run as a separate chain with its own chain ID.",
            ],
          },
          {
            parts: [
              "Hammering the public RPC. The endpoint at ",
              { code: "testnet-rpc.monad.xyz" },
              " handles normal dapp traffic but rate-limits heavy load. Use a dedicated provider for indexing or sustained calls.",
            ],
          },
          {
            parts: [
              "Confusing test MON with real MON. Mainnet MON is a different token on a different chain. There is no bridge between testnet and mainnet for state or balances.",
            ],
          },
        ],
      },
      {
        type: "p",
        parts: [
          {
            a: {
              href: "/",
              text: "Start swapping on Monad Testnet with PuddleSwap",
            },
          },
          ", a testnet DEX for builders.",
        ],
      },
    ],
    faqs: [
      {
        q: "Is Monad Testnet free to use?",
        a: "Yes. Test MON has no real value and you can claim it from a faucet at no cost. Gas fees use test MON, so all activity is free.",
      },
      {
        q: "When does Monad mainnet launch?",
        a: "Monad has not announced a public mainnet date. Testnet stays open until then, and contracts you deploy on testnet do not migrate to mainnet automatically.",
      },
      {
        q: "Do contracts deployed on testnet carry over to mainnet?",
        a: "No. Testnet and mainnet are separate chains with different chain IDs. You deploy your contracts again on mainnet when it launches; testnet state and addresses do not transfer.",
      },
      {
        q: "Which wallets support Monad Testnet?",
        a: "MetaMask, Rabby, Frame, and Rainbow all work. Add Monad Testnet by chain ID 10143 with the public RPC at testnet-rpc.monad.xyz.",
      },
      {
        q: "Is the public RPC reliable for production-style testing?",
        a: "It handles normal dapp traffic and light load. For indexing, sustained heavy calls, or production-grade testing, use a dedicated RPC provider.",
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
      "PuddleSwap's routing model: every pool pairs with a core token, so any two tokens can swap in one hop.",
    readingTime: "3 min read",
    datePublished: "2026-04-22",
    blocks: [
      {
        type: "p",
        parts: [
          { b: "Star routing" },
          " is PuddleSwap's approach to swap routing on ",
          { a: { href: "/learn/monad-testnet", text: "Monad Testnet" } },
          ". Instead of supporting arbitrary pools between arbitrary tokens, PuddleSwap designates a small set of ",
          { b: "core tokens" },
          " as hubs: ",
          { a: { href: "/tokens/usdc", text: "USDC" } },
          ", ",
          { a: { href: "/tokens/usdt", text: "USDT" } },
          ", and ",
          { a: { href: "/learn/wmon", text: "WMON" } },
          ". Every liquidity pool must pair against at least one of them.",
        ],
      },
      { type: "h2", text: 'Why "star"?' },
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
          'The winning path is shown in the Route row of the swap widget, and you can expand the "Routing table" diagnostic to see quotes from every path: live, failed, or absent.',
        ],
      },
      { type: "h2", text: "A worked example" },
      {
        type: "p",
        parts: [
          "Suppose you want to swap 100 ",
          { a: { href: "/tokens/usdc", text: "USDC" } },
          " for TOKEN_X, where TOKEN_X has pools against both USDC and WMON.",
        ],
      },
      {
        type: "p",
        parts: ["The router considers:"],
      },
      {
        type: "ul",
        items: [
          {
            parts: [
              { b: "Direct:" },
              " USDC → TOKEN_X via the USDC/TOKEN_X pool. One pool, one 0.30% fee, one slippage hit.",
            ],
          },
          {
            parts: [
              { b: "Two-hop:" },
              " USDC → WMON → TOKEN_X. Two pools, two 0.30% fees, two slippage hits.",
            ],
          },
        ],
      },
      {
        type: "p",
        parts: [
          "For most pairs, the direct path wins because it costs half as much. If the direct pool is very thin and the WMON-routed pools are deep, the two-hop path can produce better output. The router compares all available paths by output and picks the best. The Route row in the swap widget shows the chosen path; the Routing table diagnostic lists the alternatives.",
        ],
      },
      { type: "h2", text: "Slippage and the cost of multi-hop" },
      {
        type: "p",
        parts: [
          "Each hop in a route compounds slippage and fees. A 100-token swap routed through TOKEN_A → USDC → TOKEN_B is not the same as a hypothetical 100-token direct swap: each pool re-prices based on the new reserves left after the first hop, and the LP fee is taken twice.",
        ],
      },
      {
        type: "p",
        parts: [
          "For testnet pools with thin liquidity, the gap can be large. For pools with reasonable depth, it is usually small. Always check the slippage figure shown by the swap widget before confirming, and lower the slippage tolerance if you are swapping a sizeable fraction of any pool's reserves.",
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
    faqs: [
      {
        q: "Why doesn't PuddleSwap support direct pools between any two tokens?",
        a: "Direct pools fragment liquidity. With star routing, every pool pairs against a hub, so adding any new token instantly makes it tradeable against every other registered token without waiting for someone to seed every possible pair.",
      },
      {
        q: "What if my token isn't paired with a core token?",
        a: "PuddleSwap will not route to it. Pair your token against USDC, USDT, or WMON when you create the pool, and it becomes reachable from every other token in the registry.",
      },
      {
        q: "Is multi-hop slippage worse than single-hop?",
        a: "Yes, slightly. Each hop adds the pool's slippage and a 0.30% LP fee. For most testnet sizes the difference is small, and the router shows the best path it found.",
      },
      {
        q: "Can a contract bypass PuddleSwap's router and call pools directly?",
        a: "Yes. The pools are stock UniswapV2 pairs, callable by anyone. The router exists for convenience and best-route quoting; it does not gate access to the pools.",
      },
    ],
  },
  {
    slug: "wmon",
    title: "What is WMON? Wrapped MON on Monad Testnet",
    description:
      "WMON is Wrapped MON, an ERC-20 version of Monad's native token, 1:1 redeemable. UniswapV2 pools need ERC-20s, so WMON bridges native MON into them.",
    h1: "What is WMON (Wrapped Monad)?",
    summary:
      "Wrapped MON, an ERC-20 wrapper for native MON so it can participate in ERC-20-only smart contracts like UniswapV2 pools.",
    readingTime: "2 min read",
    datePublished: "2026-04-22",
    blocks: [
      {
        type: "p",
        parts: [
          { b: "WMON" },
          " is Wrapped MON, an ERC-20 token that represents 1 ",
          { a: { href: "/tokens/mon", text: "MON" } },
          ", one-to-one, redeemable any time. It exists because most smart contract interfaces, including UniswapV2, expect ERC-20 tokens, while ",
          { a: { href: "/learn/monad-testnet", text: "Monad" } },
          "'s native gas token (MON) is not an ERC-20.",
        ],
      },
      { type: "h2", text: "Why wrapping exists" },
      {
        type: "p",
        parts: [
          "Native tokens like MON (or ETH on Ethereum) are handled by the protocol itself, not by an ERC-20 contract. Many DeFi primitives, including routers, pools, and lending markets, are built around the ERC-20 interface. Wrapping converts native MON into an ERC-20 equivalent so those contracts can hold, transfer, and approve it like any other token.",
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
              ": send N native MON, receive N WMON.",
            ],
          },
          {
            parts: [
              { code: "withdraw(uint256)" },
              ": burn N WMON, receive N native MON.",
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
          "When you select MON as the input or output of a swap, PuddleSwap's ",
          { a: { href: "/learn/star-routing", text: "router" } },
          " wraps or unwraps automatically as part of the same transaction. You never have to manually wrap MON unless you want WMON as the literal output token. If a route shows WMON as a hop, that's the wrapped form participating in the pool.",
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
              "You're adding liquidity to a MON-based pool. The underlying pair is WMON, so you deposit WMON alongside the other token.",
            ],
          },
          {
            parts: ["You're building a contract that expects ERC-20 inputs."],
          },
        ],
      },
      { type: "h2", text: "When NOT to wrap manually" },
      {
        type: "p",
        parts: [
          "For most users on PuddleSwap, manual wrapping is unnecessary. The swap router calls ",
          { code: "deposit" },
          " and ",
          { code: "withdraw" },
          " on your behalf when MON is the input or output of a swap. Manually wrapping first wastes gas, because you pay for the wrap transaction and then any subsequent transfer separately, where the router would batch wrap-and-swap into a single call.",
        ],
      },
      {
        type: "p",
        parts: [
          "Wrap manually only when you need a standing WMON balance for non-swap purposes, when you are adding liquidity to a pool that pairs against WMON specifically, or when a contract you are calling requires ERC-20 input.",
        ],
      },
      { type: "h2", text: "WMON vs. WETH" },
      {
        type: "p",
        parts: [
          "WMON works the same way Wrapped Ether (WETH) works on Ethereum. Same interface, same 1:1 ratio, same purpose: turn the native gas token into an ERC-20 that smart contracts can hold and transfer. The contract code is also nearly identical, since most chains adopt the canonical WETH9 contract verbatim with the symbol changed.",
        ],
      },
      {
        type: "p",
        parts: [
          "If you have used WETH on a Uniswap V2 pool, WMON on PuddleSwap behaves the same. The only practical differences are the chain ID and which native token is being wrapped.",
        ],
      },
      {
        type: "p",
        parts: [
          { a: { href: "/", text: "Swap MON on PuddleSwap" } },
          ". The router wraps and unwraps automatically. For contract details and live pools, see the ",
          { a: { href: "/tokens/wmon", text: "WMON token page" } },
          ".",
        ],
      },
    ],
    faqs: [
      {
        q: "Are WMON and MON the same thing?",
        a: "Functionally yes. WMON is a 1:1 wrapped version of MON in ERC-20 form. You can always redeem 1 WMON for 1 MON via the WMON contract's withdraw function. The economic value is identical.",
      },
      {
        q: "Do I lose anything by wrapping MON to WMON?",
        a: "Only the gas cost of the wrap transaction. The 1:1 ratio is fixed by the contract; there is no spread, fee, or slippage in wrapping itself.",
      },
      {
        q: "What happens if I send native MON to a contract that expects WMON?",
        a: "The contract will reject the transfer or the funds will sit unused, depending on its fallback handling. ERC-20-only contracts cannot credit a native MON transfer to your account. Always wrap first.",
      },
      {
        q: "Where can I see the WMON contract on Monad Testnet?",
        a: "The WMON address is 0x97B3070F9Da6C002343862b35E68Bd8e22608943. View it on Monadscan, MonadVision, or Socialscan to read the source and check balances.",
      },
    ],
  },
];

export const learnBySlug = Object.fromEntries(
  learnEntries.map((e) => [e.slug, e]),
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
      if (block.type === "p")
        return `        <p>${partsToHtml(block.parts)}</p>`;
      if (block.type === "h2")
        return `        <h2>${escapeHtml(block.text)}</h2>`;
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
