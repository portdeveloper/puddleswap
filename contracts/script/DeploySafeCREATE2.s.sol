// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console2} from "forge-std/Script.sol";

interface ISafe {
    function setup(
        address[] calldata _owners,
        uint256 _threshold,
        address to,
        bytes calldata data,
        address fallbackHandler,
        address paymentToken,
        uint256 payment,
        address payable paymentReceiver
    ) external;
}

interface ISafeProxyFactory {
    function createProxyWithNonce(address _singleton, bytes memory initializer, uint256 saltNonce)
        external
        returns (address);
}

contract DeploySafeCREATE2 is Script {
    address private constant SAFE_SINGLETON = 0x29fcB43b46531BcA003ddC8FCB67FFE91900C762;
    address private constant SAFE_PROXY_FACTORY = 0x4e1DCf7AD4e460CfD30791CCC4F9c8a4f820ec67;
    address private constant FALLBACK_HANDLER = 0xfd0732Dc9E303f09fCEf3a7388Ad10A83459Ec99;

    function run() external returns (address safeProxy) {
        address owner1 = vm.envAddress("OWNER_1");
        address owner2 = vm.envAddress("OWNER_2");
        address owner3 = vm.envAddress("OWNER_3");

        address[] memory owners = new address[](3);
        owners[0] = owner1;
        owners[1] = owner2;
        owners[2] = owner3;

        bytes memory initializer = abi.encodeWithSelector(
            ISafe.setup.selector,
            owners,
            2,
            address(0),
            "",
            FALLBACK_HANDLER,
            address(0),
            0,
            payable(address(0))
        );

        uint256 saltNonce = vm.envOr("SALT_NONCE", uint256(keccak256(abi.encode(owners, block.chainid))));

        vm.startBroadcast();
        safeProxy = ISafeProxyFactory(SAFE_PROXY_FACTORY).createProxyWithNonce(SAFE_SINGLETON, initializer, saltNonce);
        vm.stopBroadcast();

        console2.log("Safe deployed:", safeProxy);
    }
}
