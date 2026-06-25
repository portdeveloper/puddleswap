# Integrating PuddleSwap Staking (LP Farm)

The farm is a standard **Synthetix `StakingRewards`** contract — one instance per pool. Stake a
Uniswap V2 LP token, earn a reward token streamed linearly over `rewardsDuration`. If you've
integrated a Synthetix-style farm before, this is the same interface.

- **Source / ABI (verified):** https://testnet.monadscan.com/address/0xe23B3825F950637256e8DE1BF39743E8f29D97F1
- **Standalone ABI:** [`abi/StakingRewards.json`](./abi/StakingRewards.json) · **Addresses:** [`abi/addresses.json`](./abi/addresses.json)

## Addresses (Monad Testnet — chain `10143`)

| Role | Address |
|---|---|
| StakingRewards (WMON/USDC) | `0xe23B3825F950637256e8DE1BF39743E8f29D97F1` |
| Staking token (WMON/USDC LP pair) | `0x1FBC7b6B54726D735fF1B47Df75535B4B9021902` |
| Reward token (WMON) | `0x97B3070F9Da6C002343862b35E68Bd8e22608943` |
| Router02 | `0x430c23895c8D44883526e3E0B09327dAD8766660` |
| Factory | `0xd498f5beBD0C9f1FE0135a0Cf942dA67Ee6e8A9B` |

RPC: `https://testnet-rpc.monad.xyz`

## Interface

**Reads** (view): `stakingToken() → address`, `rewardsToken() → address`,
`totalSupply() → uint256`, `balanceOf(account) → uint256` (staked), `earned(account) → uint256`
(claimable rewards), `rewardRate() → uint256` (reward tokens/sec), `periodFinish() → uint256`
(unix; rewards active while `now < periodFinish`), `rewardsDuration() → uint256`,
`getRewardForDuration() → uint256` (reward emitted over one full period), `rewardPerToken() → uint256`,
`lastTimeRewardApplicable() → uint256`.

**Writes:** `stake(uint256 amount)` (requires LP `approve` to the farm first), `withdraw(uint256 amount)`,
`getReward()` (claim), `exit()` (withdraw all + claim).

**Events:** `Staked(address indexed user, uint256 amount)`,
`Withdrawn(address indexed user, uint256 amount)`, `RewardPaid(address indexed user, uint256 reward)`,
`RewardAdded(uint256 reward, uint256 periodFinish)` — index `Staked`/`Withdrawn`/`RewardPaid` for a subgraph.

## viem

```ts
import { createPublicClient, createWalletClient, custom, http, parseUnits } from "viem";
import abi from "./abi/StakingRewards.json"; // standalone export
import { erc20Abi } from "viem";

const STAKING = "0xe23B3825F950637256e8DE1BF39743E8f29D97F1";
const LP = "0x1FBC7b6B54726D735fF1B47Df75535B4B9021902";
const rpc = "https://testnet-rpc.monad.xyz";

const pub = createPublicClient({ transport: http(rpc) });

// --- read a user's position ---
const [staked, claimable] = await Promise.all([
  pub.readContract({ address: STAKING, abi, functionName: "balanceOf", args: [user] }),
  pub.readContract({ address: STAKING, abi, functionName: "earned", args: [user] }),
]);

// --- stake (LP tokens are 18 decimals) ---
const wallet = createWalletClient({ transport: custom(window.ethereum) });
const amount = parseUnits("1.0", 18);
await wallet.writeContract({ account, address: LP, abi: erc20Abi, functionName: "approve", args: [STAKING, amount] });
await wallet.writeContract({ account, address: STAKING, abi, functionName: "stake", args: [amount] });

// --- claim / exit ---
await wallet.writeContract({ account, address: STAKING, abi, functionName: "getReward" });
await wallet.writeContract({ account, address: STAKING, abi, functionName: "exit" });
```

## ethers v6

```ts
import { Contract, JsonRpcProvider } from "ethers";
import abi from "./abi/StakingRewards.json";

const farm = new Contract("0xe23B3825F950637256e8DE1BF39743E8f29D97F1", abi,
  new JsonRpcProvider("https://testnet-rpc.monad.xyz"));

const earned = await farm.earned(user);      // claimable rewards
const staked = await farm.balanceOf(user);   // staked LP
// with a signer: await farm.connect(signer).stake(amount) / .getReward() / .exit()
```

## APR (off-chain estimate)

The contract doesn't expose APR — derive it. Annualize emissions and divide by the staked value:

```
annualRewards   = getRewardForDuration() * (31_536_000 / rewardsDuration())   // in reward-token units
stakedValue     = (value of totalSupply() LP, in the same unit as the reward token)
APR (%)         = annualRewards / stakedValue * 100
```

For a reward token that is one side of the LP pair (e.g. WMON in WMON/USDC), the pool is worth
≈ `2 × rewardTokenReserve`, scaled by `totalSupply() / pairTotalSupply`. Reference implementation:
[`web/src/lib/farms.ts → computeFarmApr`](../../web/src/lib/farms.ts). Treat it as an estimate, and
show `0` / "ended" once `now >= periodFinish`.

## Notes

- Getting LP to stake: add liquidity to the WMON/USDC pool via Router02 `addLiquidity`. The
  `StableFaucet` mints a *retired* USDC, **not** the pool's USDC (`0x534b…`) — swap WMON→USDC on the
  router to get the pool's USDC, or use tokens you already hold.
- One contract per pool: to integrate additional farms, read the same interface at each
  `stakingRewards` address listed in [`abi/addresses.json`](./abi/addresses.json).
- Testnet only — no real value.
