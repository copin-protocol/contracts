// SPDX-License-Identifier: MIT
pragma solidity 0.8.18;

interface ISubscriptionV2 {
    event AddTier(uint256 indexed tierId, bytes32 name, uint256 price);

    event Mint(
        uint256 indexed tokenId,
        uint256 indexed tierId,
        uint256 fee,
        uint256 startedTime,
        uint256 expiredTime,
        address owner
    );

    event Extend(
        uint256 indexed tokenId,
        uint256 fee,
        uint256 oldExpiredTime,
        uint256 newExpiredTime
    );

    event EthWithdraw(address receiver, uint256 amount);

    event ChangeTierPrice(uint256 tierId, uint256 oldPrice, uint256 newPrice);

    event EnableTier(uint256 tierId, bool enabled);

    event ChangeBaseTokenURI(string uri);

    event TokenWhitelistUpdated(address token, bool isWhitelisted);

    event TokenWithdraw(address token, address receiver, uint256 amount);

    event SetOperator(address operator);

    event SetDiscountPackage(uint256 tierId, uint256 duration, uint256 percent);

    event SetMaxDiscountPercent(uint256 maxDiscountPercent);

    event DiscountCodeUsed(address user, bytes32 nonce);

    struct Tier {
        bytes32 name;
        uint256 price;
        uint256 quantity;
        bool enabled;
    }

    struct SubscriptionPlan {
        uint256 startedTime;
        uint256 expiredTime;
        uint256 tierId;
        address owner;
    }

    error InvalidSubscriptionPlan();

    error InvalidTier();

    error TierDisabled();

    error InvalidDuration();

    error InsufficientFunds();

    error SubscriptionExpired();

    error AddressZero();

    error ZeroPrice();

    error EthWithdrawalFailed();

    error NotAllowedByRegistry();

    error RegistryNotSet();

    error TokenNotWhitelisted();

    error PriceNotAvailable();

    error InvalidDiscountPercent();

    error DiscountCodeAlreadyUsed();

    error InvalidSignature();

    function discountPercents(
        uint256 tierId,
        uint256 duration
    ) external view returns (uint256);
}
