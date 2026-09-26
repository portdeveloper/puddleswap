import { useQuery } from "@tanstack/react-query";
import { BaseError, ContractFunctionRevertedError, formatUnits, type Address } from "viem";
import { useAccount, usePublicClient } from "wagmi";
import { monadTestnet } from "../config/chain";

import { contractAbis, contractAddresses, multicall3Address } from "../lib/contracts";

export interface PoolInfo {
  pairAddress: Address;
  token0: Address;
  token1: Address;
  symbol0: string;
  symbol1: string;
  decimals0: number;
  decimals1: number;
  reserve0: bigint;
  reserve1: bigint;
  reserve0Formatted: string;
  reserve1Formatted: string;
  lpBalance: bigint;
  lpBalanceFormatted: string;
  totalSupply: bigint;
  sharePercent: string;
}

interface PairMeta {
  pairAddress: Address;
  token0: Address;
  token1: Address;
  reserves: [bigint, bigint];
  totalSupply: bigint;
  lpBalance: bigint;
}

type Client = NonNullable<ReturnType<typeof usePublicClient>>;

// Lists a pair only when both tokens are registered and active (so old testUSDC
// pools stay hidden). The core list is not enough: `registerBasic` tokens are
// active but not core.
async function filterToActiveTokens(publicClient: Client, pairMetas: PairMeta[]): Promise<PairMeta[]> {
  const registry = contractAddresses.tokenRegistry;
  if (!registry || pairMetas.length === 0) return pairMetas;

  const tokens = new Map<string, Address>();
  for (const meta of pairMetas) {
    tokens.set(meta.token0.toLowerCase(), meta.token0);
    tokens.set(meta.token1.toLowerCase(), meta.token1);
  }
  const uniqueTokens = [...tokens.values()];

  const results = await publicClient.multicall({
    contracts: uniqueTokens.map((token) => ({
      address: registry,
      abi: contractAbis.registry,
      functionName: "getToken" as const,
      args: [token] as const,
    })),
    multicallAddress: multicall3Address,
  });

  const active = new Set<string>();
  uniqueTokens.forEach((token, i) => {
    const result = results[i];
    if (result.status === "success") {
      if (result.result.active) active.add(token.toLowerCase());
      return;
    }
    // A revert is the registry answering "not registered". Any other failure is
    // a read that never happened, so fail the query and keep the last good list
    // rather than showing none.
    const reverted =
      result.error instanceof BaseError &&
      result.error.walk((e) => e instanceof ContractFunctionRevertedError) !== null;
    if (!reverted) throw result.error;
  });

  return pairMetas.filter(
    (meta) => active.has(meta.token0.toLowerCase()) && active.has(meta.token1.toLowerCase()),
  );
}

export function useAllPools() {
  const publicClient = usePublicClient({ chainId: monadTestnet.id });
  const { address: userAddress } = useAccount();

  return useQuery({
    queryKey: ["all-pools", userAddress],
    enabled: Boolean(publicClient && contractAddresses.uniswapV2Factory),
    staleTime: 15_000,
    refetchInterval: 30_000,
    queryFn: async (): Promise<PoolInfo[]> => {
      if (!publicClient || !contractAddresses.uniswapV2Factory) {
        return [];
      }

      const length = await publicClient.readContract({
        address: contractAddresses.uniswapV2Factory,
        abi: contractAbis.factory,
        functionName: "allPairsLength",
      });

      const count = Number(length);
      if (count === 0) return [];

      // Fetch all pair addresses
      const pairCalls = Array.from({ length: count }, (_, i) => ({
        address: contractAddresses.uniswapV2Factory!,
        abi: contractAbis.factory,
        functionName: "allPairs" as const,
        args: [BigInt(i)] as const,
      }));

      const pairResults = await publicClient.multicall({
        contracts: pairCalls,
        multicallAddress: multicall3Address,
      });

      for (const result of pairResults) {
        if (result.status !== "success") {
          throw result.error ?? new Error("Failed to fetch pair address");
        }
      }

      const pairAddresses = pairResults.map((r) => r.result as Address);

      // Fetch token0, token1, reserves, totalSupply for each pair
      const metaCalls = pairAddresses.flatMap((pair) => [
        { address: pair, abi: contractAbis.pair, functionName: "token0" as const },
        { address: pair, abi: contractAbis.pair, functionName: "token1" as const },
        { address: pair, abi: contractAbis.pair, functionName: "getReserves" as const },
        { address: pair, abi: contractAbis.pair, functionName: "totalSupply" as const },
        ...(userAddress
          ? [{ address: pair, abi: contractAbis.pair, functionName: "balanceOf" as const, args: [userAddress] as const }]
          : []),
      ]);

      const metaResults = await publicClient.multicall({
        contracts: metaCalls,
        multicallAddress: multicall3Address,
      });

      const fieldsPerPair = userAddress ? 5 : 4;

      const pairMetas: PairMeta[] = [];

      for (let i = 0; i < pairAddresses.length; i++) {
        const base = i * fieldsPerPair;
        const token0Result = metaResults[base];
        const token1Result = metaResults[base + 1];
        const reservesResult = metaResults[base + 2];
        const totalSupplyResult = metaResults[base + 3];
        const lpBalanceResult = userAddress ? metaResults[base + 4] : undefined;

        if (
          token0Result?.status !== "success" ||
          token1Result?.status !== "success" ||
          reservesResult?.status !== "success" ||
          totalSupplyResult?.status !== "success"
        ) {
          continue;
        }

        const token0 = token0Result.result as Address;
        const token1 = token1Result.result as Address;
        const reserves = reservesResult.result as [bigint, bigint, number];
        const totalSupply = totalSupplyResult.result as bigint;
        const lpBalance = lpBalanceResult?.status === "success" ? (lpBalanceResult.result as bigint) : 0n;

        pairMetas.push({
          pairAddress: pairAddresses[i],
          token0,
          token1,
          reserves: [reserves[0], reserves[1]],
          totalSupply,
          lpBalance,
        });
      }

      const listedMetas = await filterToActiveTokens(publicClient, pairMetas);

      // Collect unique token addresses for symbol/decimals lookup
      const tokenSet = new Set<string>();
      for (const meta of listedMetas) {
        tokenSet.add(meta.token0);
        tokenSet.add(meta.token1);
      }

      // Fetch symbol + decimals for all unique tokens
      const uniqueTokens = [...tokenSet] as Address[];
      const tokenInfoCalls = uniqueTokens.flatMap((addr) => [
        { address: addr, abi: contractAbis.erc20, functionName: "symbol" as const },
        { address: addr, abi: contractAbis.erc20, functionName: "decimals" as const },
      ]);

      const tokenInfoResults = await publicClient.multicall({
        contracts: tokenInfoCalls,
        multicallAddress: multicall3Address,
      });

      const tokenMeta = new Map<string, { symbol: string; decimals: number }>();
      for (let i = 0; i < uniqueTokens.length; i++) {
        const symbolResult = tokenInfoResults[i * 2];
        const decimalsResult = tokenInfoResults[i * 2 + 1];
        tokenMeta.set(uniqueTokens[i].toLowerCase(), {
          symbol: symbolResult?.status === "success" ? (symbolResult.result as string) : "???",
          decimals: decimalsResult?.status === "success" ? Number(decimalsResult.result) : 18,
        });
      }

      return listedMetas.map((meta) => {
        const t0 = tokenMeta.get(meta.token0.toLowerCase()) ?? { symbol: "???", decimals: 18 };
        const t1 = tokenMeta.get(meta.token1.toLowerCase()) ?? { symbol: "???", decimals: 18 };

        const sharePercent =
          meta.totalSupply > 0n && meta.lpBalance > 0n
            ? ((Number(meta.lpBalance) / Number(meta.totalSupply)) * 100).toFixed(2)
            : "0";

        return {
          pairAddress: meta.pairAddress,
          token0: meta.token0,
          token1: meta.token1,
          symbol0: t0.symbol,
          symbol1: t1.symbol,
          decimals0: t0.decimals,
          decimals1: t1.decimals,
          reserve0: meta.reserves[0],
          reserve1: meta.reserves[1],
          reserve0Formatted: formatUnits(meta.reserves[0], t0.decimals),
          reserve1Formatted: formatUnits(meta.reserves[1], t1.decimals),
          lpBalance: meta.lpBalance,
          lpBalanceFormatted: formatUnits(meta.lpBalance, 18),
          totalSupply: meta.totalSupply,
          sharePercent,
        };
      });
    },
  });
}
