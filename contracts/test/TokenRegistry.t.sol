// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";

import {OpenRegistrationGate} from "../src/OpenRegistrationGate.sol";
import {TokenRegistry} from "../src/TokenRegistry.sol";

contract TokenRegistryTest is Test {
    OpenRegistrationGate internal openGate;
    TokenRegistry internal registry;

    address internal admin = address(this);
    address internal verifier = address(0xB0B);
    address internal user = address(0xCAFE);

    function setUp() external {
        openGate = new OpenRegistrationGate(admin, 1 days, 1);
        registry = new TokenRegistry(admin, verifier, address(openGate));
        openGate.grantRole(openGate.REGISTRY_ROLE(), address(registry));
    }

    function test_RegisterBasic_ConsumesGateAllowance() external {
        address basicToken = address(0x1001);

        vm.prank(user);
        registry.registerBasic(basicToken, "tst", "Test Token", 18);

        assertEq(openGate.activeRegistrations(user), 1);

        vm.expectRevert();
        vm.prank(user);
        registry.registerBasic(address(0x1002), "TST2", "Test Token 2", 18);
    }

    function test_Search_SortsByLevelThenSymbolAndLimit() external {
        vm.startPrank(verifier);

        registry.registerVerified(address(0x1), "USDC", "USD Coin", 6, TokenRegistry.TokenLevel.TOP_VERIFIED, true, "img");
        registry.registerVerified(address(0x2), "USDT", "Tether", 6, TokenRegistry.TokenLevel.TOP_VERIFIED, true, "img");
        registry.registerVerified(address(0x3), "AAA", "Alpha", 18, TokenRegistry.TokenLevel.CHECKMARK, false, "img");
        registry.registerVerified(address(0x4), "BBB", "Beta", 18, TokenRegistry.TokenLevel.CHECKMARK, false, "img");
        registry.registerVerified(address(0x5), "CCC", "Gamma", 18, TokenRegistry.TokenLevel.CHECKMARK, false, "img");
        registry.registerVerified(address(0x6), "DDD", "Delta", 18, TokenRegistry.TokenLevel.CHECKMARK, false, "img");
        registry.registerVerified(address(0x7), "EEE", "Epsilon", 18, TokenRegistry.TokenLevel.CHECKMARK, false, "img");

        vm.stopPrank();

        TokenRegistry.TokenView[] memory allTokens = registry.search("");
        assertEq(allTokens.length, 6);

        assertEq(allTokens[0].symbol, "USDC");
        assertEq(uint8(allTokens[0].level), uint8(TokenRegistry.TokenLevel.TOP_VERIFIED));
        assertEq(allTokens[1].symbol, "USDT");
        assertEq(uint8(allTokens[1].level), uint8(TokenRegistry.TokenLevel.TOP_VERIFIED));

        assertEq(allTokens[2].symbol, "AAA");
        assertEq(allTokens[3].symbol, "BBB");
        assertEq(allTokens[4].symbol, "CCC");
        assertEq(allTokens[5].symbol, "DDD");
    }

    function test_Search_QueryLengthBounded() external {
        vm.expectRevert();
        registry.search("ABCDE");
    }

    function test_BasicImageURI_SuppressedInReadModel() external {
        address basicToken = address(0x2001);

        vm.prank(user);
        registry.registerBasic(basicToken, "BSC", "Basic Coin", 18);

        TokenRegistry.TokenView memory tokenView = registry.getToken(basicToken);
        assertEq(tokenView.imageURI, "");

        vm.prank(verifier);
        registry.removeToken(basicToken);

        assertEq(openGate.activeRegistrations(user), 0);
    }

    function test_SetTokenLevel_ReindexesPrefixSearch() external {
        vm.prank(verifier);
        registry.registerVerified(
            address(0x3001), "MON", "Monad", 18, TokenRegistry.TokenLevel.CHECKMARK, false, "image"
        );

        TokenRegistry.TokenView[] memory beforeUpgrade = registry.search("MO");
        assertEq(uint8(beforeUpgrade[0].level), uint8(TokenRegistry.TokenLevel.CHECKMARK));

        vm.prank(verifier);
        registry.setTokenLevel(address(0x3001), TokenRegistry.TokenLevel.TOP_VERIFIED);

        TokenRegistry.TokenView[] memory afterUpgrade = registry.search("MO");
        assertEq(uint8(afterUpgrade[0].level), uint8(TokenRegistry.TokenLevel.TOP_VERIFIED));
    }
}
