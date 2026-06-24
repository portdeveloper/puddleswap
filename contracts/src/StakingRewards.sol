// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

/// @title StakingRewards
/// @notice Single-pool LP liquidity mining. Stake `stakingToken` (a Uniswap V2 LP token) to earn
///         `rewardsToken`, streamed linearly over `rewardsDuration`. One instance per farmed pool.
/// @dev Synthetix StakingRewards model, adapted to repo conventions (AccessControl, custom errors,
///      SafeERC20, ReentrancyGuard). Rewards are funded by transferring `rewardsToken` to this
///      contract and calling `notifyRewardAmount`; the solvency guard caps the rate to the balance.
contract StakingRewards is AccessControl, ReentrancyGuard {
    using SafeERC20 for IERC20;

    bytes32 public constant OPERATOR_ROLE = keccak256("OPERATOR_ROLE");

    IERC20 public immutable rewardsToken;
    IERC20 public immutable stakingToken;

    uint256 public periodFinish;
    uint256 public rewardRate;
    uint256 public rewardsDuration;
    uint256 public lastUpdateTime;
    uint256 public rewardPerTokenStored;

    mapping(address => uint256) public userRewardPerTokenPaid;
    mapping(address => uint256) public rewards;

    uint256 private _totalSupply;
    mapping(address => uint256) private _balances;

    event Staked(address indexed user, uint256 amount);
    event Withdrawn(address indexed user, uint256 amount);
    event RewardPaid(address indexed user, uint256 reward);
    event RewardAdded(uint256 reward, uint256 periodFinish);
    event RewardsDurationUpdated(uint256 rewardsDuration);
    event Recovered(address indexed token, address indexed to, uint256 amount);

    error ZeroAmount();
    error ZeroAddress();
    error RewardTooHigh();
    error RewardPeriodActive();
    error CannotRecoverStakingToken();

    constructor(address admin_, address rewardsToken_, address stakingToken_, uint256 rewardsDuration_) {
        if (admin_ == address(0) || rewardsToken_ == address(0) || stakingToken_ == address(0)) {
            revert ZeroAddress();
        }
        if (rewardsDuration_ == 0) {
            revert ZeroAmount();
        }

        _grantRole(DEFAULT_ADMIN_ROLE, admin_);
        _grantRole(OPERATOR_ROLE, admin_);

        rewardsToken = IERC20(rewardsToken_);
        stakingToken = IERC20(stakingToken_);
        rewardsDuration = rewardsDuration_;
    }

    // ---------------------------------------------------------------------
    // Views
    // ---------------------------------------------------------------------

    function totalSupply() external view returns (uint256) {
        return _totalSupply;
    }

    function balanceOf(address account) external view returns (uint256) {
        return _balances[account];
    }

    function lastTimeRewardApplicable() public view returns (uint256) {
        return block.timestamp < periodFinish ? block.timestamp : periodFinish;
    }

    function rewardPerToken() public view returns (uint256) {
        if (_totalSupply == 0) {
            return rewardPerTokenStored;
        }
        return rewardPerTokenStored
            + ((lastTimeRewardApplicable() - lastUpdateTime) * rewardRate * 1e18) / _totalSupply;
    }

    function earned(address account) public view returns (uint256) {
        return (_balances[account] * (rewardPerToken() - userRewardPerTokenPaid[account])) / 1e18
            + rewards[account];
    }

    /// @notice Total rewards distributed over the current full reward period (annualize off this).
    function getRewardForDuration() external view returns (uint256) {
        return rewardRate * rewardsDuration;
    }

    // ---------------------------------------------------------------------
    // Staker actions
    // ---------------------------------------------------------------------

    function stake(uint256 amount) external nonReentrant updateReward(msg.sender) {
        if (amount == 0) {
            revert ZeroAmount();
        }
        _totalSupply += amount;
        _balances[msg.sender] += amount;
        stakingToken.safeTransferFrom(msg.sender, address(this), amount);
        emit Staked(msg.sender, amount);
    }

    function withdraw(uint256 amount) public nonReentrant updateReward(msg.sender) {
        if (amount == 0) {
            revert ZeroAmount();
        }
        _totalSupply -= amount;
        _balances[msg.sender] -= amount;
        stakingToken.safeTransfer(msg.sender, amount);
        emit Withdrawn(msg.sender, amount);
    }

    function getReward() public nonReentrant updateReward(msg.sender) {
        uint256 reward = rewards[msg.sender];
        if (reward > 0) {
            rewards[msg.sender] = 0;
            rewardsToken.safeTransfer(msg.sender, reward);
            emit RewardPaid(msg.sender, reward);
        }
    }

    /// @notice Withdraw the full stake and claim accrued rewards in one transaction.
    function exit() external {
        withdraw(_balances[msg.sender]);
        getReward();
    }

    // ---------------------------------------------------------------------
    // Admin
    // ---------------------------------------------------------------------

    /// @notice Start (or extend) a reward period. Reward tokens must already be held by this
    ///         contract; the solvency guard caps `rewardRate` to the available balance.
    function notifyRewardAmount(uint256 reward) external onlyRole(OPERATOR_ROLE) updateReward(address(0)) {
        if (block.timestamp >= periodFinish) {
            rewardRate = reward / rewardsDuration;
        } else {
            uint256 remaining = periodFinish - block.timestamp;
            uint256 leftover = remaining * rewardRate;
            rewardRate = (reward + leftover) / rewardsDuration;
        }

        uint256 balance = rewardsToken.balanceOf(address(this));
        if (rewardRate > balance / rewardsDuration) {
            revert RewardTooHigh();
        }

        lastUpdateTime = block.timestamp;
        periodFinish = block.timestamp + rewardsDuration;
        emit RewardAdded(reward, periodFinish);
    }

    /// @notice Change the streaming window. Only allowed once the current period has ended.
    function setRewardsDuration(uint256 rewardsDuration_) external onlyRole(DEFAULT_ADMIN_ROLE) {
        if (block.timestamp < periodFinish) {
            revert RewardPeriodActive();
        }
        if (rewardsDuration_ == 0) {
            revert ZeroAmount();
        }
        rewardsDuration = rewardsDuration_;
        emit RewardsDurationUpdated(rewardsDuration_);
    }

    /// @notice Rescue tokens accidentally sent here. The staking token can never be pulled out,
    ///         so stakers' deposits are always safe.
    function recoverERC20(address token, address to, uint256 amount) external onlyRole(DEFAULT_ADMIN_ROLE) {
        if (token == address(stakingToken)) {
            revert CannotRecoverStakingToken();
        }
        if (to == address(0)) {
            revert ZeroAddress();
        }
        IERC20(token).safeTransfer(to, amount);
        emit Recovered(token, to, amount);
    }

    modifier updateReward(address account) {
        rewardPerTokenStored = rewardPerToken();
        lastUpdateTime = lastTimeRewardApplicable();
        if (account != address(0)) {
            rewards[account] = earned(account);
            userRewardPerTokenPaid[account] = rewardPerTokenStored;
        }
        _;
    }
}
