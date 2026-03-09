// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {TestStableToken} from "./TestStableToken.sol";

contract TestUSDC is TestStableToken {
    constructor(address admin_) TestStableToken("USD Coin (Testnet)", "USDC", admin_, 6) {}
}
