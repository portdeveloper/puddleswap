import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { formatUnits, isAddress, parseUnits, type Address } from "viem";
import { Link, useParams } from "react-router-dom";
import { useAccount, usePublicClient, useWriteContract } from "wagmi";

import { useChainGuard } from "../hooks/useChainGuard";
import { contractAbis, contractAddresses } from "../lib/contracts";

export function PoolDetailsPage() {
  const { pairAddress = "" } = useParams();
  const { address } = useAccount();
  const publicClient = usePublicClient();
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
        return { token0Decimals: 18, token1Decimals: 18 };
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

  const parsedInputs = useMemo(() => {
    const token0Decimals = tokenDecimalsQuery.data?.token0Decimals ?? 18;
    const token1Decimals = tokenDecimalsQuery.data?.token1Decimals ?? 18;

    try {
      return {
        amount0: parseUnits(addAmountToken0 || "0", token0Decimals),
        amount1: parseUnits(addAmountToken1 || "0", token1Decimals),
        lpAmount: parseUnits(removeLpAmount || "0", 18)
      };
    } catch {
      return {
        amount0: 0n,
        amount1: 0n,
        lpAmount: 0n
      };
    }
  }, [addAmountToken0, addAmountToken1, removeLpAmount, tokenDecimalsQuery.data]);

  const needsLpApproval = (lpAllowanceQuery.data ?? 0n) < parsedInputs.lpAmount;

  async function approveLp() {
    if (!isAddress(pairAddress) || !contractAddresses.uniswapV2Router02) {
      return;
    }

    setPending(true);
    setStatus("Approving LP token...");
    try {
      const hash = await writeContractAsync({
        address: pairAddress,
        abi: contractAbis.pair,
        functionName: "approve",
        args: [contractAddresses.uniswapV2Router02, parsedInputs.lpAmount]
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
      parsedInputs.amount0 === 0n ||
      parsedInputs.amount1 === 0n
    ) {
      return;
    }

    setPending(true);
    setStatus("Submitting add-liquidity tx...");

    try {
      const hash = await writeContractAsync({
        address: contractAddresses.uniswapV2Router02,
        abi: contractAbis.router,
        functionName: "addLiquidity",
        args: [
          pairMetaQuery.data.token0,
          pairMetaQuery.data.token1,
          parsedInputs.amount0,
          parsedInputs.amount1,
          (parsedInputs.amount0 * 98n) / 100n,
          (parsedInputs.amount1 * 98n) / 100n,
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
      parsedInputs.lpAmount === 0n
    ) {
      return;
    }

    setPending(true);
    setStatus("Submitting remove-liquidity tx...");

    try {
      const hash = await writeContractAsync({
        address: contractAddresses.uniswapV2Router02,
        abi: contractAbis.router,
        functionName: "removeLiquidity",
        args: [
          pairMetaQuery.data.token0,
          pairMetaQuery.data.token1,
          parsedInputs.lpAmount,
          1n,
          1n,
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
        <h2>Pool Details</h2>
        <p>Invalid pair address.</p>
        <Link to="/pool/new">Go to Create Pool</Link>
      </section>
    );
  }

  return (
    <section className="card">
      <h2>Pool Details</h2>

      <div className="info-row">
        <span>Pair</span>
        <code>{pairAddress}</code>
      </div>

      <div className="info-row">
        <span>Token0</span>
        <code>{pairMetaQuery.data?.token0 ?? "-"}</code>
      </div>
      <div className="info-row">
        <span>Token1</span>
        <code>{pairMetaQuery.data?.token1 ?? "-"}</code>
      </div>
      <div className="info-row">
        <span>Reserve0</span>
        <strong>
          {pairMetaQuery.data ? formatUnits(pairMetaQuery.data.reserves[0], tokenDecimalsQuery.data?.token0Decimals ?? 18) : "-"}
        </strong>
      </div>
      <div className="info-row">
        <span>Reserve1</span>
        <strong>
          {pairMetaQuery.data ? formatUnits(pairMetaQuery.data.reserves[1], tokenDecimalsQuery.data?.token1Decimals ?? 18) : "-"}
        </strong>
      </div>
      <div className="info-row">
        <span>Your LP</span>
        <strong>{formatUnits(lpBalanceQuery.data ?? 0n, 18)}</strong>
      </div>

      <h3>Add Liquidity</h3>
      <label>
        Token0 amount
        <input value={addAmountToken0} onChange={(event) => { const v = event.target.value; if (v === "" || /^\d*\.?\d*$/.test(v)) setAddAmountToken0(v); }} />
      </label>
      <label>
        Token1 amount
        <input value={addAmountToken1} onChange={(event) => { const v = event.target.value; if (v === "" || /^\d*\.?\d*$/.test(v)) setAddAmountToken1(v); }} />
      </label>
      <button type="button" disabled={!isCorrectChain || pending} onClick={addLiquidity}>
        Add Liquidity
      </button>

      <h3>Remove Liquidity</h3>
      <label>
        LP amount
        <input value={removeLpAmount} onChange={(event) => { const v = event.target.value; if (v === "" || /^\d*\.?\d*$/.test(v)) setRemoveLpAmount(v); }} />
      </label>
      <div className="button-row">
        <button type="button" disabled={!isCorrectChain || pending || !needsLpApproval} onClick={approveLp}>
          Approve LP
        </button>
        <button
          type="button"
          disabled={!isCorrectChain || pending || needsLpApproval || parsedInputs.lpAmount === 0n}
          onClick={removeLiquidity}
        >
          Remove Liquidity
        </button>
      </div>

      <p>{status}</p>
    </section>
  );
}
