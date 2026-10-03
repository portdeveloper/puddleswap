import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Helmet } from "react-helmet-async";
import { formatUnits, isAddress, isAddressEqual, parseUnits, type Address } from "viem";
import { useAccount, usePublicClient, useWriteContract } from "wagmi";
import { monadTestnet } from "../config/chain";
import { Link } from "react-router-dom";

import { TokenPicker } from "../components/TokenPicker";
import { TxStatus } from "../components/TxStatus";
import { useChainGuard } from "../hooks/useChainGuard";
import { contractAbis, contractAddresses } from "../lib/contracts";

export function CreatePoolPage() {
  const { address } = useAccount();
  const publicClient = usePublicClient({ chainId: monadTestnet.id });
  const { isCorrectChain } = useChainGuard();
  const { writeContractAsync } = useWriteContract();

  const [tokenA, setTokenA] = useState(contractAddresses.usdc ?? "");
  const [tokenB, setTokenB] = useState(contractAddresses.testUSDT ?? "");
  const [amountA, setAmountA] = useState("100");
  const [amountB, setAmountB] = useState("100");
  const [status, setStatus] = useState("");
  const [pending, setPending] = useState(false);
  const sameToken = isAddress(tokenA) && isAddress(tokenB) && isAddressEqual(tokenA, tokenB);

  const decimalsQuery = useQuery({
    queryKey: ["pool-decimals", tokenA, tokenB],
    enabled: Boolean(publicClient && isAddress(tokenA) && isAddress(tokenB)),
    queryFn: async () => {
      if (!publicClient || !isAddress(tokenA) || !isAddress(tokenB)) {
        // `enabled` already demands all three, so this is unreachable. It used to
        // hand back 18/18, which is an invented unit sitting in a quiet branch;
        // fail instead of guessing, as #40 did for the reserve path.
        throw new Error("Cannot read token decimals without a client and two valid tokens");
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

  const decimals = decimalsQuery.data;

  // Until both decimals have actually been read there is no unit to parse into,
  // so there is no amount -- not a zero, and certainly not an 18-decimal guess.
  // Everything downstream keys off this being null: the approval value, the
  // allowance comparison, the submitted amounts and the buttons.
  const parsedAmounts = useMemo(() => {
    if (!decimals) {
      return null;
    }

    try {
      return {
        amountARaw: parseUnits(amountA || "0", decimals.decimalsA),
        amountBRaw: parseUnits(amountB || "0", decimals.decimalsB)
      };
    } catch {
      return {
        amountARaw: 0n,
        amountBRaw: 0n
      };
    }
  }, [amountA, amountB, decimals]);

  const unitsKnown = parsedAmounts !== null;

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
        !sameToken
    ),
    queryFn: async () => {
      if (!publicClient || !contractAddresses.uniswapV2Factory || !isAddress(tokenA) || !isAddress(tokenB) || sameToken) {
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

  const needsApprovalA = unitsKnown && (allowanceQuery.data?.allowanceA ?? 0n) < parsedAmounts.amountARaw;
  const needsApprovalB = unitsKnown && (allowanceQuery.data?.allowanceB ?? 0n) < parsedAmounts.amountBRaw;

  async function approveToken(token: Address) {
    if (!contractAddresses.uniswapV2Router02) {
      return;
    }

    // A disabled button is not a guard: a click can land between the query
    // resolving and the re-render. Approving on an invented unit would set an
    // allowance of parseUnits(amount, 18) on a token that may not use 18.
    if (!parsedAmounts) {
      setStatus("Waiting for token decimals before approving.");
      return;
    }

    setPending(true);
    setStatus(`Approving ${token}…`);
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
      sameToken ||
      !parsedAmounts ||
      parsedAmounts.amountARaw === 0n ||
      parsedAmounts.amountBRaw === 0n
    ) {
      return;
    }

    setPending(true);
    setStatus("Submitting add liquidity tx…");

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
      <Helmet>
        <title>Create Liquidity Pool · PuddleSwap · Monad Testnet</title>
        <meta name="description" content="Deploy a new Uniswap V2 pair and seed initial liquidity on Monad Testnet with PuddleSwap." />
        <link rel="canonical" href="https://app.puddleswap.org/pool/new" />
        <meta property="og:url" content="https://app.puddleswap.org/pool/new" />
        <meta property="og:title" content="Create Liquidity Pool · PuddleSwap · Monad Testnet" />
        <meta property="og:description" content="Deploy a new Uniswap V2 pair and seed initial liquidity on Monad Testnet with PuddleSwap." />
      </Helmet>

      <h1>Create a Liquidity Pool on Monad Testnet</h1>

      <TokenPicker label="Token A" value={tokenA} onChange={setTokenA} />
      <TokenPicker label="Token B" value={tokenB} onChange={setTokenB} />
      {sameToken && <p role="alert">Token A and Token B must be different.</p>}

      <label>
        Amount A
        <input
          value={amountA}
          onChange={(event) => { const v = event.target.value; if (v === "" || /^\d*\.?\d*$/.test(v)) setAmountA(v); }}
          inputMode="decimal"
          autoComplete="off"
          spellCheck={false}
        />
      </label>
      <label>
        Amount B
        <input
          value={amountB}
          onChange={(event) => { const v = event.target.value; if (v === "" || /^\d*\.?\d*$/.test(v)) setAmountB(v); }}
          inputMode="decimal"
          autoComplete="off"
          spellCheck={false}
        />
      </label>

      <div className="info-row">
        <span>Parsed A</span>
        <strong>{parsedAmounts && decimals ? formatUnits(parsedAmounts.amountARaw, decimals.decimalsA) : "—"}</strong>
      </div>

      <div className="info-row">
        <span>Parsed B</span>
        <strong>{parsedAmounts && decimals ? formatUnits(parsedAmounts.amountBRaw, decimals.decimalsB) : "—"}</strong>
      </div>

      {isAddress(tokenA) && isAddress(tokenB) && !sameToken && !decimals && (
        <div className="info-row">
          <span>Token decimals</span>
          <strong role="status">
            {decimalsQuery.isError
              ? "Could not read decimals — amounts and approvals are disabled"
              : "Reading decimals…"}
          </strong>
        </div>
      )}

      <div className="button-row">
        <button
          type="button"
          disabled={!isCorrectChain || pending || !unitsKnown || !needsApprovalA || !isAddress(tokenA)}
          onClick={() => approveToken(tokenA as Address)}
        >
          Approve Token A
        </button>
        <button
          type="button"
          disabled={!isCorrectChain || pending || !unitsKnown || !needsApprovalB || !isAddress(tokenB)}
          onClick={() => approveToken(tokenB as Address)}
        >
          Approve Token B
        </button>
      </div>

      <button type="button" disabled={!isCorrectChain || pending || !unitsKnown || needsApprovalA || needsApprovalB || sameToken} onClick={createPool}>
        Create / Add Liquidity
      </button>

      {status && <TxStatus message={status} />}

      {pairAddressQuery.data && pairAddressQuery.data !== "0x0000000000000000000000000000000000000000" ? (
        <p>
          Pair found: <code translate="no">{pairAddressQuery.data}</code>{" "}
          <Link to={`/pool/${pairAddressQuery.data}`}>Open pool details</Link>
        </p>
      ) : (
        <p>No pair yet for current token pair.</p>
      )}
    </section>
  );
}
