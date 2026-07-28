import type { Address } from "viem";

import deployment from "../../config/addresses/10143.json";

export const MONAD_TESTNET_CHAIN_ID = deployment.chainId;

/**
 * Deployed contract addresses on Monad testnet, sourced directly from
 * config/addresses/10143.json so the SDK and the deploy scripts cannot drift.
 */
export const monadTestnetAddresses = deployment.contracts as {
  [K in keyof typeof deployment.contracts]: Address;
};

export const MULTICALL3_ADDRESS = "0xca11bde05977b3631167028862be2a173976ca11" as Address;
