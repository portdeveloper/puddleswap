import type { Address } from "viem";
import { isAddress } from "viem";
import {
  erc20Abi,
  factoryAbi,
  MULTICALL3_ADDRESS,
  pairAbi,
  registryAbi,
  routerAbi,
  stakingRewardsAbi
} from "@puddleswap/sdk";

import { abis, deployment } from "../config/generated";

function asAddress(value: string | undefined): Address | undefined {
  if (!value) {
    return undefined;
  }

  return isAddress(value) ? value : undefined;
}

export const contractAddresses = {
  wmon: asAddress(deployment.contracts.wmon),
  usdc: asAddress(deployment.contracts.usdc),
  testUSDT: asAddress(deployment.contracts.testUSDT),
  uniswapV2Factory: asAddress(deployment.contracts.uniswapV2Factory),
  uniswapV2Router02: asAddress(deployment.contracts.uniswapV2Router02),
  tokenRegistry: asAddress(deployment.contracts.tokenRegistry),
  stakingRewardsWmonUsdc: asAddress(deployment.contracts.stakingRewardsWmonUsdc)
} as const;

function fallbackAbi<T extends readonly unknown[]>(generated: readonly unknown[], fallback: T): T {
  return (generated.length > 0 ? generated : fallback) as T;
}

export const contractAbis = {
  erc20: erc20Abi,
  router: fallbackAbi(abis.uniswapV2Router02, routerAbi),
  factory: fallbackAbi(abis.uniswapV2Factory, factoryAbi),
  pair: pairAbi,
  registry: fallbackAbi(abis.tokenRegistry, registryAbi),
  stakingRewards: fallbackAbi(abis.stakingRewardsWmonUsdc, stakingRewardsAbi)
} as const;

export const multicall3Address = MULTICALL3_ADDRESS;
