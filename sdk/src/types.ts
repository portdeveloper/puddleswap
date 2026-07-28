import type { Abi, Address } from "viem";

export type QuoteCandidate = {
  path: Address[];
  amountOut: bigint;
  success: boolean;
};

export type QuoteRequest = {
  tokenIn: Address;
  tokenOut: Address;
  /**
   * Amount of tokenIn to quote. A string is a human-readable decimal amount
   * ("1.5") parsed with tokenIn's decimals. A bigint is raw units, used as-is.
   */
  amountIn: string | bigint;
  /**
   * Core tokens to route through. Defaults to the onchain registry's
   * listCoreTokens() when omitted.
   */
  coreTokens?: Address[];
  /** Skip the onchain decimals read for tokenIn when already known. */
  decimalsIn?: number;
  /** Skip the onchain decimals read for tokenOut when already known. */
  decimalsOut?: number;
};

export type QuoteResult = {
  quotes: QuoteCandidate[];
  best: QuoteCandidate | undefined;
  decimalsIn: number;
  decimalsOut: number;
  amountInRaw: bigint;
};

export type MulticallEntry = {
  address: Address;
  abi: Abi;
  functionName: string;
  args?: readonly unknown[];
};

export type MulticallEntryResult =
  | { status: "success"; result: unknown }
  | { status: "failure"; error: Error; result?: undefined };

/**
 * The subset of a viem PublicClient the SDK reads through. Any viem or wagmi
 * public client satisfies it; tests can supply a fixture-backed stub instead
 * of a live RPC.
 */
export type PuddleReadClient = {
  readContract(parameters: {
    address: Address;
    abi: Abi;
    functionName: string;
    args?: readonly unknown[];
  }): Promise<unknown>;
  multicall(parameters: {
    allowFailure: true;
    multicallAddress: Address;
    contracts: MulticallEntry[];
  }): Promise<MulticallEntryResult[]>;
};
