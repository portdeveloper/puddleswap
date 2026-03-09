import { useChainId } from "wagmi";

import { monadTestnet } from "../config/chain";

export function useChainGuard() {
  const chainId = useChainId();
  const isCorrectChain = chainId === monadTestnet.id;

  return {
    chainId,
    isCorrectChain,
    expectedChainId: monadTestnet.id
  };
}
