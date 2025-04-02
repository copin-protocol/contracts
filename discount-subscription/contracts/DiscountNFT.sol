// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import {Address} from "@openzeppelin/contracts/utils/Address.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IDiscountNFT} from "./interfaces/IDiscountNFT.sol";
import {ISubscriptionNFT, ITier} from "./interfaces/ISubscriptionNFT.sol";
import "../libraries/Verify.sol";
import {Owned} from "./utils/Owned.sol";
import "hardhat/console.sol";

contract DiscountNFT is IDiscountNFT, ReentrancyGuard, Owned {
    using Address for address;

    ISubscriptionNFT public immutable subscriptionContract;
    address nftContract;

    address public operator;
    address public payer;
    mapping(bytes32 => bool) discountNonces;

    modifier onlyOperator() {
        require(msg.sender == operator, "Only operator");
        _;
    }

    modifier onlyPayer() {
        require(msg.sender == payer, "Only payer");
        _;
    }

    constructor(
        address _nftContract,
        address _owner,
        address _operator
    ) Owned(_owner) {
        subscriptionContract = ISubscriptionNFT(_nftContract);
        payer = _owner;
        operator = _operator;
        nftContract = _nftContract;
    }

    function getNftSub() public view returns (address) {
        return nftContract;
    }

    function setOperator(address _operator) public onlyOwner {
        require(_operator != address(0), "Invalid operator address");

        operator = _operator;

        emit OperatorSet(operator);
    }

    function setPayer(address _payer) public onlyOwner {
        require(_payer != address(0), "Invalid payer address");

        payer = _payer;

        emit PayerSet(payer);
    }

    function mintNftWithDiscount(
        address user,
        uint256 discountPercent,
        bytes32 nonce,
        bytes memory signature,
        uint256 tierId,
        uint256 duration
    ) external payable nonReentrant {
        require(discountPercent <= 50, "Invalid discount");
        require(!discountNonces[nonce], "Already redeemed");
        bool verified = Verify.verifySignature(
            keccak256(abi.encodePacked(nonce, user, discountPercent, tierId)),
            signature,
            operator
        );
        require(verified == true, "Invalid signature");

        ITier memory tier = _getTierInfo(tierId);
        uint256 originalFee = _feeMintNftWithDiscount(tier.price, duration, 0);

        uint256 userFee = _feeMintNftWithDiscount(
            tier.price,
            duration,
            discountPercent
        );
        require(msg.value >= userFee, "Insufficient user fund");
        require(address(this).balance >= originalFee, "Insufficient fund");

        uint256 totalSupplyBefore = subscriptionContract.totalSupply();
        subscriptionContract.mint{value: originalFee}(tierId, duration);
        uint256 tokenId = totalSupplyBefore + 1;
       
        discountNonces[nonce] = true;

        subscriptionContract.transferFrom(address(this), user, tokenId);

        emit MintNFT(user, discountPercent, nonce, tokenId);
    }

    function _feeMintNft(
        uint256 price,
        uint256 duration
    ) internal pure returns (uint256) {
        return (price * duration * (100 - duration + 1)) / 100;
    }

    function _feeMintNftWithDiscount(
        uint256 price,
        uint256 duration,
        uint256 discountPercent
    ) internal pure returns (uint256) {
        uint256 originalFee = _feeMintNft(price, duration);
        return ((100 - discountPercent) * originalFee) / 100;
    }

    function _getTierInfo(uint256 tierId) public view returns (ITier memory) {
        (
            bytes32 name,
            uint256 price,
            uint256 quantity,
            bool enabled
        ) = subscriptionContract.tiers(tierId);
        return
            ITier({
                name: name,
                price: price,
                quantity: quantity,
                enabled: enabled
            });
    }

    function depositEth() external payable onlyPayer {
        require(msg.value > 0, "Insufficient fund");
        emit Deposited(msg.sender, msg.value);
    }

    function withdrawEth(uint256 amount) external onlyPayer {
        require(amount <= address(this).balance, "Insufficient fund");
        if (amount > 0) {
            (bool success, ) = payable(msg.sender).call{value: amount}("");
            if (!success) revert EthWithdrawalFailed();
            emit Withdrawn(msg.sender, amount);
        }
    }
}
