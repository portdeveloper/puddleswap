import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Helmet } from "react-helmet-async";
import { formatUnits, isAddress, parseUnits, type Address } from "viem";
import { Link, useParams } from "react-router-dom";
import { useAccount, usePublicClient, useWriteContract } from "wagmi";
import { monadTestnet } from "../config/chain";

import { PoolAnalyticsChart } from "../components/PoolAnalyticsChart";
import { TxStatus } from "../components/TxStatus";
import { useChainGuard } from "../hooks/useChainGuard";
import { usePoolAnalytics } from "../hooks/usePoolAnalytics";
import { contractAbis, contractAddresses } from "../lib/contracts";
import { computeCurrentPrice } from "../lib/poolAnalytics";

function shortPair(value: string) {
  if (value.length < 10) return value;
  return `${value.slice(0, 6)}…${value.slice(-4)}`;
}

export function PoolDetailsPage() {
  const { pairAddress = "" } = useParams();
  const { address } = useAccount();
  const publicClient = usePublicClient({ chainId: monadTestnet.id });
  const { isCorrectChain } = useChainGuard();
  const { writeContractAsync } = useWriteContract();

  const [addAmountToken0, setAddAmountToken0] = useState("10");
  const [addAmountToken1, setAddAmountToken1] = useState("10");
  const [removeLpAmount, setRemoveLpAmount] = useState("0");
  const [status, setStatus] = useState("");
  const [pending, setPending] = useState(false);

  const pairMetaQuery = useQuery({
    queryKey: ["pair-meta", pairAddress],
    enabled: Boolean(publicClient && isAddress(pairAddress)),
    refetchInterval: 15_000,
    queryFn: async () => {
      if (!publicClient || !isAddress(pairAddress)) {
        return undefined;
      }

      const [token0, token1, reserves] = await Promise.all([
        publicClient.readContract({
          address: pairAddress,
          abi: contractAbis.pair,
          functionName: "token0"
        }),
        publicClient.readContract({
          address: pairAddress,
          abi: contractAbis.pair,
          functionName: "token1"
        }),
        publicClient.readContract({
          address: pairAddress,
          abi: contractAbis.pair,
          functionName: "getReserves"
        })
      ]);

      return {
        token0: token0 as Address,
        token1: token1 as Address,
        reserves: reserves as [bigint, bigint, number]
      };
    }
  });

  const tokenDecimalsQuery = useQuery({
    queryKey: ["pair-token-decimals", pairMetaQuery.data?.token0, pairMetaQuery.data?.token1],
    enabled: Boolean(publicClient && pairMetaQuery.data),
    queryFn: async () => {
      if (!publicClient || !pairMetaQuery.data) {
        // `enabled` already demands both, so this is unreachable. It used to hand
        // back 18/18, an invented unit in a quiet branch; fail instead of
        // guessing, as #42 did for Create Pool.
        throw new Error("Cannot read token decimals without a client and loaded pair metadata");
      }

      const [token0Decimals, token1Decimals] = await Promise.all([
        publicClient.readContract({
          address: pairMetaQuery.data.token0,
          abi: contractAbis.erc20,
          functionName: "decimals"
        }),
        publicClient.readContract({
          address: pairMetaQuery.data.token1,
          abi: contractAbis.erc20,
          functionName: "decimals"
        })
      ]);

      return {
        token0Decimals: Number(token0Decimals),
        token1Decimals: Number(token1Decimals)
      };
    }
  });

  // The pair's units: both underlying decimals, read from the tokens. React Query
  // keeps `data` when a background refetch fails, so a pair that was read once
  // keeps its verified units; a pair that was never read has none. Real zero
  // decimals are a unit like any other, which is why nothing here tests truthiness
  // of the numbers themselves.
  const tokenDecimals = tokenDecimalsQuery.data;
  const unitsPending = tokenDecimalsQuery.isError ? "token decimals unavailable" : "reading token decimals…";

  const analyticsQuery = usePoolAnalytics(
    isAddress(pairAddress) ? pairAddress : undefined,
    tokenDecimals?.token0Decimals,
    tokenDecimals?.token1Decimals
  );

  // No price without units: an 18/18 guess on a 6/18 pair is off by 10^12 and
  // looks entirely plausible on screen.
  const currentPrice = pairMetaQuery.data && tokenDecimals
    ? computeCurrentPrice(
        pairMetaQuery.data.reserves[0],
        pairMetaQuery.data.reserves[1],
        tokenDecimals.token0Decimals,
        tokenDecimals.token1Decimals
      )
    : undefined;

  const lpBalanceQuery = useQuery({
    queryKey: ["lp-balance", pairAddress, address],
    enabled: Boolean(publicClient && address && isAddress(pairAddress)),
    refetchInterval: 15_000,
    queryFn: async () => {
      if (!publicClient || !address || !isAddress(pairAddress)) {
        return 0n;
      }

      const balance = await publicClient.readContract({
        address: pairAddress,
        abi: contractAbis.pair,
        functionName: "balanceOf",
        args: [address]
      });

      return balance as bigint;
    }
  });

  const lpTotalSupplyQuery = useQuery({
    queryKey: ["lp-total-supply", pairAddress],
    enabled: Boolean(publicClient && isAddress(pairAddress)),
    refetchInterval: 15_000,
    queryFn: async () => {
      if (!publicClient || !isAddress(pairAddress)) {
        return 0n;
      }

      const totalSupply = await publicClient.readContract({
        address: pairAddress,
        abi: contractAbis.pair,
        functionName: "totalSupply"
      });

      return totalSupply as bigint;
    }
  });

  const lpAllowanceQuery = useQuery({
    queryKey: ["lp-allowance", pairAddress, address, contractAddresses.uniswapV2Router02],
    enabled: Boolean(publicClient && address && isAddress(pairAddress) && contractAddresses.uniswapV2Router02),
    refetchInterval: 10_000,
    queryFn: async () => {
      if (!publicClient || !address || !isAddress(pairAddress) || !contractAddresses.uniswapV2Router02) {
        return 0n;
      }

      const allowance = await publicClient.readContract({
        address: pairAddress,
        abi: contractAbis.erc20,
        functionName: "allowance",
        args: [address, contractAddresses.uniswapV2Router02]
      });

      return allowance as bigint;
    }
  });

  // Until both underlying decimals have been read there is no unit, so there is
  // no deposit amount -- not a zero, and not an 18-decimal guess. `null` is what
  // the handler and the button key off.
  const deposits = useMemo(() => {
    if (!tokenDecimals) {
      return null;
    }

    try {
      return {
        amount0: parseUnits(addAmountToken0 || "0", tokenDecimals.token0Decimals),
        amount1: parseUnits(addAmountToken1 || "0", tokenDecimals.token1Decimals)
      };
    } catch {
      return { amount0: 0n, amount1: 0n };
    }
  }, [addAmountToken0, addAmountToken1, tokenDecimals]);

  // The LP token is the pair's own, always 18, so this never depended on the
  // reads above and the remove-liquidity flow is unaffected by them.
  const lpAmount = useMemo(() => {
    try {
      return parseUnits(removeLpAmount || "0", 18);
    } catch {
      return 0n;
    }
  }, [removeLpAmount]);

  const needsLpApproval = (lpAllowanceQuery.data ?? 0n) < lpAmount;

  async function approveLp() {
    if (!isAddress(pairAddress) || !contractAddresses.uniswapV2Router02) {
      return;
    }

    setPending(true);
    setStatus("Approving LP token…");
    try {
      const hash = await writeContractAsync({
        address: pairAddress,
        abi: contractAbis.pair,
        functionName: "approve",
        args: [contractAddresses.uniswapV2Router02, lpAmount]
      });

      setStatus(`LP approval sent: ${hash}`);
      await lpAllowanceQuery.refetch();
    } catch (error) {
      console.error("LP approval failed", error);
      const msg = error instanceof Error && error.message.includes("User rejected")
        ? "Transaction rejected by wallet."
        : "LP approval failed. Please try again.";
      setStatus(msg);
    } finally {
      setPending(false);
    }
  }

  async function addLiquidity() {
    if (
      !isCorrectChain ||
      !address ||
      !pairMetaQuery.data ||
      !contractAddresses.uniswapV2Router02 ||
      !deposits ||
      deposits.amount0 === 0n ||
      deposits.amount1 === 0n
    ) {
      return;
    }

    setPending(true);
    setStatus("Submitting add-liquidity tx…");

    try {
      const hash = await writeContractAsync({
        address: contractAddresses.uniswapV2Router02,
        abi: contractAbis.router,
        functionName: "addLiquidity",
        args: [
          pairMetaQuery.data.token0,
          pairMetaQuery.data.token1,
          deposits.amount0,
          deposits.amount1,
          (deposits.amount0 * 98n) / 100n,
          (deposits.amount1 * 98n) / 100n,
          address,
          BigInt(Math.floor(Date.now() / 1000) + 60 * 20)
        ]
      });

      setStatus(`Add liquidity sent: ${hash}`);
      await lpBalanceQuery.refetch();
    } catch (error) {
      console.error("Add liquidity failed", error);
      const msg = error instanceof Error && error.message.includes("User rejected")
        ? "Transaction rejected by wallet."
        : "Add liquidity failed. Please try again.";
      setStatus(msg);
    } finally {
      setPending(false);
    }
  }

  async function removeLiquidity() {
    if (
      !isCorrectChain ||
      !address ||
      !pairMetaQuery.data ||
      !contractAddresses.uniswapV2Router02 ||
      lpAmount === 0n
    ) {
      return;
    }

    setPending(true);
    setStatus("Submitting remove-liquidity tx…");

    try {
      const totalSupply = lpTotalSupplyQuery.data ?? 0n;
      const reserves = pairMetaQuery.data.reserves;
      let minAmount0 = 1n;
      let minAmount1 = 1n;

      if (totalSupply > 0n) {
        const expectedAmount0 = (lpAmount * reserves[0]) / totalSupply;
        const expectedAmount1 = (lpAmount * reserves[1]) / totalSupply;
        minAmount0 = (expectedAmount0 * 98n) / 100n;
        minAmount1 = (expectedAmount1 * 98n) / 100n;
      }

      const hash = await writeContractAsync({
        address: contractAddresses.uniswapV2Router02,
        abi: contractAbis.router,
        functionName: "removeLiquidity",
        args: [
          pairMetaQuery.data.token0,
          pairMetaQuery.data.token1,
          lpAmount,
          minAmount0,
          minAmount1,
          address,
          BigInt(Math.floor(Date.now() / 1000) + 60 * 20)
        ]
      });

      setStatus(`Remove liquidity sent: ${hash}`);
      await lpBalanceQuery.refetch();
    } catch (error) {
      console.error("Remove liquidity failed", error);
      const msg = error instanceof Error && error.message.includes("User rejected")
        ? "Transaction rejected by wallet."
        : "Remove liquidity failed. Please try again.";
      setStatus(msg);
    } finally {
      setPending(false);
    }
  }

  if (!isAddress(pairAddress)) {
    return (
      <section className="card">
        <Helmet>
          <title>Pool Not Found · PuddleSwap</title>
          <meta name="robots" content="noindex" />
        </Helmet>
        <h2>Pool Details</h2>
        <p>Invalid pair address.</p>
        <Link to="/pool/new">Go to Create Pool</Link>
      </section>
    );
  }

  return (
    <section className="card">
      <Helmet>
        <title>{`Pool ${shortPair(pairAddress)} · Monad Testnet · PuddleSwap`}</title>
        <meta name="description" content="Liquidity pool details on Monad Testnet. View reserves, add or remove liquidity." />
        <meta name="robots" content="noindex" />
      </Helmet>
      <h2>Pool Details</h2>

      <div className="info-row">
        <span>Pair</span>
        <code translate="no">{pairAddress}</code>
      </div>

      <div className="info-row">
        <span>Token0</span>
        <code translate="no">{pairMetaQuery.data?.token0 ?? "-"}</code>
      </div>
      <div className="info-row">
        <span>Token1</span>
        <code translate="no">{pairMetaQuery.data?.token1 ?? "-"}</code>
      </div>
      <div className="info-row">
        <span>Reserve0</span>
        <strong>
          {!pairMetaQuery.data ? "-" : tokenDecimals ? formatUnits(pairMetaQuery.data.reserves[0], tokenDecimals.token0Decimals) : unitsPending}
        </strong>
      </div>
      <div className="info-row">
        <span>Reserve1</span>
        <strong>
          {!pairMetaQuery.data ? "-" : tokenDecimals ? formatUnits(pairMetaQuery.data.reserves[1], tokenDecimals.token1Decimals) : unitsPending}
        </strong>
      </div>
      <div className="info-row">
        <span>Your LP</span>
        <strong>{formatUnits(lpBalanceQuery.data ?? 0n, 18)}</strong>
      </div>
      <div className="info-row">
        <span>Current Price (Token1 per Token0)</span>
        <strong>
          {currentPrice !== undefined ? currentPrice.toFixed(6) : pairMetaQuery.data && !tokenDecimals ? unitsPending : "-"}
        </strong>
      </div>

      <h3>Analytics</h3>
      <PoolAnalyticsChart
        priceSeries={analyticsQuery.data?.priceSeries ?? []}
        volumeBuckets={analyticsQuery.data?.volumeBuckets ?? []}
      />

      <h3>Add Liquidity</h3>
      <label>
        Token0 amount
        <input
          value={addAmountToken0}
          onChange={(event) => { const v = event.target.value; if (v === "" || /^\d*\.?\d*$/.test(v)) setAddAmountToken0(v); }}
          inputMode="decimal"
          autoComplete="off"
          spellCheck={false}
        />
      </label>
      <label>
        Token1 amount
        <input
          value={addAmountToken1}
          onChange={(event) => { const v = event.target.value; if (v === "" || /^\d*\.?\d*$/.test(v)) setAddAmountToken1(v); }}
          inputMode="decimal"
          autoComplete="off"
          spellCheck={false}
        />
      </label>
      {!tokenDecimals && (
        <p role="status">
          {tokenDecimalsQuery.isError
            ? "Could not read token decimals — deposits are disabled"
            : "Reading token decimals…"}
        </p>
      )}

      <button type="button" disabled={!isCorrectChain || pending || !deposits} onClick={addLiquidity}>
        Add Liquidity
      </button>

      <h3>Remove Liquidity</h3>
      <label>
        LP amount
        <input
          value={removeLpAmount}
          onChange={(event) => { const v = event.target.value; if (v === "" || /^\d*\.?\d*$/.test(v)) setRemoveLpAmount(v); }}
          inputMode="decimal"
          autoComplete="off"
          spellCheck={false}
        />
      </label>
      <div className="button-row">
        <button type="button" disabled={!isCorrectChain || pending || !needsLpApproval} onClick={approveLp}>
          Approve LP
        </button>
        <button
          type="button"
          disabled={!isCorrectChain || pending || needsLpApproval || lpAmount === 0n}
          onClick={removeLiquidity}
        >
          Remove Liquidity
        </button>
      </div>

      {status && <TxStatus message={status} />}
    </section>
  );
}
