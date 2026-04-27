// Glossary / learn content. Imported by React components and the prerender
// script. Each article is structured as an ordered list of blocks; React
// renders them as JSX, the prerender script renders the same blocks as HTML.

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
    slug: "add-monad-testnet-to-metamask",
    title: "How to Add Monad Testnet to MetaMask",
    description:
      "Step-by-step guide to adding Monad Testnet to MetaMask, Rabby, Frame, or Rainbow. Chain ID 10143, RPC, native token, and explorer URL.",
    h1: "How to Add Monad Testnet to MetaMask",
    summary:
      "Add Monad Testnet to MetaMask, Rabby, Frame, or Rainbow with the chain details and a one-click flow from PuddleSwap.",
    readingTime: "4 min read",
    datePublished: "2026-04-27",
    blocks: [
      {
        type: "p",
        parts: [
          "Monad Testnet is not a default network in any wallet. Before you can use a Monad dapp, your wallet needs to know about chain ID ",
          { code: "10143" },
          " and the public RPC endpoint. This guide covers three ways to add it: a one-click prompt from PuddleSwap, the manual MetaMask flow, and the equivalent steps for Rabby, Frame, and Rainbow.",
        ],
      },
      { type: "h2", text: "Chain details you need" },
      {
        type: "p",
        parts: [
          "Whichever method you use, you will provide some or all of these values:",
        ],
      },
      {
        type: "ul",
        items: [
          { parts: [{ b: "Network name:" }, " Monad Testnet"] },
          { parts: [{ b: "Chain ID:" }, " ", { code: "10143" }] },
          { parts: [{ b: "Native currency symbol:" }, " ", { code: "MON" }] },
          {
            parts: [
              { b: "RPC URL:" },
              " ",
              { code: "https://testnet-rpc.monad.xyz" },
            ],
          },
          {
            parts: [
              { b: "Block explorer URL:" },
              " ",
              { code: "https://testnet.monadscan.com" },
            ],
          },
        ],
      },
      { type: "h2", text: "Method 1: One-click from PuddleSwap" },
      {
        type: "p",
        parts: [
          "The fastest path: open ",
          { a: { href: "/", text: "PuddleSwap" } },
          " and connect your wallet. If your wallet is on the wrong chain, PuddleSwap triggers your wallet's network-switch prompt automatically. Approve it, and your wallet adds Monad Testnet with the right values pre-filled. No copy-pasting required.",
        ],
      },
      {
        type: "p",
        parts: [
          "This works for any wallet that supports ",
          { code: "wallet_addEthereumChain" },
          ", which covers MetaMask, Rabby, Frame, Rainbow, and most modern injected wallets.",
        ],
      },
      { type: "h2", text: "Method 2: Add manually in MetaMask" },
      {
        type: "p",
        parts: [
          "If you prefer to add the network without connecting to a dapp first:",
        ],
      },
      {
        type: "ul",
        items: [
          {
            parts: [
              "Open MetaMask and click the network selector at the top-left.",
            ],
          },
          {
            parts: [
              'Click "Add a custom network" or "Add network" then "Add a network manually."',
            ],
          },
          { parts: ["Paste the chain details from the section above."] },
          {
            parts: [
              "Save. Monad Testnet appears in your network list and is selected.",
            ],
          },
        ],
      },
      {
        type: "p",
        parts: [
          "MetaMask validates the chain ID against the RPC: it pings the RPC, asks for ",
          { code: "eth_chainId" },
          ", and refuses to save if the response does not match the chain ID you entered. If you see a chain-mismatch error, recheck that the RPC URL and chain ID are correct.",
        ],
      },
      { type: "h2", text: "Method 3: Rabby, Frame, and Rainbow" },
      {
        type: "p",
        parts: [
          { b: "Rabby:" },
          " Rabby auto-detects custom chains when a dapp triggers ",
          { code: "wallet_addEthereumChain" },
          ", so Method 1 works. To add manually, open Rabby > Settings > Networks > Add Custom Network with the same chain details.",
        ],
      },
      {
        type: "p",
        parts: [
          { b: "Frame:" },
          " Open the Frame app > Chains tab > Add Chain. Provide name, chain ID, RPC, and currency symbol. Frame is desktop-only and works well with hardware wallets.",
        ],
      },
      {
        type: "p",
        parts: [
          { b: "Rainbow:" },
          " Recent versions of the Rainbow mobile app support custom networks. Open Rainbow > Settings > Networks > Add Custom Network. Older versions may need a wallet update first.",
        ],
      },
      { type: "h2", text: "Troubleshooting" },
      {
        type: "ul",
        items: [
          {
            parts: [
              { b: "RPC fails or times out:" },
              " The public RPC at ",
              { code: "testnet-rpc.monad.xyz" },
              " can rate-limit during peak load. Wait a minute and retry, or switch to a dedicated RPC provider for sustained calls.",
            ],
          },
          {
            parts: [
              { b: "Chain ID mismatch:" },
              " MetaMask refuses to add a network when the RPC responds with a different chain ID than what you entered. Both should say ",
              { code: "10143" },
              ".",
            ],
          },
          {
            parts: [
              { b: "Network already exists:" },
              " If you previously added Monad Testnet with a stale RPC URL, MetaMask blocks duplicate chain IDs. Delete the old entry first, then re-add.",
            ],
          },
          {
            parts: [
              { b: "Hardware wallet not signing:" },
              " Some hardware wallets need a firmware update to recognize new chain IDs. Check the latest firmware for your device.",
            ],
          },
        ],
      },
      { type: "h2", text: "What to do after adding the network" },
      {
        type: "p",
        parts: [
          "Get some test MON from a faucet (see ",
          {
            a: {
              href: "/learn/get-test-mon-faucet",
              text: "How to Get Test MON",
            },
          },
          "), then try a swap on PuddleSwap to confirm everything works. If you have never used a testnet DEX, see ",
          {
            a: {
              href: "/learn/swap-tokens-on-monad",
              text: "How to Swap Tokens on Monad Testnet",
            },
          },
          ".",
        ],
      },
      {
        type: "p",
        parts: [
          { a: { href: "/", text: "Open PuddleSwap" } },
          " to trigger the one-click add flow, or read ",
          {
            a: {
              href: "/learn/monad-testnet",
              text: "What is Monad Testnet?",
            },
          },
          " for chain background.",
        ],
      },
    ],
    faqs: [
      {
        q: "Why isn't Monad Testnet in MetaMask's dropdown by default?",
        a: "MetaMask only ships a default list of major chains and their popular testnets. New testnets like Monad's are added through the custom-network flow until they are widely adopted.",
      },
      {
        q: "What if the RPC fails when I try to add the network?",
        a: "MetaMask validates the RPC by calling eth_chainId. If the public RPC is rate-limited, the call can fail. Wait a minute and try again, or use a dedicated RPC provider.",
      },
      {
        q: "Is it safe to add a custom network to MetaMask?",
        a: "Adding a network does not give the network any access to your wallet. The risk comes from interacting with malicious contracts on the network, not from the network itself. Only sign transactions from dapps you trust.",
      },
      {
        q: "How do I switch back to Ethereum or another chain?",
        a: "Click the network selector dropdown in MetaMask and pick the chain you want. Adding Monad Testnet does not remove or affect any other network in your wallet.",
      },
    ],
  },
  {
    slug: "get-test-mon-faucet",
    title: "How to Get Test MON from the Monad Faucet",
    description:
      "Where to find the Monad Testnet faucet, how much MON you get per claim, and what to do if the faucet is rate-limited.",
    h1: "How to Get Test MON from the Monad Faucet",
    summary:
      "Find the Monad Testnet faucet, claim test MON for gas, and learn what to do if the faucet is empty or rate-limited.",
    readingTime: "3 min read",
    datePublished: "2026-04-27",
    blocks: [
      {
        type: "p",
        parts: [
          "Test ",
          { a: { href: "/tokens/mon", text: "MON" } },
          " is the native token of ",
          { a: { href: "/learn/monad-testnet", text: "Monad Testnet" } },
          ". You need a small balance to pay gas before you can do anything else: deploy a contract, swap a token, or send a transfer. This guide covers where to claim test MON, how often, and what to do when the faucet is unavailable.",
        ],
      },
      { type: "h2", text: "Why you need test MON" },
      {
        type: "p",
        parts: [
          "Test MON has no real value. It exists only to pay gas on Monad Testnet so the chain has an economic model that mirrors mainnet. Every transaction on testnet still costs gas; the difference is that test MON is free and can be reclaimed when you run out.",
        ],
      },
      { type: "h2", text: "Where to find the official faucet" },
      {
        type: "p",
        parts: [
          "Monad operates the official faucet through its main developer portal. The current URL changes occasionally, so the most reliable approach is to start at ",
          { code: "monad.xyz" },
          " or the official Monad Discord and follow the link to the testnet faucet from there. Avoid third-party faucets unless they are listed in Monad's official documentation.",
        ],
      },
      {
        type: "p",
        parts: [
          "Some Monad community Discords also run their own faucet bots. These typically require a Discord verification step and gate-keep claims by Discord roles. They are useful when the main faucet is rate-limited.",
        ],
      },
      { type: "h2", text: "How to claim test MON" },
      { type: "p", parts: ["The general flow on any faucet:"] },
      {
        type: "ul",
        items: [
          {
            parts: [
              "Connect or paste the wallet address you want to fund.",
            ],
          },
          {
            parts: [
              "Pass any anti-bot checks (captcha, Twitter follow, Discord role, depending on the faucet).",
            ],
          },
          {
            parts: [
              "Submit the claim. Test MON arrives within a block or two.",
            ],
          },
          {
            parts: [
              "Wait for the cooldown (typically 24 hours per address per faucet) before claiming again.",
            ],
          },
        ],
      },
      { type: "h2", text: "How much MON you receive" },
      {
        type: "p",
        parts: [
          "The official faucet drips a small fixed amount per claim, usually enough for hundreds of regular transactions. Exact amounts change over time as Monad tunes the faucet against testnet load. For most workflows, one claim is enough for a day of normal dapp testing.",
        ],
      },
      {
        type: "p",
        parts: [
          "If you are running automated tests or deploying many contracts, expect to claim repeatedly across multiple addresses, or use a developer-grade faucet through your RPC provider if available.",
        ],
      },
      { type: "h2", text: "When the faucet is rate-limited or empty" },
      {
        type: "ul",
        items: [
          {
            parts: [
              { b: "Wait the cooldown:" },
              " Most rate limits reset after 24 hours per address. Try again later from the same address, or use a different one.",
            ],
          },
          {
            parts: [
              { b: "Try a community faucet:" },
              " Monad community Discords sometimes run faucets when the official one is empty.",
            ],
          },
          {
            parts: [
              { b: "Ask in Discord:" },
              " For dev work, asking a moderator in Monad's Discord is often faster than waiting on a faucet refill.",
            ],
          },
          {
            parts: [
              { b: "Check chain ID:" },
              " If the faucet says it sent funds but your wallet shows nothing, confirm you are connected to chain ID ",
              { code: "10143" },
              ", not a different network or a stale RPC.",
            ],
          },
        ],
      },
      { type: "h2", text: "What to do once you have MON" },
      {
        type: "p",
        parts: [
          "Now you can pay gas on Monad Testnet. Try a swap on ",
          { a: { href: "/", text: "PuddleSwap" } },
          ", deposit into a pool, or deploy any EVM contract. If you have not added Monad Testnet to your wallet yet, see ",
          {
            a: {
              href: "/learn/add-monad-testnet-to-metamask",
              text: "How to Add Monad Testnet to MetaMask",
            },
          },
          ". For a full swap walkthrough, see ",
          {
            a: {
              href: "/learn/swap-tokens-on-monad",
              text: "How to Swap Tokens on Monad Testnet",
            },
          },
          ".",
        ],
      },
    ],
    faqs: [
      {
        q: "Does test MON have real value?",
        a: "No. Test MON is for paying gas on Monad Testnet only. It is not transferable to mainnet, has no market, and you cannot exchange it for anything outside the testnet ecosystem.",
      },
      {
        q: "How often can I claim from the faucet?",
        a: "The official faucet typically allows one claim per address per 24 hours. Community faucet bots may have different cooldowns. If you need more frequent funding, request a developer faucet through an RPC provider.",
      },
      {
        q: "What's the minimum MON balance I need?",
        a: "A few hundredths of a MON is enough to pay gas for many regular transactions. One faucet claim almost always covers a full day of normal use.",
      },
      {
        q: "Can I get MON without using the faucet?",
        a: "Other developers can send you test MON directly from their wallet. Bridges from other testnets to Monad Testnet are rare and not officially supported. The faucet is the canonical source.",
      },
    ],
  },
  {
    slug: "swap-tokens-on-monad",
    title: "How to Swap Tokens on Monad Testnet",
    description:
      "Beginner walkthrough for swapping tokens on Monad Testnet with PuddleSwap. Wallet setup, slippage, approvals, and what to do if a swap fails.",
    h1: "How to Swap Tokens on Monad Testnet",
    summary:
      "Walkthrough of a first swap on Monad Testnet: wallet setup, faucet, slippage, approvals, and what to do when a swap fails.",
    readingTime: "5 min read",
    datePublished: "2026-04-27",
    blocks: [
      {
        type: "p",
        parts: [
          "Swapping tokens on ",
          { a: { href: "/learn/monad-testnet", text: "Monad Testnet" } },
          " is the same idea as swapping on Ethereum or any UniswapV2-style DEX. The wallet flow, fees, and approvals all carry over. This guide walks through a first swap on PuddleSwap end-to-end, from wallet setup through confirming the transaction.",
        ],
      },
      { type: "h2", text: "Before you start" },
      { type: "p", parts: ["You need three things in place:"] },
      {
        type: "ul",
        items: [
          {
            parts: [
              "An EVM wallet with Monad Testnet added. See ",
              {
                a: {
                  href: "/learn/add-monad-testnet-to-metamask",
                  text: "How to Add Monad Testnet to MetaMask",
                },
              },
              " if you have not added it yet.",
            ],
          },
          {
            parts: [
              "A small balance of test ",
              { a: { href: "/tokens/mon", text: "MON" } },
              " to pay gas. See ",
              {
                a: {
                  href: "/learn/get-test-mon-faucet",
                  text: "How to Get Test MON from the Faucet",
                },
              },
              ".",
            ],
          },
          {
            parts: [
              "Some balance of the input token you want to swap, if it is not MON. PuddleSwap supports MON, ",
              { a: { href: "/tokens/wmon", text: "WMON" } },
              ", ",
              { a: { href: "/tokens/usdc", text: "USDC" } },
              ", ",
              { a: { href: "/tokens/usdt", text: "USDT" } },
              ", and any registered ERC-20 with a pool against a core token.",
            ],
          },
        ],
      },
      { type: "h2", text: "Step 1: Connect your wallet" },
      {
        type: "p",
        parts: [
          "Open ",
          { a: { href: "/", text: "PuddleSwap" } },
          " and click Connect Wallet. Select your wallet from the prompt. If your wallet is on a different chain, PuddleSwap will ask it to switch to Monad Testnet. Approve the switch in your wallet's popup.",
        ],
      },
      { type: "h2", text: "Step 2: Pick the input and output tokens" },
      {
        type: "p",
        parts: [
          "The swap widget has two token slots: the token you are paying with on top, the token you are receiving on the bottom. Click either slot to open the token picker. The picker lists the core tokens (MON, WMON, USDC, USDT) plus any other token you have a balance of, plus any address you paste manually in Advanced mode.",
        ],
      },
      { type: "h2", text: "Step 3: Enter an amount" },
      {
        type: "p",
        parts: [
          "Type the amount of input token you want to swap. The output amount updates automatically based on the best route ",
          { a: { href: "/learn/star-routing", text: "the router" } },
          " can find. The Route row shows you which path was chosen: a direct swap if the pair exists, or a one-hop swap through USDC, USDT, or WMON if not.",
        ],
      },
      { type: "h2", text: "Step 4: Check slippage" },
      {
        type: "p",
        parts: [
          "Slippage tolerance is the maximum percentage you will accept the output to drop by between quoting and execution. The default is 1%. For thin testnet pools, raise it to 2-3% if your swap is failing because reserves shifted. For deep pools, you can lower it for tighter execution.",
        ],
      },
      {
        type: "p",
        parts: [
          "Setting slippage too high lets MEV bots sandwich you. Setting it too low makes your transaction revert. The default is a reasonable balance for most testnet trades.",
        ],
      },
      { type: "h2", text: "Step 5: Approve, then swap" },
      {
        type: "p",
        parts: [
          "If your input token is an ERC-20 (anything other than MON), the first transaction is an approval that lets the router pull tokens from your wallet. Sign the approval in your wallet. Once it confirms, the Swap button becomes active. Click it, sign the swap transaction, and wait one block for it to confirm. The output token appears in your wallet.",
        ],
      },
      {
        type: "p",
        parts: [
          "If you are swapping with MON as the input, no approval is needed. The router accepts native MON directly and ",
          { a: { href: "/learn/wmon", text: "wraps it to WMON" } },
          " inside the same transaction.",
        ],
      },
      { type: "h2", text: "If your swap fails" },
      {
        type: "ul",
        items: [
          {
            parts: [
              { b: "Reverted with slippage error:" },
              " Reserves moved more than your slippage tolerance allows between quote and execution. Raise the slippage and retry.",
            ],
          },
          {
            parts: [
              { b: "Out of gas:" },
              " You ran out of test MON for gas. Top up from the faucet.",
            ],
          },
          {
            parts: [
              { b: "Approval not yet confirmed:" },
              " The Swap button stays disabled until the approval transaction confirms. Wait for the previous transaction, or check it in MonadVision.",
            ],
          },
          {
            parts: [
              { b: "No route found:" },
              " The token you are trying to swap does not have a pool against a core token. Either add liquidity yourself with ",
              { a: { href: "/pool/new", text: "Create Pool" } },
              " or pick a different token.",
            ],
          },
        ],
      },
      { type: "h2", text: "What to do next" },
      {
        type: "p",
        parts: [
          "Browse ",
          { a: { href: "/pools", text: "active pools" } },
          " to see what's tradeable. Read about ",
          { a: { href: "/learn/star-routing", text: "star routing" } },
          " to understand how PuddleSwap picks the best path. Or ",
          { a: { href: "/pool/new", text: "create your own pool" } },
          " paired against a core token.",
        ],
      },
    ],
    faqs: [
      {
        q: "Why does my swap require an approval transaction first?",
        a: "ERC-20 tokens require an explicit allowance before another contract (the router) can move them. The approval grants that allowance once. After approving, future swaps of the same token skip this step until you revoke or change the allowance.",
      },
      {
        q: "What does slippage actually mean?",
        a: "Slippage is the difference between the quoted output and the actual output. It happens because pool reserves change between quote and execution. The slippage tolerance setting tells the router to revert the transaction if the actual output drops by more than that percentage.",
      },
      {
        q: "Why does the Route row show a different path than I expected?",
        a: "PuddleSwap evaluates every path through every available core token (USDC, USDT, WMON) and picks the one with the best output. The chosen path may not be the most direct one if a multi-hop path has deeper liquidity or better pricing.",
      },
      {
        q: "What should I do if a swap keeps failing?",
        a: "Check that your wallet is on chain ID 10143, that you have enough MON for gas, that your slippage is at least 1-2% for thin pools, and that your input token has a pool against a core token. If all four are correct, the pool may have very low liquidity; pick a different token or add liquidity first.",
      },
    ],
  },
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
