// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {IRegistrationGate} from "./IRegistrationGate.sol";

contract OpenRegistrationGate is AccessControl, IRegistrationGate {
    bytes32 public constant REGISTRY_ROLE = keccak256("REGISTRY_ROLE");

    uint256 public cooldown;
    uint256 public maxActiveRegistrations;

    mapping(address => uint256) public lastRegistrationAt;
    mapping(address => uint256) public activeRegistrations;

    event CooldownUpdated(uint256 cooldown);
    event MaxActiveRegistrationsUpdated(uint256 maxActiveRegistrations);
    event RegistrationConsumed(address indexed registrant, address indexed token, uint256 registeredAt);
    event ActiveRegistrationDecremented(address indexed registrant, uint256 newActiveRegistrations);

    error RegistrationCooldownActive(uint256 nextAllowedTimestamp);
    error MaxActiveRegistrationsReached(uint256 maxAllowed);

    constructor(address admin_, uint256 cooldown_, uint256 maxActiveRegistrations_) {
        _grantRole(DEFAULT_ADMIN_ROLE, admin_);
        cooldown = cooldown_;
        maxActiveRegistrations = maxActiveRegistrations_;
    }

    function authorizeAndConsume(address registrant, address token) external onlyRole(REGISTRY_ROLE) {
        uint256 lastRegisteredAt = lastRegistrationAt[registrant];
        uint256 nextAllowed = lastRegisteredAt + cooldown;
        if (lastRegisteredAt != 0 && block.timestamp < nextAllowed) {
            revert RegistrationCooldownActive(nextAllowed);
        }

        if (activeRegistrations[registrant] >= maxActiveRegistrations) {
            revert MaxActiveRegistrationsReached(maxActiveRegistrations);
        }

        lastRegistrationAt[registrant] = block.timestamp;
        activeRegistrations[registrant] += 1;

        emit RegistrationConsumed(registrant, token, block.timestamp);
    }

    function onBasicTokenRemoved(address registrant) external onlyRole(REGISTRY_ROLE) {
        uint256 currentActive = activeRegistrations[registrant];
        if (currentActive == 0) {
            return;
        }

        uint256 newValue = currentActive - 1;
        activeRegistrations[registrant] = newValue;

        emit ActiveRegistrationDecremented(registrant, newValue);
    }

    function setCooldown(uint256 cooldown_) external onlyRole(DEFAULT_ADMIN_ROLE) {
        cooldown = cooldown_;
        emit CooldownUpdated(cooldown_);
    }

    function setMaxActiveRegistrations(uint256 maxActiveRegistrations_) external onlyRole(DEFAULT_ADMIN_ROLE) {
        maxActiveRegistrations = maxActiveRegistrations_;
        emit MaxActiveRegistrationsUpdated(maxActiveRegistrations_);
    }
}
