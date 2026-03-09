import { isAddress, type Address } from "viem";

export function asAddress(value: string): Address | undefined {
  return isAddress(value) ? value : undefined;
}
