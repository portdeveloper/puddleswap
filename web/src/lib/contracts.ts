import type { Address } from "viem";
import { isAddress } from "viem";

import { abis, deployment } from "../config/generated";
import { erc20Abi, factoryAbi, pairAbi, registryAbi, routerAbi, wmonAbi } from "../abi/minimal";

function asAddress(value: string | undefined): Address | undefined {
  if (!value) {
    return undefined;
  }

  return isAddress(value) ? value : undefined;
}

export const contractAddresses = {
  safe: asAddress(deployment.contracts.safe),
  wmon: asAddress(deployment.contracts.wmon),
  testUSDC: asAddress(deployment.contracts.testUSDC),
  testUSDT: asAddress(deployment.contracts.testUSDT),
  stableFaucet: asAddress(deployment.contracts.stableFaucet),
  uniswapV2Factory: asAddress(deployment.contracts.uniswapV2Factory),
  uniswapV2Router02: asAddress(deployment.contracts.uniswapV2Router02),
  openRegistrationGate: asAddress(deployment.contracts.openRegistrationGate),
  tokenRegistry: asAddress(deployment.contracts.tokenRegistry),
  registrationPass: asAddress(deployment.contracts.registrationPass),
  passRegistrationGate: asAddress(deployment.contracts.passRegistrationGate)
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
  wmon: fallbackAbi(abis.wmon, wmonAbi)
} as const;

export const multicall3Address = "0xca11bde05977b3631167028862be2a173976ca11" as Address;
