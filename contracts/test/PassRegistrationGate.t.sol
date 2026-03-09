// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";

import {PassRegistrationGate} from "../src/PassRegistrationGate.sol";
import {RegistrationPass} from "../src/RegistrationPass.sol";

contract PassRegistrationGateTest is Test {
    RegistrationPass internal pass;
    PassRegistrationGate internal gate;

    address internal admin = address(this);
    address internal registry = address(0xABCD);
    address internal user = address(0x1234);

    function setUp() external {
        pass = new RegistrationPass(admin);
        gate = new PassRegistrationGate(admin, address(pass));

        pass.grantRole(pass.CONSUMER_ROLE(), address(gate));
        gate.grantRole(gate.REGISTRY_ROLE(), registry);
    }

    function test_AuthorizeAndConsume_BurnsPass() external {
        uint256 tokenId = pass.mintPass(user, uint64(block.timestamp + 30 days));

        vm.prank(registry);
        gate.authorizeAndConsume(user, address(0x9999));

        vm.expectRevert();
        pass.ownerOf(tokenId);
    }
}
