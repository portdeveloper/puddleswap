import { useMemo, useState } from "react";
import { Helmet } from "react-helmet-async";
import { parseUnits } from "viem";
import { useAccount, useWriteContract } from "wagmi";

import { TxStatus } from "../components/TxStatus";
import { useChainGuard } from "../hooks/useChainGuard";
import { useFarms, type FarmInfo } from "../hooks/useFarms";
import { contractAbis } from "../lib/contracts";
import { FARMS } from "../lib/farms";

const LP_DECIMALS = 18;

function trim(value: string, decimals = 4): string {
  const num = Number(value);
  if (Number.isNaN(num)) return value;
  if (num === 0) return "0";
  if (num > 0 && num < 0.0001) return "<0.0001";
  return num.toLocaleString(undefined, { maximumFractionDigits: decimals });
}

function txError(error: unknown): string {
  return error instanceof Error && error.message.includes("User rejected")
    ? "Transaction rejected by wallet."
    : "Transaction failed. Please try again.";
}

function FarmCard({ farm, onTx }: { farm: FarmInfo; onTx: () => void }) {
  const { address } = useAccount();
  const { isCorrectChain } = useChainGuard();
  const { writeContractAsync } = useWriteContract();

  const [stakeInput, setStakeInput] = useState("");
  const [unstakeInput, setUnstakeInput] = useState("");
  const [status, setStatus] = useState("");
  const [pending, setPending] = useState(false);

  const parsed = useMemo(() => {
    try {
      return {
        stake: parseUnits(stakeInput || "0", LP_DECIMALS),
        unstake: parseUnits(unstakeInput || "0", LP_DECIMALS)
      };
    } catch {
      return { stake: 0n, unstake: 0n };
    }
  }, [stakeInput, unstakeInput]);

  const needsApproval = parsed.stake > 0n && farm.allowance < parsed.stake;
  const canStake = isCorrectChain && !pending && parsed.stake > 0n && !needsApproval;
  const canUnstake =
    isCorrectChain && !pending && parsed.unstake > 0n && parsed.unstake <= farm.userStaked;
  const canClaim = isCorrectChain && !pending && farm.earned > 0n;

  async function approve() {
    if (!isCorrectChain || parsed.stake === 0n) return;
    setPending(true);
    setStatus("Approving LP…");
    try {
      const hash = await writeContractAsync({
        address: farm.stakingToken,
        abi: contractAbis.erc20,
        functionName: "approve",
        args: [farm.stakingRewards, parsed.stake]
      });
      setStatus(`LP approval sent: ${hash}`);
      onTx();
    } catch (error) {
      console.error("LP approval failed", error);
      setStatus(txError(error));
    } finally {
      setPending(false);
    }
  }

  async function stake() {
    if (!canStake) return;
    setPending(true);
    setStatus("Staking LP…");
    try {
      const hash = await writeContractAsync({
        address: farm.stakingRewards,
        abi: contractAbis.stakingRewards,
        functionName: "stake",
        args: [parsed.stake]
      });
      setStatus(`Stake sent: ${hash}`);
      setStakeInput("");
      onTx();
    } catch (error) {
      console.error("Stake failed", error);
      setStatus(txError(error));
    } finally {
      setPending(false);
    }
  }

  async function unstake() {
    if (!canUnstake) return;
    setPending(true);
    setStatus("Unstaking LP…");
    try {
      const hash = await writeContractAsync({
        address: farm.stakingRewards,
        abi: contractAbis.stakingRewards,
        functionName: "withdraw",
        args: [parsed.unstake]
      });
      setStatus(`Unstake sent: ${hash}`);
      setUnstakeInput("");
      onTx();
    } catch (error) {
      console.error("Unstake failed", error);
      setStatus(txError(error));
    } finally {
      setPending(false);
    }
  }

  async function claim() {
    if (!canClaim) return;
    setPending(true);
    setStatus("Claiming rewards…");
    try {
      const hash = await writeContractAsync({
        address: farm.stakingRewards,
        abi: contractAbis.stakingRewards,
        functionName: "getReward"
      });
      setStatus(`Claim sent: ${hash}`);
      onTx();
    } catch (error) {
      console.error("Claim failed", error);
      setStatus(txError(error));
    } finally {
      setPending(false);
    }
  }

  const muted = { color: "var(--text-muted)" } as const;

  return (
    <div className="card">
      <h3>
        {farm.label} <span style={muted}>· stake LP, earn {farm.rewardSymbol}</span>
      </h3>

      <div className="info-row">
        <span>APR (est.)</span>
        <strong>
          {!farm.rewardsActive || farm.apr === null ? "—" : `${farm.apr.toFixed(2)}%`}
        </strong>
      </div>
      <div className="info-row">
        <span>Rewards</span>
        <span>
          {farm.rewardsActive
            ? `${trim(farm.rewardPerDayFormatted)} ${farm.rewardSymbol} / day`
            : "Not active"}
        </span>
      </div>
      <div className="info-row">
        <span>Total staked</span>
        <span>{trim(farm.totalStakedFormatted)} LP</span>
      </div>
      <div className="info-row">
        <span>Your stake</span>
        <span>{trim(farm.userStakedFormatted)} LP</span>
      </div>
      <div className="info-row">
        <span>Pending rewards</span>
        <strong>
          {trim(farm.earnedFormatted)} {farm.rewardSymbol}
        </strong>
      </div>

      <h3>Stake</h3>
      <label>
        LP amount
        <input
          value={stakeInput}
          onChange={(event) => {
            const v = event.target.value;
            if (v === "" || /^\d*\.?\d*$/.test(v)) setStakeInput(v);
          }}
          inputMode="decimal"
          autoComplete="off"
          spellCheck={false}
          placeholder="0.0"
        />
      </label>
      <p style={muted}>
        Wallet LP: {trim(farm.walletLpFormatted)}{" "}
        {address && farm.walletLp > 0n && (
          <button
            type="button"
            style={{
              background: "none",
              border: "none",
              padding: 0,
              font: "inherit",
              color: "inherit",
              textDecoration: "underline",
              cursor: "pointer"
            }}
            onClick={() => setStakeInput(farm.walletLpFormatted)}
          >
            Max
          </button>
        )}
      </p>
      <div className="button-row">
        <button type="button" disabled={!isCorrectChain || pending || !needsApproval} onClick={approve}>
          Approve LP
        </button>
        <button type="button" disabled={!canStake} onClick={stake}>
          Stake
        </button>
      </div>

      <h3>Unstake</h3>
      <label>
        LP amount
        <input
          value={unstakeInput}
          onChange={(event) => {
            const v = event.target.value;
            if (v === "" || /^\d*\.?\d*$/.test(v)) setUnstakeInput(v);
          }}
          inputMode="decimal"
          autoComplete="off"
          spellCheck={false}
          placeholder="0.0"
        />
      </label>
      <p style={muted}>
        Staked: {trim(farm.userStakedFormatted)}{" "}
        {farm.userStaked > 0n && (
          <button
            type="button"
            style={{
              background: "none",
              border: "none",
              padding: 0,
              font: "inherit",
              color: "inherit",
              textDecoration: "underline",
              cursor: "pointer"
            }}
            onClick={() => setUnstakeInput(farm.userStakedFormatted)}
          >
            Max
          </button>
        )}
      </p>
      <div className="button-row">
        <button type="button" disabled={!canUnstake} onClick={unstake}>
          Unstake
        </button>
        <button type="button" disabled={!canClaim} onClick={claim}>
          Claim {farm.rewardSymbol}
        </button>
      </div>

      {status && <TxStatus message={status} />}
    </div>
  );
}

export function FarmPage() {
  const farmsQuery = useFarms();

  return (
    <section
      style={{
        width: "100%",
        maxWidth: 520,
        margin: "0 auto",
        display: "flex",
        flexDirection: "column",
        gap: 20
      }}
    >
      <Helmet>
        <title>Farm · Liquidity Mining · Monad Testnet · PuddleSwap</title>
        <meta
          name="description"
          content="Stake your PuddleSwap LP tokens on Monad Testnet to earn rewards."
        />
        <link rel="canonical" href="https://app.puddleswap.org/farm" />
        <meta property="og:url" content="https://app.puddleswap.org/farm" />
        <meta property="og:title" content="Farm · Liquidity Mining · PuddleSwap" />
        <meta
          property="og:description"
          content="Stake your PuddleSwap LP tokens on Monad Testnet to earn rewards."
        />
      </Helmet>

      <div style={{ textAlign: "center" }}>
        <p className="section-label">~ liquidity mining ~</p>
        <h1 className="pools-page-title">Farm</h1>
        <p className="pools-page-subtitle">
          Stake your LP tokens to earn rewards while they keep earning swap fees.
        </p>
      </div>

      {FARMS.length === 0 && (
        <div className="card" role="status">
          <p style={{ color: "var(--text-muted)" }}>
            No farms are live yet. Check back once liquidity mining is deployed.
          </p>
        </div>
      )}

      {FARMS.length > 0 && farmsQuery.isLoading && (
        <div className="card" role="status">
          <p style={{ color: "var(--text-muted)" }}>Loading farms…</p>
        </div>
      )}

      {FARMS.length > 0 && farmsQuery.isError && (
        <div className="card" role="alert">
          <p style={{ color: "var(--text-muted)" }}>Failed to load farms.</p>
        </div>
      )}

      {farmsQuery.data?.map((farm) => (
        <FarmCard key={farm.stakingRewards} farm={farm} onTx={() => void farmsQuery.refetch()} />
      ))}
    </section>
  );
}
