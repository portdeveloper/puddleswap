export type NativeGasEstimate =
  | { kind: "estimated"; costWei: bigint }
  | { kind: "insufficient-funds" }
  | { kind: "unavailable"; message: string };

export type InputBalanceStatus =
  | "ok"
  | "insufficient"
  | "gas-shortfall"
  | "estimating"
  | "estimate-unavailable";

/**
 * Insufficient-balance check for the swap input, pure on raw bigint values.
 *
 * Native MON input pays gas from the same balance that funds the swap value
 * (swapExactETHForTokens sends the amount as msg.value), so the balance must
 * cover amount + the transaction's estimated gas cost. ERC-20 input only
 * needs the amount itself: its transfer value and gas are separate. Unknown
 * balances (still loading) report ok so the button stays enabled until real
 * data arrives.
 *
 * `nativeGasEstimate` carries the live estimate from the chain.  While it is
 * undefined the native swap is blocked with "estimating" because we cannot
 * prove the balance would cover gas.  An explicit "insufficient-funds" or
 * "unavailable" result is surfaced as a blocking status with a user-facing
 * reason.
 */
export function checkInputBalance(params: {
  isNativeIn: boolean;
  balanceInRaw: bigint | undefined;
  amountInRaw: bigint | undefined;
  nativeGasEstimate: NativeGasEstimate | undefined;
}): InputBalanceStatus {
  const { isNativeIn, balanceInRaw, amountInRaw, nativeGasEstimate } = params;

  if (balanceInRaw === undefined || amountInRaw === undefined) {
    return "ok";
  }

  if (amountInRaw <= 0n) {
    return "ok";
  }

  if (!isNativeIn) {
    return balanceInRaw >= amountInRaw ? "ok" : "insufficient";
  }

  // Native input: gas estimate is required before we can approve the swap.

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
