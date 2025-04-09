// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

contract MockUniswapRouter {
    address public WETH;
    address public factory;

    function setWETH(address _weth) external {
        WETH = _weth;
    }

    function setFactory(address _factory) external {
        factory = _factory;
    }
}
