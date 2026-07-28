import type { Address } from "viem";

import { monadTestnetAddresses } from "./addresses";
import { factoryAbi, pairAbi, registryAbi } from "./abis";
import type { PuddleReadClient } from "./types";

export type RegistryToken = {
  token: Address;
  symbol: string;
  name: string;
  decimals: number;
  level: number;
  imageURI: string;
  isCore: boolean;
  active: boolean;
};

export type PairReserves = {
  reserve0: bigint;
  reserve1: bigint;
  blockTimestampLast: number;
};

/** Core tokens the star router routes through, from the onchain registry. */
export async function listCoreTokens(client: PuddleReadClient): Promise<Address[]> {
  const result = await client.readContract({
    address: monadTestnetAddresses.tokenRegistry,
    abi: registryAbi,
    functionName: "listCoreTokens"
  });

  return result as Address[];
}

/** Search the onchain token registry by symbol or name. */
export async function searchTokens(client: PuddleReadClient, query: string): Promise<RegistryToken[]> {
  const result = await client.readContract({
    address: monadTestnetAddresses.tokenRegistry,
    abi: registryAbi,
    functionName: "search",
    args: [query]
  });

  return result as RegistryToken[];
}

/**
 * Pair address for a token pair, or undefined when no pool exists.
 * The factory returns the zero address for missing pairs.
 */
export async function getPair(
  client: PuddleReadClient,
  tokenA: Address,
  tokenB: Address
): Promise<Address | undefined> {
  const pair = (await client.readContract({
    address: monadTestnetAddresses.uniswapV2Factory,
    abi: factoryAbi,
    functionName: "getPair",
    args: [tokenA, tokenB]
  })) as Address;

  return pair === "0x0000000000000000000000000000000000000000" ? undefined : pair;
}

/** Current reserves of a pair, ordered by the pair's token0/token1. */
export async function getReserves(client: PuddleReadClient, pair: Address): Promise<PairReserves> {
  const [reserve0, reserve1, blockTimestampLast] = (await client.readContract({
    address: pair,
    abi: pairAbi,
    functionName: "getReserves"
  })) as [bigint, bigint, number];

  return { reserve0, reserve1, blockTimestampLast };
}
