// SPDX-License-Identifier: MIT
pragma solidity 0.8.18;

interface ICopyTradingFees {
    struct Fee {
        uint96 id; // max: 7.9228e28
        address account;
        uint128 size; // 1e18; max: 3.4028e38
        uint128 fee; // 1e18; max: 3.4028e38
    }
    event SetExecutor(address executor);

    event ChargeFee(
        uint96 indexed id,
        address indexed account,
        uint128 size,
        uint128 fee,
        address receiver
    );

    event SetPaymentToken(address token, bool enable);

    event ChangeFeeReceiver(address receiver);

    error AddressZero();

    error SizeZero();

    error InvalidFeeId();

    error AlreadyCharged();

    error OnlyExecutor();

    error TokenNotSupported();

    error EthWithdrawalFailed();
}
