import type { Address } from "viem";
import { isAddress } from "viem";

import { abis, deployment } from "../config/generated";
import {
  erc20Abi,
  factoryAbi,
  pairAbi,
  registryAbi,
  routerAbi,
  stakingRewardsAbi
} from "../abi/minimal";

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

export const multicall3Address = "0xca11bde05977b3631167028862be2a173976ca11" as Address;
