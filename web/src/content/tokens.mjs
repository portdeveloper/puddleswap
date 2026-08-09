// Static content for the core-token pages. The token metadata below (symbol,
// decimals, address) is the source of truth for prerender. Runtime React code
// still reads the chain for live state. Keep addresses in sync with
// src/config/generated.ts.

export const tokenEntries = [
  {
    slug: "mon",
    symbol: "MON",
    name: "Monad",
    address: null, // native asset, no ERC-20 contract
    decimals: 18,
    isNative: true,
    isCore: true,
    title: "MON: Monad Testnet Native Token",
    description:
      "MON is Monad's native gas token. On testnet, MON is free from the faucet and pays for every transaction. Wrap to WMON for ERC-20 interop.",
    h1: "MON: Native Gas Token of Monad Testnet",
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
          "), test MON has no real economic value but is still required to pay transaction gas. Every contract call, including swaps on PuddleSwap, burns a small amount of test MON as gas.",
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
            parts: [{ b: "Testnet chain ID:" }, " ", { code: "10143" }],
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
          "Native gas tokens aren't ERC-20s. They predate the standard and are handled by the protocol directly. Most DeFi primitives (DEX pools, lending markets, bridges) expect ERC-20 interfaces, so native MON has to be ",
          { a: { href: "/learn/wmon", text: "wrapped to WMON" } },
          " before it can enter those contracts. PuddleSwap's router wraps and unwraps automatically as part of each swap, so you never have to touch WMON directly unless you want to.",
        ],
      },
      { type: "h2", text: "Swapping with MON on PuddleSwap" },
      {
        type: "p",
        parts: [
          "Select MON as the input or output on the ",
          { a: { href: "/", text: "swap widget" } },
          ". If you're selling MON, the router wraps it to WMON mid-transaction. If you're buying MON, the router unwraps WMON back to native MON at the end. If the route shows WMON as the hop, that is the wrapped form passing through a pool.",
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
    faqs: [
      {
        q: "Does test MON have any real value?",
        a: "No. Test MON exists only on Monad Testnet, where it pays gas. It is not bridged to mainnet, has no market, and cannot be exchanged for real assets.",
      },
      {
        q: "Why isn't MON listed as an ERC-20 contract address?",
        a: "MON is the native gas token of Monad, like ETH on Ethereum. Native tokens are handled by the protocol itself and have no ERC-20 contract. Use WMON when you need an ERC-20 form for pools or other contracts.",
      },
      {
        q: "How do I get MON for gas?",
        a: "Claim from the official Monad Testnet faucet, swap from another token on PuddleSwap, or have someone send you MON directly. Most users start with the faucet because it is free and the cooldown resets daily.",
      },
      {
        q: "Can I send MON to a smart contract directly?",
        a: "Only if the contract has a payable receive or fallback function. ERC-20-only contracts cannot accept native MON; for those you wrap it to WMON first and send the WMON.",
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
    title: "WMON: Wrapped Monad on Monad Testnet",
    description:
      "WMON is Wrapped Monad, an ERC-20 version of native MON on Monad Testnet. 1:1 redeemable. Core routing token on PuddleSwap.",
    h1: "WMON: Wrapped Monad on Monad Testnet",
    summary:
      "ERC-20 wrapper for native MON, 1:1 redeemable. Acts as a core routing hub on PuddleSwap.",
    blocks: [
      {
        type: "p",
        parts: [
          { b: "WMON" },
          " is Wrapped Monad, an ERC-20 token that represents 1 MON, exchangeable 1:1 at any time. On PuddleSwap, WMON is one of the three ",
          { a: { href: "/learn/star-routing", text: "core routing tokens" } },
          " that sit at the center of the star. Every pool must pair against WMON, USDC, or USDT to be reachable by the router.",
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
          "UniswapV2 pools require both sides of a pair to be ERC-20 tokens. Native MON can't be put into a pool directly, so the router wraps MON to WMON mid-transaction whenever MON appears as an input or output. For a longer explanation, see ",
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
    faqs: [
      {
        q: "Is WMON the same value as MON?",
        a: "Yes. WMON is redeemable 1:1 for MON via the WMON contract's withdraw function at any time. The economic value is identical; only the token form differs.",
      },
      {
        q: "Do I need to hold WMON to use PuddleSwap?",
        a: "No. PuddleSwap's router wraps and unwraps automatically when you swap with MON as input or output. You only hold WMON if you wrap it manually or receive it from a liquidity pool withdrawal.",
      },
      {
        q: "Where do I get WMON?",
        a: "Either swap to it on PuddleSwap, call deposit() on the WMON contract with native MON, or withdraw from a WMON-paired liquidity pool position.",
      },
      {
        q: "What is the WMON contract address?",
        a: "0x97B3070F9Da6C002343862b35E68Bd8e22608943 on Monad Testnet (chain ID 10143). Verify on Monadscan, MonadVision, or Socialscan before interacting.",
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
    title: "USDC: Test USD Coin on Monad Testnet",
    description:
      "Circle-issued testnet USDC used as a core routing token on PuddleSwap. It is not the locally mintable token dispensed by the stable faucet.",
    h1: "USDC: Test USD Coin on Monad Testnet",
    summary:
      "Test USD-pegged stablecoin. One of three core routing tokens on PuddleSwap. 6 decimals.",
    blocks: [
      {
        type: "p",
        parts: [
          { b: "USDC" },
          " on Monad Testnet is Circle's canonical testnet USDC and can move between supported testnets through CCTP. It is ",
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
          "PuddleSwap's canonical USDC is not minted by the local stable faucet. Obtain it through Circle's testnet CCTP flow, receive it from another developer, or swap for it on PuddleSwap. The faucet's different USDC contract is not a core routing token. You can swap MON for canonical USDC from the ",
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
          " decimals instead of the usual 18, matching mainnet USDC. When you quote or add liquidity, PuddleSwap handles the decimal conversion automatically, but if you're writing your own contract or script, make sure to read ",
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
    faqs: [
      {
        q: "Is testnet USDC the same as real USDC?",
        a: "No. This is Circle-issued testnet USDC, separate from mainnet USDC. It has no real economic value and cannot be redeemed for real USD.",
      },
      {
        q: "How do I get testnet USDC?",
        a: "Use Circle's testnet CCTP flow, swap MON or WMON for canonical USDC on PuddleSwap, or receive it from another developer. The local stable faucet dispenses a different USDC contract.",
      },
      {
        q: "Why is USDC a core routing token on PuddleSwap?",
        a: "PuddleSwap's star routing designates USDC, USDT, and WMON as hubs. Every pool must pair against at least one of them, which keeps the routing graph small and predictable for both users and contract integrations.",
      },
      {
        q: "Does USDC stay close to 1:1 with USDT and WMON on testnet?",
        a: "No price is defended. All pools float according to their reserves and trades; even USDC/USDT can move away from 1:1 on testnet. WMON pairs are especially volatile.",
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
    title: "USDT: Test Tether USD on Monad Testnet",
    description:
      "USDT is a test USD-pegged stablecoin on Monad Testnet, used as a core routing token on PuddleSwap. 6 decimals, free from the faucet.",
    h1: "USDT: Test Tether USD on Monad Testnet",
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
          " connected to mainnet USDT. It is a separate contract with no economic value. USDT is one of PuddleSwap's three ",
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
          "Test USDT can be minted from the stable faucet on the testnet, or received via swaps on PuddleSwap. Since USDT is a core token, liquidity is usually available in both directions. You can swap MON for USDT or USDC for USDT in one transaction.",
        ],
      },
      { type: "h2", text: "Decimals caveat" },
      {
        type: "p",
        parts: [
          "USDT uses ",
          { code: "6" },
          " decimals. If you're reading balances or computing amounts in your own code, don't assume 18. Read ",
          { code: "decimals()" },
          " from the token contract. PuddleSwap handles this transparently in the UI.",
        ],
      },
      { type: "h2", text: "USDT vs. USDC" },
      {
        type: "p",
        parts: [
          "Both are test stablecoins with 6 decimals and core-token status. Pick whichever matches the pool you want to trade against. The router will choose the best routing path between the core tokens automatically. ",
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
    faqs: [
      {
        q: "Is testnet USDT the same as Tether's USDT?",
        a: "No. Testnet USDT is a separate ERC-20 deployed only on Monad Testnet for testing. It is not issued by Tether, has no real value, and cannot be moved off testnet to any other chain.",
      },
      {
        q: "How is USDT different from USDC on Monad Testnet?",
        a: "Both are USD-pegged stablecoins issued for testnet. They behave identically for routing and pricing. The brand difference exists so you can test stable-to-stable swaps and downstream flows that depend on either name.",
      },
      {
        q: "Where do I get testnet USDT?",
        a: "Claim from the stable faucet on Monad Testnet, swap from another token on PuddleSwap, or receive a transfer from another developer. The faucet is free with a daily cooldown.",
      },
      {
        q: "Can I bridge testnet USDT to mainnet?",
        a: "No. Testnet tokens stay on testnet. There is no bridge between Monad Testnet and Monad mainnet (or any other chain) for testnet assets. Do not attempt to send testnet USDT across a bridge.",
      },
    ],
  },
];

export const tokenBySlug = Object.fromEntries(
  tokenEntries.map((e) => [e.slug, e]),
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
