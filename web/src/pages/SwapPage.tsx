import { useMemo, useState, type CSSProperties } from "react";
import { useQuery } from "@tanstack/react-query";
import { formatUnits, isAddress, type Address, type Hash } from "viem";
import { useAccount, useConnect, usePublicClient, useWriteContract } from "wagmi";

import { useChainGuard } from "../hooks/useChainGuard";
import { useCoreTokens } from "../hooks/useCoreTokens";
import { useBestQuote } from "../hooks/useBestQuote";
import { useTokenMeta } from "../hooks/useTokenMeta";
import { contractAbis, contractAddresses } from "../lib/contracts";

function shortAddress(value: string) {
  return `${value.slice(0, 6)}...${value.slice(-4)}`;
}

function amountInputStyle(value: string): CSSProperties {
  const length = Math.min(Math.max(value.trim().length, 1), 48);
  return { "--amount-chars": String(length) } as CSSProperties;
}

const MON_TOKEN = "MON";

export function SwapPage() {
  const { address, isConnected } = useAccount();
  const { connect, connectors } = useConnect();
  const publicClient = usePublicClient();
  const { isCorrectChain } = useChainGuard();
  const { writeContractAsync } = useWriteContract();

  const [tokenIn, setTokenIn] = useState(contractAddresses.testUSDC ?? "");
  const [tokenOut, setTokenOut] = useState(contractAddresses.testUSDT ?? "");
  const [amountIn, setAmountIn] = useState("1");
  const [slippagePercent, setSlippagePercent] = useState("1");
  const [lastAction, setLastAction] = useState<string>("");
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [showDiagnostics, setShowDiagnostics] = useState(false);
  const [pending, setPending] = useState(false);
  const [pendingAction, setPendingAction] = useState<"approve" | "swap" | null>(null);

  const { data: coreTokens = [] } = useCoreTokens();
  const tokenInMeta = useTokenMeta(tokenIn);
  const tokenOutMeta = useTokenMeta(tokenOut);

  const quickTokenAddresses = useMemo(() => {
    const values = [contractAddresses.testUSDC, contractAddresses.testUSDT, ...coreTokens];
    const deduped: Address[] = [];

    for (const value of values) {
      if (!value || value === contractAddresses.wmon || deduped.includes(value)) {
        continue;
      }

      deduped.push(value);
    }

    return deduped.slice(0, 6);
  }, [coreTokens]);

  const fallbackCores = useMemo(
    () =>
      [contractAddresses.testUSDC, contractAddresses.testUSDT, contractAddresses.wmon].filter(
        Boolean
      ) as Address[],
    []
  );

  const routesCores = coreTokens.length > 0 ? coreTokens : fallbackCores;
  const quoteQuery = useBestQuote(tokenIn, tokenOut, amountIn, routesCores);
  const selectableTokens = useMemo(() => {
    const values = [
      MON_TOKEN,
      ...quickTokenAddresses,
      tokenIn || undefined,
      tokenOut || undefined
    ];
    const deduped: string[] = [];

    for (const value of values) {
      if (!value || deduped.includes(value)) {
        continue;
      }

      deduped.push(value);
    }

    return deduped;
  }, [quickTokenAddresses, tokenIn, tokenOut]);

  const allowanceQuery = useQuery({
    queryKey: ["allowance", address, tokenIn, contractAddresses.uniswapV2Router02],
    enabled: Boolean(
      publicClient &&
        address &&
        contractAddresses.uniswapV2Router02 &&
        isAddress(tokenIn) &&
        quoteQuery.data?.amountInRaw !== undefined
    ),
    refetchInterval: 10_000,
    queryFn: async () => {
      if (!publicClient || !address || !contractAddresses.uniswapV2Router02 || !isAddress(tokenIn)) {
        return 0n;
      }

      const allowance = await publicClient.readContract({
        address: tokenIn,
        abi: contractAbis.erc20,
        functionName: "allowance",
        args: [address, contractAddresses.uniswapV2Router02]
      });

      return allowance as bigint;
    }
  });
  const balanceInQuery = useQuery({
    queryKey: ["balance", address, tokenIn],
    enabled: Boolean(publicClient && address && isAddress(tokenIn)),
    queryFn: async () => {
      if (!publicClient || !address || !isAddress(tokenIn)) {
        return 0n;
      }

      const balance = await publicClient.readContract({
        address: tokenIn as Address,
        abi: contractAbis.erc20,
        functionName: "balanceOf",
        args: [address]
      });

      return balance as bigint;
    }
  });
  const balanceOutQuery = useQuery({
    queryKey: ["balance", address, tokenOut],
    enabled: Boolean(publicClient && address && isAddress(tokenOut)),
    queryFn: async () => {
      if (!publicClient || !address || !isAddress(tokenOut)) {
        return 0n;
      }

      const balance = await publicClient.readContract({
        address: tokenOut as Address,
        abi: contractAbis.erc20,
        functionName: "balanceOf",
        args: [address]
      });

      return balance as bigint;
    }
  });
  const monBalanceQuery = useQuery({
    queryKey: ["balance", "native-mon", address],
    enabled: Boolean(publicClient && address),
    refetchInterval: 10_000,
    queryFn: async () => {
      if (!publicClient || !address) {
        return 0n;
      }

      return publicClient.getBalance({ address });
    }
  });

  const needsApproval =
    tokenIn !== MON_TOKEN &&
    Boolean(quoteQuery.data?.best) &&
    (allowanceQuery.data ?? 0n) < (quoteQuery.data?.amountInRaw ?? 0n) &&
    (quoteQuery.data?.amountInRaw ?? 0n) > 0n;

  async function handleApprove() {
    if (!isCorrectChain || !contractAddresses.uniswapV2Router02 || !isAddress(tokenIn) || !publicClient) {
      return;
    }

    setPending(true);
    setPendingAction("approve");
    setLastAction("Approving token...");

    try {
      const hash = await writeContractAsync({
        address: tokenIn,
        abi: contractAbis.erc20,
        functionName: "approve",
        args: [contractAddresses.uniswapV2Router02, 2n ** 256n - 1n]
      });

      setLastAction(`Approval sent: ${hash}`);
      await publicClient.waitForTransactionReceipt({ hash });
      setLastAction(`Approval confirmed: ${hash}`);
      await allowanceQuery.refetch();
    } catch (error) {
      setLastAction(`Approval failed: ${(error as Error).message}`);
    } finally {
      setPending(false);
      setPendingAction(null);
    }
  }

  async function handleSwap() {
    if (!isCorrectChain || !address || !contractAddresses.uniswapV2Router02 || !quoteQuery.data?.best || !publicClient) {
      return;
    }

    setPending(true);
    setPendingAction("swap");
    setLastAction("Submitting swap...");

    try {
      const slippage = Number(slippagePercent);
      const bps = Number.isFinite(slippage) ? Math.floor(slippage * 100) : 100;
      const minOut = quoteQuery.data.best.amountOut - (quoteQuery.data.best.amountOut * BigInt(bps)) / 10_000n;
      const deadline = BigInt(Math.floor(Date.now() / 1000) + 60 * 20);
      const isTokenInMon = tokenIn === MON_TOKEN;
      const isTokenOutMon = tokenOut === MON_TOKEN;

      let hash: Hash;

      if (isTokenInMon && !isTokenOutMon) {
        hash = await writeContractAsync({
          address: contractAddresses.uniswapV2Router02,
          abi: contractAbis.router,
          functionName: "swapExactETHForTokens",
          args: [minOut, quoteQuery.data.best.path, address, deadline],
          value: quoteQuery.data.amountInRaw
        });
      } else if (!isTokenInMon && isTokenOutMon) {
        hash = await writeContractAsync({
          address: contractAddresses.uniswapV2Router02,
          abi: contractAbis.router,
          functionName: "swapExactTokensForETH",
          args: [quoteQuery.data.amountInRaw, minOut, quoteQuery.data.best.path, address, deadline]
        });
      } else {
        hash = await writeContractAsync({
          address: contractAddresses.uniswapV2Router02,
          abi: contractAbis.router,
          functionName: "swapExactTokensForTokens",
          args: [quoteQuery.data.amountInRaw, minOut, quoteQuery.data.best.path, address, deadline]
        });
      }

      setLastAction(`Swap sent: ${hash}`);
      await publicClient.waitForTransactionReceipt({ hash });
      setLastAction(`Swap confirmed: ${hash}`);
      await Promise.all([
        allowanceQuery.refetch(),
        balanceInQuery.refetch(),
        balanceOutQuery.refetch(),
        monBalanceQuery.refetch(),
        quoteQuery.refetch()
      ]);
    } catch (error) {
      setLastAction(`Swap failed: ${(error as Error).message}`);
    } finally {
      setPending(false);
      setPendingAction(null);
    }
  }

  function handleSwapDirection() {
    setTokenIn(tokenOut);
    setTokenOut(tokenIn);
  }

  async function handlePrimaryAction() {
    if (!isConnected) {
      const injectedConnector = connectors[0];

      if (!injectedConnector) {
        setLastAction("No wallet connector found.");
        return;
      }

      connect({ connector: injectedConnector });
      return;
    }

    if (needsApproval) {
      await handleApprove();
      return;
    }

    await handleSwap();
  }

  const symbolByAddress = useMemo(() => {
    const map = new Map<string, string>();

    if (contractAddresses.testUSDC) {
      map.set(contractAddresses.testUSDC.toLowerCase(), "USDC");
    }
    if (contractAddresses.testUSDT) {
      map.set(contractAddresses.testUSDT.toLowerCase(), "USDT");
    }
    if (contractAddresses.wmon) {
      map.set(contractAddresses.wmon.toLowerCase(), "WMON");
    }
    if (tokenInMeta.data) {
      map.set(tokenInMeta.data.address.toLowerCase(), tokenInMeta.data.symbol);
    }
    if (tokenOutMeta.data) {
      map.set(tokenOutMeta.data.address.toLowerCase(), tokenOutMeta.data.symbol);
    }

    return map;
  }, [tokenInMeta.data, tokenOutMeta.data]);

  function getTokenLabel(tokenAddress: string) {
    if (tokenAddress === MON_TOKEN) {
      return "MON";
    }

    if (isAddress(tokenAddress)) {
      return symbolByAddress.get(tokenAddress.toLowerCase()) ?? shortAddress(tokenAddress);
    }

    return tokenAddress;
  }

  const isTokenInMon = tokenIn === MON_TOKEN;
  const isTokenOutMon = tokenOut === MON_TOKEN;
  const tokenInSymbol = isAddress(tokenIn)
    ? symbolByAddress.get(tokenIn.toLowerCase()) ?? shortAddress(tokenIn)
    : isTokenInMon
      ? MON_TOKEN
      : "Select";

  const bestQuoteReadable =
    quoteQuery.data?.best && quoteQuery.data.decimalsOut !== undefined
      ? formatUnits(quoteQuery.data.best.amountOut, quoteQuery.data.decimalsOut)
      : "-";
  const bestQuoteValue = bestQuoteReadable === "-" ? "0" : bestQuoteReadable;

  const amountInRawPreview =
    quoteQuery.data?.amountInRaw !== undefined && quoteQuery.data.decimalsIn !== undefined
      ? formatUnits(quoteQuery.data.amountInRaw, quoteQuery.data.decimalsIn)
      : "-";
  const balanceInRaw = isTokenInMon ? monBalanceQuery.data : balanceInQuery.data;
  const balanceOutRaw = isTokenOutMon ? monBalanceQuery.data : balanceOutQuery.data;
  const balanceInDecimals = isTokenInMon ? 18 : tokenInMeta.data?.decimals;
  const balanceOutDecimals = isTokenOutMon ? 18 : tokenOutMeta.data?.decimals;
  const balanceInReadable =
    balanceInRaw !== undefined && balanceInDecimals !== undefined ? formatUnits(balanceInRaw, balanceInDecimals) : "-";
  const balanceOutReadable =
    balanceOutRaw !== undefined && balanceOutDecimals !== undefined ? formatUnits(balanceOutRaw, balanceOutDecimals) : "-";
  const hasInsufficientBalance =
    isConnected &&
    balanceInRaw !== undefined &&
    quoteQuery.data?.amountInRaw !== undefined &&
    quoteQuery.data.amountInRaw > 0n &&
    balanceInRaw < quoteQuery.data.amountInRaw;

  const primaryButtonLabel = pending
    ? pendingAction === "approve"
      ? `Approving ${tokenInSymbol}...`
      : pendingAction === "swap"
        ? "Swapping..."
        : "Waiting for wallet..."
    : !isConnected
      ? "Connect wallet"
      : hasInsufficientBalance
        ? `Insufficient ${tokenInSymbol} balance`
      : needsApproval
        ? `Approve ${tokenInSymbol}`
        : "Swap";
  const primaryDisabled =
    pending ||
    (!isConnected
      ? connectors.length === 0
      : !isCorrectChain || hasInsufficientBalance || (!needsApproval && !quoteQuery.data?.best));

  const routeReadable =
    quoteQuery.data?.best?.path
      .map((pathAddress, index, path) => {
        if (
          contractAddresses.wmon &&
          pathAddress.toLowerCase() === contractAddresses.wmon.toLowerCase() &&
          ((isTokenInMon && index === 0) || (isTokenOutMon && index === path.length - 1))
        ) {
          return MON_TOKEN;
        }

        return symbolByAddress.get(pathAddress.toLowerCase()) ?? shortAddress(pathAddress);
      })
      .join(" -> ") ?? "No route";

  return (
    <section className="swap-hero swap-compact-layout">
      <div className="swap-compact-card">
        <div className="swap-mode-toggle" aria-label="Swap mode">
          <div className="mode-pill mode-pill-static active">Swap</div>
        </div>

        <div className="swap-panel compact-panel">
          <div className="swap-panel-top compact-panel-top">
            <span className="panel-label">From</span>
            <span className="panel-balance">Balance {balanceInReadable}</span>
          </div>

          <div className="swap-panel-main compact-panel-main">
            <select value={tokenIn} onChange={(event) => setTokenIn(event.target.value)} className="compact-token-select">
              {selectableTokens.map((token) => (
                <option key={token} value={token}>
                  {getTokenLabel(token)}
                </option>
              ))}
            </select>
            <input
              className="compact-amount-input"
              style={amountInputStyle(amountIn)}
              value={amountIn}
              onChange={(event) => setAmountIn(event.target.value)}
              placeholder="0"
            />
          </div>
        </div>

        <button
          type="button"
          className="swap-direction-button compact-direction-button"
          aria-label="Switch sell and buy tokens"
          title="Switch sell and buy tokens"
          onClick={handleSwapDirection}
        >
          <span className="direction-glyph" aria-hidden="true">
            ⇅
          </span>
        </button>

        <div className="swap-panel compact-panel">
          <div className="swap-panel-top compact-panel-top">
            <span className="panel-label">To</span>
            <span className="panel-balance">Balance {balanceOutReadable}</span>
          </div>

          <div className="swap-panel-main compact-panel-main">
            <select
              value={tokenOut}
              onChange={(event) => setTokenOut(event.target.value)}
              className="compact-token-select"
            >
              {selectableTokens.map((token) => (
                <option key={token} value={token}>
                  {getTokenLabel(token)}
                </option>
              ))}
            </select>
            <input className="compact-amount-input" style={amountInputStyle(bestQuoteValue)} value={bestQuoteValue} readOnly />
          </div>
        </div>

        <div className="swap-meta compact-meta">
          <div className="route-preview compact-route-preview">
            <span>Best route</span>
            <strong>{routeReadable}</strong>
          </div>
          <label className="slippage-field compact-slippage-field">
            Slippage (%)
            <input
              value={slippagePercent}
              onChange={(event) => setSlippagePercent(event.target.value)}
              placeholder="1"
              className="slippage-input compact-slippage-input"
            />
          </label>
        </div>

        <button type="button" className="swap-cta compact-cta" disabled={primaryDisabled} onClick={handlePrimaryAction}>
          {primaryButtonLabel}
        </button>

        <div className="swap-debug compact-debug">
          <button type="button" className="swap-link-button" onClick={() => setShowDiagnostics((value) => !value)}>
            {showDiagnostics ? "Hide diagnostics" : "Routing table"}
          </button>
          <button type="button" className="swap-link-button" onClick={() => setShowAdvanced((value) => !value)}>
            {showAdvanced ? "Hide advanced" : "Advanced token input"}
          </button>
        </div>
      </div>

      {showDiagnostics && (
        <section className="swap-diagnostics compact-box">
          <div className="diagnostic-header">
            <span>Path</span>
            <span>Status</span>
            <span>Amount Out</span>
          </div>
          {quoteQuery.data?.quotes.map((quote) => (
            <div key={quote.path.join("-")} className="diagnostic-row">
              <code>{quote.path.join(" -> ")}</code>
              <span className={quote.success ? "diag-ok" : "diag-fail"}>{quote.success ? "LIVE" : "FAIL"}</span>
              <span>{quote.success ? formatUnits(quote.amountOut, quoteQuery.data?.decimalsOut ?? 18) : "-"}</span>
            </div>
          ))}
          <div className="diagnostic-row">
            <code>Input Preview</code>
            <span className="diag-ok">INFO</span>
            <span>{amountInRawPreview}</span>
          </div>
        </section>
      )}

      {showAdvanced && (
        <section className="swap-advanced compact-box">
          <label>
            Sell token address
            <input value={tokenIn} onChange={(event) => setTokenIn(event.target.value)} placeholder="0x..." />
          </label>
          <label>
            Buy token address
            <input value={tokenOut} onChange={(event) => setTokenOut(event.target.value)} placeholder="0x..." />
          </label>
        </section>
      )}

      <div className="quick-token-row compact-quick-row">
        <span>Quick tokens</span>
        <button type="button" className="quick-token" onClick={() => setTokenIn(MON_TOKEN)}>
          Sell MON
        </button>
        <button type="button" className="quick-token" onClick={() => setTokenOut(MON_TOKEN)}>
          Buy MON
        </button>
        {quickTokenAddresses.map((token) => (
          <button key={`sell-${token}`} type="button" className="quick-token" onClick={() => setTokenIn(token)}>
            Sell {getTokenLabel(token)}
          </button>
        ))}
        {quickTokenAddresses.map((token) => (
          <button key={`buy-${token}`} type="button" className="quick-token" onClick={() => setTokenOut(token)}>
            Buy {getTokenLabel(token)}
          </button>
        ))}
      </div>

      {lastAction && (
        <p className="swap-status" title={lastAction}>
          {lastAction}
        </p>
      )}
      {!isCorrectChain && (
        <div className="network-warning">
          Wrong chain selected. Switch wallet to Monad testnet (10143) to approve and swap.
        </div>
      )}
    </section>
  );
}
