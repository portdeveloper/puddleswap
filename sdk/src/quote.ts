import { parseUnits, type Address } from "viem";

import { monadTestnetAddresses, MULTICALL3_ADDRESS } from "./addresses";
import { erc20Abi, routerAbi } from "./abis";
import { listCoreTokens } from "./reads";
import { buildCandidateRoutes, selectBestQuote } from "./routing";
import type { PuddleReadClient, QuoteCandidate, QuoteRequest, QuoteResult } from "./types";

/**
 * Quote a swap across every candidate star route in a single multicall.
 *
 * Enumerates direct, 3-hop and 4-hop paths through the core tokens, asks the
 * router for getAmountsOut on each path in one batched RPC call and picks the
 * best successful candidate. This is the exact quote flow the web app runs.
 */
export async function getQuote(client: PuddleReadClient, request: QuoteRequest): Promise<QuoteResult> {
  const { tokenIn, tokenOut } = request;

  if (tokenIn === tokenOut) {
    throw new Error("tokenIn and tokenOut must differ");
  }

  const [decimalsIn, decimalsOut, coreTokens] = await Promise.all([
    resolveDecimals(client, tokenIn, request.decimalsIn),
    resolveDecimals(client, tokenOut, request.decimalsOut),
    request.coreTokens ?? listCoreTokens(client)
  ]);

  const amountInRaw =
    typeof request.amountIn === "bigint" ? request.amountIn : parseUnits(request.amountIn, decimalsIn);

  const routes = buildCandidateRoutes(tokenIn, tokenOut, coreTokens);

  const multicallResult = await client.multicall({
    allowFailure: true,
    multicallAddress: MULTICALL3_ADDRESS,
    contracts: routes.map((route) => ({
      address: monadTestnetAddresses.uniswapV2Router02,
      abi: routerAbi,
      functionName: "getAmountsOut",
      args: [amountInRaw, route]
    }))
  });

  const quotes: QuoteCandidate[] = routes.map((route, index) => {
    const result = multicallResult[index];

    if (result.status !== "success") {
      return {
        path: route,
        amountOut: 0n,
        success: false
      };
    }

    const amounts = result.result as bigint[];
    const finalAmount = amounts[amounts.length - 1] ?? 0n;

    return {
      path: route,
      amountOut: finalAmount,
      success: true
    };
  });

  return {
    quotes,
    best: selectBestQuote(quotes),
    decimalsIn,
    decimalsOut,
    amountInRaw
  };
}

async function resolveDecimals(client: PuddleReadClient, token: Address, known?: number): Promise<number> {
  if (known !== undefined) {
    return known;
  }

  const raw = await client.readContract({
    address: token,
    abi: erc20Abi,
    functionName: "decimals"
  });

  return Number(raw);
}
