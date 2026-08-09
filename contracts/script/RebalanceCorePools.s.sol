// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script} from "forge-std/Script.sol";
import {console2} from "forge-std/console2.sol";

interface IERC20Mintable {
    function mint(address to, uint256 amount) external;
    function approve(address spender, uint256 amount) external returns (bool);
    function transfer(address to, uint256 amount) external returns (bool);
    function balanceOf(address owner) external view returns (uint256);
    function allowance(address owner, address spender) external view returns (uint256);
}

interface IWMON {
    function deposit() external payable;
    function approve(address spender, uint256 amount) external returns (bool);
    function transfer(address to, uint256 amount) external returns (bool);
    function balanceOf(address owner) external view returns (uint256);
    function allowance(address owner, address spender) external view returns (uint256);
}

interface IUniswapV2Factory {
    function getPair(address tokenA, address tokenB) external view returns (address pair);
}

interface IUniswapV2Pair {
    function token0() external view returns (address);
    function getReserves() external view returns (uint112 reserve0, uint112 reserve1, uint32 blockTimestampLast);
    function balanceOf(address owner) external view returns (uint256);
    function totalSupply() external view returns (uint256);
    function approve(address spender, uint256 amount) external returns (bool);
    function allowance(address owner, address spender) external view returns (uint256);
    function sync() external;
}

interface IUniswapV2Router02 {
    function swapExactTokensForTokens(
        uint256 amountIn,
        uint256 amountOutMin,
        address[] calldata path,
        address to,
        uint256 deadline
    ) external returns (uint256[] memory amounts);

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

    function removeLiquidity(
        address tokenA,
        address tokenB,
        uint256 liquidity,
        uint256 amountAMin,
        uint256 amountBMin,
        address to,
        uint256 deadline
    ) external returns (uint256 amountA, uint256 amountB);
}

/// @notice Skim-and-reseed rebalancer. Instead of trading the pool back to
///         target (which sells WMON inventory down the price curve to whoever
///         moved it), an out-of-tolerance pool is harvested: the operator's
///         entire LP position is withdrawn (pocketing whatever the counterparty
///         paid in), the remnant is set back to the target price by donating
///         the missing side directly to the pair and calling sync(), and a
///         small fixed seed is re-added at the target ratio. Inventory lost
///         per cycle is bounded by the seed size, not by pool depth. Donations
///         land in a pool the operator owns ~all of, so they are recovered at
///         the next skim.
contract RebalanceCorePools is Script {
    uint256 private constant FEE_NUMERATOR = 997;
    uint256 private constant FEE_DENOMINATOR = 1000;
    // A remnant nudge swap may need inputs well above the remnant reserve
    // (input = reserve * (sqrt(drift) - 1)); allow up to 100x.
    uint256 private constant REMNANT_INPUT_CAP_BPS = 1_000_000;

    address internal _factoryAddress;
    address internal _routerAddress;
    address internal _operator;
    address internal _wmonToken;
    uint256 internal _targetStablePerWmon;
    uint256 internal _toleranceBps;
    uint256 internal _seedWmonWei;
    uint256 internal _gasBufferWei;

    function run() external {
        _factoryAddress = vm.envAddress("FACTORY_ADDRESS");
        _routerAddress = vm.envAddress("ROUTER_ADDRESS");
        address usdcAddress = vm.envAddress("USDC_ADDRESS");
        address usdtAddress = vm.envAddress("USDT_ADDRESS");
        _wmonToken = vm.envAddress("WMON_ADDRESS");
        _operator = vm.envAddress("OPERATOR_ADDRESS");

        _targetStablePerWmon = vm.envOr("TARGET_STABLE_PER_WMON", uint256(30_000)); // 0.03 stable/WMON
        _toleranceBps = vm.envOr("TARGET_TOLERANCE_BPS", uint256(500)); // 5%
        _seedWmonWei = vm.envOr("SEED_WMON_WEI", uint256(1_000 ether)); // WMON re-seeded per skim
        _gasBufferWei = vm.envOr("GAS_BUFFER_WEI", uint256(5 ether)); // native MON kept back for gas

        vm.startBroadcast();

        _ensureApproval(usdcAddress);
        _ensureApproval(usdtAddress);
        _ensureWmonApproval(_wmonToken);

        _skimAndReseed(usdcAddress);
        _skimAndReseed(usdtAddress);

        vm.stopBroadcast();
    }

    function _skimAndReseed(address stableToken) internal {
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

        if (currentPrice >= lowerBound && currentPrice <= upperBound) {
            console2.log("within tolerance, no action");
            return;
        }

        // 1) Skim: withdraw the operator's entire LP position. This pockets
        //    whatever the counterparty paid into the pool without trading.
        uint256 lpBalance = IUniswapV2Pair(pair).balanceOf(_operator);
        if (lpBalance > 0) {
            _ensureLpApproval(pair);
            uint256 totalSupply = IUniswapV2Pair(pair).totalSupply();
            uint256 minStable = (reserveStable * lpBalance / totalSupply) * 99 / 100;
            uint256 minWmon = (reserveWmon * lpBalance / totalSupply) * 99 / 100;
            (uint256 outStable, uint256 outWmon) = IUniswapV2Router02(_routerAddress).removeLiquidity(
                stableToken, _wmonToken, lpBalance, minStable, minWmon, _operator, block.timestamp + 1 hours
            );
            console2.log("skim: removed stable", outStable);
            console2.log("skim: removed wmon", outWmon);
        } else {
            console2.log("skim: no lp position, reseed only");
        }

        // 2) Fix the remnant: it keeps the skewed price after the burn; donate
        //    the missing side and sync() so it sits exactly on target.
        if (!_fixRemnantPrice(pair, stableToken)) {
            return;
        }

        // 3) Reseed: add a small fixed-size position at the target ratio.
        _reseed(stableToken);
    }

    /// @dev Sets the remnant pool's price to target. Cheap imbalances (dust
    ///      remnants) are fixed by donating the deficient token and calling
    ///      sync(); donations above the cap would gift value to the remnant's
    ///      other LP owners, so larger imbalances are corrected with a swap
    ///      instead (cost is slippage on the small remnant, and the output
    ///      comes back to the operator). After a swap, any residual is
    ///      donation-sized by construction.
    function _fixRemnantPrice(address pair, address stableToken) internal returns (bool) {
        // Donation caps: a small fraction of the seed. Anything cheaper than
        // this is not worth a swap's fee/slippage; anything above it goes the
        // swap route.
        uint256 capWmon = _seedWmonWei / 10;
        uint256 capStable = (capWmon * _targetStablePerWmon) / 1e18;

        (uint256 reserveStable, uint256 reserveWmon) = _reservesFor(pair, stableToken, _wmonToken);
        if (reserveStable > 0 && reserveWmon > 0) {
            uint256 currentPrice = _stablePerWmonPrice(reserveStable, reserveWmon);
            if (currentPrice > _targetStablePerWmon) {
                uint256 needWmon = (reserveStable * 1e18) / _targetStablePerWmon - reserveWmon;
                if (needWmon > capWmon) {
                    uint256 wmonIn =
                        _findWmonInToTarget(reserveStable, reserveWmon, _targetStablePerWmon, REMNANT_INPUT_CAP_BPS);
                    uint256 affordable = IWMON(_wmonToken).balanceOf(_operator) + _spendableNative();
                    if (wmonIn > affordable) wmonIn = affordable;
                    if (wmonIn == 0 || _amountOut(wmonIn, reserveWmon, reserveStable) == 0) {
                        console2.log("remnant: swap fix unaffordable, skip reseed");
                        return false;
                    }
                    _ensureWmonBalance(_wmonToken, _operator, wmonIn);
                    address[] memory path = new address[](2);
                    path[0] = _wmonToken;
                    path[1] = stableToken;
                    IUniswapV2Router02(_routerAddress).swapExactTokensForTokens(
                        wmonIn, 0, path, _operator, block.timestamp + 1 hours
                    );
                    console2.log("remnant: swap wmon->stable", wmonIn);
                }
            } else if (currentPrice < _targetStablePerWmon) {
                uint256 needStable = (reserveWmon * _targetStablePerWmon) / 1e18 - reserveStable;
                if (needStable > capStable) {
                    uint256 stableIn =
                        _findStableInToTarget(reserveStable, reserveWmon, _targetStablePerWmon, REMNANT_INPUT_CAP_BPS);
                    uint256 stableBalance = IERC20Mintable(stableToken).balanceOf(_operator);
                    if (stableIn > stableBalance) stableIn = stableBalance;
                    if (stableIn == 0 || _amountOut(stableIn, reserveStable, reserveWmon) == 0) {
                        console2.log("remnant: swap fix unaffordable, skip reseed");
                        return false;
                    }
                    address[] memory path = new address[](2);
                    path[0] = stableToken;
                    path[1] = _wmonToken;
                    IUniswapV2Router02(_routerAddress).swapExactTokensForTokens(
                        stableIn, 0, path, _operator, block.timestamp + 1 hours
                    );
                    console2.log("remnant: swap stable->wmon", stableIn);
                }
            }
        }

        // Residual (or dust-remnant) imbalance: donate the deficient side.
        uint256 pairStable = IERC20Mintable(stableToken).balanceOf(pair);
        uint256 pairWmon = IWMON(_wmonToken).balanceOf(pair);

        uint256 targetStable = (pairWmon * _targetStablePerWmon) / 1e18;
        if (targetStable >= pairStable) {
            uint256 needStable = targetStable - pairStable;
            if (needStable > capStable || needStable > IERC20Mintable(stableToken).balanceOf(_operator)) {
                console2.log("remnant: stable donation too costly, skip reseed", needStable);
                return false;
            }
            if (needStable > 0) {
                require(IERC20Mintable(stableToken).transfer(pair, needStable), "stable donation failed");
                console2.log("remnant: donated stable", needStable);
            }
        } else {
            uint256 needWmon = (pairStable * 1e18) / _targetStablePerWmon - pairWmon;
            uint256 affordableWmon = IWMON(_wmonToken).balanceOf(_operator) + _spendableNative();
            if (needWmon > capWmon || needWmon > affordableWmon) {
                console2.log("remnant: wmon donation too costly, skip reseed", needWmon);
                return false;
            }
            if (needWmon > 0) {
                _ensureWmonBalance(_wmonToken, _operator, needWmon);
                require(IWMON(_wmonToken).transfer(pair, needWmon), "wmon donation failed");
                console2.log("remnant: donated wmon", needWmon);
            }
        }

        IUniswapV2Pair(pair).sync();
        return true;
    }

    function _findStableInToTarget(
        uint256 reserveStable,
        uint256 reserveWmon,
        uint256 targetStablePerWmon,
        uint256 maxInputFractionBps
    ) internal pure returns (uint256) {
        uint256 cap = (reserveStable * maxInputFractionBps) / 10_000;
        if (cap == 0) {
            return 0;
        }

        // If even the max allowed input can't push price up to target, take a partial correction at cap.
        if (_priceAfterStableIn(reserveStable, reserveWmon, cap) < targetStablePerWmon) {
            return cap;
        }

        uint256 lo = 0;
        uint256 hi = cap;
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
        if (candidate > cap) {
            return cap;
        }
        return candidate;
    }

    function _findWmonInToTarget(
        uint256 reserveStable,
        uint256 reserveWmon,
        uint256 targetStablePerWmon,
        uint256 maxInputFractionBps
    ) internal pure returns (uint256) {
        uint256 cap = (reserveWmon * maxInputFractionBps) / 10_000;
        if (cap == 0) {
            return 0;
        }

        // If even the max allowed input can't push price down to target, take a partial correction at cap.
        if (_priceAfterWmonIn(reserveStable, reserveWmon, cap) > targetStablePerWmon) {
            return cap;
        }

        uint256 lo = 0;
        uint256 hi = cap;
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
        if (candidate > cap) {
            return cap;
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



    function _reseed(address stableToken) internal {
        uint256 seedWmon = _seedWmonWei;
        uint256 seedStable = (seedWmon * _targetStablePerWmon) / 1e18;

        // Scale the seed down to what the wallet can actually fund, keeping
        // the target ratio, instead of reverting the cycle.
        uint256 affordableWmon = IWMON(_wmonToken).balanceOf(_operator) + _spendableNative();
        if (seedWmon > affordableWmon) {
            seedWmon = affordableWmon;
            seedStable = (seedWmon * _targetStablePerWmon) / 1e18;
            console2.log("reseed: wmon capped to affordable", seedWmon);
        }
        uint256 stableBalance = IERC20Mintable(stableToken).balanceOf(_operator);
        if (seedStable > stableBalance) {
            seedStable = stableBalance;
            seedWmon = (seedStable * 1e18) / _targetStablePerWmon;
            console2.log("reseed: stable capped to balance", seedStable);
        }
        if (seedWmon == 0 || seedStable == 0) {
            console2.log("reseed: skipped - pre-fund operator wallet");
            return;
        }

        _ensureWmonBalance(_wmonToken, _operator, seedWmon);
        // The nudge lands close to but not exactly on target; allow the router
        // to trim either side by up to 10% to match the remnant ratio.
        IUniswapV2Router02(_routerAddress).addLiquidity(
            stableToken,
            _wmonToken,
            seedStable,
            seedWmon,
            (seedStable * 90) / 100,
            (seedWmon * 90) / 100,
            _operator,
            block.timestamp + 1 hours
        );
        console2.log("reseed: wmon added", seedWmon);
        console2.log("reseed: stable added", seedStable);
    }

    function _spendableNative() internal view returns (uint256) {
        uint256 nativeBalance = _operator.balance;
        return nativeBalance > _gasBufferWei ? nativeBalance - _gasBufferWei : 0;
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

    function _ensureLpApproval(address pair) internal {
        uint256 current = IUniswapV2Pair(pair).allowance(_operator, _routerAddress);
        if (current < type(uint256).max / 2) {
            IUniswapV2Pair(pair).approve(_routerAddress, type(uint256).max);
        }
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
