// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {TestStableToken} from "./TestStableToken.sol";

contract TestUSDT is TestStableToken {
    constructor(address admin_) TestStableToken("Tether USD (Testnet)", "USDT", admin_, 6) {}
}
