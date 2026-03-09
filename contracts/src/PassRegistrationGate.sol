// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {IRegistrationGate} from "./IRegistrationGate.sol";

interface IRegistrationPass {
    function firstValidPass(address owner) external view returns (bool found, uint256 tokenId);
    function consume(uint256 tokenId) external;
}

contract PassRegistrationGate is AccessControl, IRegistrationGate {
    bytes32 public constant REGISTRY_ROLE = keccak256("REGISTRY_ROLE");

    IRegistrationPass public immutable registrationPass;

    event PassConsumedForRegistration(address indexed registrant, address indexed token, uint256 indexed tokenId);

    error NoUsablePass(address registrant);

    constructor(address admin_, address registrationPass_) {
        _grantRole(DEFAULT_ADMIN_ROLE, admin_);
        registrationPass = IRegistrationPass(registrationPass_);
    }

    function authorizeAndConsume(address registrant, address token) external onlyRole(REGISTRY_ROLE) {
        (bool found, uint256 tokenId) = registrationPass.firstValidPass(registrant);
        if (!found) {
            revert NoUsablePass(registrant);
        }

        registrationPass.consume(tokenId);
        emit PassConsumedForRegistration(registrant, token, tokenId);
    }
}
