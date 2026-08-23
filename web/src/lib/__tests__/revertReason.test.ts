import { describe, expect, it } from "vitest";
import {
  BaseError,
  ContractFunctionRevertedError,
  UserRejectedRequestError,
} from "viem";
import { decodeTxError } from "../revertReason";

/** Wrap a revert string the way viem surfaces it from a node response. */
function revertError(reason: string) {
  return new BaseError("Execution reverted for an unknown reason.", {
    cause: new ContractFunctionRevertedError({
      abi: [],
      functionName: "swapExactTokensForTokens",
      message: reason,
    }),
  });
}

describe("decodeTxError", () => {
  it("maps INSUFFICIENT_OUTPUT_AMOUNT to a slippage suggestion", () => {
    const decoded = decodeTxError(
      revertError("execution reverted: UniswapV2Router: INSUFFICIENT_OUTPUT_AMOUNT"),
    );
    expect(decoded.kind).toBe("slippage");
    expect(decoded.message).toMatch(/slippage/i);
    expect(decoded.reason).toBe("INSUFFICIENT_OUTPUT_AMOUNT");
  });

  it("maps EXPIRED to a retry message", () => {
    const decoded = decodeTxError(
      revertError("execution reverted: UniswapV2Router: EXPIRED"),
    );
    expect(decoded.kind).toBe("expired");
    expect(decoded.message).toMatch(/deadline|try again/i);
    expect(decoded.reason).toBe("EXPIRED");
  });

  it("maps TRANSFER_FROM_FAILED to an approval message", () => {
    const decoded = decodeTxError(
      revertError("execution reverted: TransferHelper: TRANSFER_FROM_FAILED"),
    );
    expect(decoded.kind).toBe("allowance");
    expect(decoded.message).toMatch(/approve/i);
    expect(decoded.reason).toBe("TRANSFER_FROM_FAILED");
  });

  it("maps an allowance revert phrased the OpenZeppelin way to the same advice", () => {
    const decoded = decodeTxError(
      revertError("execution reverted: ERC20: transfer amount exceeds allowance"),
    );
    expect(decoded.kind).toBe("allowance");
  });

  it("detects wallet rejection by type, not by message text", () => {
    const rejection = new BaseError("request failed", {
      cause: new UserRejectedRequestError(new Error("User denied signature")),
    });
    const decoded = decodeTxError(rejection);
    expect(decoded.kind).toBe("rejected");
    expect(decoded.reason).toBe("rejected");
  });

  it("does NOT treat a revert merely mentioning 'User rejected' as a rejection", () => {
    const decoded = decodeTxError(
      revertError("execution reverted: User rejected tokens are not supported"),
    );
    expect(decoded.kind).not.toBe("rejected");
  });

  it("surfaces the raw reason for an unmapped revert instead of a generic apology", () => {
    const decoded = decodeTxError(revertError("execution reverted: UniswapV2: K"));
    expect(decoded.kind).toBe("reverted");
    expect(decoded.message).toBe("Transaction reverted: UniswapV2: K");
    expect(decoded.reason).toBe("UniswapV2: K");
  });

  it("never shows the double 'reverted: execution reverted' prefix", () => {
    const decoded = decodeTxError(revertError("execution reverted: UniswapV2: K"));
    expect(decoded.message).not.toMatch(/execution reverted/i);
  });

  it("mentions balance in the transfer-failed advice", () => {
    const decoded = decodeTxError(
      revertError("execution reverted: TransferHelper: TRANSFER_FROM_FAILED"),
    );
    expect(decoded.message).toMatch(/balance/i);
    expect(decoded.message).toMatch(/approve/i);
  });

  it("reads revert text from details when no reverted-error node exists", () => {
    const decoded = decodeTxError(
      new BaseError("Execution reverted", {
        details: "execution reverted: UniswapV2Router: EXPIRED",
      }),
    );
    expect(decoded.kind).toBe("expired");
  });

  it("falls back to unknown for a plain error", () => {
    const decoded = decodeTxError(new Error("network down"));
    expect(decoded.kind).toBe("unknown");
    expect(decoded.reason).toBe("unknown");
  });

  it("tolerates non-Error throwables", () => {
    expect(decodeTxError("boom").kind).toBe("unknown");
    expect(decodeTxError(undefined).kind).toBe("unknown");
  });
});
