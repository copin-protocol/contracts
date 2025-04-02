// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

interface IDiscountNFT {
    event MintNFT(address indexed user, uint256 discountAmount, bytes32 nonce, uint256 tokenId);
    event Deposited(address indexed payer, uint256 amount);
    event Withdrawn(address indexed payer, uint256 amount);
    event OperatorSet(address indexed operator);
    event PayerSet(address indexed payer);

    error EthWithdrawalFailed();
    error InsufficientFunds();
}
