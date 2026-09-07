import type { Address, Hex } from "viem";

export const MON = "MON" as const;
export type Token = Address | typeof MON;

export interface TokenView {
  token: Address;
  symbol: string;
  name: string;
  decimals: number;
  level: number;
  imageURI: string;
  isCore: boolean;
  active: boolean;
}

export interface QuoteCandidate {
  path: Address[];
  amountOut: bigint;
  success: boolean;
}

export interface QuoteResult {
  quotes: QuoteCandidate[];
  best: QuoteCandidate | undefined;
  decimalsIn: number;
  decimalsOut: number;
  amountInRaw: bigint;
  priceImpactBps: number | undefined;
}

export interface QuoteOptions {
  coreTokens?: readonly Address[];
}

export interface Pool {
  pairAddress: Address;
  token0: Address;
  token1: Address;
  reserve0: bigint;
  reserve1: bigint;
  blockTimestampLast: number;
}

export interface SwapTransaction {
  to: Address;
  data: Hex;
  value?: bigint;
}

export interface BuildSwapTxParams {
  tokenIn: Token;
  tokenOut: Token;
  amountIn: bigint;
  amountOutMin: bigint;
  path: readonly Address[];
  recipient: Address;
  deadline?: bigint;
}
