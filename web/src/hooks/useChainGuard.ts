import { useAccount } from "wagmi";

import { monadTestnet } from "../config/chain";

export function useChainGuard() {
  const { chain } = useAccount();
  const isCorrectChain = chain?.id === monadTestnet.id;

  return {
    chainId: chain?.id,
    isCorrectChain,
    expectedChainId: monadTestnet.id
  };
}
