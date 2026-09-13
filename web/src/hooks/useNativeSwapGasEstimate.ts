import { useQuery } from "@tanstack/react-query";
import { BaseError, InsufficientFundsError } from "viem";
import { usePublicClient } from "wagmi";
import { monadTestnet } from "../config/chain";

import { contractAbis, contractAddresses } from "../lib/contracts";
import { decodeTxError } from "../lib/revertReason";
import type { NativeGasEstimate } from "../lib/swapBalance";

function isInsufficientFunds(error: unknown): boolean {
  if (error instanceof InsufficientFundsError) return true;
  if (error instanceof BaseError) {
    return Boolean(error.walk((e) => e instanceof InsufficientFundsError));
  }
  return false;
}

/**
 * Estimate the gas cost (in wei) of a native-MON swap. Returns a
 * NativeGasEstimate that the pure `checkInputBalance` helper can consume.
 *
 * The estimate is re-fetched every 10 s so it tracks changes in gas price and
 * quote path.  `placeholderData: keepPreviousData` avoids a flash to the
 * "estimating" state while the quote refreshes.
 */
export function useNativeSwapGasEstimate({
  enabled,
  account,
  amountInRaw,
  path,
  minOut,
}: {
  enabled: boolean;
  account: `0x${string}` | undefined;
  amountInRaw: bigint | undefined;
  path: `0x${string}`[] | undefined;
  minOut: bigint | undefined;
}): { data: NativeGasEstimate | undefined; isLoading: boolean } {
  const publicClient = usePublicClient({ chainId: monadTestnet.id });

  const { data, isLoading } = useQuery<NativeGasEstimate | undefined>({
    queryKey: [
      "native-swap-gas-estimate",
      account,
      amountInRaw?.toString() ?? "",
      path?.join("-") ?? "",
      minOut?.toString() ?? "",
    ],
    enabled:
      enabled &&
      Boolean(publicClient && account && amountInRaw !== undefined && amountInRaw > 0n && path && path.length >= 2),
    refetchInterval: 10_000,
    queryFn: async (): Promise<NativeGasEstimate> => {
      if (!publicClient || !account || amountInRaw === undefined || !path) {
        return { kind: "unavailable", message: "Missing parameters" };
      }

      // Use 0n for minOut in the estimate: gas units don't depend on
      // slippage, and a tighter minOut can trigger spurious reverts.
      const deadline = BigInt(Math.floor(Date.now() / 1000) + 60 * 20);

      try {
        const gasUnits = await publicClient.estimateContractGas({
          address: contractAddresses.uniswapV2Router02!,
          abi: contractAbis.router,
          functionName: "swapExactETHForTokens",
          args: [minOut ?? 0n, path, account, deadline],
          account,
          value: amountInRaw,
        });

        let feePerGas: bigint;
        try {
          const fees = await publicClient.estimateFeesPerGas();
          feePerGas = fees.maxFeePerGas;
        } catch {
          // EIP-1559 not supported on this chain — fall back to legacy gas price.
          feePerGas = await publicClient.getGasPrice();
        }

        return { kind: "estimated", costWei: gasUnits * feePerGas };
      } catch (error: unknown) {
        if (isInsufficientFunds(error)) {
          return { kind: "insufficient-funds" };
        }
        const decoded = decodeTxError(error);
        return {
          kind: "unavailable",
          message: decoded.message,
        };
      }
    },
  });

  return { data, isLoading };
}
