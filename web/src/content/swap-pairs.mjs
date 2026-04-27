// Swap-guide content. Each entry is a directed pair (e.g. MON → USDC).
// Imported by React components and the prerender script. The block schema
// matches learn.mjs and is rendered via the shared BlocksRenderer.

export const SWAP_GUIDES_BASE_PATH = "/swap";

const TOKENS = {
  mon: {
    symbol: "MON",
    name: "Monad",
    slug: "mon",
    isNative: true,
    description:
      "Monad's native gas token. Required for paying gas on Monad Testnet. Free from the official faucet.",
  },
  wmon: {
    symbol: "WMON",
    name: "Wrapped Monad",
    slug: "wmon",
    isNative: false,
    description:
      "ERC-20 wrapper for native MON, redeemable 1:1 at any time. Used in liquidity pools and any contract that expects ERC-20 inputs.",
  },
  usdc: {
    symbol: "USDC",
    name: "USD Coin",
    slug: "usdc",
    isNative: false,
    isStable: true,
    description:
      "USD-pegged stablecoin issued for Monad Testnet. Stable rate, deep core-pair pools, claimable from the stable faucet.",
  },
  usdt: {
    symbol: "USDT",
    name: "Tether USD",
    slug: "usdt",
    isNative: false,
    isStable: true,
    description:
      "USD-pegged stablecoin (testnet variant). Behaves like USDC for routing and pricing, separate brand for diversification testing.",
  },
};

function tokenLink(token) {
  return { a: { href: `/tokens/${token.slug}`, text: token.symbol } };
}

function stepsForCategory(category, from, to) {
  const isMonInput = from.symbol === "MON";
  const isMonOutput = to.symbol === "MON";

  const items = [
    {
      parts: [
        "Open ",
        { a: { href: "/", text: "PuddleSwap" } },
        " and connect your wallet to Monad Testnet (chain ID ",
        { code: "10143" },
        ").",
      ],
    },
    {
      parts: [
        "Pick ",
        { b: from.symbol },
        " as the input token and ",
        { b: to.symbol },
        " as the output token.",
      ],
    },
    {
      parts: [
        "Type the ",
        { b: from.symbol },
        " amount you want to swap. The output ",
        { b: to.symbol },
        " amount updates automatically based on the best route.",
      ],
    },
    {
      parts: [
        "Check the slippage tolerance. The default is 1%; raise to 2-3% for thin pools, lower for deep pools.",
      ],
    },
  ];

  if (isMonInput) {
    items.push({
      parts: [
        "Click Swap and sign the transaction in your wallet. There is no approval step because MON is the native gas token, not an ERC-20.",
      ],
    });
  } else {
    items.push({
      parts: [
        "Sign the ERC-20 approval first. This grants the router permission to pull ",
        { b: from.symbol },
        " from your wallet and only needs to happen once per token.",
      ],
    });
    items.push({
      parts: [
        "Once the approval confirms, the Swap button activates. Click Swap and sign the transaction.",
      ],
    });
  }

  if (isMonOutput) {
    items.push({
      parts: [
        "After one block, native ",
        { b: to.symbol },
        " arrives in your wallet. The router unwraps WMON to MON inside the same transaction, so you receive native MON, not WMON.",
      ],
    });
  } else {
    items.push({
      parts: [
        "After one block, ",
        { b: to.symbol },
        " appears in your wallet as an ERC-20 balance.",
      ],
    });
  }

  return items;
}

const CATEGORIES = {
  "native-to-stable": {
    // MON -> USDC, MON -> USDT
    routePath: ({ from, to }) =>
      `${from.symbol} → WMON → ${to.symbol}`,
    routeExplain: ({ from, to }) => [
      "The router accepts native ",
      { b: from.symbol },
      " directly. It first wraps your ",
      from.symbol,
      " to WMON via the WMON contract's ",
      { code: "deposit()" },
      " call, then trades the WMON into ",
      { b: to.symbol },
      " through the WMON/",
      to.symbol,
      " pool. Everything happens in a single transaction.",
    ],
    slippageNote: ({ to }) => [
      { b: to.symbol },
      " is a USD-pegged stablecoin, but the underlying pair is WMON/",
      to.symbol,
      ", which is volatile (MON's price moves against USD). Price impact scales with how much of the pool's reserves your swap consumes; large swaps may need higher slippage tolerance.",
    ],
  },
  "stable-to-native": {
    // USDC -> MON, USDT -> MON
    routePath: ({ from, to }) =>
      `${from.symbol} → WMON → ${to.symbol}`,
    routeExplain: ({ from, to }) => [
      { b: from.symbol },
      " trades into WMON through the ",
      from.symbol,
      "/WMON pool, then the router unwraps that WMON to native ",
      { b: to.symbol },
      " by calling ",
      { code: "withdraw()" },
      " on the WMON contract. You receive native ",
      to.symbol,
      ", not WMON. Both steps happen in one transaction.",
    ],
    slippageNote: ({ from }) => [
      { b: from.symbol },
      " is a stablecoin, but the ",
      from.symbol,
      "/WMON pool itself is volatile because MON's price moves against USD. Price impact depends on pool depth and swap size.",
    ],
  },
  "wmon-to-stable": {
    // WMON -> USDC, WMON -> USDT
    routePath: ({ from, to }) => `${from.symbol} → ${to.symbol}`,
    routeExplain: ({ from, to }) => [
      "Direct trade through the ",
      from.symbol,
      "/",
      to.symbol,
      " pool. One pool, one 0.30% LP fee, one slippage hit. No wrap or unwrap step is involved because both sides are already ERC-20s.",
    ],
    slippageNote: ({ to }) => [
      { b: to.symbol },
      " is a stablecoin, but WMON/",
      to.symbol,
      " is a volatile pair. Price impact depends on pool depth and how much your swap moves the reserves.",
    ],
  },
  "stable-to-wmon": {
    // USDC -> WMON, USDT -> WMON
    routePath: ({ from, to }) => `${from.symbol} → ${to.symbol}`,
    routeExplain: ({ from, to }) => [
      "Direct trade through the ",
      from.symbol,
      "/",
      to.symbol,
      " pool. The router does not unwrap to native MON; you receive ",
      { b: to.symbol },
      " as an ERC-20 balance. Useful when you want WMON specifically (for LPing or ERC-20-only contracts).",
    ],
    slippageNote: ({ from }) => [
      { b: from.symbol },
      " is a stablecoin, but the ",
      from.symbol,
      "/WMON pair is volatile. Price impact depends on pool depth.",
    ],
  },
  "stable-pair": {
    // USDC -> USDT, USDT -> USDC
    routePath: ({ from, to }) => `${from.symbol} → ${to.symbol}`,
    routeExplain: ({ from, to }) => [
      "Direct trade through the ",
      from.symbol,
      "/",
      to.symbol,
      " stablecoin pool. Both sides are USD-pegged, so the rate sits close to 1:1. The only deviation comes from the 0.30% LP fee and any imbalance in reserves.",
    ],
    slippageNote: () => [
      "Stablecoin-to-stablecoin swaps have minimal price impact when reserves are balanced. The default 1% slippage is more than enough for most swap sizes; you can lower it if you want tighter execution.",
    ],
  },
};

const PAIR_DEFS = [
  {
    slug: "mon-to-usdc",
    from: "mon",
    to: "usdc",
    category: "native-to-stable",
    useCase:
      "Convert MON to USDC when you want a USD-pegged balance instead of holding the volatile native token. Useful for testing stablecoin flows, parking value through volatility, or paying for things priced in dollars.",
    faqs: [
      {
        q: "Why does my MON get wrapped to WMON during the swap?",
        a: "UniswapV2 pools require ERC-20 tokens on both sides. Native MON is not ERC-20, so the router wraps it to WMON inside the same transaction. You sign once and pay one round of gas; the wrap is invisible to you.",
      },
      {
        q: "Do I need to approve before swapping MON?",
        a: "No. Native MON does not have an ERC-20 allowance. The approval step only applies when the input token is an ERC-20 like USDC, USDT, or WMON.",
      },
      {
        q: "How is the MON/USDC rate calculated?",
        a: "PuddleSwap reads live reserves from the WMON/USDC pool and applies the constant-product formula. The output USDC amount you see is the net amount after the 0.30% LP fee.",
      },
      {
        q: "What's the minimum MON I can swap?",
        a: "There is no protocol minimum. Practical minimums depend on gas: very small swaps cost more in gas than the trade itself is worth on testnet, so most users swap at least a few MON.",
      },
    ],
  },
  {
    slug: "usdc-to-mon",
    from: "usdc",
    to: "mon",
    category: "stable-to-native",
    useCase:
      "Convert USDC to native MON when you need MON for gas, are out of faucet allowance, or want native MON for a contract that requires it as msg.value.",
    faqs: [
      {
        q: "Why does my USDC need to approve the router first?",
        a: "ERC-20 tokens require an explicit allowance before another contract can move them. The approval grants the router permission to pull USDC from your wallet. After approving once, future swaps of USDC skip this step until you revoke or change the allowance.",
      },
      {
        q: "Will I receive native MON or wrapped WMON?",
        a: "You receive native MON. The router calls withdraw() on the WMON contract at the end of the swap to unwrap the WMON back to native MON before sending it to your wallet.",
      },
      {
        q: "Is it cheaper to use the faucet instead?",
        a: "If you only need a small amount of MON for gas, the faucet is free. Swapping makes sense when you need more MON than the faucet drips, when the faucet is rate-limited, or when you want to convert an existing USDC balance.",
      },
      {
        q: "What if the swap fails with a slippage error?",
        a: "Reserves moved between quote and execution by more than your slippage tolerance allows. Raise the slippage to 2-3% and retry, or pick a smaller swap size.",
      },
    ],
  },
  {
    slug: "mon-to-usdt",
    from: "mon",
    to: "usdt",
    category: "native-to-stable",
    useCase:
      "Convert MON to USDT for a USD-pegged balance, or when the WMON/USDT pool has better depth than WMON/USDC for your swap size.",
    faqs: [
      {
        q: "Why route through WMON instead of trading MON directly?",
        a: "UniswapV2 pools only hold ERC-20 tokens. Native MON has to be wrapped to WMON before entering any pool. The router does this inside the swap transaction so you do not have to wrap manually.",
      },
      {
        q: "Is the rate the same as MON to USDC?",
        a: "Not exactly. MON/USDC and MON/USDT each have their own pool with their own reserves. The rates can drift slightly between the two pairs, especially when one pool is deeper than the other.",
      },
      {
        q: "What is the difference between USDT and USDC on Monad Testnet?",
        a: "Both are USD-pegged stablecoins issued for testnet. They behave identically for routing purposes; only the brand differs. Use whichever you need for downstream testing.",
      },
      {
        q: "Can I send the resulting USDT to mainnet?",
        a: "No. Testnet USDT is not bridged to mainnet and has no real value. It is a test token issued only for Monad Testnet activity.",
      },
    ],
  },
  {
    slug: "usdt-to-mon",
    from: "usdt",
    to: "mon",
    category: "stable-to-native",
    useCase:
      "Convert USDT to native MON when you need MON for gas, or when a contract you want to call requires native MON as msg.value.",
    faqs: [
      {
        q: "Do I receive native MON or WMON?",
        a: "Native MON. The router unwraps the intermediate WMON back to native MON inside the same transaction.",
      },
      {
        q: "Why does USDT need an approval first?",
        a: "USDT is an ERC-20 token. The router can only move it after you grant an allowance. The approval is a one-time step per token; subsequent swaps reuse the allowance.",
      },
      {
        q: "What if the USDT/WMON pool is shallow?",
        a: "Slippage and price impact rise as your swap consumes more of the pool's reserves. For thin pools, raise slippage tolerance, split the swap into smaller chunks, or check whether USDC/WMON has better depth and route through USDC first.",
      },
      {
        q: "How much MON should I expect to receive?",
        a: "The output depends on current WMON/USDT and WMON pool reserves and is shown live in the swap widget before you confirm. The displayed amount is net of the 0.30% LP fee.",
      },
    ],
  },
  {
    slug: "wmon-to-usdc",
    from: "wmon",
    to: "usdc",
    category: "wmon-to-stable",
    useCase:
      "Trade WMON for USDC when you have a WMON balance (for example from an LP withdrawal) and want USDC. Skips the unwrap step that MON -> USDC adds at the start.",
    faqs: [
      {
        q: "Why would I have WMON instead of MON?",
        a: "WMON balances usually come from LP withdrawals, manually wrapped MON, or contracts that send WMON instead of MON. If you swap MON via PuddleSwap normally, the router wraps invisibly and you never hold WMON yourself.",
      },
      {
        q: "Is WMON to USDC cheaper than MON to USDC?",
        a: "Slightly yes. WMON to USDC is one pool hop. MON to USDC adds a wrap step in the same transaction; the wrap is cheap but not free, so MON to USDC costs a small amount more in gas.",
      },
      {
        q: "Can I unwrap WMON to MON instead of swapping?",
        a: "Yes. Call withdraw() on the WMON contract directly to redeem WMON for native MON 1:1. That is a different operation from swapping for USDC and produces a different output token.",
      },
      {
        q: "What pool does this trade go through?",
        a: "The WMON/USDC pool. PuddleSwap routes directly through it without intermediate hops because both sides are already ERC-20s.",
      },
    ],
  },
  {
    slug: "usdc-to-wmon",
    from: "usdc",
    to: "wmon",
    category: "stable-to-wmon",
    useCase:
      "Trade USDC for WMON when you want WMON specifically (to add liquidity to a WMON pair, hold as an ERC-20, or pass to a contract that expects ERC-20 inputs). The router skips the unwrap step.",
    faqs: [
      {
        q: "Why would I want WMON instead of native MON?",
        a: "WMON is required for adding liquidity to UniswapV2 pools that pair against MON, for transferring as an ERC-20, and for any contract that does not accept native value transfers. If you just want gas money, swap to MON instead.",
      },
      {
        q: "Can I unwrap the WMON to MON later?",
        a: "Yes. Call withdraw() on the WMON contract any time to redeem WMON for native MON at a 1:1 ratio. There is no fee or spread on the wrap-unwrap operation itself.",
      },
      {
        q: "Why does this swap need an approval?",
        a: "USDC is an ERC-20 token. The router needs an allowance before it can move USDC out of your wallet. Approving once covers all future USDC swaps until you revoke or change the allowance.",
      },
      {
        q: "What pool depth should I expect?",
        a: "WMON/USDC is one of the deeper core-pair pools on PuddleSwap. Browse current reserves on the pools page to see live depth before swapping.",
      },
    ],
  },
  {
    slug: "wmon-to-usdt",
    from: "wmon",
    to: "usdt",
    category: "wmon-to-stable",
    useCase:
      "Trade WMON for USDT when you already hold WMON (from an LP withdrawal or manual wrap) and want USDT exposure.",
    faqs: [
      {
        q: "Is the WMON/USDT rate the same as WMON/USDC?",
        a: "Close, but not identical. Each pool has its own reserves and trades independently. Small drift between the two is normal; arbitrage between them is what keeps the rates aligned over time.",
      },
      {
        q: "Why don't I just unwrap WMON to MON?",
        a: "Unwrapping converts WMON to native MON, not to USDT. The two operations have different outputs. Use unwrap when you want native MON; use this swap when you want USDT.",
      },
      {
        q: "What's the LP fee on this swap?",
        a: "0.30% per pool, taken on the input side. PuddleSwap does not charge an additional app-level fee.",
      },
      {
        q: "Can I do the reverse (USDT to WMON) just as easily?",
        a: "Yes. The pool is bidirectional and both directions trade through the same WMON/USDT pair. See the USDT to WMON guide for that direction.",
      },
    ],
  },
  {
    slug: "usdt-to-wmon",
    from: "usdt",
    to: "wmon",
    category: "stable-to-wmon",
    useCase:
      "Trade USDT for WMON when you want WMON for LPing, ERC-20 transfers, or contract calls that require ERC-20 input. The router skips the unwrap step at the end.",
    faqs: [
      {
        q: "Why would I want WMON instead of MON?",
        a: "WMON is the ERC-20 form of MON. You need WMON to add liquidity to a WMON-paired pool, to transfer as an ERC-20, or to call a contract that does not accept native value. If you just want gas, swap to MON instead.",
      },
      {
        q: "Can I unwrap the resulting WMON to MON?",
        a: "Yes, by calling withdraw() on the WMON contract. The ratio is fixed 1:1 with no fee, so wrap and unwrap operations are essentially free aside from gas.",
      },
      {
        q: "What's the difference between this and MON's faucet?",
        a: "The faucet drips a small amount of native MON for free. This swap converts USDT to WMON at the current pool rate. They have different output tokens (MON vs WMON) and different cost models (free with cooldown vs market rate).",
      },
      {
        q: "How is slippage calculated?",
        a: "Slippage is the difference between the quoted output and the actual output at execution time. The slippage tolerance setting tells the router to revert the transaction if the actual output drops by more than that percentage.",
      },
    ],
  },
  {
    slug: "usdc-to-usdt",
    from: "usdc",
    to: "usdt",
    category: "stable-pair",
    useCase:
      "Swap USDC for USDT when you want to test stablecoin pool slippage, switch brands for a downstream test, or hold USDT instead of USDC.",
    faqs: [
      {
        q: "Why does the rate not stay exactly 1:1?",
        a: "The 0.30% LP fee always lowers the output by that fraction. Any imbalance in pool reserves also moves the rate slightly away from 1:1. A perfectly balanced pool with zero fees would give exactly 1:1.",
      },
      {
        q: "Is there an arbitrage opportunity if the rate drifts?",
        a: "On a real-money exchange yes; on testnet the LP fee plus gas usually exceeds the drift. The mechanic still works: if USDC/USDT prices diverge, arbitrageurs trade until the pool re-balances. On testnet this is mostly a learning exercise.",
      },
      {
        q: "Why are there two stablecoins on testnet?",
        a: "Two stablecoins let you test routing and pool behavior with stable-to-stable pairs that mimic mainnet patterns. They also exercise the star-routing logic where USDC and USDT are both core tokens and any new token paired against either is reachable.",
      },
      {
        q: "Are testnet USDC and testnet USDT the same as mainnet USDC and USDT?",
        a: "No. They are separate test tokens deployed only for Monad Testnet, with no economic value and no relationship to the real Circle USDC or Tether USDT. They share the brand for familiarity, not the issuer.",
      },
    ],
  },
  {
    slug: "usdt-to-usdc",
    from: "usdt",
    to: "usdc",
    category: "stable-pair",
    useCase:
      "Swap USDT for USDC when you want USDC instead of USDT, or to test the reverse leg of a stablecoin arbitrage.",
    faqs: [
      {
        q: "Is this just the reverse of USDC to USDT?",
        a: "It uses the same pool but in the opposite direction. The pool reserves move the other way, and the rate may differ slightly from the forward direction depending on which side has more reserves at the moment.",
      },
      {
        q: "What's the price impact for a typical swap?",
        a: "For balanced stablecoin pools, price impact is negligible at small sizes and grows quadratically as your swap consumes a larger share of reserves. The widget shows the live impact before you confirm.",
      },
      {
        q: "Is the LP fee the same?",
        a: "Yes. Every UniswapV2 pool charges 0.30% on swaps, applied to the input token. PuddleSwap adds no app-level fee on top.",
      },
      {
        q: "Can I add liquidity to the USDC/USDT pool?",
        a: "Yes. Open the pools page and find the USDC/USDT pair, or use Create Pool if it does not exist yet. Adding liquidity to a stable pair earns LP fees on swaps with low impermanent-loss risk.",
      },
    ],
  },
];

function relatedKey(token) {
  return token === "mon" ? "mon" : token === "wmon" ? "wmon" : token;
}

function buildPair(def) {
  const from = TOKENS[def.from];
  const to = TOKENS[def.to];
  const cat = CATEGORIES[def.category];

  const blocks = [
    {
      type: "p",
      parts: [def.useCase],
    },
    { type: "h2", text: "The route" },
    {
      type: "p",
      parts: [
        "Path: ",
        { code: cat.routePath({ from, to }) },
        ".",
      ],
    },
    {
      type: "p",
      parts: cat.routeExplain({ from, to }),
    },
    { type: "h2", text: "Step by step" },
    {
      type: "ul",
      items: stepsForCategory(def.category, from, to),
    },
    { type: "h2", text: "Slippage and fees" },
    {
      type: "p",
      parts: cat.slippageNote({ from, to }),
    },
    {
      type: "p",
      parts: [
        "All UniswapV2-style pools on PuddleSwap charge a 0.30% LP fee on the input side. PuddleSwap itself does not charge an app-level fee. Gas is paid in test ",
        tokenLink(TOKENS.mon),
        ".",
      ],
    },
    { type: "h2", text: `About ${from.symbol}` },
    {
      type: "p",
      parts: [
        from.description,
        " See the ",
        tokenLink(from),
        " token page for the full address, decimals, and live pools.",
      ],
    },
    { type: "h2", text: `About ${to.symbol}` },
    {
      type: "p",
      parts: [
        to.description,
        " See the ",
        tokenLink(to),
        " token page for the full address, decimals, and live pools.",
      ],
    },
    {
      type: "p",
      parts: [
        { a: { href: "/", text: `Open PuddleSwap` } },
        " to swap ",
        { b: from.symbol },
        " for ",
        { b: to.symbol },
        " now, or read about ",
        { a: { href: "/learn/star-routing", text: "star routing" } },
        " for the full routing model.",
      ],
    },
  ];

  return {
    slug: def.slug,
    from,
    to,
    category: def.category,
    title: `How to Swap ${from.symbol} for ${to.symbol} on Monad Testnet`,
    description: `Step-by-step guide to swapping ${from.symbol} for ${to.symbol} on Monad Testnet via PuddleSwap. Route, slippage, approvals, and FAQs.`,
    h1: `How to Swap ${from.symbol} for ${to.symbol} on Monad Testnet`,
    summary: `Walkthrough for swapping ${from.symbol} to ${to.symbol} on Monad Testnet using PuddleSwap.`,
    readingTime: "4 min read",
    datePublished: "2026-04-27",
    blocks,
    faqs: def.faqs,
  };
}

export const swapPairs = PAIR_DEFS.map(buildPair);

export const swapPairBySlug = Object.fromEntries(
  swapPairs.map((p) => [p.slug, p]),
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

export function swapBlocksToHtml(blocks) {
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
