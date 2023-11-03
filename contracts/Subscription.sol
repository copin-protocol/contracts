// SPDX-License-Identifier: MIT
pragma solidity 0.8.18;

import "@openzeppelin/contracts/token/ERC721/extensions/ERC721Enumerable.sol";
import "@openzeppelin/contracts/token/common/ERC2981.sol";
import {ISubscription} from "contracts/interfaces/ISubscription.sol";
import {Owned} from "contracts/utils/Owned.sol";

contract Subscription is
    ISubscription,
    ERC721,
    ERC721Enumerable,
    ERC2981,
    Owned
{
    uint256 nextTierId = 1;
    uint256 nextTokenId = 1;

    mapping(uint256 => Tier) public tiers;
    mapping(uint256 => SubscriptionPlan) public subscriptions;

    constructor(
        address _owner
    ) Owned(_owner) ERC721("Copin Subscription", "COPINSUB") {
        _setDefaultRoyalty(_owner, 1000);
    }

    function transferOwnership(
        address newOwner
    ) public override(Owned) onlyOwner {
        super.transferOwnership(newOwner);
        _setDefaultRoyalty(newOwner, 1000);
    }

    function _baseURI() internal pure override returns (string memory) {
        return "https://api.copin.io/subscription/metadata";
    }

    function contractURI() public pure returns (string memory) {
        string
            memory json = '{"name":"Copin Subscription","description":"This collection represents subscription plans of Copin","image":"ipfs://bafybeifxchritbyyxwa6ob66sxvio2ladhek5s6do7gdtnbmct5ni6w4hy","external_link" : "copin.io"}';
        return string.concat("data:application/json;utf8,", json);
    }

    function _beforeTokenTransfer(
        address from,
        address to,
        uint256 tokenId,
        uint256 batchSize
    ) internal override(ERC721, ERC721Enumerable) {
        super._beforeTokenTransfer(from, to, tokenId, batchSize);
    }

    function supportsInterface(
        bytes4 interfaceId
    ) public view override(ERC721, ERC721Enumerable, ERC2981) returns (bool) {
        return super.supportsInterface(interfaceId);
    }

    function mint(uint256 tierId, uint256 duration) external payable {
        Tier storage tier = tiers[tierId];
        if (tier.price == 0) {
            revert InvalidTier();
        }
        if (!tier.enabled) {
            revert TierDisabled();
        }
        if (duration == 0 || duration > 12) {
            revert InvalidDuration();
        }
        uint256 fee = _fee(tier.price, duration);
        if (msg.value < fee) {
            revert InsufficientFunds();
        }
        uint256 tokenId = nextTokenId++;
        _mint(msg.sender, tokenId);
        // _setTokenRoyalty(tokenId, owner, 1000);
        uint256 expiredTime = block.timestamp + duration * 30 * 24 * 3600;
        subscriptions[tokenId] = SubscriptionPlan({
            startedTime: block.timestamp,
            expiredTime: expiredTime,
            tierId: tierId,
            owner: msg.sender
        });
        tier.quantity++;
        emit Mint(
            tokenId,
            tierId,
            fee,
            block.timestamp,
            expiredTime,
            msg.sender
        );
    }

    function extend(uint256 tokenId, uint256 duration) external payable {
        SubscriptionPlan storage subscription = subscriptions[tokenId];
        if (subscription.owner == address(0)) {
            revert InvalidSubscriptionPlan();
        }
        if (duration == 0 || duration > 12) {
            revert InvalidDuration();
        }
        if (block.timestamp > subscription.expiredTime) {
            revert SubscriptionExpired();
        }
        Tier memory tier = tiers[subscription.tierId];
        if (!tier.enabled) {
            revert TierDisabled();
        }
        uint256 fee = _fee(tier.price, duration);
        if (msg.value < fee) {
            revert InsufficientFunds();
        }
        uint256 oldExpiredTime = subscription.expiredTime;
        subscription.expiredTime += duration * 30 * 24 * 3600;
        emit Extend(tokenId, fee, oldExpiredTime, subscription.expiredTime);
    }

    function _fee(
        uint256 price,
        uint256 duration
    ) internal pure returns (uint256) {
        return (price * duration * (100 - duration + 1)) / 100;
    }

    receive() external payable {}

    function addTier(
        bytes32 name,
        uint256 price
    ) external onlyOwner returns (uint256) {
        if (price == 0) {
            revert ZeroPrice();
        }
        uint256 tierId = nextTierId++;
        tiers[tierId] = Tier({
            name: name,
            price: price,
            quantity: 0,
            enabled: true
        });
        emit AddTier(tierId, name, price);
        return tierId;
    }

    function changeTierPrice(uint256 tierId, uint256 price) external onlyOwner {
        Tier storage tier = tiers[tierId];
        if (tier.price == 0) {
            revert InvalidTier();
        }
        if (price == 0) {
            revert ZeroPrice();
        }
        uint256 oldPrice = tier.price;
        tier.price = price;
        emit ChangeTierPrice(tierId, oldPrice, price);
    }

    function enableTier(uint256 tierId, bool enabled) external onlyOwner {
        Tier storage tier = tiers[tierId];
        if (tier.price == 0) {
            revert InvalidTier();
        }
        tier.enabled = enabled;
        emit EnableTier(tierId, enabled);
    }

    function withdrawEth(address receiver, uint256 amount) external onlyOwner {
        if (receiver == address(0)) {
            revert AddressZero();
        }
        if (amount > 0) {
            (bool success, ) = payable(receiver).call{value: amount}("");
            if (!success) revert EthWithdrawalFailed();
            emit EthWithdraw(receiver, amount);
        }
    }
}
