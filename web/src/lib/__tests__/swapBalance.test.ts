import { describe, expect, it } from "vitest";

import { checkInputBalance, type NativeGasEstimate } from "../swapBalance";

const FIVE = 5_000_000_000_000_000_000n; // 5 MON in wei
const GAS_COST = 20_000_000_000_000_000n; // 0.02 MON estimated gas

function estimated(costWei: bigint): NativeGasEstimate {
  return { kind: "estimated", costWei };
}

describe("checkInputBalance", () => {
  it("blocks native input while the balance read is unavailable", () => {
    // Loading or failed balance reads both surface as undefined; native
    // submission must stay blocked either way.
    expect(
      checkInputBalance({
        isNativeIn: true,
        balanceInRaw: undefined,
        amountInRaw: FIVE,
        nativeGasEstimate: estimated(GAS_COST),
      }),
    ).toBe("balance-unavailable");

    expect(
      checkInputBalance({
        isNativeIn: true,
        balanceInRaw: undefined,
        amountInRaw: FIVE,
        nativeGasEstimate: undefined,
      }),
    ).toBe("balance-unavailable");

    expect(
      checkInputBalance({
        isNativeIn: true,
        balanceInRaw: undefined,
        amountInRaw: FIVE,
        nativeGasEstimate: { kind: "unavailable", message: "RPC error" },
      }),
    ).toBe("balance-unavailable");
  });

  it("returns ok when there is no quote amount yet", () => {
    expect(
      checkInputBalance({
        isNativeIn: true,
        balanceInRaw: FIVE,
        amountInRaw: undefined,
        nativeGasEstimate: estimated(GAS_COST),
      }),
    ).toBe("ok");

    expect(
      checkInputBalance({
        isNativeIn: true,
        balanceInRaw: undefined,
        amountInRaw: undefined,
        nativeGasEstimate: undefined,
      }),
    ).toBe("ok");
  });

  it("ERC-20: treats a still-loading balance as ok", () => {
    expect(
      checkInputBalance({
        isNativeIn: false,
        balanceInRaw: undefined,
        amountInRaw: FIVE,
        nativeGasEstimate: undefined,
      }),
    ).toBe("ok");
  });

  it("returns ok for zero-amount quotes", () => {
    expect(
      checkInputBalance({
        isNativeIn: true,
        balanceInRaw: 0n,
        amountInRaw: 0n,
        nativeGasEstimate: estimated(GAS_COST),
      }),
    ).toBe("ok");
  });

  it("returns insufficient when native amount exceeds balance", () => {
    expect(
      checkInputBalance({
        isNativeIn: true,
        balanceInRaw: FIVE,
        amountInRaw: FIVE + 1n,
        nativeGasEstimate: estimated(GAS_COST),
      }),
    ).toBe("insufficient");
  });

  it("returns gas-shortfall when amount fits but amount+gas does not", () => {
    // balance = 1 MON, amount = 0.99 MON, gas = 0.02 MON → 0.99+0.02 > 1
    const oneMon = 1_000_000_000_000_000_000n;
    const amount = oneMon - 10_000_000_000_000_000n; // 0.99 MON
    expect(
      checkInputBalance({
        isNativeIn: true,
        balanceInRaw: oneMon,
        amountInRaw: amount,
        nativeGasEstimate: estimated(GAS_COST),
      }),
    ).toBe("gas-shortfall");
  });

  it("returns ok when amount + gas exactly equals balance", () => {
    // balance = 5 MON, amount = 4.98 MON, gas = 0.02 MON
    const amount = FIVE - GAS_COST;
    expect(
      checkInputBalance({
        isNativeIn: true,
        balanceInRaw: FIVE,
        amountInRaw: amount,
        nativeGasEstimate: estimated(GAS_COST),
      }),
    ).toBe("ok");
  });

  it("returns gas-shortfall when native gas estimate is insufficient-funds", () => {
    expect(
      checkInputBalance({
        isNativeIn: true,
        balanceInRaw: FIVE,
        amountInRaw: FIVE - GAS_COST,
        nativeGasEstimate: { kind: "insufficient-funds" },
      }),
    ).toBe("gas-shortfall");
  });

  it("returns estimate-unavailable when native gas estimate failed", () => {
    expect(
      checkInputBalance({
        isNativeIn: true,
        balanceInRaw: FIVE,
        amountInRaw: FIVE - GAS_COST,
        nativeGasEstimate: { kind: "unavailable", message: "RPC error" },
      }),
    ).toBe("estimate-unavailable");
  });

  it("returns estimating when native gas estimate is still loading", () => {
    expect(
      checkInputBalance({
        isNativeIn: true,
        balanceInRaw: FIVE,
        amountInRaw: FIVE - GAS_COST,
        nativeGasEstimate: undefined,
      }),
    ).toBe("estimating");
  });

  it("ERC-20: full balance is ok", () => {
    expect(
      checkInputBalance({
        isNativeIn: false,
        balanceInRaw: FIVE,
        amountInRaw: FIVE,
        nativeGasEstimate: undefined,
      }),
    ).toBe("ok");
  });

  it("ERC-20: over balance is insufficient", () => {
    expect(
      checkInputBalance({
        isNativeIn: false,
        balanceInRaw: FIVE,
        amountInRaw: FIVE + 1n,
        nativeGasEstimate: undefined,
      }),
    ).toBe("insufficient");
  });

  it("ERC-20: ignores gas estimate entirely", () => {
    expect(
      checkInputBalance({
        isNativeIn: false,
        balanceInRaw: FIVE,
        amountInRaw: FIVE,
        nativeGasEstimate: { kind: "insufficient-funds" },
      }),
    ).toBe("ok");
  });
});
