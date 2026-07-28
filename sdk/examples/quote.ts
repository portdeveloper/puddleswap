import { formatUnits } from "viem";

import { applySlippage, createPuddleClient, getQuote, monadTestnetAddresses } from "../src/index";

// Best route and quote for a USDC -> WMON swap, using only the SDK and an
// RPC URL. Run with: pnpm --dir sdk example  (RPC_URL overrides the default)
const client = createPuddleClient(process.env.RPC_URL);
const { usdc, wmon } = monadTestnetAddresses;

const quote = await getQuote(client, { tokenIn: usdc, tokenOut: wmon, amountIn: "10" });

if (!quote.best) {
  console.log("No live route for USDC -> WMON right now.");
  process.exit(1);
}

const out = formatUnits(quote.best.amountOut, quote.decimalsOut);
const minOut = formatUnits(applySlippage(quote.best.amountOut, 1), quote.decimalsOut);

console.log(`Candidates quoted: ${quote.quotes.length} (${quote.quotes.filter((q) => q.success).length} live)`);
console.log(`Best route: ${quote.best.path.join(" -> ")}`);
console.log(`10 USDC -> ${out} WMON`);
console.log(`Min out at 1% slippage: ${minOut} WMON`);
