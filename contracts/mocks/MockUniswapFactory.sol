// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

contract MockUniswapFactory {
    address public pair;

    function setPair(address _pair) external {
        pair = _pair;
    }

    function getPair(address, address) external view returns (address) {
        return pair;
    }
}
