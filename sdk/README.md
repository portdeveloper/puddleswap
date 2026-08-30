# PuddleSwap SDK

Wallet-agnostic helpers for reading PuddleSwap, finding the best star-routed
quote, and building unsigned swap transactions on Monad testnet.

```ts
import { addresses, createPuddleSwapClient } from "@puddleswap/sdk";

const puddle = createPuddleSwapClient({ rpcUrl: process.env.RPC_URL! });
const quote = await puddle.getQuote(addresses.usdc, addresses.wmon, "1");

console.log(quote.best?.path, quote.best?.amountOut);
```

`buildSwapTx` returns `{ to, data, value? }`. The caller remains responsible
for signing and sending the transaction.

The client also exposes `getPair`, `listPools`, `listCoreTokens`, and
`searchTokens`. Every multi-route quote and pool metadata read is batched with
Multicall3.

Run the standalone quote example after building:

```bash
RPC_URL=https://your-monad-rpc pnpm --dir sdk example:quote
```
