# @puddleswap/sdk

TypeScript SDK for PuddleSwap, the Uniswap-V2-style DEX on Monad testnet
(chain 10143). It contains the star-routing quote logic the web app runs:
direct, 3-hop and 4-hop paths through core tokens, batched into a single
multicall. The web app consumes this package, so there is exactly one copy
of the routing code.

Everything works over plain RPC. No backend, no API key, no wallet coupling:
`buildSwapTx` returns calldata and signing stays with the caller.

## Install

The package lives in this repo's pnpm workspace:

```bash
make setup   # or: pnpm install
```

The only runtime dependency is [viem](https://viem.sh).

## Quote a swap

```ts
import { createPuddleClient, getQuote, monadTestnetAddresses } from "@puddleswap/sdk";

const client = createPuddleClient(process.env.RPC_URL);
const { usdc, wmon } = monadTestnetAddresses;

const quote = await getQuote(client, {
  tokenIn: usdc,
  tokenOut: wmon,
  amountIn: "10" // human units, parsed with tokenIn's decimals
});

console.log(quote.best?.path);      // best route, e.g. [USDC, USDT, WMON]
console.log(quote.best?.amountOut); // raw output units (bigint)
console.log(quote.quotes);          // every candidate with success flag
```

`getQuote` resolves token decimals and the registry's core tokens onchain
when they are not passed in, then quotes every candidate route in one
multicall. Pass `coreTokens`, `decimalsIn` and `decimalsOut` to skip those
reads.

A runnable version is in `examples/quote.ts`:

```bash
pnpm --dir sdk example   # RPC_URL env var overrides the default RPC
```

## Slippage and swap calldata

```ts
import { applySlippage, buildSwapTx } from "@puddleswap/sdk";

const minOut = applySlippage(quote.best.amountOut, 1); // 1% tolerance

const tx = buildSwapTx({
  path: quote.best.path,
  amountInRaw: quote.amountInRaw,
  minAmountOutRaw: minOut,
  recipient: "0xYourAddress"
});
// tx = { to, data, value } - sign and send it with any wallet or script
```

`applySlippage` is the exact min-out formula the swap page uses (floor the
percent to basis points, deduct with integer bigint math). `buildSwapTx`
picks the router function by swap shape: `nativeIn: true` pays native MON
through a WMON-first path, `nativeOut: true` receives native MON through a
WMON-last path, otherwise it is token to token. ERC-20 inputs need a router
allowance before sending.

## Reads

```ts
import { getPair, getReserves, listCoreTokens, searchTokens } from "@puddleswap/sdk";

const cores = await listCoreTokens(client);
const tokens = await searchTokens(client, "USD");
const pair = await getPair(client, usdc, wmon);
if (pair) {
  const { reserve0, reserve1 } = await getReserves(client, pair);
}
```

## Pure routing functions

```ts
import { buildCandidateRoutes, selectBestQuote } from "@puddleswap/sdk";

const routes = buildCandidateRoutes(tokenIn, tokenOut, cores);
const best = selectBestQuote(quotes); // max amountOut among successful ones
```

These take no client and do no IO, so they test against fixture pools. See
`src/__tests__/sdk.test.ts` for a fixture-backed `PuddleReadClient` stub that
runs `getQuote` end to end against x*y=k pools with no RPC.

## Addresses

`monadTestnetAddresses` is imported straight from
`config/addresses/10143.json`, the same file the deploy scripts write, so the
SDK cannot drift from the deployment.

## Tests

```bash
pnpm --dir sdk test --run
```
