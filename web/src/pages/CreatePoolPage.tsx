import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { formatUnits, isAddress, parseUnits, type Address } from "viem";
import { useAccount, usePublicClient, useWriteContract } from "wagmi";
import { Link } from "react-router-dom";

import { TokenPicker } from "../components/TokenPicker";
import { useChainGuard } from "../hooks/useChainGuard";
import { contractAbis, contractAddresses } from "../lib/contracts";

export function CreatePoolPage() {
  const { address } = useAccount();
  const publicClient = usePublicClient();
  const { isCorrectChain } = useChainGuard();
  const { writeContractAsync } = useWriteContract();

  const [tokenA, setTokenA] = useState(contractAddresses.testUSDC ?? "");
  const [tokenB, setTokenB] = useState(contractAddresses.testUSDT ?? "");
  const [amountA, setAmountA] = useState("100");
  const [amountB, setAmountB] = useState("100");
  const [status, setStatus] = useState("");
  const [pending, setPending] = useState(false);

  const decimalsQuery = useQuery({
    queryKey: ["pool-decimals", tokenA, tokenB],
    enabled: Boolean(publicClient && isAddress(tokenA) && isAddress(tokenB)),
    queryFn: async () => {
      if (!publicClient || !isAddress(tokenA) || !isAddress(tokenB)) {
        return { decimalsA: 18, decimalsB: 18 };
      }

      const [decimalsA, decimalsB] = await Promise.all([
        publicClient.readContract({
          address: tokenA,
          abi: contractAbis.erc20,
          functionName: "decimals"
        }),
        publicClient.readContract({
          address: tokenB,
          abi: contractAbis.erc20,
          functionName: "decimals"
        })
      ]);

      return {
        decimalsA: Number(decimalsA),
        decimalsB: Number(decimalsB)
      };
    }
  });

  const parsedAmounts = useMemo(() => {
    const decimalsA = decimalsQuery.data?.decimalsA ?? 18;
    const decimalsB = decimalsQuery.data?.decimalsB ?? 18;

    try {
      return {
        amountARaw: parseUnits(amountA || "0", decimalsA),
        amountBRaw: parseUnits(amountB || "0", decimalsB)
      };
    } catch {
      return {
        amountARaw: 0n,
        amountBRaw: 0n
      };
    }
  }, [amountA, amountB, decimalsQuery.data]);

  const allowanceQuery = useQuery({
    queryKey: ["pool-allowances", address, tokenA, tokenB, contractAddresses.uniswapV2Router02],
    enabled: Boolean(
      publicClient &&
        address &&
        contractAddresses.uniswapV2Router02 &&
        isAddress(tokenA) &&
        isAddress(tokenB)
    ),
    refetchInterval: 10_000,
    queryFn: async () => {
      if (
        !publicClient ||
        !address ||
        !contractAddresses.uniswapV2Router02 ||
        !isAddress(tokenA) ||
        !isAddress(tokenB)
      ) {
        return { allowanceA: 0n, allowanceB: 0n };
      }

      const [allowanceA, allowanceB] = await Promise.all([
        publicClient.readContract({
          address: tokenA,
          abi: contractAbis.erc20,
          functionName: "allowance",
          args: [address, contractAddresses.uniswapV2Router02]
        }),
        publicClient.readContract({
          address: tokenB,
          abi: contractAbis.erc20,
          functionName: "allowance",
          args: [address, contractAddresses.uniswapV2Router02]
        })
      ]);

      return {
        allowanceA: allowanceA as bigint,
        allowanceB: allowanceB as bigint
      };
    }
  });

  const pairAddressQuery = useQuery({
    queryKey: ["pair-address", tokenA, tokenB],
    enabled: Boolean(
      publicClient &&
        contractAddresses.uniswapV2Factory &&
        isAddress(tokenA) &&
        isAddress(tokenB) &&
        tokenA !== tokenB
    ),
    queryFn: async () => {
      if (!publicClient || !contractAddresses.uniswapV2Factory || !isAddress(tokenA) || !isAddress(tokenB)) {
        return undefined;
      }

      const pair = await publicClient.readContract({
        address: contractAddresses.uniswapV2Factory,
        abi: contractAbis.factory,
        functionName: "getPair",
        args: [tokenA as Address, tokenB as Address]
      });

      return pair as Address;
    }
  });

  const needsApprovalA = (allowanceQuery.data?.allowanceA ?? 0n) < parsedAmounts.amountARaw;
  const needsApprovalB = (allowanceQuery.data?.allowanceB ?? 0n) < parsedAmounts.amountBRaw;

  async function approveToken(token: Address) {
    if (!contractAddresses.uniswapV2Router02) {
      return;
    }

    setPending(true);
    setStatus(`Approving ${token}...`);
    try {
      const hash = await writeContractAsync({
        address: token,
        abi: contractAbis.erc20,
        functionName: "approve",
        args: [contractAddresses.uniswapV2Router02, token === (tokenA as Address) ? parsedAmounts.amountARaw : parsedAmounts.amountBRaw]
      });
      setStatus(`Approval sent: ${hash}`);
      await allowanceQuery.refetch();
    } catch (error) {
      console.error("Approval failed", error);
      const msg = error instanceof Error && error.message.includes("User rejected")
        ? "Transaction rejected by wallet."
        : "Approval failed. Please try again.";
      setStatus(msg);
    } finally {
      setPending(false);
    }
  }

  async function createPool() {
    if (
      !isCorrectChain ||
      !address ||
      !contractAddresses.uniswapV2Router02 ||
      !isAddress(tokenA) ||
      !isAddress(tokenB) ||
      parsedAmounts.amountARaw === 0n ||
      parsedAmounts.amountBRaw === 0n
    ) {
      return;
    }

    setPending(true);
    setStatus("Submitting add liquidity tx...");

    try {
      const hash = await writeContractAsync({
        address: contractAddresses.uniswapV2Router02,
        abi: contractAbis.router,
        functionName: "addLiquidity",
        args: [
          tokenA as Address,
          tokenB as Address,
          parsedAmounts.amountARaw,
          parsedAmounts.amountBRaw,
          (parsedAmounts.amountARaw * 98n) / 100n,
          (parsedAmounts.amountBRaw * 98n) / 100n,
          address,
          BigInt(Math.floor(Date.now() / 1000) + 60 * 20)
        ]
      });

      setStatus(`Liquidity tx sent: ${hash}`);
      await pairAddressQuery.refetch();
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

  return (
    <section className="card">
      <h2>Create Pool</h2>

      <TokenPicker label="Token A" value={tokenA} onChange={setTokenA} />
      <TokenPicker label="Token B" value={tokenB} onChange={setTokenB} />

      <label>
        Amount A
        <input value={amountA} onChange={(event) => { const v = event.target.value; if (v === "" || /^\d*\.?\d*$/.test(v)) setAmountA(v); }} />
      </label>
      <label>
        Amount B
        <input value={amountB} onChange={(event) => { const v = event.target.value; if (v === "" || /^\d*\.?\d*$/.test(v)) setAmountB(v); }} />
      </label>

      <div className="info-row">
        <span>Parsed A</span>
        <strong>{formatUnits(parsedAmounts.amountARaw, decimalsQuery.data?.decimalsA ?? 18)}</strong>
      </div>

      <div className="info-row">
        <span>Parsed B</span>
        <strong>{formatUnits(parsedAmounts.amountBRaw, decimalsQuery.data?.decimalsB ?? 18)}</strong>
      </div>

      <div className="button-row">
        <button
          type="button"
          disabled={!isCorrectChain || pending || !needsApprovalA || !isAddress(tokenA)}
          onClick={() => approveToken(tokenA as Address)}
        >
          Approve Token A
        </button>
        <button
          type="button"
          disabled={!isCorrectChain || pending || !needsApprovalB || !isAddress(tokenB)}
          onClick={() => approveToken(tokenB as Address)}
        >
          Approve Token B
        </button>
      </div>

      <button type="button" disabled={!isCorrectChain || pending || needsApprovalA || needsApprovalB} onClick={createPool}>
        Create / Add Liquidity
      </button>

      <p>{status}</p>

      {pairAddressQuery.data && pairAddressQuery.data !== "0x0000000000000000000000000000000000000000" ? (
        <p>
          Pair found: <code>{pairAddressQuery.data}</code>{" "}
          <Link to={`/pool/${pairAddressQuery.data}`}>Open pool details</Link>
        </p>
      ) : (
        <p>No pair yet for current token pair.</p>
      )}
    </section>
  );
}
