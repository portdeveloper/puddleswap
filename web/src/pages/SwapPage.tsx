import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Helmet } from "react-helmet-async";
import { formatUnits, isAddress, type Address, type Hash } from "viem";
import {
  useAccount,
  useConnect,
  usePublicClient,
  useSwitchChain,
  useWriteContract,
} from "wagmi";
import { monadTestnet } from "../config/chain";

import { TokenIcon } from "../components/TokenIcon";
import { TxStatus } from "../components/TxStatus";
import { useChainGuard } from "../hooks/useChainGuard";
import { useCoreTokens } from "../hooks/useCoreTokens";
import { useBestQuote } from "../hooks/useBestQuote";
import { useTokenMeta } from "../hooks/useTokenMeta";
import { contractAbis, contractAddresses } from "../lib/contracts";

function shortAddress(value: string) {
  return `${value.slice(0, 6)}…${value.slice(-4)}`;
}

const MON_TOKEN = "MON";

export function SwapPage() {
  const { address, isConnected } = useAccount();
  const { connect, connectors } = useConnect();
  const publicClient = usePublicClient({ chainId: monadTestnet.id });
  const { isCorrectChain } = useChainGuard();
  const { switchChain } = useSwitchChain();
  const { writeContractAsync } = useWriteContract();

  const [tokenIn, setTokenIn] = useState(contractAddresses.usdc ?? "");
  const [tokenOut, setTokenOut] = useState(contractAddresses.testUSDT ?? "");
  const [amountIn, setAmountIn] = useState("1");
  const [slippagePercent, setSlippagePercent] = useState("1");
  const [lastAction, setLastAction] = useState<string>("");
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [showDiagnostics, setShowDiagnostics] = useState(false);
  const [pending, setPending] = useState(false);
  const [pendingAction, setPendingAction] = useState<"approve" | "swap" | null>(
    null,
  );
  const [showSettings, setShowSettings] = useState(false);
  const mascotRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onScroll() {
      if (!mascotRef.current) return;
      const fadeStart = 300;
      const fadeEnd = 600;
      const y = window.scrollY;
      const opacity =
        y <= fadeStart
          ? 1
          : y >= fadeEnd
            ? 0
            : 1 - (y - fadeStart) / (fadeEnd - fadeStart);
      mascotRef.current.style.opacity = String(opacity);
      mascotRef.current.style.pointerEvents = opacity === 0 ? "none" : "";
    }
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const { data: coreTokens = [] } = useCoreTokens();
  const tokenInMeta = useTokenMeta(tokenIn);
  const tokenOutMeta = useTokenMeta(tokenOut);

  const quickTokenAddresses = useMemo(() => {
    const values = [
      contractAddresses.usdc,
      contractAddresses.testUSDT,
      ...coreTokens,
    ];
    const deduped: Address[] = [];

    for (const value of values) {
      if (
        !value ||
        value === contractAddresses.wmon ||
        deduped.includes(value)
      ) {
        continue;
      }

      deduped.push(value);
    }

    return deduped.slice(0, 6);
  }, [coreTokens]);

  const fallbackCores = useMemo(
    () =>
      [
        contractAddresses.usdc,
        contractAddresses.testUSDT,
        contractAddresses.wmon,
      ].filter(Boolean) as Address[],
    [],
  );

  const routesCores = coreTokens.length > 0 ? coreTokens : fallbackCores;
  const quoteQuery = useBestQuote(tokenIn, tokenOut, amountIn, routesCores);
  const selectableTokens = useMemo(() => {
    const values = [
      MON_TOKEN,
      ...quickTokenAddresses,
      tokenIn || undefined,
      tokenOut || undefined,
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
    queryKey: [
      "allowance",
      address,
      tokenIn,
      contractAddresses.uniswapV2Router02,
    ],
    enabled: Boolean(
      publicClient &&
      address &&
      contractAddresses.uniswapV2Router02 &&
      isAddress(tokenIn) &&
      quoteQuery.data?.amountInRaw !== undefined,
    ),
    refetchInterval: 10_000,
    queryFn: async () => {
      if (
        !publicClient ||
        !address ||
        !contractAddresses.uniswapV2Router02 ||
        !isAddress(tokenIn)
      ) {
        return 0n;
      }

      const allowance = await publicClient.readContract({
        address: tokenIn,
        abi: contractAbis.erc20,
        functionName: "allowance",
        args: [address, contractAddresses.uniswapV2Router02],
      });

      return allowance as bigint;
    },
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
        args: [address],
      });

      return balance as bigint;
    },
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
        args: [address],
      });

      return balance as bigint;
    },
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
    },
  });

  const needsApproval =
    tokenIn !== MON_TOKEN &&
    Boolean(quoteQuery.data?.best) &&
    (allowanceQuery.data ?? 0n) < (quoteQuery.data?.amountInRaw ?? 0n) &&
    (quoteQuery.data?.amountInRaw ?? 0n) > 0n;

  async function handleApprove() {
    if (
      !isCorrectChain ||
      !contractAddresses.uniswapV2Router02 ||
      !isAddress(tokenIn) ||
      !publicClient
    ) {
      return;
    }

    setPending(true);
    setPendingAction("approve");
    setLastAction("Approving token…");

    try {
      const hash = await writeContractAsync({
        address: tokenIn,
        abi: contractAbis.erc20,
        functionName: "approve",
        args: [
          contractAddresses.uniswapV2Router02,
          quoteQuery.data?.amountInRaw ?? 0n,
        ],
      });

      setLastAction(`Approval sent: ${hash}`);
      const approvalReceipt = await publicClient.waitForTransactionReceipt({
        hash,
      });
      if (approvalReceipt.status === "reverted") {
        setLastAction(`Approval reverted: ${hash}`);
        return;
      }
      setLastAction(`Approval confirmed: ${hash}`);
      await allowanceQuery.refetch();
    } catch (error) {
      console.error("Approval failed", error);
      const msg =
        error instanceof Error && error.message.includes("User rejected")
          ? "Transaction rejected by wallet."
          : "Approval failed. Please try again.";
      setLastAction(msg);
    } finally {
      setPending(false);
      setPendingAction(null);
    }
  }

  async function handleSwap() {
    if (
      !isCorrectChain ||
      !address ||
      !contractAddresses.uniswapV2Router02 ||
      !quoteQuery.data?.best ||
      !publicClient
    ) {
      return;
    }

    setPending(true);
    setPendingAction("swap");
    setLastAction("Submitting swap…");

    try {
      const rawSlippage = Number(slippagePercent);
      const slippage =
        Number.isFinite(rawSlippage) && rawSlippage > 0
          ? Math.min(rawSlippage, 50)
          : 1;
      const bps = Math.floor(slippage * 100);
      const minOut =
        quoteQuery.data.best.amountOut -
        (quoteQuery.data.best.amountOut * BigInt(bps)) / 10_000n;
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
          value: quoteQuery.data.amountInRaw,
        });
      } else if (!isTokenInMon && isTokenOutMon) {
        hash = await writeContractAsync({
          address: contractAddresses.uniswapV2Router02,
          abi: contractAbis.router,
          functionName: "swapExactTokensForETH",
          args: [
            quoteQuery.data.amountInRaw,
            minOut,
            quoteQuery.data.best.path,
            address,
            deadline,
          ],
        });
      } else {
        hash = await writeContractAsync({
          address: contractAddresses.uniswapV2Router02,
          abi: contractAbis.router,
          functionName: "swapExactTokensForTokens",
          args: [
            quoteQuery.data.amountInRaw,
            minOut,
            quoteQuery.data.best.path,
            address,
            deadline,
          ],
        });
      }

      setLastAction(`Swap sent: ${hash}`);
      const swapReceipt = await publicClient.waitForTransactionReceipt({
        hash,
      });
      if (swapReceipt.status === "reverted") {
        setLastAction(`Swap reverted: ${hash}`);
        return;
      }
      setLastAction(`Swap confirmed: ${hash}`);
      await Promise.all([
        allowanceQuery.refetch(),
        balanceInQuery.refetch(),
        balanceOutQuery.refetch(),
        monBalanceQuery.refetch(),
        quoteQuery.refetch(),
      ]);
    } catch (error) {
      console.error("Swap failed", error);
      const msg =
        error instanceof Error && error.message.includes("User rejected")
          ? "Transaction rejected by wallet."
          : "Swap failed. Check your balance and try again.";
      setLastAction(msg);
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

    if (!isCorrectChain) {
      switchChain({ chainId: monadTestnet.id });
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

    if (contractAddresses.usdc) {
      map.set(contractAddresses.usdc.toLowerCase(), "USDC");
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
      map.set(
        tokenOutMeta.data.address.toLowerCase(),
        tokenOutMeta.data.symbol,
      );
    }

    return map;
  }, [tokenInMeta.data, tokenOutMeta.data]);

  function getTokenLabel(tokenAddress: string) {
    if (tokenAddress === MON_TOKEN) {
      return "MON";
    }

    if (isAddress(tokenAddress)) {
      return (
        symbolByAddress.get(tokenAddress.toLowerCase()) ??
        shortAddress(tokenAddress)
      );
    }

    return tokenAddress;
  }

  const isTokenInMon = tokenIn === MON_TOKEN;
  const isTokenOutMon = tokenOut === MON_TOKEN;
  const tokenInSymbol = getTokenLabel(tokenIn);
  const tokenOutSymbol = getTokenLabel(tokenOut);

  const bestQuoteReadable =
    quoteQuery.data?.best && quoteQuery.data.decimalsOut !== undefined
      ? formatUnits(quoteQuery.data.best.amountOut, quoteQuery.data.decimalsOut)
      : "";
  const bestQuoteValue = bestQuoteReadable || "0";

  const amountInRawPreview =
    quoteQuery.data?.amountInRaw !== undefined &&
    quoteQuery.data.decimalsIn !== undefined
      ? formatUnits(quoteQuery.data.amountInRaw, quoteQuery.data.decimalsIn)
      : "-";
  const balanceInRaw = isTokenInMon
    ? monBalanceQuery.data
    : balanceInQuery.data;
  const balanceOutRaw = isTokenOutMon
    ? monBalanceQuery.data
    : balanceOutQuery.data;
  const balanceInDecimals = isTokenInMon ? 18 : tokenInMeta.data?.decimals;
  const balanceOutDecimals = isTokenOutMon ? 18 : tokenOutMeta.data?.decimals;
  const balanceInReadable =
    balanceInRaw !== undefined && balanceInDecimals !== undefined
      ? formatUnits(balanceInRaw, balanceInDecimals)
      : "-";
  const balanceOutReadable =
    balanceOutRaw !== undefined && balanceOutDecimals !== undefined
      ? formatUnits(balanceOutRaw, balanceOutDecimals)
      : "-";
  const hasInsufficientBalance =
    isConnected &&
    balanceInRaw !== undefined &&
    quoteQuery.data?.amountInRaw !== undefined &&
    quoteQuery.data.amountInRaw > 0n &&
    balanceInRaw < quoteQuery.data.amountInRaw;

  const primaryButtonLabel = pending
    ? pendingAction === "approve"
      ? `Approving ${tokenInSymbol}…`
      : pendingAction === "swap"
        ? "Swapping…"
        : "Waiting for wallet…"
    : !isConnected
      ? "Connect Wallet"
      : !isCorrectChain
        ? "Switch to Monad Testnet"
        : hasInsufficientBalance
          ? `Insufficient ${tokenInSymbol} balance`
          : needsApproval
            ? `Approve ${tokenInSymbol}`
            : "Swap";
  const primaryDisabled =
    pending ||
    (!isConnected
      ? connectors.length === 0
      : isCorrectChain &&
        (hasInsufficientBalance || (!needsApproval && !quoteQuery.data?.best)));

  const isReady =
    isConnected &&
    isCorrectChain &&
    !hasInsufficientBalance &&
    (needsApproval || Boolean(quoteQuery.data?.best));

  const routeLabels =
    quoteQuery.data?.best?.path.map((pathAddress, index, path) => {
      if (
        contractAddresses.wmon &&
        pathAddress.toLowerCase() === contractAddresses.wmon.toLowerCase() &&
        ((isTokenInMon && index === 0) ||
          (isTokenOutMon && index === path.length - 1))
      ) {
        return MON_TOKEN;
      }

      return (
        symbolByAddress.get(pathAddress.toLowerCase()) ??
        shortAddress(pathAddress)
      );
    }) ?? [];

  const chevronDown = (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <polyline points="6 9 12 15 18 9" />
    </svg>
  );

  const arrowRight = (
    <svg
      width="12"
      height="12"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <line x1="5" y1="12" x2="19" y2="12" />
      <polyline points="12 5 19 12 12 19" />
    </svg>
  );

  return (
    <>
      <Helmet>
        <title>Monad Testnet Swap · PuddleSwap DEX</title>
        <meta
          name="description"
          content="Swap tokens on Monad Testnet. PuddleSwap is an unaudited DEX with star routing through USDC, USDT, and WMON for builders testing on Monad."
        />
        <link rel="canonical" href="https://app.puddleswap.org/" />
        <meta property="og:url" content="https://app.puddleswap.org/" />
        <meta
          property="og:title"
          content="Monad Testnet Swap · PuddleSwap DEX"
        />
        <meta
          property="og:description"
          content="Swap tokens on Monad Testnet. PuddleSwap is an unaudited DEX with star routing through USDC, USDT, and WMON for builders testing on Monad."
        />
      </Helmet>

      {/* Mascot */}
      <div className="character-container" ref={mascotRef} aria-hidden="true">
        <div className="speech-bubble warning">
          Testnet tokens have no real value!
        </div>
        <div className="speech-bubble">Ready to make a splash?</div>
        <div className="puddle-char-wrapper">
          <svg
            className="puddle-char"
            viewBox="0 0 140 100"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <ellipse
              cx="70"
              cy="55"
              rx="55"
              ry="38"
              fill="#4E9A55"
              transform="rotate(-3 70 55)"
            />
            <ellipse cx="57" cy="48" rx="4" ry="8" fill="#1E201E" />
            <ellipse cx="83" cy="48" rx="4" ry="8" fill="#1E201E" />
            <path
              d="M60 68q10 8 20 0"
              stroke="#1E201E"
              strokeWidth="3"
              fill="none"
              strokeLinecap="round"
            />
          </svg>
        </div>
      </div>

      {/* Swap widget */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          width: "100%",
        }}
      >
        <div className="swap-widget">
          <div className="widget-header">
            <div className="widget-tabs">
              <button type="button" className="widget-tab active">
                Swap
              </button>
            </div>
            <button
              type="button"
              className="icon-btn"
              aria-label="Settings"
              onClick={() => setShowSettings((v) => !v)}
            >
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <circle cx="12" cy="12" r="3" />
                <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
              </svg>
            </button>
          </div>

          {showSettings && (
            <div className="slippage-row" style={{ paddingBottom: 8 }}>
              <span>Slippage tolerance</span>
              <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                <input
                  className="slippage-input-inline"
                  type="text"
                  inputMode="decimal"
                  autoComplete="off"
                  spellCheck={false}
                  aria-label="Slippage tolerance percent"
                  value={slippagePercent}
                  onChange={(event) => setSlippagePercent(event.target.value)}
                  placeholder="1"
                />
                <span style={{ fontWeight: 600, color: "var(--text-dark)" }}>
                  %
                </span>
              </div>
            </div>
          )}

          {/* You pay */}
          <div className="token-input-container">
            <div className="input-header">
              <span>You pay</span>
            </div>
            <div className="input-body">
              <input
                type="text"
                className="amount-input"
                inputMode="decimal"
                autoComplete="off"
                spellCheck={false}
                aria-label="You pay amount"
                value={amountIn}
                onChange={(event) => {
                  const v = event.target.value;
                  if (v === "" || /^\d*\.?\d*$/.test(v)) setAmountIn(v);
                }}
                placeholder="0"
              />
              <TokenSelectorButton
                tokens={selectableTokens}
                value={tokenIn}
                onChange={setTokenIn}
                getLabel={getTokenLabel}
                chevron={chevronDown}
              />
            </div>
            {isConnected && (
              <span className="token-balance">
                Balance: {balanceInReadable}
              </span>
            )}
          </div>

          {/* Swap direction */}
          <div className="swap-divider">
            <button
              type="button"
              className="swap-arrow-btn"
              onClick={handleSwapDirection}
              aria-label="Switch tokens"
            >
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <line x1="12" y1="5" x2="12" y2="19" />
                <polyline points="19 12 12 19 5 12" />
              </svg>
            </button>
          </div>

          {/* You receive */}
          <div className="token-input-container">
            <div className="input-header">
              <span>You receive</span>
            </div>
            <div className="input-body">
              <input
                type="text"
                className="amount-input"
                inputMode="decimal"
                autoComplete="off"
                spellCheck={false}
                aria-label="You receive amount"
                value={bestQuoteValue}
                readOnly
                placeholder="0"
              />
              <TokenSelectorButton
                tokens={selectableTokens}
                value={tokenOut}
                onChange={setTokenOut}
                getLabel={getTokenLabel}
                chevron={chevronDown}
              />
            </div>
            {isConnected && (
              <span className="token-balance">
                Balance: {balanceOutReadable}
              </span>
            )}
          </div>

          {/* Route info */}
          {quoteQuery.data?.best && (
            <div className="route-info">
              {quoteQuery.data.decimalsIn !== undefined &&
                quoteQuery.data.decimalsOut !== undefined &&
                quoteQuery.data.amountInRaw > 0n && (
                  <div className="route-row">
                    <span>Exchange Rate</span>
                    <span className="route-value">
                      1 {tokenInSymbol} ={" "}
                      {(
                        Number(bestQuoteValue) / Number(amountIn || "1")
                      ).toFixed(4)}{" "}
                      {tokenOutSymbol}
                    </span>
                  </div>
                )}
              <div className="route-row">
                <span>Route</span>
                <span className="route-path">
                  {routeLabels.map((label, i) => (
                    <span
                      key={i}
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 4,
                      }}
                    >
                      {i > 0 && arrowRight}
                      {label}
                    </span>
                  ))}
                </span>
              </div>
            </div>
          )}

          {/* CTA */}
          <button
            type="button"
            className={`btn-main ${isReady ? "ready" : ""}`}
            disabled={primaryDisabled}
            onClick={handlePrimaryAction}
          >
            {primaryButtonLabel}
          </button>

          {/* Debug links */}
          <div className="debug-links">
            <button
              type="button"
              className="debug-link"
              onClick={() => setShowDiagnostics((v) => !v)}
            >
              {showDiagnostics ? "Hide diagnostics" : "Routing table"}
            </button>
            <button
              type="button"
              className="debug-link"
              onClick={() => setShowAdvanced((v) => !v)}
            >
              {showAdvanced ? "Hide advanced" : "Advanced"}
            </button>
          </div>

          <div className="disclaimer-inline">
            Unaudited software provided "as is." Use at your own risk. Bugs may
            result in loss of funds. Not financial advice.
          </div>
        </div>

        {/* Diagnostics */}
        {showDiagnostics && (
          <div className="diagnostics-panel">
            <div className="diagnostic-header">
              <span>Path</span>
              <span>Status</span>
              <span>Out</span>
            </div>
            {quoteQuery.data?.quotes.map((quote) => (
              <div key={quote.path.join("-")} className="diagnostic-row">
                <code>
                  {quote.path
                    .map(
                      (a) =>
                        symbolByAddress.get(a.toLowerCase()) ?? shortAddress(a),
                    )
                    .join(" > ")}
                </code>
                <span className={quote.success ? "diag-ok" : "diag-fail"}>
                  {quote.success ? "LIVE" : "FAIL"}
                </span>
                <span>
                  {quote.success
                    ? formatUnits(
                        quote.amountOut,
                        quoteQuery.data?.decimalsOut ?? 18,
                      )
                    : "-"}
                </span>
              </div>
            ))}
            <div className="diagnostic-row">
              <code>Input Preview</code>
              <span className="diag-ok">INFO</span>
              <span>{amountInRawPreview}</span>
            </div>
          </div>
        )}

        {/* Advanced token input */}
        {showAdvanced && (
          <div className="advanced-panel">
            <label>
              Sell token address
              <input
                value={tokenIn}
                onChange={(event) => setTokenIn(event.target.value)}
                placeholder="0x…"
                autoComplete="off"
                spellCheck={false}
              />
            </label>
            <label>
              Buy token address
              <input
                value={tokenOut}
                onChange={(event) => setTokenOut(event.target.value)}
                placeholder="0x…"
                autoComplete="off"
                spellCheck={false}
              />
            </label>
          </div>
        )}

        {/* Quick tokens */}
        <div className="quick-tokens">
          <span className="quick-tokens-label">Quick:</span>
          <button
            type="button"
            className="quick-pill"
            onClick={() => setTokenIn(MON_TOKEN)}
          >
            Sell MON
          </button>
          <button
            type="button"
            className="quick-pill"
            onClick={() => setTokenOut(MON_TOKEN)}
          >
            Buy MON
          </button>
          {quickTokenAddresses.map((token) => (
            <button
              key={`sell-${token}`}
              type="button"
              className="quick-pill"
              onClick={() => setTokenIn(token)}
            >
              Sell {getTokenLabel(token)}
            </button>
          ))}
        </div>

        {/* Status */}
        {lastAction && (
          <TxStatus message={lastAction} className="swap-status" />
        )}
      </div>
    </>
  );
}

/* Token selector as a dropdown button */
function TokenSelectorButton({
  tokens,
  value,
  onChange,
  getLabel,
  chevron,
}: {
  tokens: string[];
  value: string;
  onChange: (v: string) => void;
  getLabel: (v: string) => string;
  chevron: React.ReactNode;
}) {
  const label = getLabel(value);

  return (
    <div style={{ position: "relative", flexShrink: 0 }}>
      <div className="token-selector">
        <TokenIcon symbol={label} size={28} />
        {label}
        {chevron}
      </div>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        style={{
          position: "absolute",
          inset: 0,
          opacity: 0,
          cursor: "pointer",
          width: "100%",
          height: "100%",
          border: "none",
          padding: 0,
        }}
      >
        {tokens.map((token) => (
          <option key={token} value={token}>
            {getLabel(token)}
          </option>
        ))}
      </select>
    </div>
  );
}
