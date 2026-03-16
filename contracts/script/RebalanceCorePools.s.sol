// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script} from "forge-std/Script.sol";
import {console2} from "forge-std/console2.sol";

interface IERC20Mintable {
    function mint(address to, uint256 amount) external;
    function approve(address spender, uint256 amount) external returns (bool);
    function balanceOf(address owner) external view returns (uint256);
    function allowance(address owner, address spender) external view returns (uint256);
}

interface IWMON {
    function deposit() external payable;
    function approve(address spender, uint256 amount) external returns (bool);
    function balanceOf(address owner) external view returns (uint256);
    function allowance(address owner, address spender) external view returns (uint256);
}

interface IUniswapV2Factory {
    function getPair(address tokenA, address tokenB) external view returns (address pair);
}

interface IUniswapV2Pair {
    function token0() external view returns (address);
    function getReserves() external view returns (uint112 reserve0, uint112 reserve1, uint32 blockTimestampLast);
}

interface IUniswapV2Router02 {
    function swapExactTokensForTokens(
        uint256 amountIn,
        uint256 amountOutMin,
        address[] calldata path,
        address to,
        uint256 deadline
    ) external returns (uint256[] memory amounts);
}

contract RebalanceCorePools is Script {
    uint256 private constant FEE_NUMERATOR = 997;
    uint256 private constant FEE_DENOMINATOR = 1000;

    address private _factoryAddress;
    address private _routerAddress;
    address private _operator;
    address private _wmonToken;
    uint256 private _targetStablePerWmon;
    uint256 private _toleranceBps;
    uint256 private _maxInputFractionBps;

    function run() external {
        _factoryAddress = vm.envAddress("FACTORY_ADDRESS");
        _routerAddress = vm.envAddress("ROUTER_ADDRESS");
        address usdcAddress = vm.envAddress("USDC_ADDRESS");
        address usdtAddress = vm.envAddress("USDT_ADDRESS");
        _wmonToken = vm.envAddress("WMON_ADDRESS");
        _operator = vm.envAddress("OPERATOR_ADDRESS");

        _targetStablePerWmon = vm.envOr("TARGET_STABLE_PER_WMON", uint256(1000 * 1e6)); // 1000 USDC/USDT
        _toleranceBps = vm.envOr("TARGET_TOLERANCE_BPS", uint256(50)); // 0.50%
        _maxInputFractionBps = vm.envOr("MAX_INPUT_FRACTION_BPS", uint256(5000)); // 50% reserve cap

        vm.startBroadcast();

        _ensureApproval(usdcAddress);
        _ensureApproval(usdtAddress);
        _ensureWmonApproval(_wmonToken);

        _rebalanceStableWmon(usdcAddress);
        _rebalanceStableWmon(usdtAddress);

        vm.stopBroadcast();
    }

    function _rebalanceStableWmon(address stableToken) internal {
        address pair = IUniswapV2Factory(_factoryAddress).getPair(stableToken, _wmonToken);
        require(pair != address(0), "pair not found");

        (uint256 reserveStable, uint256 reserveWmon) = _reservesFor(pair, stableToken, _wmonToken);
        require(reserveStable > 0 && reserveWmon > 0, "empty reserves");

        uint256 currentPrice = _stablePerWmonPrice(reserveStable, reserveWmon);
        uint256 lowerBound = (_targetStablePerWmon * (10_000 - _toleranceBps)) / 10_000;
        uint256 upperBound = (_targetStablePerWmon * (10_000 + _toleranceBps)) / 10_000;

        console2.log("pair", pair);
        console2.log("stable", stableToken);
        console2.log("current price", currentPrice);
        console2.log("target price", _targetStablePerWmon);

        if (currentPrice < lowerBound) {
            uint256 amountStableIn =
                _findStableInToTarget(reserveStable, reserveWmon, _targetStablePerWmon, _maxInputFractionBps);
            if (amountStableIn == 0) {
                console2.log("skip: zero stable in");
                return;
            }

            _ensureStableBalance(stableToken, _operator, amountStableIn);
            uint256 expectedWmonOut = _amountOut(amountStableIn, reserveStable, reserveWmon);
            uint256 minWmonOut = (expectedWmonOut * (10_000 - _toleranceBps)) / 10_000;
            address[] memory path = new address[](2);
            path[0] = stableToken;
            path[1] = _wmonToken;
            IUniswapV2Router02(_routerAddress).swapExactTokensForTokens(
                amountStableIn, minWmonOut, path, _operator, block.timestamp + 1 hours
            );
            console2.log("swap stable->wmon", amountStableIn);
        } else if (currentPrice > upperBound) {
            uint256 amountWmonIn =
                _findWmonInToTarget(reserveStable, reserveWmon, _targetStablePerWmon, _maxInputFractionBps);
            if (amountWmonIn == 0) {
                console2.log("skip: zero wmon in");
                return;
            }

            _ensureWmonBalance(_wmonToken, _operator, amountWmonIn);
            uint256 expectedStableOut = _amountOut(amountWmonIn, reserveWmon, reserveStable);
            uint256 minStableOut = (expectedStableOut * (10_000 - _toleranceBps)) / 10_000;
            address[] memory path = new address[](2);
            path[0] = _wmonToken;
            path[1] = stableToken;
            IUniswapV2Router02(_routerAddress).swapExactTokensForTokens(
                amountWmonIn, minStableOut, path, _operator, block.timestamp + 1 hours
            );
            console2.log("swap wmon->stable", amountWmonIn);
        } else {
            console2.log("within tolerance, no action");
        }
    }

    function _ensureStableBalance(address stableToken, address operator, uint256 requiredAmount) internal view {
        uint256 stableBalance = IERC20Mintable(stableToken).balanceOf(operator);
        require(stableBalance >= requiredAmount, "insufficient stable balance - pre-fund operator wallet");
    }

    function _ensureWmonBalance(address wmonToken, address operator, uint256 requiredAmount) internal {
        uint256 wmonBalance = IWMON(wmonToken).balanceOf(operator);
        if (wmonBalance < requiredAmount) {
            IWMON(wmonToken).deposit{value: requiredAmount - wmonBalance}();
        }
    }

    function _ensureApproval(address token) internal {
        uint256 current = IERC20Mintable(token).allowance(_operator, _routerAddress);
        if (current < type(uint256).max / 2) {
            IERC20Mintable(token).approve(_routerAddress, type(uint256).max);
        }
    }

    function _ensureWmonApproval(address wmonToken) internal {
        uint256 current = IWMON(wmonToken).allowance(_operator, _routerAddress);
        if (current < type(uint256).max / 2) {
            IWMON(wmonToken).approve(_routerAddress, type(uint256).max);
        }
    }

    function _findStableInToTarget(
        uint256 reserveStable,
        uint256 reserveWmon,
        uint256 targetStablePerWmon,
        uint256 maxInputFractionBps
    ) internal pure returns (uint256) {
        uint256 lo = 0;
        uint256 hi = (reserveStable * maxInputFractionBps) / 10_000;

        if (hi == 0) {
            return 0;
        }

        for (uint256 i = 0; i < 80; i++) {
            uint256 mid = (lo + hi + 1) / 2;
            uint256 priceAfter = _priceAfterStableIn(reserveStable, reserveWmon, mid);
            if (priceAfter < targetStablePerWmon) {
                lo = mid;
            } else {
                hi = mid - 1;
            }
        }

        uint256 candidate = lo + 1;
        if (candidate > (reserveStable * maxInputFractionBps) / 10_000) {
            return 0;
        }
        return candidate;
    }

    function _findWmonInToTarget(
        uint256 reserveStable,
        uint256 reserveWmon,
        uint256 targetStablePerWmon,
        uint256 maxInputFractionBps
    ) internal pure returns (uint256) {
        uint256 lo = 0;
        uint256 hi = (reserveWmon * maxInputFractionBps) / 10_000;

        if (hi == 0) {
            return 0;
        }

        for (uint256 i = 0; i < 80; i++) {
            uint256 mid = (lo + hi + 1) / 2;
            uint256 priceAfter = _priceAfterWmonIn(reserveStable, reserveWmon, mid);
            if (priceAfter > targetStablePerWmon) {
                lo = mid;
            } else {
                hi = mid - 1;
            }
        }

        uint256 candidate = lo + 1;
        if (candidate > (reserveWmon * maxInputFractionBps) / 10_000) {
            return 0;
        }
        return candidate;
    }

    function _stablePerWmonPrice(uint256 reserveStable, uint256 reserveWmon) internal pure returns (uint256) {
        return (reserveStable * 1e18) / reserveWmon;
    }

    function _priceAfterStableIn(uint256 reserveStable, uint256 reserveWmon, uint256 stableIn)
        internal
        pure
        returns (uint256)
    {
        uint256 wmonOut = _amountOut(stableIn, reserveStable, reserveWmon);
        if (wmonOut >= reserveWmon) {
            return type(uint256).max;
        }

        uint256 newReserveStable = reserveStable + stableIn;
        uint256 newReserveWmon = reserveWmon - wmonOut;
        return _stablePerWmonPrice(newReserveStable, newReserveWmon);
    }

    function _priceAfterWmonIn(uint256 reserveStable, uint256 reserveWmon, uint256 wmonIn)
        internal
        pure
        returns (uint256)
    {
        uint256 stableOut = _amountOut(wmonIn, reserveWmon, reserveStable);
        if (stableOut >= reserveStable) {
            return 0;
        }

        uint256 newReserveWmon = reserveWmon + wmonIn;
        uint256 newReserveStable = reserveStable - stableOut;
        return _stablePerWmonPrice(newReserveStable, newReserveWmon);
    }

    function _amountOut(uint256 amountIn, uint256 reserveIn, uint256 reserveOut) internal pure returns (uint256) {
        if (amountIn == 0 || reserveIn == 0 || reserveOut == 0) {
            return 0;
        }

        uint256 amountInWithFee = amountIn * FEE_NUMERATOR;
        return (amountInWithFee * reserveOut) / ((reserveIn * FEE_DENOMINATOR) + amountInWithFee);
    }

    function _reservesFor(address pair, address stableToken, address wmonToken)
        internal
        view
        returns (uint256 reserveStable, uint256 reserveWmon)
    {
        (uint112 reserve0, uint112 reserve1,) = IUniswapV2Pair(pair).getReserves();
        if (IUniswapV2Pair(pair).token0() == stableToken) {
            reserveStable = uint256(reserve0);
            reserveWmon = uint256(reserve1);
        } else {
            require(IUniswapV2Pair(pair).token0() == wmonToken, "unexpected pair token");
            reserveStable = uint256(reserve1);
            reserveWmon = uint256(reserve0);
        }
    }
}
