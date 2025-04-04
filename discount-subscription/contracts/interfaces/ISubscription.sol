// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;
import "@openzeppelin/contracts/token/ERC721/IERC721.sol";

interface ISubscription is IERC721 {
    function tiers(
        uint256 tierId
    )
        external
        view
        returns (bytes32 name, uint256 price, uint256 quantity, bool enabled);

    function mint(uint256 tierId, uint256 duration) external payable;

    function totalSupply() external view returns (uint256);

    struct Tier {
        bytes32 name;
        uint256 price;
        uint256 quantity;
        bool enabled;
    }
}
