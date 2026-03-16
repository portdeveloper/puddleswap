// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script} from "forge-std/Script.sol";

interface IERC20Mintable {
    function mint(address to, uint256 amount) external;
    function approve(address spender, uint256 amount) external returns (bool);
}

interface IUniswapV2Router02 {
    function addLiquidity(
        address tokenA,
        address tokenB,
        uint256 amountADesired,
        uint256 amountBDesired,
        uint256 amountAMin,
        uint256 amountBMin,
        address to,
        uint256 deadline
    ) external returns (uint256 amountA, uint256 amountB, uint256 liquidity);
}

interface IWMON {
    function deposit() external payable;
    function approve(address spender, uint256 amount) external returns (bool);
}

contract SeedCorePools is Script {
    function run() external {
        address routerAddress = vm.envAddress("ROUTER_ADDRESS");
        address usdcAddress = vm.envAddress("USDC_ADDRESS");
        address usdtAddress = vm.envAddress("USDT_ADDRESS");
        address wmonAddress = vm.envAddress("WMON_ADDRESS");
        address lpOwner = vm.envAddress("LP_OWNER");

        uint256 usdcAmount = vm.envOr("SEED_USDC_AMOUNT", uint256(2_000_000 * 1e6));
        uint256 usdtAmount = vm.envOr("SEED_USDT_AMOUNT", uint256(2_000_000 * 1e6));
        uint256 wmonAmount = vm.envOr("SEED_WMON_AMOUNT", uint256(2_000 ether));

        vm.startBroadcast();

        // USDC is a real token — wallet must be pre-funded (no mint)
        IERC20Mintable(usdtAddress).mint(lpOwner, usdtAmount + (usdtAmount / 2));
        IWMON(wmonAddress).deposit{value: wmonAmount}();

        IERC20Mintable(usdcAddress).approve(routerAddress, type(uint256).max);
        IERC20Mintable(usdtAddress).approve(routerAddress, type(uint256).max);
        IWMON(wmonAddress).approve(routerAddress, type(uint256).max);

        IUniswapV2Router02(routerAddress).addLiquidity(
            usdcAddress, usdtAddress, usdcAmount, usdtAmount,
            (usdcAmount * 95) / 100, (usdtAmount * 95) / 100,
            lpOwner, block.timestamp + 1 hours
        );
        IUniswapV2Router02(routerAddress).addLiquidity(
            usdcAddress, wmonAddress, usdcAmount / 2, wmonAmount / 2,
            (usdcAmount / 2 * 95) / 100, (wmonAmount / 2 * 95) / 100,
            lpOwner, block.timestamp + 1 hours
        );
        IUniswapV2Router02(routerAddress).addLiquidity(
            usdtAddress, wmonAddress, usdtAmount / 2, wmonAmount / 2,
            (usdtAmount / 2 * 95) / 100, (wmonAmount / 2 * 95) / 100,
            lpOwner, block.timestamp + 1 hours
        );

        vm.stopBroadcast();
    }
}
