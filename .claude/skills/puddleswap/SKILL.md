---
name: puddleswap
description: >-
  Interact with PuddleSwap, a Uniswap-V2-style DEX on Monad testnet (chain 10143).
  Use when quoting or executing token swaps, finding best routes, creating pools,
  adding/removing liquidity, getting test stablecoins from the faucet, searching the
  onchain token registry, or staking LP tokens for rewards. Covers reads (eth_call)
  and writes (signed txs) over plain JSON-RPC — there is no API server.
---

# PuddleSwap

A static, no-backend DEX on **Monad testnet**. Everything is onchain: agents interact by
calling the contracts below directly over JSON-RPC. Reads use `eth_call`; writes need a
wallet/signer funded with test MON for gas. The router and pools are **stock Uniswap V2**.

App: https://app.puddleswap.org · Source: https://github.com/portdeveloper/puddleswap ·
Machine summary: https://app.puddleswap.org/llms.txt

## Network

| Field | Value |
|-------|-------|
| Network | Monad Testnet |
| Chain ID | `10143` (writes are testnet-only; never reuse on mainnet) |
| RPC | `https://testnet-rpc.monad.xyz` |
| Explorer | `https://testnet.monadscan.com` |

## Contracts (chain 10143)

| Contract | Address | Notes |
|----------|---------|-------|
| WMON | `0x97B3070F9Da6C002343862b35E68Bd8e22608943` | Wrapped MON, 18 decimals. `deposit()` payable / `withdraw(wad)`. |
| USDC (core) | `0x534b2f3A21130d7a60830c2Df862319e593943A3` | 6 decimals. The app's USDC. **Not mintable** — acquire by swapping. |
| USDT | `0x1314b22df27BDcD4F8D11a0f4185943e55748917` | 6 decimals. The app's USDT. Mintable via the faucet. |
| StableFaucet | `0x50959dd2a4ef310f9aa2df9498cE9aC0aB956276` | `claim()` mints test stables (see gotcha below). |
| UniswapV2Factory | `0xd498f5beBD0C9f1FE0135a0Cf942dA67Ee6e8A9B` | `getPair`, `allPairs`, `allPairsLength`, `createPair`. |
| UniswapV2Router02 | `0x430c23895c8D44883526e3E0B09327dAD8766660` | Quotes, swaps, liquidity. |
| TokenRegistry | `0x82289127fda2d521c851C696796c41EDB6b6461D` | `search`, `listCoreTokens`, `registerBasic`. |
| OpenRegistrationGate | `0xd1a37dF00238b97F453fC583806711048eB9987c` | Controls who may register tokens. |

Canonical machine-readable addresses + ABIs:
`config/addresses/10143.json` and `docs/integration/abi/addresses.json`.

> Decimals matter: USDC and USDT are **6 decimals**, WMON is **18**. Always scale amounts
> by the *token's own* decimals (`1 USDT = 1_000_000`; `1 WMON = 1e18`).

## Getting test funds

1. **MON (gas):** get native MON from the official Monad testnet faucet (external). Required to send any write tx.
2. **WMON:** wrap MON by sending value to `WMON.deposit()` (payable); unwrap with `withdraw(wad)`.
3. **USDT:** call `StableFaucet.claim()` — mints **1000 USDT** (the app's USDT, `0x1314…`) per address, with a **24h cooldown**. Free and reliable.
4. **USDC (core):** **not** available from the faucet and not mintable. Get it by swapping, e.g. claim USDT then swap USDT → USDC (a USDC/USDT pool exists), or swap WMON → USDC.

> **Gotcha — two different "USDC" tokens.** `StableFaucet.claim()` also mints a *separate*
> test USDC at `0xc152fE819323913e478Cab556BE9e24a81790eAF`. That token is **not** the app's
> core USDC (`0x534b2f3A…`) — it has its own pool and won't trade against core-USDC pairs.
> For anything the UI calls "USDC", use `0x534b2f3A…`. Don't pass the faucet USDC into core routes.

## Quoting a swap (read)

PuddleSwap uses **star routing**: core tokens (WMON, USDC, USDT — authoritative list from
`TokenRegistry.listCoreTokens()`) act as hop intermediaries. To quote A→B, build candidate
paths and pick the one with the largest final output from `getAmountsOut`:

- `[A, B]` (direct)
- `[A, C, B]` for each core `C` (skip if `C == A` or `C == B`)
- `[A, C1, C2, B]` for distinct core pairs

```bash
# cast: quote 1 USDT -> WMON (direct). Returns amounts[]; last element is the output.
cast call 0x430c23895c8D44883526e3E0B09327dAD8766660 \
  "getAmountsOut(uint256,address[])(uint256[])" \
  1000000 "[0x1314b22df27BDcD4F8D11a0f4185943e55748917,0x97B3070F9Da6C002343862b35E68Bd8e22608943]" \
  --rpc-url https://testnet-rpc.monad.xyz
```

```ts
// viem: pick the best route across candidates
import { createPublicClient, http, parseUnits } from "viem";
const client = createPublicClient({ transport: http("https://testnet-rpc.monad.xyz") });
const ROUTER = "0x430c23895c8D44883526e3E0B09327dAD8766660";
const routerAbi = [{ type:"function", name:"getAmountsOut", stateMutability:"view",
  inputs:[{name:"amountIn",type:"uint256"},{name:"path",type:"address[]"}],
  outputs:[{name:"amounts",type:"uint256[]"}] }] as const;

const amountIn = parseUnits("1", 6); // 1 USDT (6 decimals)
const quotes = await Promise.all(candidatePaths.map(path =>
  client.readContract({ address: ROUTER, abi: routerAbi, functionName: "getAmountsOut", args: [amountIn, path] })
    .then(a => ({ path, out: a[a.length - 1] }))
    .catch(() => null)            // illiquid paths revert — skip them
));
const best = quotes.filter(Boolean).sort((a, b) => (a!.out > b!.out ? -1 : 1))[0];
```

Quotes are spot estimates (the UI re-quotes ~every 6s). Apply slippage to get `amountOutMin`
(UI default 1%, max 50%): `amountOutMin = best.out * (10000 - slippageBps) / 10000`.

## Executing a swap (write)

1. `ERC20(tokenIn).approve(router, amountIn)` — once per token until allowance is spent.
2. `Router.swapExactTokensForTokens(amountIn, amountOutMin, path, to, deadline)` where
   `deadline = nowSeconds + 1200` (20 min) and `path`/`amountOutMin` come from the best quote.

Native-MON variants exist: `swapExactETHForTokens` (payable, path starts with WMON) and
`swapExactTokensForETH` (path ends with WMON). Otherwise wrap to WMON first.

```bash
# cast (write): approve then swap. Use a keystore/private key for --from.
cast send 0x1314b22df27BDcD4F8D11a0f4185943e55748917 "approve(address,uint256)" \
  0x430c23895c8D44883526e3E0B09327dAD8766660 1000000 --rpc-url $RPC --account <keystore>
cast send 0x430c23895c8D44883526e3E0B09327dAD8766660 \
  "swapExactTokensForTokens(uint256,uint256,address[],address,uint256)" \
  1000000 <amountOutMin> "[<path...>]" <to> <deadline> --rpc-url $RPC --account <keystore>
```

## Pools & liquidity

- **Find a pool:** `Factory.getPair(tokenA, tokenB)` → pair address (`0x0…0` means none yet).
- **Read reserves:** on the pair, `getReserves() → (reserve0, reserve1, blockTimestampLast)`,
  `token0()`, `token1()`, `totalSupply()`, `balanceOf(user)` (LP balance).
- **Create + seed:** `Factory.createPair(tokenA, tokenB)` (if missing), then approve both tokens
  to the router and call `Router.addLiquidity(tokenA, tokenB, amountADesired, amountBDesired, amountAMin, amountBMin, to, deadline)`.
- **Remove:** approve the **LP token** to the router, then
  `Router.removeLiquidity(tokenA, tokenB, liquidity, amountAMin, amountBMin, to, deadline)`.

Known core pools (chain 10143): WMON/USDC `0x1FBC7b6B54726D735fF1B47Df75535B4B9021902`
(this is also the farm's staking LP), WMON/USDT `0x0002b40B245eFcD99A41fd0FB11F2ED90123933d`,
USDC/USDT `0xEa236ABC4Fa54bF5a7a690d0CC2190f3b2C138F9`.

## Token registry

- `search(string query)` — symbol-prefix search (≤4 chars). Returns
  `(address token, string symbol, string name, uint8 decimals, uint8 level, string imageURI, bool isCore, bool active)[]`.
  `level`: trust tier (higher = more trusted; core tokens are top). Higher tiers sort first.
- `listCoreTokens() → address[]` — authoritative core/intermediary set for routing.
- `registerBasic(token, symbol, name, decimals)` — anyone can register a "Basic" token
  (7-day cooldown, max 1 active per address). Subject to `OpenRegistrationGate`.

## Farm — LP staking (WMON/USDC)

StakingRewards: `0xe23B3825F950637256e8DE1BF39743E8f29D97F1` ·
stakes the WMON/USDC LP (`0x1FBC7b6B…`) · rewards in **WMON**.

- **Stake:** approve the LP token to the StakingRewards address, then `stake(amount)`.
- **Claim rewards:** `getReward()`. **Withdraw:** `withdraw(amount)`. **Exit (withdraw all + claim):** `exit()`.
- **Reads:** `balanceOf(user)` (staked), `earned(user)` (claimable WMON), `totalSupply()`,
  `rewardRate()` (WMON/sec), `getRewardForDuration()`, `periodFinish()`, `rewardsDuration()`.
- **APR** (reward token == WMON == one side of the pool):
  `APR = rewardRate * secondsPerYear * wmonPriceUSD / (totalStaked_LP * lpPriceUSD)`.
  Detailed integration walkthrough (viem + ethers v6): `docs/integration/staking-rewards.md`.

## Safety & gotchas

- **Testnet only.** Tokens have no value; treat all activity as non-financial. Writes require chain `10143`.
- **Approvals first.** Every `swap`/`addLiquidity`/`stake` needs a prior `approve` on the token being spent (the LP token for remove-liquidity and staking).
- **Deadlines & slippage.** Always pass a future `deadline` and a real `amountOutMin`; `0`/no-deadline invites MEV/failed txs.
- **USDC ambiguity** (see "Getting test funds"): only `0x534b2f3A…` is the app's USDC; the faucet's USDC is a different token.
- **Illiquid paths revert.** `getAmountsOut` throws for paths without pools — catch and skip when scanning candidates.
