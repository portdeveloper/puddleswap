import { describe, expect, it } from "vitest";

import { checkInputBalance, NATIVE_GAS_BUFFER_WEI } from "../swapBalance";

// 5 MON in wei-scale integers, with the gas buffer as its own unit.
const FIVE = 5_000_000_000_000_000_000n;
const GAS_BUFFER = NATIVE_GAS_BUFFER_WEI; // 0.01 MON

describe("checkInputBalance", () => {
  it("flags native input equal to the full balance as insufficient", () => {
    const result = checkInputBalance({
      isNativeIn: true,
      balanceInRaw: FIVE,
      amountInRaw: FIVE,
    });

    expect(result.insufficient).toBe(true);
    expect(result.gasReserveShortfall).toBe(true);
  });

  it("allows native input up to balance minus the gas buffer", () => {
    const result = checkInputBalance({
      isNativeIn: true,
      balanceInRaw: FIVE,
      amountInRaw: FIVE - GAS_BUFFER,
    });

    expect(result.insufficient).toBe(false);
    expect(result.gasReserveShortfall).toBe(false);
  });

  it("still flags native input past the plain balance", () => {
    const result = checkInputBalance({
      isNativeIn: true,
      balanceInRaw: FIVE,
      amountInRaw: FIVE + 1n,
    });

    expect(result.insufficient).toBe(true);
    expect(result.gasReserveShortfall).toBe(false);
  });

  it("keeps the ERC-20 comparison unchanged: full balance is fine", () => {
    const result = checkInputBalance({
      isNativeIn: false,
      balanceInRaw: FIVE,
      amountInRaw: FIVE,
    });

    expect(result.insufficient).toBe(false);
    expect(result.gasReserveShortfall).toBe(false);
  });

  it("keeps the ERC-20 comparison unchanged: over balance is insufficient", () => {
    const result = checkInputBalance({
      isNativeIn: false,
      balanceInRaw: FIVE,
      amountInRaw: FIVE + 1n,
    });

    expect(result.insufficient).toBe(true);
    expect(result.gasReserveShortfall).toBe(false);
  });

  it("reports sufficient while balances are still loading", () => {
    expect(
      checkInputBalance({
        isNativeIn: true,
        balanceInRaw: undefined,
        amountInRaw: FIVE,
      }),
    ).toEqual({ insufficient: false, gasReserveShortfall: false });

    expect(
      checkInputBalance({
        isNativeIn: true,
        balanceInRaw: FIVE,
        amountInRaw: undefined,
      }),
    ).toEqual({ insufficient: false, gasReserveShortfall: false });
  });

  it("ignores zero-amount quotes the same way the inline check did", () => {
    const result = checkInputBalance({
      isNativeIn: true,
      balanceInRaw: 0n,
      amountInRaw: 0n,
    });

    expect(result.insufficient).toBe(false);
  });

  it("reserves the gas buffer even when the balance itself is tiny", () => {
    const result = checkInputBalance({
      isNativeIn: true,
      balanceInRaw: 1n,
      amountInRaw: 1n,
    });

    expect(result.insufficient).toBe(true);
    expect(result.gasReserveShortfall).toBe(true);
  });
});
