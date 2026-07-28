import { encodeFunctionData, type Address, type Hex } from "viem";

import { monadTestnetAddresses } from "./addresses";
import { routerAbi } from "./abis";

export const DEFAULT_DEADLINE_SECONDS = 20 * 60;

export type SwapTxRequest = {
  /** Swap path from buildCandidateRoutes / getQuote, wrapped tokens only. */
  path: Address[];
  /** Exact input amount in raw units. */
  amountInRaw: bigint;
  /** Minimum acceptable output in raw units, e.g. from applySlippage. */
  minAmountOutRaw: bigint;
  /** Address that receives the output tokens. */
  recipient: Address;
  /** Unix deadline in seconds. Defaults to now + 20 minutes. */
  deadline?: bigint;
  /** Pay with native MON. path[0] must be WMON; the router wraps it. */
  nativeIn?: boolean;
  /** Receive native MON. The last path element must be WMON. */
  nativeOut?: boolean;
};

export type SwapTx = {
  to: Address;
  data: Hex;
  value: bigint;
};

/**
 * Build an unsigned swap transaction for the PuddleSwap router.
 *
 * Picks the same router function the web app uses for each shape:
 * swapExactETHForTokens when paying native MON, swapExactTokensForETH when
 * receiving native MON, swapExactTokensForTokens otherwise. Returns plain
 * calldata; signing and sending stay with the caller.
 */
export function buildSwapTx(request: SwapTxRequest): SwapTx {
  const { path, amountInRaw, minAmountOutRaw, recipient, nativeIn = false, nativeOut = false } = request;

  if (path.length < 2) {
    throw new Error("path needs at least two tokens");
  }
  if (nativeIn && nativeOut) {
    throw new Error("nativeIn and nativeOut cannot both be set");
  }

  const wmon = monadTestnetAddresses.wmon.toLowerCase();

  if (nativeIn && path[0].toLowerCase() !== wmon) {
    throw new Error("nativeIn requires the path to start with WMON");
  }
  if (nativeOut && path[path.length - 1].toLowerCase() !== wmon) {
    throw new Error("nativeOut requires the path to end with WMON");
  }

  const deadline = request.deadline ?? BigInt(Math.floor(Date.now() / 1000) + DEFAULT_DEADLINE_SECONDS);
  const to = monadTestnetAddresses.uniswapV2Router02;

  if (nativeIn) {
    return {
      to,
      data: encodeFunctionData({
        abi: routerAbi,
        functionName: "swapExactETHForTokens",
        args: [minAmountOutRaw, path, recipient, deadline]
      }),
      value: amountInRaw
    };
  }

  if (nativeOut) {
    return {
      to,
      data: encodeFunctionData({
        abi: routerAbi,
        functionName: "swapExactTokensForETH",
        args: [amountInRaw, minAmountOutRaw, path, recipient, deadline]
      }),
      value: 0n
    };
  }

  return {
    to,
    data: encodeFunctionData({
      abi: routerAbi,
      functionName: "swapExactTokensForTokens",
      args: [amountInRaw, minAmountOutRaw, path, recipient, deadline]
    }),
    value: 0n
  };
}
