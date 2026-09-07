import type { PublicClient } from "viem";
import { describe, expect, it, vi } from "vitest";

import { addresses, createPuddleSwapClient } from "../index.js";

describe("getQuote", () => {
  it("batches every candidate route and selects the largest successful output", async () => {
    const multicall = vi.fn().mockResolvedValue([
      { status: "success", result: [1_000_000n, 100n] },
      { status: "success", result: [1_000_000n, 120n, 150n] }
    ]);
    const readContract = vi.fn(async ({
      address,
      functionName
    }: {
      address?: string;
      functionName?: string;
    }) => {
      if (functionName === "listCoreTokens") {
        return [addresses.testUSDT];
      }
      if (functionName === "decimals") {
        return address === addresses.usdc ? 6 : 18;
      }
      return [1_000n, 1n];
    });
    const puddle = createPuddleSwapClient({
      publicClient: { multicall, readContract } as unknown as PublicClient
    });

    const quote = await puddle.getQuote(addresses.usdc, addresses.wmon, "1");

    expect(quote.best?.path).toEqual([
      addresses.usdc,
      addresses.testUSDT,
      addresses.wmon
    ]);
    expect(quote.best?.amountOut).toBe(150n);
    expect(multicall).toHaveBeenCalledTimes(1);
    expect(multicall.mock.calls[0][0].contracts).toHaveLength(2);
  });
});
