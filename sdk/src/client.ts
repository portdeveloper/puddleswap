import {
  createPublicClient,
  encodeFunctionData,
  http,
  parseUnits,
  zeroAddress,
  type Address,
  type PublicClient
} from "viem";
import { monadTestnet } from "viem/chains";

import {
  erc20Abi,
  factoryAbi,
  pairAbi,
  registryAbi,
  routerAbi
} from "./abis.js";
import { deployment } from "./deployment.js";
import { buildCandidateRoutes, selectBestQuote } from "./routing.js";
import {
  MON,
  type BuildSwapTxParams,
  type Pool,
  type QuoteCandidate,
  type QuoteOptions,
  type QuoteResult,
  type SwapTransaction,
  type Token,
  type TokenView
} from "./types.js";

export const addresses = {
  ...deployment.contracts,
  factory: deployment.contracts.uniswapV2Factory,
  router: deployment.contracts.uniswapV2Router02,
  registry: deployment.contracts.tokenRegistry
} as Record<
  keyof typeof deployment.contracts | "factory" | "router" | "registry",
  Address
>;

export const chainId = deployment.chainId;
export const multicall3Address = "0xca11bde05977b3631167028862be2a173976ca11" as Address;

export interface CreatePuddleSwapClientOptions {
  rpcUrl?: string;
  publicClient?: PublicClient;
}

function resolveToken(token: Token): Address {
  return token === MON ? addresses.wmon : token;
}

function sameAddress(left: Address, right: Address): boolean {
  return left.toLowerCase() === right.toLowerCase();
}

async function readTokenDecimals(
  publicClient: PublicClient,
  tokenIn: Token,
  tokenOut: Token
): Promise<[number, number]> {
  const readDecimals = async (token: Token): Promise<number> => {
    if (token === MON) {
      return 18;
    }

    const result = await publicClient.readContract({
      address: token,
      abi: erc20Abi,
      functionName: "decimals"
    });
    return Number(result);
  };

  return Promise.all([readDecimals(tokenIn), readDecimals(tokenOut)]);
}

export function buildSwapTx({
  tokenIn,
  tokenOut,
  amountIn,
  amountOutMin,
  path,
  recipient,
  deadline = BigInt(Math.floor(Date.now() / 1000) + 20 * 60)
}: BuildSwapTxParams): SwapTransaction {
  if (tokenIn === MON && tokenOut === MON) {
    throw new Error("A swap cannot use MON as both input and output");
  }
  if (path.length < 2) {
    throw new Error("A swap path must contain at least two tokens");
  }
  if (amountIn <= 0n) {
    throw new RangeError("Swap input amount must be greater than zero");
  }
  if (amountOutMin < 0n) {
    throw new RangeError("Minimum output amount cannot be negative");
  }

  const resolvedIn = resolveToken(tokenIn);
  const resolvedOut = resolveToken(tokenOut);
  if (
    !sameAddress(path[0], resolvedIn) ||
    !sameAddress(path[path.length - 1], resolvedOut)
  ) {
    throw new Error("Swap path endpoints do not match tokenIn and tokenOut");
  }

  if (tokenIn === MON) {
    return {
      to: addresses.router,
      data: encodeFunctionData({
        abi: routerAbi,
        functionName: "swapExactETHForTokens",
        args: [amountOutMin, [...path], recipient, deadline]
      }),
      value: amountIn
    };
  }

  if (tokenOut === MON) {
    return {
      to: addresses.router,
      data: encodeFunctionData({
        abi: routerAbi,
        functionName: "swapExactTokensForETH",
        args: [amountIn, amountOutMin, [...path], recipient, deadline]
      })
    };
  }

  return {
    to: addresses.router,
    data: encodeFunctionData({
      abi: routerAbi,
      functionName: "swapExactTokensForTokens",
      args: [amountIn, amountOutMin, [...path], recipient, deadline]
    })
  };
}

export function createPuddleSwapClient(options: CreatePuddleSwapClientOptions) {
  if (!options.publicClient && !options.rpcUrl) {
    throw new Error("createPuddleSwapClient requires rpcUrl or publicClient");
  }

  const publicClient = (options.publicClient ?? createPublicClient({
    chain: monadTestnet,
    transport: http(options.rpcUrl)
  })) as PublicClient;

  async function listCoreTokens(): Promise<Address[]> {
    const result = await publicClient.readContract({
      address: addresses.registry,
      abi: registryAbi,
      functionName: "listCoreTokens"
    });
    return [...result];
  }

  async function searchTokens(query: string): Promise<TokenView[]> {
    const result = await publicClient.readContract({
      address: addresses.registry,
      abi: registryAbi,
      functionName: "search",
      args: [query]
    }) as readonly TokenView[];

    return result.map((token) => ({
      ...token,
      decimals: Number(token.decimals),
      level: Number(token.level)
    }));
  }

  async function getPair(tokenA: Token, tokenB: Token): Promise<Address | undefined> {
    const pair = await publicClient.readContract({
      address: addresses.factory,
      abi: factoryAbi,
      functionName: "getPair",
      args: [resolveToken(tokenA), resolveToken(tokenB)]
    });

    return pair === zeroAddress ? undefined : pair;
  }

  async function listPools(): Promise<Pool[]> {
    const length = await publicClient.readContract({
      address: addresses.factory,
      abi: factoryAbi,
      functionName: "allPairsLength"
    });
    const count = Number(length);
    if (count === 0) {
      return [];
    }

    const pairResults = await publicClient.multicall({
      allowFailure: true,
      multicallAddress: multicall3Address,
      contracts: Array.from({ length: count }, (_, index) => ({
        address: addresses.factory,
        abi: factoryAbi,
        functionName: "allPairs" as const,
        args: [BigInt(index)] as const
      }))
    });
    const pairAddresses = pairResults.flatMap((result) =>
      result.status === "success" ? [result.result as Address] : []
    );
    if (pairAddresses.length === 0) {
      return [];
    }

    const poolResults = await publicClient.multicall({
      allowFailure: true,
      multicallAddress: multicall3Address,
      contracts: pairAddresses.flatMap((pairAddress) => [
        { address: pairAddress, abi: pairAbi, functionName: "token0" as const },
        { address: pairAddress, abi: pairAbi, functionName: "token1" as const },
        { address: pairAddress, abi: pairAbi, functionName: "getReserves" as const }
      ])
    });
    const pools: Pool[] = [];

    pairAddresses.forEach((pairAddress, index) => {
      const token0 = poolResults[index * 3];
      const token1 = poolResults[index * 3 + 1];
      const reserves = poolResults[index * 3 + 2];
      if (
        token0?.status !== "success" ||
        token1?.status !== "success" ||
        reserves?.status !== "success"
      ) {
        return;
      }

      const [reserve0, reserve1, blockTimestampLast] = reserves.result as readonly [
        bigint,
        bigint,
        number
      ];
      pools.push({
        pairAddress,
        token0: token0.result as Address,
        token1: token1.result as Address,
        reserve0,
        reserve1,
        blockTimestampLast
      });
    });

    return pools;
  }

  async function getQuote(
    tokenIn: Token,
    tokenOut: Token,
    amount: string | bigint,
    quoteOptions: QuoteOptions = {}
  ): Promise<QuoteResult> {
    const tokenInAddress = resolveToken(tokenIn);
    const tokenOutAddress = resolveToken(tokenOut);
    if (sameAddress(tokenInAddress, tokenOutAddress)) {
      return {
        quotes: [],
        best: undefined,
        decimalsIn: 18,
        decimalsOut: 18,
        amountInRaw: 0n,
        priceImpactBps: undefined
      };
    }

    const [decimals, coreTokens] = await Promise.all([
      readTokenDecimals(publicClient, tokenIn, tokenOut),
      quoteOptions.coreTokens
        ? Promise.resolve([...quoteOptions.coreTokens])
        : listCoreTokens()
    ]);
    const [decimalsIn, decimalsOut] = decimals;
    const amountInRaw = typeof amount === "bigint" ? amount : parseUnits(amount, decimalsIn);
    if (amountInRaw <= 0n) {
      throw new RangeError("Quote amount must be greater than zero");
    }

    const routes = buildCandidateRoutes(tokenInAddress, tokenOutAddress, coreTokens);
    const quoteResults = await publicClient.multicall({
      allowFailure: true,
      multicallAddress: multicall3Address,
      contracts: routes.map((path) => ({
        address: addresses.router,
        abi: routerAbi,
        functionName: "getAmountsOut" as const,
        args: [amountInRaw, path] as const
      }))
    });
    const quotes: QuoteCandidate[] = routes.map((path, index) => {
      const result = quoteResults[index];
      if (!result || result.status !== "success") {
        return { path, amountOut: 0n, success: false };
      }

      const amounts = result.result as readonly bigint[];
      return { path, amountOut: amounts[amounts.length - 1] ?? 0n, success: true };
    });
    const best = selectBestQuote(quotes);
    let priceImpactBps: number | undefined;

    if (best && best.amountOut > 0n) {
      const referenceIn = amountInRaw / 1000n > 0n ? amountInRaw / 1000n : 1n;
      try {
        const referenceAmounts = await publicClient.readContract({
          address: addresses.router,
          abi: routerAbi,
          functionName: "getAmountsOut",
          args: [referenceIn, best.path]
        });
        const referenceOut = referenceAmounts[referenceAmounts.length - 1] ?? 0n;
        if (referenceOut > 0n) {
          const denominator = amountInRaw * referenceOut;
          const ratioBps = denominator > 0n
            ? Number((best.amountOut * referenceIn * 10_000n) / denominator)
            : 10_000;
          priceImpactBps = Math.max(0, 10_000 - ratioBps);
        }
      } catch {
        priceImpactBps = undefined;
      }
    }

    return { quotes, best, decimalsIn, decimalsOut, amountInRaw, priceImpactBps };
  }

  return {
    publicClient,
    getQuote,
    buildSwapTx,
    getPair,
    listPools,
    listCoreTokens,
    searchTokens
  };
}

export type PuddleSwapClient = ReturnType<typeof createPuddleSwapClient>;
