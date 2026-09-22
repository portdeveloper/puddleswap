export type NativeGasEstimate =
  | { kind: "estimated"; costWei: bigint }
  | { kind: "insufficient-funds" }
  | { kind: "unavailable"; message: string };

export type InputBalanceStatus =
  | "ok"
  | "insufficient"
  | "gas-shortfall"
  | "estimating"
  | "estimate-unavailable"
  | "balance-unavailable";

/**
 * Insufficient-balance check for the swap input, pure on raw bigint values.
 *
 * Native MON input pays gas from the same balance that funds the swap value
 * (swapExactETHForTokens sends the amount as msg.value), so the balance must
 * cover amount + the transaction's estimated gas cost. ERC-20 input only
 * needs the amount itself: its transfer value and gas are separate.
 *
 * Native input is blocked until every read it depends on is available:
 * a still-loading or failed balance read reports "balance-unavailable", an
 * undefined gas estimate reports "estimating", and an explicit
 * "insufficient-funds" or "unavailable" estimate is surfaced as a blocking
 * status with a user-facing reason. ERC-20 keeps the permissive behaviour of
 * treating a loading balance as "ok" until real data arrives.
 *
 * When there is no amount yet (no quote, or a zero-amount preview) the check
 * reports "ok": the page independently refuses to submit without a quote.
 */
export function checkInputBalance(params: {
  isNativeIn: boolean;
  balanceInRaw: bigint | undefined;
  amountInRaw: bigint | undefined;
  nativeGasEstimate: NativeGasEstimate | undefined;
}): InputBalanceStatus {
  const { isNativeIn, balanceInRaw, amountInRaw, nativeGasEstimate } = params;

  if (amountInRaw === undefined || amountInRaw <= 0n) {
    return "ok";
  }

  if (!isNativeIn) {
    if (balanceInRaw === undefined) {
      return "ok";
    }
    return balanceInRaw >= amountInRaw ? "ok" : "insufficient";
  }

  // Native input: both the balance and a usable gas estimate are required
  // before we can approve the swap.

  if (balanceInRaw === undefined) {
    return "balance-unavailable";
  }

  if (nativeGasEstimate === undefined) {
    return "estimating";
  }

  if (nativeGasEstimate.kind === "insufficient-funds") {
    return "gas-shortfall";
  }

  if (nativeGasEstimate.kind === "unavailable") {
    return "estimate-unavailable";
  }

  const { costWei } = nativeGasEstimate;

  if (balanceInRaw < amountInRaw + costWei) {
    // Balance covers the amount but not amount+gas — gas shortfall.
    if (balanceInRaw >= amountInRaw) {
      return "gas-shortfall";
    }
    return "insufficient";
  }

  return "ok";
}
