/**
 * Gas buffer reserved when the swap input is native MON.
 *
 * swapExactETHForTokens sends `amountInRaw` as msg.value, drawn from the same
 * native balance that pays gas. Spending the entire balance therefore builds a
 * transaction that cannot cover its own gas and fails after signing. ERC-20
 * inputs are unaffected: their transfer value and gas are separate, so their
 * balance check stays a plain amount comparison.
 */
export const NATIVE_GAS_BUFFER_WEI = 10_000_000_000_000_000n; // 0.01 MON

export type InputBalanceCheck = {
  /** True when the required input (amount, plus gas buffer if native) exceeds the balance. */
  insufficient: boolean;
  /**
   * True when the amount alone fits the balance but the native gas buffer
   * does not — i.e. only the MON-for-gas reservation makes the swap fail.
   * Always false for ERC-20 inputs.
   */
  gasReserveShortfall: boolean;
};

/**
 * Insufficient-balance check for the swap input, pure on raw bigint values.
 *
 * Native MON input must keep NATIVE_GAS_BUFFER_WEI aside for gas; ERC-20 input
 * only needs the amount itself. Unknown balances (still loading) report
 * sufficient, mirroring the previous inline check so the button stays enabled
 * until real data arrives.
 */
export function checkInputBalance(params: {
  isNativeIn: boolean;
  balanceInRaw: bigint | undefined;
  amountInRaw: bigint | undefined;
}): InputBalanceCheck {
  const { isNativeIn, balanceInRaw, amountInRaw } = params;

  if (balanceInRaw === undefined || amountInRaw === undefined) {
    return { insufficient: false, gasReserveShortfall: false };
  }

  if (amountInRaw <= 0n) {
    return { insufficient: false, gasReserveShortfall: false };
  }

  const required = isNativeIn
    ? amountInRaw + NATIVE_GAS_BUFFER_WEI
    : amountInRaw;

  if (balanceInRaw >= required) {
    return { insufficient: false, gasReserveShortfall: false };
  }

  return {
    insufficient: true,
    gasReserveShortfall: isNativeIn && balanceInRaw >= amountInRaw,
  };
}
