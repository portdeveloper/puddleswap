import { describe, expect, it } from "vitest";
import { decodeFunctionData, parseUnits, type Address } from "viem";

import {
  applySlippage,
  buildCandidateRoutes,
  buildSwapTx,
  getQuote,
  monadTestnetAddresses,
  routerAbi,
  type MulticallEntry,
  type MulticallEntryResult,
  type PuddleReadClient
} from "../index";

// x*y=k constant-product output with the 0.3% fee, used to derive expected
// values independently of the code under test.
function cpOut(amountIn: bigint, reserveIn: bigint, reserveOut: bigint): bigint {
  const num = amountIn * 997n * reserveOut;
  const den = reserveIn * 1000n + amountIn * 997n;
  return num / den;
}

const USDC = "0x0000000000000000000000000000000000000a01" as Address;
const WMON = "0x0000000000000000000000000000000000000a02" as Address;
const USDT = "0x0000000000000000000000000000000000000a03" as Address;

// Fixture pools, keyed by "tokenA>tokenB". Reserves are one-directional for
// simplicity; the stub router below walks them per hop.
const pools = new Map<string, { reserveIn: bigint; reserveOut: bigint }>([
  // USDC (6 decimals) -> WMON (18 decimals), shallow direct pool
  [`${USDC}>${WMON}`, { reserveIn: parseUnits("1000", 6), reserveOut: parseUnits("500", 18) }],
  // USDC -> USDT -> WMON, deep pools that beat the direct route
  [`${USDC}>${USDT}`, { reserveIn: parseUnits("500000", 6), reserveOut: parseUnits("500000", 6) }],
  [`${USDT}>${WMON}`, { reserveIn: parseUnits("500000", 6), reserveOut: parseUnits("300000", 18) }]
]);

function quoteAlongPath(amountIn: bigint, path: Address[]): bigint[] | undefined {
  const amounts = [amountIn];
  let current = amountIn;

  for (let i = 1; i < path.length; i++) {
    const pool = pools.get(`${path[i - 1]}>${path[i]}`);
    if (!pool) {
      return undefined;
    }
    current = cpOut(current, pool.reserveIn, pool.reserveOut);
    amounts.push(current);
  }

  return amounts;
}

// A fixture-backed stand-in for a viem public client. getAmountsOut walks the
// pool fixtures; unknown pairs fail the candidate like a reverted RPC call.
const fixtureClient: PuddleReadClient = {
  async readContract({ functionName }) {
    if (functionName === "decimals") {
      return 6;
    }
    if (functionName === "listCoreTokens") {
      return [USDT];
    }
    throw new Error(`unexpected readContract: ${functionName}`);
  },
  async multicall({ contracts }) {
    return contracts.map((entry: MulticallEntry): MulticallEntryResult => {
      const [amountIn, path] = entry.args as [bigint, Address[]];
      const amounts = quoteAlongPath(amountIn, path);

      if (!amounts) {
        return { status: "failure", error: new Error("no pool") };
      }

      return { status: "success", result: amounts };
    });
  }
};

describe("getQuote", () => {
  it("returns the same candidates and winner as the extracted web flow", async () => {
    const result = await getQuote(fixtureClient, {
      tokenIn: USDC,
      tokenOut: WMON,
      amountIn: "100",
      coreTokens: [USDT],
      decimalsIn: 6,
      decimalsOut: 18
    });

    // Same candidate enumeration as buildCandidateRoutes.
    const expectedRoutes = buildCandidateRoutes(USDC, WMON, [USDT]);
    expect(result.quotes.map((quote) => quote.path)).toEqual(expectedRoutes);

    // Same raw amount parsing as the web app (parseUnits with decimalsIn).
    expect(result.amountInRaw).toBe(parseUnits("100", 6));

    // Winner and amounts pinned to independent x*y=k math: the deep two-hop
    // route through USDT beats the shallow direct pool.
    const amountInRaw = parseUnits("100", 6);
    const directOut = cpOut(amountInRaw, parseUnits("1000", 6), parseUnits("500", 18));
    const hopOut = cpOut(
      cpOut(amountInRaw, parseUnits("500000", 6), parseUnits("500000", 6)),
      parseUnits("500000", 6),
      parseUnits("300000", 18)
    );
    expect(hopOut).toBeGreaterThan(directOut);
    expect(result.best?.path).toEqual([USDC, USDT, WMON]);
    expect(result.best?.amountOut).toBe(hopOut);

    const direct = result.quotes.find((quote) => quote.path.length === 2);
    expect(direct?.amountOut).toBe(directOut);
    expect(result.decimalsIn).toBe(6);
    expect(result.decimalsOut).toBe(18);
  });

  it("reads decimals and core tokens onchain when not provided", async () => {
    const result = await getQuote(fixtureClient, {
      tokenIn: USDC,
      tokenOut: WMON,
      amountIn: "100"
    });

    // decimals come from the stub's readContract (6), cores from the registry.
    expect(result.decimalsIn).toBe(6);
    expect(result.amountInRaw).toBe(parseUnits("100", 6));
    expect(result.best?.path).toEqual([USDC, USDT, WMON]);
  });

  it("accepts a raw bigint amountIn without decimal parsing", async () => {
    const raw = parseUnits("100", 6);
    const result = await getQuote(fixtureClient, {
      tokenIn: USDC,
      tokenOut: WMON,
      amountIn: raw,
      coreTokens: [USDT],
      decimalsIn: 6,
      decimalsOut: 18
    });

    expect(result.amountInRaw).toBe(raw);
  });

  it("marks failed candidates instead of throwing", async () => {
    // No fixture pool goes WMON -> USDC, so every candidate fails.
    const result = await getQuote(fixtureClient, {
      tokenIn: WMON,
      tokenOut: USDC,
      amountIn: "1",
      coreTokens: [USDT],
      decimalsIn: 18,
      decimalsOut: 6
    });

    expect(result.quotes.every((quote) => !quote.success)).toBe(true);
    expect(result.best).toBeUndefined();
  });

  it("rejects identical tokenIn and tokenOut", async () => {
    await expect(
      getQuote(fixtureClient, { tokenIn: USDC, tokenOut: USDC, amountIn: "1" })
    ).rejects.toThrow("must differ");
  });
});

describe("applySlippage", () => {
  it("matches the swap page min-out formula exactly", () => {
    const amountOut = 123_456_789n;

    // The formula the swap page used inline: floor percent to bps, then
    // deduct with integer bigint math.
    for (const percent of [1, 0.5, 50]) {
      const bps = Math.floor(percent * 100);
      const expected = amountOut - (amountOut * BigInt(bps)) / 10_000n;
      expect(applySlippage(amountOut, percent)).toBe(expected);
    }
  });

  it("returns the full amount at zero slippage", () => {
    expect(applySlippage(1_000_000n, 0)).toBe(1_000_000n);
  });
});

// Decoded calldata comes back EIP-55 checksummed; compare case-insensitively.
function lower(value: unknown): unknown {
  if (typeof value === "string") {
    return value.toLowerCase();
  }
  if (Array.isArray(value)) {
    return value.map(lower);
  }
  return value;
}

describe("buildSwapTx", () => {
  const recipient = "0x00000000000000000000000000000000000000b1" as Address;
  const path = [USDC, WMON];
  const amountInRaw = parseUnits("100", 6);
  const minOut = parseUnits("49", 18);
  const deadline = 1_800_000_000n;

  it("encodes swapExactTokensForTokens for a token-to-token swap", () => {
    const tx = buildSwapTx({ path, amountInRaw, minAmountOutRaw: minOut, recipient, deadline });

    expect(tx.to).toBe(monadTestnetAddresses.uniswapV2Router02);
    expect(tx.value).toBe(0n);

    const decoded = decodeFunctionData({ abi: routerAbi, data: tx.data });
    expect(decoded.functionName).toBe("swapExactTokensForTokens");
    expect(lower(decoded.args)).toEqual(lower([amountInRaw, minOut, path, recipient, deadline]));
  });

  it("encodes swapExactETHForTokens with value when paying native MON", () => {
    const wmonPath = [monadTestnetAddresses.wmon, USDC];
    const tx = buildSwapTx({
      path: wmonPath,
      amountInRaw,
      minAmountOutRaw: minOut,
      recipient,
      deadline,
      nativeIn: true
    });

    expect(tx.value).toBe(amountInRaw);

    const decoded = decodeFunctionData({ abi: routerAbi, data: tx.data });
    expect(decoded.functionName).toBe("swapExactETHForTokens");
    expect(lower(decoded.args)).toEqual(lower([minOut, wmonPath, recipient, deadline]));
  });

  it("encodes swapExactTokensForETH when receiving native MON", () => {
    const wmonPath = [USDC, monadTestnetAddresses.wmon];
    const tx = buildSwapTx({
      path: wmonPath,
      amountInRaw,
      minAmountOutRaw: minOut,
      recipient,
      deadline,
      nativeOut: true
    });

    expect(tx.value).toBe(0n);

    const decoded = decodeFunctionData({ abi: routerAbi, data: tx.data });
    expect(decoded.functionName).toBe("swapExactTokensForETH");
    expect(lower(decoded.args)).toEqual(lower([amountInRaw, minOut, wmonPath, recipient, deadline]));
  });

  it("rejects native flags that do not match the path", () => {
    expect(() =>
      buildSwapTx({ path, amountInRaw, minAmountOutRaw: minOut, recipient, deadline, nativeIn: true })
    ).toThrow("start with WMON");
    expect(() =>
      buildSwapTx({ path, amountInRaw, minAmountOutRaw: minOut, recipient, deadline, nativeOut: true })
    ).toThrow("end with WMON");
  });
});
