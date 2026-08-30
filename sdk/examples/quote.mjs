import { formatUnits } from "viem";
import { addresses, createPuddleSwapClient } from "@puddleswap/sdk";

const rpcUrl = process.env.RPC_URL;
if (!rpcUrl) throw new Error("Set RPC_URL to a Monad testnet RPC endpoint");

const puddle = createPuddleSwapClient({ rpcUrl });
const quote = await puddle.getQuote(addresses.usdc, addresses.wmon, "1");

if (!quote.best) throw new Error("No USDC -> WMON route found");

console.log("route:", quote.best.path.join(" -> "));
console.log(
  "amount out:",
  formatUnits(quote.best.amountOut, quote.decimalsOut),
  "WMON",
);
