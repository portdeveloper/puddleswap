import {
  BaseError,
  ContractFunctionRevertedError,
  UserRejectedRequestError,
} from "viem";

export type DecodedTxErrorKind =
  | "rejected"
  | "slippage"
  | "expired"
  | "allowance"
  | "reverted"
  | "unknown";

export type DecodedTxError = {
  kind: DecodedTxErrorKind;
  /** User-facing message: says what happened and what to do about it. */
  message: string;
  /** Stable analytics label: the kind, or the raw revert string when we have one. */
  reason: string;
};

/**
 * Extract the most specific revert text available from a viem error chain.
 * ContractFunctionRevertedError carries the require() string when the node
 * returned one; `details` and `shortMessage` are progressively vaguer.
 */
const REVERT_PREFIX = /^execution reverted:?\s*/i;

function revertText(error: unknown): string {
  if (error instanceof BaseError) {
    const reverted = error.walk(
      (e) => e instanceof ContractFunctionRevertedError,
    );
    if (reverted instanceof ContractFunctionRevertedError && reverted.reason) {
      return reverted.reason.replace(REVERT_PREFIX, "");
    }
    return error.details || error.shortMessage || error.message;
  }
  return error instanceof Error ? error.message : String(error);
}

/**
 * Decode a swap/approve failure into something a user can act on.
 *
 * Pure function of the thrown error: no state, no I/O, so the pool and farm
 * pages can reuse it as-is. Unknown reverts surface the raw reason string
 * instead of a generic apology, because "UniswapV2: K" in the UI is more
 * debuggable than "Swap failed" for both the user and us.
 */
export function decodeTxError(error: unknown): DecodedTxError {
  if (
    error instanceof BaseError &&
    error.walk((e) => e instanceof UserRejectedRequestError)
  ) {
    return {
      kind: "rejected",
      message: "Transaction rejected by wallet.",
      reason: "rejected",
    };
  }

  const text = revertText(error);

  if (text.includes("INSUFFICIENT_OUTPUT_AMOUNT")) {
    return {
      kind: "slippage",
      message:
        "Price moved beyond your slippage tolerance. Try a higher slippage setting or a smaller amount.",
      reason: "INSUFFICIENT_OUTPUT_AMOUNT",
    };
  }

  if (text.includes("EXPIRED")) {
    return {
      kind: "expired",
      message:
        "The swap deadline passed before the transaction was mined. Try again.",
      reason: "EXPIRED",
    };
  }

  if (
    text.includes("TRANSFER_FROM_FAILED") ||
    text.toLowerCase().includes("insufficient allowance") ||
    text.includes("exceeds allowance")
  ) {
    return {
      kind: "allowance",
      message:
        "The token transfer failed. Approve the token again and retry; if it keeps failing, check your token balance.",
      reason: "TRANSFER_FROM_FAILED",
    };
  }

  // A revert we do not have a friendlier story for: show the reason itself.
  if (error instanceof BaseError) {
    const reverted = error.walk(
      (e) => e instanceof ContractFunctionRevertedError,
    );
    if (reverted instanceof ContractFunctionRevertedError) {
      const reason =
        reverted.reason?.replace(REVERT_PREFIX, "") ?? "execution reverted";
      return {
        kind: "reverted",
        message: `Transaction reverted: ${reason}`,
        reason,
      };
    }
  }

  return {
    kind: "unknown",
    message: "Swap failed. Check your balance and try again.",
    reason: "unknown",
  };
}
