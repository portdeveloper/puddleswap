// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";

import {TestStableToken} from "../src/TestStableToken.sol";
import {TestUSDC} from "../src/TestUSDC.sol";
import {TestUSDT} from "../src/TestUSDT.sol";
import {WMON} from "../src/WMON.sol";

interface IUniswapV2Pair {
    function factory() external view returns (address);
    function token0() external view returns (address);
    function token1() external view returns (address);
    function initialize(address token0, address token1) external;
    function getReserves() external view returns (uint112 reserve0, uint112 reserve1, uint32 blockTimestampLast);
    function mint(address to) external returns (uint256 liquidity);
}

interface IUniswapV2Router02 {
    function getAmountsOut(uint256 amountIn, address[] calldata path)
        external
        view
        returns (uint256[] memory amounts);
}

/// @notice Local routing regression on real Uniswap V2 contracts: no fork, no RPC.
///         Every reserve is set explicitly and every amount comes from the deployed
///         router's own getAmountsOut, so the direct-vs-multi-hop comparison is decided
///         by pool depth and price impact rather than by any value the test picks.
contract LowLiquidityRoutingTest is Test {
    /// @dev Init code hash UniswapV2Library.pairFor() derives pool addresses with.
    bytes32 internal constant PAIR_INIT_CODE_HASH =
        0x96e8ac4277198ff8b6f785478aa9a39f403cb768dd02cbee326c3e7da348845f;

    uint256 internal constant AMOUNT_IN = 1_000e6;
    uint256 internal constant DUST_AMOUNT_IN = 1e6;

    uint256 internal constant THIN_STABLE_RESERVE = 5_000e6;
    uint256 internal constant DEEP_STABLE_RESERVE = 5_000_000e6;
    uint256 internal constant DEEP_WMON_RESERVE = 100_000e18;

    address internal factory;
    IUniswapV2Router02 internal router;

    TestUSDC internal usdc;
    TestUSDT internal usdt;
    WMON internal wmon;

    function setUp() external {
        wmon = new WMON();
        usdc = new TestUSDC(address(this));
        usdt = new TestUSDT(address(this));

        factory = deployCode("UniswapV2Factory.sol:UniswapV2Factory", abi.encode(address(this)));
        router = IUniswapV2Router02(
            deployCode("UniswapV2Router02.sol:UniswapV2Router02", abi.encode(factory, address(wmon)))
        );
    }

    /// A thin USDC/USDT pool quotes worse than USDC -> WMON -> USDT through deep pools,
    /// even though the two-hop route pays the 0.3% fee twice.
    function test_multiHopBeatsThinDirectPool() external {
        address directPool =
            _deployAndSeedRouterPair(address(usdc), THIN_STABLE_RESERVE, address(usdt), THIN_STABLE_RESERVE);
        address usdcCorePool =
            _deployAndSeedRouterPair(address(usdc), DEEP_STABLE_RESERVE, address(wmon), DEEP_WMON_RESERVE);
        address usdtCorePool =
            _deployAndSeedRouterPair(address(usdt), DEEP_STABLE_RESERVE, address(wmon), DEEP_WMON_RESERVE);

        assertTrue(directPool != usdcCorePool, "direct and USDC/WMON pools must differ");
        assertTrue(directPool != usdtCorePool, "direct and USDT/WMON pools must differ");
        assertTrue(usdcCorePool != usdtCorePool, "core pools must differ");

        _assertPool(directPool, address(usdc), THIN_STABLE_RESERVE, address(usdt), THIN_STABLE_RESERVE);
        _assertPool(usdcCorePool, address(usdc), DEEP_STABLE_RESERVE, address(wmon), DEEP_WMON_RESERVE);
        _assertPool(usdtCorePool, address(usdt), DEEP_STABLE_RESERVE, address(wmon), DEEP_WMON_RESERVE);

        uint256[] memory directAmounts = router.getAmountsOut(AMOUNT_IN, _directPath());
        uint256[] memory multiHopAmounts = router.getAmountsOut(AMOUNT_IN, _multiHopPath());

        assertEq(directAmounts.length, 2, "direct path must return 2 amounts");
        assertEq(multiHopAmounts.length, 3, "multi-hop path must return 3 amounts");
        assertEq(directAmounts[0], AMOUNT_IN, "direct path must echo the input amount");
        assertEq(multiHopAmounts[0], AMOUNT_IN, "multi-hop path must echo the input amount");

        assertGt(directAmounts[1], 0, "direct route must quote a positive output");
        assertGt(multiHopAmounts[1], 0, "core hop must quote a positive output");
        assertGt(multiHopAmounts[2], 0, "multi-hop route must quote a positive output");
        assertGt(multiHopAmounts[2], directAmounts[1], "multi-hop must beat the thin direct pool");

        // Both routes still lose to fees and impact, so neither number is a free lunch.
        assertLt(directAmounts[1], AMOUNT_IN, "direct route cannot out-quote its own input");
        assertLt(multiHopAmounts[2], AMOUNT_IN, "multi-hop route cannot out-quote its own input");

        // The gap comes from the thin pool's price impact: a dust trade on that same pool
        // gets a materially better rate than the full-size trade the routes compare.
        uint256[] memory dustAmounts = router.getAmountsOut(DUST_AMOUNT_IN, _directPath());
        assertGt(
            _rate(dustAmounts[1], DUST_AMOUNT_IN),
            _rate(directAmounts[1], AMOUNT_IN),
            "thin pool must charge price impact"
        );
    }

    /// Control: same core pools, same amount, deep direct pool. The direct route wins
    /// again, so the comparison tracks reserves rather than the shape of the path.
    function test_deepDirectPoolBeatsMultiHop() external {
        address directPool =
            _deployAndSeedRouterPair(address(usdc), DEEP_STABLE_RESERVE, address(usdt), DEEP_STABLE_RESERVE);
        address usdcCorePool =
            _deployAndSeedRouterPair(address(usdc), DEEP_STABLE_RESERVE, address(wmon), DEEP_WMON_RESERVE);
        address usdtCorePool =
            _deployAndSeedRouterPair(address(usdt), DEEP_STABLE_RESERVE, address(wmon), DEEP_WMON_RESERVE);

        _assertPool(directPool, address(usdc), DEEP_STABLE_RESERVE, address(usdt), DEEP_STABLE_RESERVE);
        _assertPool(usdcCorePool, address(usdc), DEEP_STABLE_RESERVE, address(wmon), DEEP_WMON_RESERVE);
        _assertPool(usdtCorePool, address(usdt), DEEP_STABLE_RESERVE, address(wmon), DEEP_WMON_RESERVE);

        uint256[] memory directAmounts = router.getAmountsOut(AMOUNT_IN, _directPath());
        uint256[] memory multiHopAmounts = router.getAmountsOut(AMOUNT_IN, _multiHopPath());

        assertEq(directAmounts.length, 2, "direct path must return 2 amounts");
        assertEq(multiHopAmounts.length, 3, "multi-hop path must return 3 amounts");
        assertGt(directAmounts[1], multiHopAmounts[2], "deep direct pool must beat the two-hop route");
    }

    // ── Fixtures ──

    /// @dev Deploys real v2-core pair code at the address the router computes for the couple,
    ///      then seeds it with exact reserves by crediting the pair and calling pair.mint().
    ///      The vendored periphery derives that address from the canonical 0x96e8ac... init
    ///      code hash, while the core pair rebuilt here hashes differently under this repo's
    ///      build settings, so a factory.createPair() pool would sit at another address the
    ///      router never reads. This covers router quoting and reserve-driven route ranking;
    ///      it makes no claim about a factory and router deployed from this repo agreeing on
    ///      that hash.
    function _deployAndSeedRouterPair(address tokenA, uint256 reserveA, address tokenB, uint256 reserveB)
        internal
        returns (address pair)
    {
        (address token0, address token1) = _sortTokens(tokenA, tokenB);
        pair = _routerPairFor(token0, token1);

        vm.prank(factory);
        deployCodeTo("UniswapV2Pair.sol:UniswapV2Pair", pair);

        vm.prank(factory);
        IUniswapV2Pair(pair).initialize(token0, token1);

        _sendToPool(pair, tokenA, reserveA);
        _sendToPool(pair, tokenB, reserveB);
        IUniswapV2Pair(pair).mint(address(this));
    }

    function _routerPairFor(address token0, address token1) internal view returns (address) {
        bytes32 salt = keccak256(abi.encodePacked(token0, token1));
        return address(uint160(uint256(keccak256(abi.encodePacked(hex"ff", factory, salt, PAIR_INIT_CODE_HASH)))));
    }

    function _sendToPool(address pool, address token, uint256 amount) internal {
        if (token == address(wmon)) {
            vm.deal(address(this), amount);
            wmon.deposit{value: amount}();
            wmon.transfer(pool, amount);
        } else {
            TestStableToken(token).mint(pool, amount);
        }
    }

    // ── Helpers ──

    function _assertPool(address pool, address tokenA, uint256 reserveA, address tokenB, uint256 reserveB)
        internal
        view
    {
        assertGt(pool.code.length, 0, "pool must be deployed");
        assertEq(IUniswapV2Pair(pool).factory(), factory, "pool must point at the deployed factory");

        (address token0, address token1) = _sortTokens(tokenA, tokenB);
        assertTrue(token0 < token1, "pool tokens must be distinct and sorted");
        assertEq(IUniswapV2Pair(pool).token0(), token0, "unexpected token0");
        assertEq(IUniswapV2Pair(pool).token1(), token1, "unexpected token1");

        (uint256 expected0, uint256 expected1) = tokenA == token0 ? (reserveA, reserveB) : (reserveB, reserveA);
        (uint112 reserve0, uint112 reserve1,) = IUniswapV2Pair(pool).getReserves();
        assertEq(uint256(reserve0), expected0, "unexpected reserve0");
        assertEq(uint256(reserve1), expected1, "unexpected reserve1");
    }

    function _sortTokens(address tokenA, address tokenB) internal pure returns (address, address) {
        return tokenA < tokenB ? (tokenA, tokenB) : (tokenB, tokenA);
    }

    /// @dev Output per unit of input, scaled to 18 decimals, for comparing trade sizes.
    function _rate(uint256 amountOut, uint256 amountIn) internal pure returns (uint256) {
        return (amountOut * 1e18) / amountIn;
    }

    function _directPath() internal view returns (address[] memory path) {
        path = new address[](2);
        path[0] = address(usdc);
        path[1] = address(usdt);
    }

    function _multiHopPath() internal view returns (address[] memory path) {
        path = new address[](3);
        path[0] = address(usdc);
        path[1] = address(wmon);
        path[2] = address(usdt);
    }
}
