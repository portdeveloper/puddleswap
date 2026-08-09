// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";

import {RebalanceCorePools} from "../script/RebalanceCorePools.s.sol";
import {TestUSDC} from "../src/TestUSDC.sol";
import {WMON} from "../src/WMON.sol";

/// @dev The vendored periphery derives pair addresses from the canonical
///      0x96e8ac... init code hash, while a factory deployed from this repo's
///      build hashes pairs differently. Using a mock factory whose getPair
///      mapping points at the router-derived address keeps the script's
///      factory.getPair() and the router's internal pairFor() in agreement,
///      matching production.
contract MockFactory {
    mapping(address => mapping(address => address)) public getPair;
    address public feeTo;

    function setPair(address tokenA, address tokenB, address pairAddr) external {
        getPair[tokenA][tokenB] = pairAddr;
        getPair[tokenB][tokenA] = pairAddr;
    }
}

interface IUniswapV2PairLike {
    function initialize(address token0, address token1) external;
    function token0() external view returns (address);
    function getReserves() external view returns (uint112 reserve0, uint112 reserve1, uint32 blockTimestampLast);
    function balanceOf(address owner) external view returns (uint256);
    function totalSupply() external view returns (uint256);
}

interface IUniswapV2Router02Like {
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

    function swapExactTokensForTokens(
        uint256 amountIn,
        uint256 amountOutMin,
        address[] calldata path,
        address to,
        uint256 deadline
    ) external returns (uint256[] memory amounts);
}

/// @notice Drives the skim-and-reseed path against a real local Uniswap V2
///         deployment: the harness contract plays the operator (it holds the
///         LP, tokens, and native balance the script logic spends).
contract SkimHarness is RebalanceCorePools {
    function configure(
        address factoryAddress,
        address routerAddress,
        address wmonToken,
        uint256 targetStablePerWmon,
        uint256 toleranceBps,
        uint256 seedWmonWei,
        uint256 gasBufferWei
    ) external {
        _factoryAddress = factoryAddress;
        _routerAddress = routerAddress;
        _wmonToken = wmonToken;
        _operator = address(this);
        _targetStablePerWmon = targetStablePerWmon;
        _toleranceBps = toleranceBps;
        _seedWmonWei = seedWmonWei;
        _gasBufferWei = gasBufferWei;
    }

    function skimAndReseed(address stableToken) external {
        _ensureApproval(stableToken);
        _ensureWmonApproval(_wmonToken);
        _skimAndReseed(stableToken);
    }

    receive() external payable {}
}

contract RebalanceSkimReseedTest is Test {
    uint256 internal constant TARGET = 30_000; // 0.03 USDC per WMON
    uint256 internal constant TOLERANCE_BPS = 500; // 5%
    uint256 internal constant SEED_WMON = 1_000e18;
    uint256 internal constant GAS_BUFFER = 5e18;

    // Production-like pool: 0.03 price, deep-ish WMON side.
    uint256 internal constant POOL_WMON = 20_000e18;
    uint256 internal constant POOL_STABLE = 600e6;

    bytes32 internal constant PAIR_INIT_CODE_HASH =
        0x96e8ac4277198ff8b6f785478aa9a39f403cb768dd02cbee326c3e7da348845f;

    MockFactory internal factory;
    IUniswapV2Router02Like internal router;
    WMON internal wmon;
    TestUSDC internal usdc;
    SkimHarness internal harness;
    address internal pair;
    address internal bot = makeAddr("bot");

    function setUp() external {
        wmon = new WMON();
        usdc = new TestUSDC(address(this));
        factory = new MockFactory();
        router = IUniswapV2Router02Like(
            deployCode("UniswapV2Router02.sol:UniswapV2Router02", abi.encode(address(factory), address(wmon)))
        );

        // Place real v2-core pair code at the address the router computes.
        (address token0, address token1) = address(usdc) < address(wmon)
            ? (address(usdc), address(wmon))
            : (address(wmon), address(usdc));
        pair = address(
            uint160(
                uint256(
                    keccak256(
                        abi.encodePacked(
                            hex"ff",
                            address(factory),
                            keccak256(abi.encodePacked(token0, token1)),
                            PAIR_INIT_CODE_HASH
                        )
                    )
                )
            )
        );
        vm.prank(address(factory));
        deployCodeTo("UniswapV2Pair.sol:UniswapV2Pair", pair);
        vm.prank(address(factory));
        IUniswapV2PairLike(pair).initialize(token0, token1);
        factory.setPair(address(usdc), address(wmon), pair);

        harness = new SkimHarness();
        harness.configure(
            address(factory), address(router), address(wmon), TARGET, TOLERANCE_BPS, SEED_WMON, GAS_BUFFER
        );

        // The harness (operator) seeds the pool and holds ~all LP, like prod.
        deal(address(harness), POOL_WMON + GAS_BUFFER);
        vm.startPrank(address(harness));
        wmon.deposit{ value: POOL_WMON }();
        wmon.approve(address(router), type(uint256).max);
        vm.stopPrank();
        usdc.mint(address(harness), POOL_STABLE);
        vm.prank(address(harness));
        usdc.approve(address(router), type(uint256).max);
        vm.prank(address(harness));
        router.addLiquidity(
            address(usdc),
            address(wmon),
            POOL_STABLE,
            POOL_WMON,
            0,
            0,
            address(harness),
            block.timestamp + 1 hours
        );
    }

    function _botBuys(uint256 stableIn) internal {
        usdc.mint(bot, stableIn);
        vm.startPrank(bot);
        usdc.approve(address(router), stableIn);
        address[] memory path = new address[](2);
        path[0] = address(usdc);
        path[1] = address(wmon);
        router.swapExactTokensForTokens(stableIn, 1, path, bot, block.timestamp + 1 hours);
        vm.stopPrank();
    }

    function _price() internal view returns (uint256) {
        (uint112 r0, uint112 r1,) = IUniswapV2PairLike(pair).getReserves();
        (uint256 rStable, uint256 rWmon) = IUniswapV2PairLike(pair).token0() == address(usdc)
            ? (uint256(r0), uint256(r1))
            : (uint256(r1), uint256(r0));
        return (rStable * 1e18) / rWmon;
    }

    function _wmonReserve() internal view returns (uint256) {
        (uint112 r0, uint112 r1,) = IUniswapV2PairLike(pair).getReserves();
        return IUniswapV2PairLike(pair).token0() == address(wmon) ? uint256(r0) : uint256(r1);
    }

    /// A bot pump is harvested: the operator pockets the bot's stable payment,
    /// the price returns to target, and only ~a seed of WMON goes back in.
    function test_skimHarvestsPumpAndReseedsAtTarget() external {
        _botBuys(500e6);
        assertGt(_price(), (TARGET * (10_000 + TOLERANCE_BPS)) / 10_000, "pump must leave tolerance");

        uint256 stableBefore = usdc.balanceOf(address(harness));
        harness.skimAndReseed(address(usdc));

        // Price restored to within tolerance of target.
        assertApproxEqRel(_price(), TARGET, 0.05e18, "price must return to target");

        // Pool depth is now bounded by the seed, not the old 20k reserve.
        assertLe(_wmonReserve(), (SEED_WMON * 110) / 100, "reseeded pool must be shallow");
        assertGt(_wmonReserve(), (SEED_WMON * 90) / 100, "reseed must actually land");

        // The operator captured most of the bot's 500 USDC: it recovered the
        // pool's stable side and only re-deposited ~30 USDC of seed.
        uint256 stableAfter = usdc.balanceOf(address(harness));
        uint256 seedStable = (SEED_WMON * TARGET) / 1e18; // 30e6
        assertGt(
            stableAfter,
            stableBefore + 500e6 + POOL_STABLE - seedStable - 60e6,
            "operator must pocket the bot's payment"
        );
    }

    /// Within tolerance the script must not touch the pool.
    function test_withinToleranceNoAction() external {
        uint256 lpBefore = IUniswapV2PairLike(pair).balanceOf(address(harness));
        (uint112 r0Before, uint112 r1Before,) = IUniswapV2PairLike(pair).getReserves();

        harness.skimAndReseed(address(usdc));

        (uint112 r0After, uint112 r1After,) = IUniswapV2PairLike(pair).getReserves();
        assertEq(IUniswapV2PairLike(pair).balanceOf(address(harness)), lpBefore, "LP untouched");
        assertEq(r0After, r0Before, "reserve0 untouched");
        assertEq(r1After, r1Before, "reserve1 untouched");
    }

    /// A dump (someone selling WMON into the pool) is skimmed symmetrically:
    /// the operator recovers the added WMON and the price returns to target.
    function test_skimHandlesDumpBelowTarget() external {
        address seller = makeAddr("seller");
        deal(seller, 30_000e18);
        vm.startPrank(seller);
        wmon.deposit{ value: 30_000e18 }();
        wmon.approve(address(router), type(uint256).max);
        address[] memory path = new address[](2);
        path[0] = address(wmon);
        path[1] = address(usdc);
        router.swapExactTokensForTokens(20_000e18, 1, path, seller, block.timestamp + 1 hours);
        vm.stopPrank();
        assertLt(_price(), (TARGET * (10_000 - TOLERANCE_BPS)) / 10_000, "dump must leave tolerance");

        uint256 wmonBefore = wmon.balanceOf(address(harness)) + address(harness).balance;
        harness.skimAndReseed(address(usdc));

        assertApproxEqRel(_price(), TARGET, 0.05e18, "price must return to target");
        assertGt(
            wmon.balanceOf(address(harness)) + address(harness).balance,
            wmonBefore + 30_000e18,
            "operator must pocket the dumped WMON"
        );
    }

    /// With an outside LP holding a few percent of the pool (like prod), the
    /// post-skim remnant is too large to fix by donation — the script must
    /// swap it back to target instead of gifting WMON to the other LP, then
    /// reseed on top.
    function test_outsideLpRemnantFixedBySwapNotDonation() external {
        address otherLp = makeAddr("otherLp");
        uint256 lpWmon = (POOL_WMON * 3) / 100;
        uint256 lpStable = (POOL_STABLE * 3) / 100;
        deal(otherLp, lpWmon);
        usdc.mint(otherLp, lpStable);
        vm.startPrank(otherLp);
        wmon.deposit{ value: lpWmon }();
        wmon.approve(address(router), type(uint256).max);
        usdc.approve(address(router), type(uint256).max);
        router.addLiquidity(
            address(usdc), address(wmon), lpStable, lpWmon, 0, 0, otherLp, block.timestamp + 1 hours
        );
        vm.stopPrank();

        _botBuys(500e6);

        uint256 otherLpBalance = IUniswapV2PairLike(pair).balanceOf(otherLp);
        harness.skimAndReseed(address(usdc));

        assertApproxEqRel(_price(), TARGET, 0.05e18, "price must return to target");
        assertGt(_wmonReserve(), (SEED_WMON * 90) / 100, "reseed must land");
        assertEq(
            IUniswapV2PairLike(pair).balanceOf(otherLp), otherLpBalance, "outside LP untouched"
        );
    }

    /// When the wallet can't fund a full seed, the reseed scales down instead
    /// of reverting the cycle.
    function test_reseedScalesToAffordableBalance() external {
        _botBuys(500e6);

        // Drain the harness of everything but gas + a sliver of WMON. The skim
        // will recover pool funds, so simulate poverty by using a huge seed.
        harness.configure(
            address(factory), address(router), address(wmon), TARGET, TOLERANCE_BPS, 1_000_000e18, GAS_BUFFER
        );

        harness.skimAndReseed(address(usdc));

        // Cycle completes and the pool is reseeded with what was affordable.
        assertGt(_wmonReserve(), 0, "pool must be reseeded");
        assertApproxEqRel(_price(), TARGET, 0.05e18, "price must return to target");
    }
}
