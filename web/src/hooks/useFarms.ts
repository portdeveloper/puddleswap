import { useQuery } from "@tanstack/react-query";
import { formatUnits, type Address } from "viem";
import { useAccount, usePublicClient } from "wagmi";

import { monadTestnet } from "../config/chain";
import { contractAbis, multicall3Address } from "../lib/contracts";
import { computeFarmApr, FARMS, type FarmConfig } from "../lib/farms";

export interface FarmInfo {
  stakingRewards: Address;
  label: string;
  stakingToken: Address; // LP pair
  rewardsToken: Address;
  rewardSymbol: string;
  rewardDecimals: number;

  // Farm-level
  totalStaked: bigint;
  totalStakedFormatted: string;
  rewardRate: bigint; // per second
  periodFinish: bigint;
  rewardsActive: boolean;
  rewardPerDayFormatted: string;
  apr: number | null;

  // User-level (zeroed when disconnected)
  userStaked: bigint;
  userStakedFormatted: string;
  earned: bigint;
  earnedFormatted: string;
  walletLp: bigint;
  walletLpFormatted: string;
  allowance: bigint;
}

const LP_DECIMALS = 18;
const SECONDS_PER_DAY = 86_400n;

function ok<T>(result: { status: string; result?: unknown } | undefined): T | undefined {
  return result && result.status === "success" ? (result.result as T) : undefined;
}

export function useFarms() {
  const publicClient = usePublicClient({ chainId: monadTestnet.id });
  const { address: userAddress } = useAccount();

  return useQuery({
    queryKey: ["farms", userAddress],
    enabled: Boolean(publicClient) && FARMS.length > 0,
    staleTime: 15_000,
    refetchInterval: 30_000,
    queryFn: async (): Promise<FarmInfo[]> => {
      if (!publicClient || FARMS.length === 0) {
        return [];
      }

      const now = BigInt(Math.floor(Date.now() / 1000));
      const loaded = await Promise.all(FARMS.map((farm) => loadFarm(farm)));

      async function loadFarm(farm: FarmConfig): Promise<FarmInfo | null> {
        const sr = farm.stakingRewards;
        const srAbi = contractAbis.stakingRewards;

        // Stage 1: staking-contract reads. Built as a standalone const so it infers as an array
        // (not a strict tuple), matching the pattern in useAllPools / the stage-2 calls below.
        const stakingCalls = [
          { address: sr, abi: srAbi, functionName: "stakingToken" as const },
          { address: sr, abi: srAbi, functionName: "rewardsToken" as const },
          { address: sr, abi: srAbi, functionName: "totalSupply" as const },
          { address: sr, abi: srAbi, functionName: "rewardRate" as const },
          { address: sr, abi: srAbi, functionName: "periodFinish" as const },
          { address: sr, abi: srAbi, functionName: "rewardsDuration" as const },
          { address: sr, abi: srAbi, functionName: "getRewardForDuration" as const },
          ...(userAddress
            ? [
                { address: sr, abi: srAbi, functionName: "balanceOf" as const, args: [userAddress] as const },
                { address: sr, abi: srAbi, functionName: "earned" as const, args: [userAddress] as const }
              ]
            : [])
        ];
        const s1 = await publicClient!.multicall({
          multicallAddress: multicall3Address,
          contracts: stakingCalls
        });

        const stakingToken = ok<Address>(s1[0]);
        const rewardsToken = ok<Address>(s1[1]);
        if (!stakingToken || !rewardsToken) {
          return null; // contract not reachable / not deployed
        }

        const totalStaked = ok<bigint>(s1[2]) ?? 0n;
        const rewardRate = ok<bigint>(s1[3]) ?? 0n;
        const periodFinish = ok<bigint>(s1[4]) ?? 0n;
        const rewardsDuration = ok<bigint>(s1[5]) ?? 0n;
        const rewardForDuration = ok<bigint>(s1[6]) ?? 0n;
        const userStaked = userAddress ? ok<bigint>(s1[7]) ?? 0n : 0n;
        const earned = userAddress ? ok<bigint>(s1[8]) ?? 0n : 0n;

        // Stage 2: underlying pair + reward-token metadata + user LP wallet/allowance.
        // Split by ABI (pair vs erc20) so each multicall stays single-ABI — viem's tuple
        // inference rejects mixed ABIs in one contracts array.
        const pairCalls = [
          { address: stakingToken, abi: contractAbis.pair, functionName: "token0" as const },
          { address: stakingToken, abi: contractAbis.pair, functionName: "token1" as const },
          { address: stakingToken, abi: contractAbis.pair, functionName: "getReserves" as const },
          { address: stakingToken, abi: contractAbis.pair, functionName: "totalSupply" as const }
        ];
        const erc20Calls = [
          { address: rewardsToken, abi: contractAbis.erc20, functionName: "symbol" as const },
          { address: rewardsToken, abi: contractAbis.erc20, functionName: "decimals" as const },
          ...(userAddress
            ? [
                { address: stakingToken, abi: contractAbis.erc20, functionName: "balanceOf" as const, args: [userAddress] as const },
                { address: stakingToken, abi: contractAbis.erc20, functionName: "allowance" as const, args: [userAddress, farm.stakingRewards] as const }
              ]
            : [])
        ];

        const [pairRes, ercRes] = await Promise.all([
          publicClient!.multicall({ multicallAddress: multicall3Address, contracts: pairCalls }),
          publicClient!.multicall({ multicallAddress: multicall3Address, contracts: erc20Calls })
        ]);

        const token0 = ok<Address>(pairRes[0]);
        const token1 = ok<Address>(pairRes[1]);
        const reserves = ok<readonly [bigint, bigint, number]>(pairRes[2]);
        const pairTotalSupply = ok<bigint>(pairRes[3]) ?? 0n;
        const rewardSymbol = ok<string>(ercRes[0]) ?? "?";
        const rewardDecimals = Number(ok<number>(ercRes[1]) ?? 18);
        const walletLp = userAddress ? ok<bigint>(ercRes[2]) ?? 0n : 0n;
        const allowance = userAddress ? ok<bigint>(ercRes[3]) ?? 0n : 0n;

        // Reward token is one side of the LP pair; pick its reserve for valuation.
        let rewardTokenReserve = 0n;
        if (reserves && token0 && token1) {
          if (token0.toLowerCase() === rewardsToken.toLowerCase()) {
            rewardTokenReserve = reserves[0];
          } else if (token1.toLowerCase() === rewardsToken.toLowerCase()) {
            rewardTokenReserve = reserves[1];
          }
        }

        const apr = computeFarmApr({
          rewardForDuration,
          rewardsDuration,
          periodFinish,
          now,
          totalStaked,
          pairTotalSupply,
          rewardTokenReserve
        });

        return {
          stakingRewards: farm.stakingRewards,
          label: farm.label,
          stakingToken,
          rewardsToken,
          rewardSymbol,
          rewardDecimals,
          totalStaked,
          totalStakedFormatted: formatUnits(totalStaked, LP_DECIMALS),
          rewardRate,
          periodFinish,
          rewardsActive: periodFinish > now,
          rewardPerDayFormatted: formatUnits(rewardRate * SECONDS_PER_DAY, rewardDecimals),
          apr,
          userStaked,
          userStakedFormatted: formatUnits(userStaked, LP_DECIMALS),
          earned,
          earnedFormatted: formatUnits(earned, rewardDecimals),
          walletLp,
          walletLpFormatted: formatUnits(walletLp, LP_DECIMALS),
          allowance
        };
      }

      return loaded.filter((farm): farm is FarmInfo => farm !== null);
    }
  });
}
