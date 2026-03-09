// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";

interface IMintableERC20 {
    function mint(address to, uint256 amount) external;
}

contract StableFaucet is AccessControl {
    bytes32 public constant OPERATOR_ROLE = keccak256("OPERATOR_ROLE");

    IMintableERC20 public immutable usdc;
    IMintableERC20 public immutable usdt;

    uint256 public claimAmountUSDC;
    uint256 public claimAmountUSDT;
    uint256 public cooldown;
    bool public enabled;

    mapping(address => uint256) public nextClaimAt;

    event Claimed(address indexed user, uint256 usdcAmount, uint256 usdtAmount, uint256 nextClaimTimestamp);
    event FaucetEnabled(bool enabled);
    event CooldownUpdated(uint256 cooldown);
    event ClaimAmountsUpdated(uint256 usdcAmount, uint256 usdtAmount);
    event AdminMint(address indexed operator, address indexed token, address indexed to, uint256 amount);

    error ClaimTooSoon(uint256 nextClaimTimestamp);
    error FaucetDisabled();
    error UnsupportedToken(address token);

    constructor(
        address admin_,
        address usdc_,
        address usdt_,
        uint256 claimAmountUSDC_,
        uint256 claimAmountUSDT_,
        uint256 cooldown_
    ) {
        _grantRole(DEFAULT_ADMIN_ROLE, admin_);
        _grantRole(OPERATOR_ROLE, admin_);

        usdc = IMintableERC20(usdc_);
        usdt = IMintableERC20(usdt_);

        claimAmountUSDC = claimAmountUSDC_;
        claimAmountUSDT = claimAmountUSDT_;
        cooldown = cooldown_;
        enabled = true;
    }

    function claim() external {
        if (!enabled) {
            revert FaucetDisabled();
        }

        uint256 nextClaim = nextClaimAt[msg.sender];
        if (block.timestamp < nextClaim) {
            revert ClaimTooSoon(nextClaim);
        }

        uint256 newNextClaim = block.timestamp + cooldown;
        nextClaimAt[msg.sender] = newNextClaim;

        usdc.mint(msg.sender, claimAmountUSDC);
        usdt.mint(msg.sender, claimAmountUSDT);

        emit Claimed(msg.sender, claimAmountUSDC, claimAmountUSDT, newNextClaim);
    }

    function setEnabled(bool enabled_) external onlyRole(DEFAULT_ADMIN_ROLE) {
        enabled = enabled_;
        emit FaucetEnabled(enabled_);
    }

    function setCooldown(uint256 cooldown_) external onlyRole(DEFAULT_ADMIN_ROLE) {
        cooldown = cooldown_;
        emit CooldownUpdated(cooldown_);
    }

    function setClaimAmounts(uint256 usdcAmount_, uint256 usdtAmount_) external onlyRole(DEFAULT_ADMIN_ROLE) {
        claimAmountUSDC = usdcAmount_;
        claimAmountUSDT = usdtAmount_;
        emit ClaimAmountsUpdated(usdcAmount_, usdtAmount_);
    }

    function adminMint(address token, address to, uint256 amount) external onlyRole(OPERATOR_ROLE) {
        if (token != address(usdc) && token != address(usdt)) {
            revert UnsupportedToken(token);
        }

        IMintableERC20(token).mint(to, amount);
        emit AdminMint(msg.sender, token, to, amount);
    }
}
