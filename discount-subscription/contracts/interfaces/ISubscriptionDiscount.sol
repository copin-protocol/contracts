// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

interface ISubscriptionDiscount {
    event MintDiscounted(address indexed user, uint256 tokenId, bytes32 nonce, uint256 discountPercent);
    event Deposited(address indexed payer, uint256 amount);
    event Withdrawn(address indexed payer, uint256 amount);
    event OperatorSet(address indexed operator);
    event PayerSet(address indexed payer);
    event MaxDiscountPercentSet(uint256 discountPercent);

    error EthWithdrawalFailed();
    error InsufficientFunds();
}
