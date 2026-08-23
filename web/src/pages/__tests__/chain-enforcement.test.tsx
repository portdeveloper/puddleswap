import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";

import { monadTestnet } from "../../config/chain";
import { contractAddresses } from "../../lib/contracts";

// --- Mock wagmi hooks ---
const mockWriteContractAsync = vi.fn();
const mockSwitchChain = vi.fn();
const mockConnect = vi.fn();

const wagmiState = {
  address: "0x1234567890abcdef1234567890abcdef12345678" as const,
  isConnected: true,
  chain: { id: monadTestnet.id } as { id: number } | undefined,
  connectors: [{ id: "injected", name: "MetaMask" }],
};

vi.mock("wagmi", () => ({
  useAccount: () => ({
    address: wagmiState.address,
    isConnected: wagmiState.isConnected,
    chain: wagmiState.chain,
  }),
  useConnect: () => ({
    connect: mockConnect,
    connectors: wagmiState.connectors,
  }),
  useDisconnect: () => ({ disconnect: vi.fn() }),
  usePublicClient: () => null,
  useWriteContract: () => ({ writeContractAsync: mockWriteContractAsync }),
  useSwitchChain: () => ({ switchChain: mockSwitchChain }),
  useChainId: () => wagmiState.chain?.id ?? monadTestnet.id,
}));

// --- Mock react-query ---
vi.mock("@tanstack/react-query", () => ({
  useQuery: () => ({ data: undefined, refetch: vi.fn() }),
  useQueryClient: () => ({}),
}));

// --- Mock custom hooks ---
vi.mock("../../hooks/useCoreTokens", () => ({
  useCoreTokens: () => ({ data: [] }),
}));
vi.mock("../../hooks/useBestQuote", () => ({
  useBestQuote: () => ({ data: undefined, refetch: vi.fn() }),
}));
vi.mock("../../hooks/useTokenMeta", () => ({
  useTokenMeta: () => ({ data: undefined }),
}));

// --- Mock react-router-dom ---
const routerState = {
  searchParams: new URLSearchParams(),
};
const mockSetSearchParams = vi.fn(
  (
    ...args: [
      URLSearchParams | ((prev: URLSearchParams) => URLSearchParams),
      { replace?: boolean }?,
    ]
  ) => {
    const [next] = args;
    routerState.searchParams =
      typeof next === "function" ? next(routerState.searchParams) : next;
  },
);

vi.mock("react-router-dom", () => ({
  Link: ({ children, to }: { children: React.ReactNode; to: string }) =>
    React.createElement("a", { href: to }, children),
  useParams: () => ({ pairAddress: "0x0000000000000000000000000000000000000001" }),
  useSearchParams: () =>
    [routerState.searchParams, mockSetSearchParams] as const,
}));

// --- Mock TokenPicker ---
vi.mock("../../components/TokenPicker", () => ({
  TokenPicker: () => null,
}));

import { SwapPage } from "../SwapPage";
import { CreatePoolPage } from "../CreatePoolPage";
import { PoolDetailsPage } from "../PoolDetailsPage";

beforeEach(() => {
  vi.clearAllMocks();
  wagmiState.isConnected = true;
  wagmiState.chain = { id: monadTestnet.id };
  routerState.searchParams = new URLSearchParams();
});

// ============================================================
// SwapPage chain enforcement
// ============================================================
describe("SwapPage chain enforcement", () => {
  it("shows 'Swap' CTA button when on Monad testnet", () => {
    wagmiState.chain = { id: monadTestnet.id };
    const { container } = render(React.createElement(SwapPage));

    const btn = container.querySelector("button.btn-main");
    expect(btn).toBeInTheDocument();
    expect(btn!.textContent).toBe("Swap");
  });

  it("shows 'Switch to Monad Testnet' when on Ethereum mainnet", () => {
    wagmiState.chain = { id: 1 };
    render(React.createElement(SwapPage));

    expect(screen.getByText("Switch to Monad Testnet")).toBeInTheDocument();
  });

  it("shows 'Switch to Monad Testnet' when on Arbitrum", () => {
    wagmiState.chain = { id: 42161 };
    render(React.createElement(SwapPage));

    expect(screen.getByText("Switch to Monad Testnet")).toBeInTheDocument();
  });

  it("shows 'Switch to Monad Testnet' when on Monad mainnet (id=143)", () => {
    wagmiState.chain = { id: 143 };
    render(React.createElement(SwapPage));

    expect(screen.getByText("Switch to Monad Testnet")).toBeInTheDocument();
  });

  it("the switch-network button is NOT disabled (user can click it)", () => {
    wagmiState.chain = { id: 1 };
    render(React.createElement(SwapPage));

    const btn = screen.getByText("Switch to Monad Testnet");
    expect(btn).not.toBeDisabled();
  });

  it("clicking 'Switch to Monad Testnet' calls switchChain with testnet chainId", async () => {
    wagmiState.chain = { id: 1 };
    render(React.createElement(SwapPage));

    const btn = screen.getByText("Switch to Monad Testnet");
    await userEvent.click(btn);

    expect(mockSwitchChain).toHaveBeenCalledWith({ chainId: monadTestnet.id });
  });

  it("does NOT call writeContractAsync when on wrong chain", async () => {
    wagmiState.chain = { id: 1 };
    render(React.createElement(SwapPage));

    const btn = screen.getByText("Switch to Monad Testnet");
    await userEvent.click(btn);

    expect(mockWriteContractAsync).not.toHaveBeenCalled();
  });

  it("shows 'Connect Wallet' when disconnected", () => {
    wagmiState.isConnected = false;
    wagmiState.chain = undefined;
    render(React.createElement(SwapPage));

    expect(screen.getByText("Connect Wallet")).toBeInTheDocument();
  });
});

// ============================================================
// SwapPage URL query params (added alongside #18)
// ============================================================
describe("SwapPage URL query params", () => {
  it("preselects tokens from valid ?in= and ?out= query params", () => {
    routerState.searchParams = new URLSearchParams({
      in: contractAddresses.usdc!,
      out: "MON",
    });
    render(React.createElement(SwapPage));

    const [tokenInSelect, tokenOutSelect] = screen.getAllByRole("combobox");
    expect(tokenInSelect).toHaveValue(contractAddresses.usdc);
    expect(tokenOutSelect).toHaveValue("MON");
  });

  it("falls back to MON and testUSDT when query params are missing or invalid", () => {
    routerState.searchParams = new URLSearchParams({
      in: "not-an-address",
      // out intentionally omitted
    });
    render(React.createElement(SwapPage));

    const [tokenInSelect, tokenOutSelect] = screen.getAllByRole("combobox");
    expect(tokenInSelect).toHaveValue("MON");
    expect(tokenOutSelect).toHaveValue(contractAddresses.testUSDT);
  });

  it("picking a token updates the URL with replace semantics", async () => {
    const user = userEvent.setup();
    render(React.createElement(SwapPage));

    const [, tokenOutSelect] = screen.getAllByRole("combobox");
    await user.selectOptions(tokenOutSelect, contractAddresses.usdc!);

    expect(mockSetSearchParams).toHaveBeenCalledTimes(1);
    expect(mockSetSearchParams.mock.calls[0][1]).toEqual({ replace: true });
    expect(routerState.searchParams.get("out")).toBe(contractAddresses.usdc);
  });

  it("switching direction swaps both tokens in the URL with replace semantics", async () => {
    const user = userEvent.setup();
    routerState.searchParams = new URLSearchParams({
      in: contractAddresses.usdc!,
      out: "MON",
    });
    render(React.createElement(SwapPage));

    await user.click(screen.getByLabelText("Switch tokens"));

    const [tokenInSelect, tokenOutSelect] = screen.getAllByRole("combobox");
    expect(tokenInSelect).toHaveValue("MON");
    expect(tokenOutSelect).toHaveValue(contractAddresses.usdc);
    expect(mockSetSearchParams).toHaveBeenCalledTimes(1);
    expect(mockSetSearchParams.mock.calls[0][1]).toEqual({ replace: true });
    expect(routerState.searchParams.get("in")).toBe("MON");
    expect(routerState.searchParams.get("out")).toBe(contractAddresses.usdc);
  });
});

// ============================================================
// CreatePoolPage chain enforcement
// ============================================================
describe("CreatePoolPage chain enforcement", () => {
  it("disables all buttons when on wrong chain", () => {
    wagmiState.chain = { id: 1 };
    render(React.createElement(CreatePoolPage));

    const approveA = screen.getByRole("button", { name: /approve token a/i });
    const approveB = screen.getByRole("button", { name: /approve token b/i });
    const createBtn = screen.getByRole("button", { name: /create.*liquidity/i });

    expect(approveA).toBeDisabled();
    expect(approveB).toBeDisabled();
    expect(createBtn).toBeDisabled();
  });

  it("disables buttons when on Monad mainnet (not testnet)", () => {
    wagmiState.chain = { id: 143 };
    render(React.createElement(CreatePoolPage));

    const approveA = screen.getByRole("button", { name: /approve token a/i });
    expect(approveA).toBeDisabled();
  });

  it("does not call writeContractAsync for approve on wrong chain", async () => {
    wagmiState.chain = { id: 1 };
    render(React.createElement(CreatePoolPage));

    const approveA = screen.getByRole("button", { name: /approve token a/i });
    // Button is disabled so click won't fire, but let's verify
    await userEvent.click(approveA).catch(() => {});

    expect(mockWriteContractAsync).not.toHaveBeenCalled();
  });
});

// ============================================================
// PoolDetailsPage chain enforcement
// ============================================================
describe("PoolDetailsPage chain enforcement", () => {
  it("disables Add Liquidity button when on wrong chain", () => {
    wagmiState.chain = { id: 1 };
    render(React.createElement(PoolDetailsPage));

    const addBtn = screen.getByRole("button", { name: /add liquidity/i });
    expect(addBtn).toBeDisabled();
  });

  it("disables Remove Liquidity button when on wrong chain", () => {
    wagmiState.chain = { id: 1 };
    render(React.createElement(PoolDetailsPage));

    const removeBtn = screen.getByRole("button", { name: /remove liquidity/i });
    expect(removeBtn).toBeDisabled();
  });

  it("disables Approve LP button when on wrong chain", () => {
    wagmiState.chain = { id: 1 };
    render(React.createElement(PoolDetailsPage));

    const approveBtn = screen.getByRole("button", { name: /approve lp/i });
    expect(approveBtn).toBeDisabled();
  });

  it("disables all buttons when on Polygon instead of Monad testnet", () => {
    wagmiState.chain = { id: 137 };
    render(React.createElement(PoolDetailsPage));

    const buttons = screen.getAllByRole("button");
    for (const btn of buttons) {
      expect(btn).toBeDisabled();
    }
  });
});

// ============================================================
// Cross-cutting: no chain other than 10143 should allow transactions
// ============================================================
describe("no transactions allowed on non-testnet chains", () => {
  const wrongChainIds = [
    { id: 1, name: "Ethereum Mainnet" },
    { id: 143, name: "Monad Mainnet" },
    { id: 137, name: "Polygon" },
    { id: 42161, name: "Arbitrum One" },
    { id: 10, name: "Optimism" },
    { id: 56, name: "BSC" },
    { id: 8453, name: "Base" },
    { id: 43114, name: "Avalanche" },
  ];

  for (const chain of wrongChainIds) {
    it(`SwapPage blocks swaps on ${chain.name} (${chain.id})`, () => {
      wagmiState.chain = { id: chain.id };
      render(React.createElement(SwapPage));

      expect(screen.getByText("Switch to Monad Testnet")).toBeInTheDocument();
    });
  }

  for (const chain of wrongChainIds) {
    it(`CreatePoolPage disables actions on ${chain.name} (${chain.id})`, () => {
      wagmiState.chain = { id: chain.id };
      render(React.createElement(CreatePoolPage));

      const createBtn = screen.getByRole("button", { name: /create.*liquidity/i });
      expect(createBtn).toBeDisabled();
    });
  }

  for (const chain of wrongChainIds) {
    it(`PoolDetailsPage disables actions on ${chain.name} (${chain.id})`, () => {
      wagmiState.chain = { id: chain.id };
      render(React.createElement(PoolDetailsPage));

      const addBtn = screen.getByRole("button", { name: /add liquidity/i });
      expect(addBtn).toBeDisabled();
    });
  }
});
