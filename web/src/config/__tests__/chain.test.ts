import { describe, expect, it } from "vitest";

import { monadTestnet } from "../chain";

describe("chain config", () => {
  it("uses Monad testnet chain ID 10143", () => {
    expect(monadTestnet.id).toBe(10143);
  });

  it("has correct native currency", () => {
    expect(monadTestnet.nativeCurrency.symbol).toBe("MON");
    expect(monadTestnet.nativeCurrency.decimals).toBe(18);
  });

  it("has RPC URL configured", () => {
    expect(monadTestnet.rpcUrls.default.http.length).toBeGreaterThan(0);
    expect(monadTestnet.rpcUrls.default.http[0]).toContain("monad");
  });

  it("is NOT Monad mainnet", () => {
    // Monad mainnet ID is 143 — we must be on testnet
    expect(monadTestnet.id).not.toBe(143);
  });
});

describe("wagmi config", () => {
  it("only allows Monad testnet as a chain", async () => {
    const { wagmiConfig } = await import("../wagmi");
    const chainIds = wagmiConfig.chains.map((c) => c.id);

    expect(chainIds).toEqual([monadTestnet.id]);
    expect(chainIds).toHaveLength(1);
  });

  it("does not include Ethereum mainnet", async () => {
    const { wagmiConfig } = await import("../wagmi");
    const chainIds = wagmiConfig.chains.map((c) => c.id);

    expect(chainIds).not.toContain(1);
  });

  it("does not include Monad mainnet", async () => {
    const { wagmiConfig } = await import("../wagmi");
    const chainIds = wagmiConfig.chains.map((c) => c.id);

    expect(chainIds).not.toContain(143);
  });

  it("exports CHAIN_ID matching Monad testnet", async () => {
    const { CHAIN_ID } = await import("../wagmi");
    expect(CHAIN_ID).toBe(monadTestnet.id);
    expect(CHAIN_ID).toBe(10143);
  });

  it("configures transport only for Monad testnet", async () => {
    const { wagmiConfig } = await import("../wagmi");
    // Transport keys should only have our chain
    const transportChainIds = Object.keys(wagmiConfig._internal.transports).map(Number);
    expect(transportChainIds).toEqual([monadTestnet.id]);
  });
});
