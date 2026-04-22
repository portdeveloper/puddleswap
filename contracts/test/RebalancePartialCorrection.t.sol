// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {RebalanceCorePools} from "../script/RebalanceCorePools.s.sol";

/// @notice Exposes the internal pure helpers in RebalanceCorePools so we can
///         exercise the partial-correction behavior added in the script.
contract RebalanceHarness is RebalanceCorePools {
    function findStableInToTarget(
        uint256 reserveStable,
        uint256 reserveWmon,
        uint256 targetStablePerWmon,
        uint256 maxInputFractionBps
    ) external pure returns (uint256) {
        return _findStableInToTarget(reserveStable, reserveWmon, targetStablePerWmon, maxInputFractionBps);
    }

    function findWmonInToTarget(
        uint256 reserveStable,
        uint256 reserveWmon,
        uint256 targetStablePerWmon,
        uint256 maxInputFractionBps
    ) external pure returns (uint256) {
        return _findWmonInToTarget(reserveStable, reserveWmon, targetStablePerWmon, maxInputFractionBps);
    }
}

contract RebalancePartialCorrectionTest is Test {
    RebalanceHarness internal harness;

    // Convenience pool: ~500 USDC/WMON (1000 USDC reserve, 2 WMON reserve, 6/18 decimals)
    uint256 internal constant RESERVE_STABLE = 1_000 * 1e6;
    uint256 internal constant RESERVE_WMON = 2 * 1e18;

    function setUp() public {
        harness = new RebalanceHarness();
    }

    // ---- _findStableInToTarget ----

    /// Target reachable inside cap returns a non-zero amount under the cap.
    function test_findStableInToTarget_withinCap() public {
        uint256 cap = (RESERVE_STABLE * 5_000) / 10_000;
        uint256 amountIn = harness.findStableInToTarget(
            RESERVE_STABLE,
            RESERVE_WMON,
            600 * 1e6, // target 600 USDC/WMON, modest move from 500
            5_000 // 50% cap
        );
        assertGt(amountIn, 0, "expected non-zero stable amount");
        assertLe(amountIn, cap, "must respect cap");
    }

    /// When the cap can't reach target, returns the cap (partial correction).
    /// Pre-fix this returned 0 (no action), starving the rebalancer.
    function test_findStableInToTarget_beyondCap_returnsCap() public {
        uint256 cap = (RESERVE_STABLE * 100) / 10_000; // 1% cap
        uint256 amountIn = harness.findStableInToTarget(
            RESERVE_STABLE,
            RESERVE_WMON,
            10_000 * 1e6, // target 10000 USDC/WMON, far beyond reachable in one step
            100 // 1% cap
        );
        assertEq(amountIn, cap, "expected fallback to cap, not zero");
    }

    /// Zero cap means nothing can be done.
    function test_findStableInToTarget_zeroCap() public {
        uint256 amountIn = harness.findStableInToTarget(RESERVE_STABLE, RESERVE_WMON, 600 * 1e6, 0);
        assertEq(amountIn, 0);
    }

    // ---- _findWmonInToTarget ----

    function test_findWmonInToTarget_withinCap() public {
        uint256 cap = (RESERVE_WMON * 5_000) / 10_000;
        uint256 amountIn = harness.findWmonInToTarget(
            RESERVE_STABLE,
            RESERVE_WMON,
            400 * 1e6, // target 400 USDC/WMON, modest drop from 500
            5_000
        );
        assertGt(amountIn, 0, "expected non-zero wmon amount");
        assertLe(amountIn, cap, "must respect cap");
    }

    /// The exact case that bit us on USDT/WMON: target is ~halving, cap is small.
    /// Pre-fix returned 0; post-fix returns the cap so the pool converges across cycles.
    function test_findWmonInToTarget_beyondCap_returnsCap() public {
        uint256 cap = (RESERVE_WMON * 500) / 10_000; // 5% cap
        uint256 amountIn = harness.findWmonInToTarget(
            RESERVE_STABLE,
            RESERVE_WMON,
            30_000, // target 0.03 USDC/WMON, huge swing from 500
            500 // 5% cap
        );
        assertEq(amountIn, cap, "expected fallback to cap, not zero");
    }

    function test_findWmonInToTarget_zeroCap() public {
        uint256 amountIn = harness.findWmonInToTarget(RESERVE_STABLE, RESERVE_WMON, 400 * 1e6, 0);
        assertEq(amountIn, 0);
    }
}
