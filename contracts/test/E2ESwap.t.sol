// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";

import {WMON} from "../src/WMON.sol";
import {TestUSDC} from "../src/TestUSDC.sol";
import {TestUSDT} from "../src/TestUSDT.sol";
import {StableFaucet} from "../src/StableFaucet.sol";
import {TokenRegistry} from "../src/TokenRegistry.sol";
import {OpenRegistrationGate} from "../src/OpenRegistrationGate.sol";

interface IUniswapV2Factory {
    function getPair(address tokenA, address tokenB) external view returns (address pair);
    function allPairsLength() external view returns (uint256);
    function createPair(address tokenA, address tokenB) external returns (address pair);
    function INIT_CODE_PAIR_HASH() external view returns (bytes32);
}

interface IUniswapV2Router02 {
    function factory() external view returns (address);
    function WETH() external view returns (address);

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

    function addLiquidityETH(
        address token,
        uint256 amountTokenDesired,
        uint256 amountTokenMin,
        uint256 amountETHMin,
        address to,
        uint256 deadline
    ) external payable returns (uint256 amountToken, uint256 amountETH, uint256 liquidity);

    function removeLiquidity(
        address tokenA,
        address tokenB,
        uint256 liquidity,
        uint256 amountAMin,
        uint256 amountBMin,
        address to,
        uint256 deadline
    ) external returns (uint256 amountA, uint256 amountB);

    function swapExactTokensForTokens(
        uint256 amountIn,
        uint256 amountOutMin,
        address[] calldata path,
        address to,
        uint256 deadline
    ) external returns (uint256[] memory amounts);

    function swapExactETHForTokens(
        uint256 amountOutMin,
        address[] calldata path,
        address to,
        uint256 deadline
    ) external payable returns (uint256[] memory amounts);

    function swapExactTokensForETH(
        uint256 amountIn,
        uint256 amountOutMin,
        address[] calldata path,
        address to,
        uint256 deadline
    ) external returns (uint256[] memory amounts);

    function getAmountsOut(uint256 amountIn, address[] calldata path)
        external
        view
        returns (uint256[] memory amounts);
}

interface IUniswapV2Pair {
    function token0() external view returns (address);
    function token1() external view returns (address);
    function getReserves() external view returns (uint112, uint112, uint32);
    function totalSupply() external view returns (uint256);
    function balanceOf(address) external view returns (uint256);
    function approve(address, uint256) external returns (bool);
}

/// @notice End-to-end swap tests using Monad testnet fork.
/// Run with: forge test --match-path test/E2ESwap.t.sol --fork-url https://testnet-rpc.monad.xyz -vv
contract E2ESwapTest is Test {
    // Deployed contract addresses on Monad testnet (10143)
    address constant WMON_ADDR = 0xd26963176b2BdFE961c4eC92AD91Be308682a2F2;
    address constant USDC_ADDR = 0x0C184F2EFFdAac1c48bCBF986665AFa19d414f31;
    address constant USDT_ADDR = 0xF28D1a07F3412d2b15A1C546465389975a0C266A;
    address constant FACTORY_ADDR = 0xA00188bEe39D462bdBE8c318FD0dA8d4542f6DBB;
    address constant ROUTER_ADDR = 0xda225241D19039faC3Ec4E2307a4064fE01D0B2f;
    address constant FAUCET_ADDR = 0x4c5E27C3898bDA1B2Aa68fA0937eD89D2a2e4eb7;

    WMON internal wmon = WMON(payable(WMON_ADDR));
    TestUSDC internal usdc = TestUSDC(USDC_ADDR);
    TestUSDT internal usdt = TestUSDT(USDT_ADDR);
    IUniswapV2Factory internal factory = IUniswapV2Factory(FACTORY_ADDR);
    IUniswapV2Router02 internal router = IUniswapV2Router02(ROUTER_ADDR);
    StableFaucet internal faucet = StableFaucet(FAUCET_ADDR);

    address internal alice;
    address internal bob;

    function setUp() external {
        // Create test accounts with ETH
        alice = makeAddr("alice");
        bob = makeAddr("bob");
        vm.deal(alice, 100 ether);
        vm.deal(bob, 100 ether);

        // Mint tokens via faucet (which has MINTER_ROLE)
        // Use the faucet contract as minter since it has the role
        vm.startPrank(FAUCET_ADDR);
        usdc.mint(alice, 50_000 * 1e6);
        usdt.mint(alice, 50_000 * 1e6);
        usdc.mint(bob, 50_000 * 1e6);
        usdt.mint(bob, 50_000 * 1e6);
        vm.stopPrank();
    }

    // ── Direct token-to-token swap ──

    function test_swapExactUSDCForUSDT() external {
        uint256 amountIn = 100 * 1e6;

        vm.startPrank(alice);
        usdc.approve(address(router), amountIn);

        address[] memory path = new address[](2);
        path[0] = USDC_ADDR;
        path[1] = USDT_ADDR;

        uint256[] memory expectedAmounts = router.getAmountsOut(amountIn, path);
        uint256 minOut = (expectedAmounts[1] * 99) / 100;

        uint256 usdtBefore = usdt.balanceOf(alice);
        uint256 usdcBefore = usdc.balanceOf(alice);

        router.swapExactTokensForTokens(amountIn, minOut, path, alice, block.timestamp + 20 minutes);
        vm.stopPrank();

        assertEq(usdc.balanceOf(alice), usdcBefore - amountIn, "USDC not deducted");
        assertGt(usdt.balanceOf(alice), usdtBefore, "USDT not received");
        assertGe(usdt.balanceOf(alice) - usdtBefore, minOut, "Received less than minOut");
    }

    // ── Multi-hop swap (USDC -> WMON -> USDT) ──

    function test_swapMultiHop_USDCtoWMONtoUSDT() external {
        uint256 amountIn = 500 * 1e6;

        vm.startPrank(alice);
        usdc.approve(address(router), amountIn);

        address[] memory path = new address[](3);
        path[0] = USDC_ADDR;
        path[1] = WMON_ADDR;
        path[2] = USDT_ADDR;

        uint256[] memory expectedAmounts = router.getAmountsOut(amountIn, path);
        uint256 minOut = (expectedAmounts[2] * 98) / 100;

        uint256 usdtBefore = usdt.balanceOf(alice);

        router.swapExactTokensForTokens(amountIn, minOut, path, alice, block.timestamp + 20 minutes);
        vm.stopPrank();

        assertGe(usdt.balanceOf(alice) - usdtBefore, minOut, "Multi-hop: received less than minOut");
    }

    // ── Native MON -> token swap (swapExactETHForTokens) ──

    function test_swapExactETHForUSDC() external {
        uint256 amountIn = 1 ether;

        vm.startPrank(alice);

        address[] memory path = new address[](2);
        path[0] = WMON_ADDR;
        path[1] = USDC_ADDR;

        uint256[] memory expectedAmounts = router.getAmountsOut(amountIn, path);
        uint256 minOut = (expectedAmounts[1] * 99) / 100;

        uint256 usdcBefore = usdc.balanceOf(alice);
        uint256 ethBefore = alice.balance;

        router.swapExactETHForTokens{value: amountIn}(minOut, path, alice, block.timestamp + 20 minutes);
        vm.stopPrank();

        assertLt(alice.balance, ethBefore, "ETH not spent");
        assertGe(usdc.balanceOf(alice) - usdcBefore, minOut, "USDC less than minOut");
    }

    // ── Token -> native MON swap (swapExactTokensForETH) ──

    function test_swapExactUSDCForETH() external {
        uint256 amountIn = 500 * 1e6;

        vm.startPrank(alice);
        usdc.approve(address(router), amountIn);

        address[] memory path = new address[](2);
        path[0] = USDC_ADDR;
        path[1] = WMON_ADDR;

        uint256[] memory expectedAmounts = router.getAmountsOut(amountIn, path);
        uint256 minOut = (expectedAmounts[1] * 99) / 100;

        uint256 ethBefore = alice.balance;

        router.swapExactTokensForETH(amountIn, minOut, path, alice, block.timestamp + 20 minutes);
        vm.stopPrank();

        assertGe(alice.balance - ethBefore, minOut, "ETH received less than minOut");
    }

    // ── Add liquidity to existing pool ──

    function test_addLiquidity() external {
        uint256 amountA = 1_000 * 1e6;
        uint256 amountB = 1_000 * 1e6;

        address pair = factory.getPair(USDC_ADDR, USDT_ADDR);
        require(pair != address(0), "USDC/USDT pair must exist");
        uint256 lpBefore = IUniswapV2Pair(pair).balanceOf(alice);

        vm.startPrank(alice);
        usdc.approve(address(router), amountA);
        usdt.approve(address(router), amountB);

        router.addLiquidity(
            USDC_ADDR, USDT_ADDR,
            amountA, amountB,
            (amountA * 98) / 100, (amountB * 98) / 100,
            alice, block.timestamp + 20 minutes
        );
        vm.stopPrank();

        uint256 lpAfter = IUniswapV2Pair(pair).balanceOf(alice);
        assertGt(lpAfter, lpBefore, "No LP tokens received");
    }

    // ── Remove liquidity with slippage protection ──

    function test_removeLiquidity() external {
        // First add liquidity
        uint256 amountA = 2_000 * 1e6;
        uint256 amountB = 2_000 * 1e6;

        vm.startPrank(alice);
        usdc.approve(address(router), amountA);
        usdt.approve(address(router), amountB);

        router.addLiquidity(
            USDC_ADDR, USDT_ADDR,
            amountA, amountB,
            0, 0,
            alice, block.timestamp + 1 hours
        );

        address pair = factory.getPair(USDC_ADDR, USDT_ADDR);
        uint256 lpBalance = IUniswapV2Pair(pair).balanceOf(alice);
        assertGt(lpBalance, 0, "No LP tokens to remove");

        // Calculate expected output with slippage
        uint256 totalSupply = IUniswapV2Pair(pair).totalSupply();
        (uint112 reserve0, uint112 reserve1,) = IUniswapV2Pair(pair).getReserves();
        uint256 expected0 = (lpBalance * uint256(reserve0)) / totalSupply;
        uint256 expected1 = (lpBalance * uint256(reserve1)) / totalSupply;
        uint256 min0 = (expected0 * 98) / 100;
        uint256 min1 = (expected1 * 98) / 100;

        uint256 usdcBefore = usdc.balanceOf(alice);
        uint256 usdtBefore = usdt.balanceOf(alice);

        IUniswapV2Pair(pair).approve(address(router), lpBalance);

        address token0 = IUniswapV2Pair(pair).token0();
        address token1 = IUniswapV2Pair(pair).token1();

        router.removeLiquidity(
            token0, token1,
            lpBalance, min0, min1,
            alice, block.timestamp + 20 minutes
        );
        vm.stopPrank();

        assertEq(IUniswapV2Pair(pair).balanceOf(alice), 0, "LP not fully burned");
        assertGt(usdc.balanceOf(alice) + usdt.balanceOf(alice), usdcBefore + usdtBefore, "No tokens returned");
    }

    // ── Slippage protection enforced ──

    function test_swapRevertsOnExcessiveSlippage() external {
        uint256 amountIn = 100 * 1e6;

        vm.startPrank(alice);
        usdc.approve(address(router), amountIn);

        address[] memory path = new address[](2);
        path[0] = USDC_ADDR;
        path[1] = USDT_ADDR;

        uint256 unreasonableMinOut = amountIn * 2;

        vm.expectRevert();
        router.swapExactTokensForTokens(amountIn, unreasonableMinOut, path, alice, block.timestamp + 20 minutes);
        vm.stopPrank();
    }

    // ── Deadline enforcement ──

    function test_swapRevertsOnExpiredDeadline() external {
        uint256 amountIn = 100 * 1e6;

        vm.startPrank(alice);
        usdc.approve(address(router), amountIn);

        address[] memory path = new address[](2);
        path[0] = USDC_ADDR;
        path[1] = USDT_ADDR;

        vm.expectRevert();
        router.swapExactTokensForTokens(amountIn, 0, path, alice, block.timestamp - 1);
        vm.stopPrank();
    }

    // ── Faucet -> swap full flow (user onboarding) ──

    function test_faucetClaimThenSwap() external {
        address newUser = makeAddr("newUser");
        vm.deal(newUser, 1 ether);

        // Claim from faucet
        vm.prank(newUser);
        faucet.claim();

        assertGt(usdc.balanceOf(newUser), 0, "Faucet did not mint USDC");
        assertGt(usdt.balanceOf(newUser), 0, "Faucet did not mint USDT");

        // Swap claimed USDC for USDT
        uint256 swapAmount = 100 * 1e6;

        vm.startPrank(newUser);
        usdc.approve(address(router), swapAmount);

        address[] memory path = new address[](2);
        path[0] = USDC_ADDR;
        path[1] = USDT_ADDR;

        uint256 usdtBefore = usdt.balanceOf(newUser);
        router.swapExactTokensForTokens(swapAmount, 0, path, newUser, block.timestamp + 20 minutes);
        vm.stopPrank();

        assertGt(usdt.balanceOf(newUser), usdtBefore, "Faucet user swap failed");
    }

    // ── Concurrent swaps from multiple users ──

    function test_concurrentSwaps() external {
        uint256 amountIn = 200 * 1e6;

        address[] memory path = new address[](2);
        path[0] = USDC_ADDR;
        path[1] = USDT_ADDR;

        // Alice swaps
        vm.startPrank(alice);
        usdc.approve(address(router), amountIn);
        uint256 aliceUsdtBefore = usdt.balanceOf(alice);
        router.swapExactTokensForTokens(amountIn, 0, path, alice, block.timestamp + 20 minutes);
        vm.stopPrank();
        uint256 aliceReceived = usdt.balanceOf(alice) - aliceUsdtBefore;

        // Bob swaps same amount — gets slightly less due to price impact from Alice
        vm.startPrank(bob);
        usdc.approve(address(router), amountIn);
        uint256 bobUsdtBefore = usdt.balanceOf(bob);
        router.swapExactTokensForTokens(amountIn, 0, path, bob, block.timestamp + 20 minutes);
        vm.stopPrank();
        uint256 bobReceived = usdt.balanceOf(bob) - bobUsdtBefore;

        assertGt(aliceReceived, 0, "Alice got nothing");
        assertGt(bobReceived, 0, "Bob got nothing");
        // Bob should receive less due to Alice's price impact
        assertGt(aliceReceived, bobReceived, "Price impact not reflected");
    }

    // ── Large swap with significant price impact ──

    function test_largeSwapPriceImpact() external view {
        address[] memory path = new address[](2);
        path[0] = USDC_ADDR;
        path[1] = USDT_ADDR;

        // Small swap for baseline rate
        uint256[] memory smallAmounts = router.getAmountsOut(100 * 1e6, path);
        uint256 smallRate = (smallAmounts[1] * 1e18) / smallAmounts[0];

        // Large swap (significant portion of pool)
        uint256[] memory largeAmounts = router.getAmountsOut(100_000 * 1e6, path);
        uint256 largeRate = (largeAmounts[1] * 1e18) / largeAmounts[0];

        assertGt(smallRate, largeRate, "Large swap should have worse rate");
    }

    // ── Quote accuracy: getAmountsOut matches actual swap ──

    function test_quoteMatchesActualSwap() external {
        uint256 amountIn = 1_000 * 1e6;

        address[] memory path = new address[](2);
        path[0] = USDC_ADDR;
        path[1] = USDT_ADDR;

        uint256[] memory quoted = router.getAmountsOut(amountIn, path);

        vm.startPrank(alice);
        usdc.approve(address(router), amountIn);

        uint256 usdtBefore = usdt.balanceOf(alice);
        router.swapExactTokensForTokens(amountIn, 0, path, alice, block.timestamp + 20 minutes);
        vm.stopPrank();

        uint256 actualOut = usdt.balanceOf(alice) - usdtBefore;
        assertEq(actualOut, quoted[1], "Quote did not match actual swap output");
    }

    // ── Add liquidity with ETH (matching pool ratio) ──

    function test_addLiquidityETH() external {
        address pair = factory.getPair(USDC_ADDR, WMON_ADDR);
        require(pair != address(0), "USDC/WMON pair must exist");

        // Get current reserves to match ratio
        (uint112 r0, uint112 r1,) = IUniswapV2Pair(pair).getReserves();
        address token0 = IUniswapV2Pair(pair).token0();

        uint256 reserveUSDC;
        uint256 reserveWMON;
        if (token0 == USDC_ADDR) {
            reserveUSDC = uint256(r0);
            reserveWMON = uint256(r1);
        } else {
            reserveUSDC = uint256(r1);
            reserveWMON = uint256(r0);
        }

        // Add 1 ETH worth, with USDC proportional to pool ratio
        uint256 ethAmount = 1 ether;
        uint256 tokenAmount = (ethAmount * reserveUSDC) / reserveWMON;
        // Add 5% extra desired to account for rounding, with low minimums
        uint256 tokenDesired = (tokenAmount * 105) / 100;

        vm.startPrank(alice);
        usdc.approve(address(router), tokenDesired);

        uint256 ethBefore = alice.balance;

        router.addLiquidityETH{value: ethAmount}(
            USDC_ADDR,
            tokenDesired,
            1, // low min for test flexibility
            1,
            alice,
            block.timestamp + 20 minutes
        );
        vm.stopPrank();

        assertLt(alice.balance, ethBefore, "ETH not spent");
        assertGt(IUniswapV2Pair(pair).balanceOf(alice), 0, "No LP tokens received");
    }

    // ── Full round trip: swap and swap back ──

    function test_roundTripSwap() external {
        uint256 amountIn = 500 * 1e6;

        vm.startPrank(alice);
        usdc.approve(address(router), type(uint256).max);
        usdt.approve(address(router), type(uint256).max);

        uint256 usdcStart = usdc.balanceOf(alice);

        // USDC -> USDT
        address[] memory pathForward = new address[](2);
        pathForward[0] = USDC_ADDR;
        pathForward[1] = USDT_ADDR;
        uint256[] memory forwardAmounts = router.swapExactTokensForTokens(
            amountIn, 0, pathForward, alice, block.timestamp + 20 minutes
        );

        // USDT -> USDC (swap back)
        address[] memory pathBack = new address[](2);
        pathBack[0] = USDT_ADDR;
        pathBack[1] = USDC_ADDR;
        router.swapExactTokensForTokens(
            forwardAmounts[1], 0, pathBack, alice, block.timestamp + 20 minutes
        );
        vm.stopPrank();

        uint256 usdcEnd = usdc.balanceOf(alice);
        // Should lose some to fees (0.3% each way)
        assertLt(usdcEnd, usdcStart, "Should lose value to fees in round trip");
        // But shouldn't lose more than ~1% (two 0.3% fees)
        assertGt(usdcEnd, (usdcStart * 99) / 100, "Lost too much in round trip");
    }
}
