import type { Address } from "viem";

export type TokenView = {
  token: Address;
  symbol: string;
  name: string;
  decimals: number;
  level: number;
  imageURI: string;
  isCore: boolean;
  active: boolean;
};
