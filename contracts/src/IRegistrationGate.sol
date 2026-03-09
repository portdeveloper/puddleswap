// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface IRegistrationGate {
    function authorizeAndConsume(address registrant, address token) external;
}
