// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import {ISubscription} from "../interfaces/ISubscription.sol";

contract MockSubscription is ISubscription, ERC721 {
    uint256 private _totalSupply = 0;
    uint256 private _nextTokenId = 1;
    mapping(uint256 => bool) public tierEnabled;
    mapping(uint256 => uint256) public tierPrices;
    mapping(uint256 => uint256) public tierQuantities;
    mapping(uint256 => bytes32) public tierNames;

    constructor() ERC721("MockSubscription", "MSUB") {
        _initializeTier(1, "tier1", 30000000000000000, true);
        _initializeTier(2, "tier2", 100000000000000000, true);
    }

    function _initializeTier(
        uint256 tierId,
        string memory name,
        uint256 price,
        bool enabled
    ) private {
        tierNames[tierId] = bytes32(bytes(name));
        tierPrices[tierId] = price;
        tierEnabled[tierId] = enabled;
    }

    function tiers(
        uint256 tierId
    )
        external
        view
        override
        returns (bytes32 name, uint256 price, uint256 quantity, bool enabled)
    {
        return (
            tierNames[tierId],
            tierPrices[tierId],
            tierQuantities[tierId],
            tierEnabled[tierId]
        );
    }

    // Implement mint function from ISubscriptionNFT
    function mint(uint256 tierId, uint256 duration) external payable override {
        require(tierEnabled[tierId], "Tier not enabled");
        require(duration > 0 && duration <= 12, "Invalid duration");

        // Calculate fee (same logic as in DiscountNFT)
        uint256 fee = (tierPrices[tierId] * duration * (100 - duration + 1)) /
            100;

        // Check sufficient payment
        require(msg.value >= fee, "Insufficient payment");

        // Mint the token to the sender (will be DiscountNFT contract)
        uint256 tokenId = _nextTokenId++;
        _mint(msg.sender, tokenId);

        _totalSupply++;
        // Update tier quantity
        tierQuantities[tierId]++;
    }

    function totalSupply() public view override returns (uint256) {
        return _totalSupply;
    }
}
