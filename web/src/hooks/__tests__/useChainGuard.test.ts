import { describe, expect, it, vi } from "vitest";
import { renderHook } from "@testing-library/react";

import { monadTestnet } from "../../config/chain";

const mockUseAccount = vi.fn();
vi.mock("wagmi", () => ({
  useAccount: () => mockUseAccount(),
}));

import { useChainGuard } from "../useChainGuard";

describe("useChainGuard", () => {
  it("returns isCorrectChain=true when wallet is on Monad testnet", () => {
    mockUseAccount.mockReturnValue({ chain: { id: monadTestnet.id } });

    const { result } = renderHook(() => useChainGuard());

    expect(result.current.isCorrectChain).toBe(true);
    expect(result.current.chainId).toBe(monadTestnet.id);
    expect(result.current.expectedChainId).toBe(monadTestnet.id);
  });

  it("returns isCorrectChain=false when wallet is on Ethereum mainnet", () => {
    mockUseAccount.mockReturnValue({ chain: { id: 1 } });

    const { result } = renderHook(() => useChainGuard());

    expect(result.current.isCorrectChain).toBe(false);
    expect(result.current.chainId).toBe(1);
  });

  it("returns isCorrectChain=false when wallet is on Arbitrum", () => {
    mockUseAccount.mockReturnValue({ chain: { id: 42161 } });

    const { result } = renderHook(() => useChainGuard());

    expect(result.current.isCorrectChain).toBe(false);
  });

  it("returns isCorrectChain=false when wallet is on Monad mainnet (id=143)", () => {
    // Monad mainnet has a different chain ID than testnet
    mockUseAccount.mockReturnValue({ chain: { id: 143 } });

    const { result } = renderHook(() => useChainGuard());

    expect(result.current.isCorrectChain).toBe(false);
  });

  it("returns isCorrectChain=false when wallet has no chain (disconnected)", () => {
    mockUseAccount.mockReturnValue({ chain: undefined });

    const { result } = renderHook(() => useChainGuard());

    expect(result.current.isCorrectChain).toBe(false);
    expect(result.current.chainId).toBeUndefined();
  });

  it("always reports expectedChainId as Monad testnet", () => {
    mockUseAccount.mockReturnValue({ chain: { id: 137 } });

    const { result } = renderHook(() => useChainGuard());

    expect(result.current.expectedChainId).toBe(monadTestnet.id);
    expect(result.current.expectedChainId).toBe(10143);
  });
});
