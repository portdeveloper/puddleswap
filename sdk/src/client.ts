import { createPublicClient, http, type PublicClient } from "viem";
import { monadTestnet } from "viem/chains";

/**
 * A viem public client preconfigured for Monad testnet. Scripts need only
 * this and optionally their own RPC URL; the chain default is used otherwise.
 */
export function createPuddleClient(rpcUrl?: string): PublicClient {
  return createPublicClient({
    chain: monadTestnet,
    transport: http(rpcUrl)
  });
}
