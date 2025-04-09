// SPDX-License-Identifier: MIT
pragma solidity 0.8.18;

import "@openzeppelin/contracts/token/ERC721/extensions/ERC721Enumerable.sol";
import "@openzeppelin/contracts/token/common/ERC2981.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {ISubscriptionV2} from "contracts/interfaces/ISubscriptionV2.sol";
import {Owned} from "contracts/utils/Owned.sol";
import {Verify} from "contracts/utils/Verify.sol";
import "@uniswap/v2-periphery/contracts/interfaces/IUniswapV2Router02.sol";
import "@uniswap/v2-core/contracts/interfaces/IUniswapV2Pair.sol";
import "@uniswap/v2-core/contracts/interfaces/IUniswapV2Factory.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";

import "hardhat/console.sol";

contract SubscriptionV2 is
    ISubscriptionV2,
    ERC721,
    ERC721Enumerable,
    ERC2981,
    Owned,
    ReentrancyGuard
{
    uint256 nextTierId = 1;
    uint256 nextTokenId = 1;
    uint256 constant DURATION_UNIT = 30 * 24 * 3600;
    uint256 public maxDiscountPercent;
    string public baseTokenURI;

    address public operator;
    address public uniswapRouter;
    address public weth;
    address public usdc;

    // Stablecoin whitelist mapping
    mapping(address => bool) public whitelistedTokens;
    mapping(uint256 => Tier) public tiers;
    mapping(uint256 => SubscriptionPlan) public subscriptions;
    mapping(uint256 => mapping(uint256 => uint256)) public discountPercents;
    mapping(bytes32 => address) public usedCodes;

    constructor(
        address _owner,
        address _operator,
        string memory _baseTokenURI,
        address _uniswapRouter,
        address _usdc
    ) Owned(_owner) ERC721("Copin Subscription", "COPINSUB") {
        _setDefaultRoyalty(_owner, 1000);
        setBaseURI(_baseTokenURI);
        operator = _operator;
        uniswapRouter = _uniswapRouter;
        weth = IUniswapV2Router02(_uniswapRouter).WETH();
        usdc = _usdc;
    }

    function transferOwnership(
        address newOwner
    ) public override(Owned) onlyOwner {
        super.transferOwnership(newOwner);
    }

    function _baseURI() internal view virtual override returns (string memory) {
        return baseTokenURI;
    }

    function contractURI() public pure returns (string memory) {
        string
            memory json = '{"name":"Copin Subscription","description":"This collection represents subscription plans of Copin","image":"ipfs://bafybeifxchritbyyxwa6ob66sxvio2ladhek5s6do7gdtnbmct5ni6w4hy","external_link" : "https://app.copin.io/subscription"}';
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

    function getFee(
        uint256 tierId,
        uint256 price,
        uint256 duration,
        uint256 discountPercent
    ) public view returns (uint256) {
        if (discountPercent > 0) {
            return (price * duration * (100 - discountPercent)) / 100;
        }
        return
            (price * duration * (100 - discountPercents[tierId][duration])) /
            100;
    }

    // Updated function to account for token decimals
    function getPriceInUsdc(address token) public view returns (uint256) {
        // Get the Uniswap pair for token/USDC
        address factory = IUniswapV2Router02(uniswapRouter).factory();
        address pair = IUniswapV2Factory(factory).getPair(token, usdc);

        if (pair == address(0)) {
            revert PriceNotAvailable();
        }

        (uint112 reserve0, uint112 reserve1, ) = IUniswapV2Pair(pair)
            .getReserves();

        // Determine which token is which
        bool isToken0 = IUniswapV2Pair(pair).token0() == token;
        (uint112 tokenReserve, uint112 usdcReserve) = isToken0
            ? (reserve0, reserve1)
            : (reserve1, reserve0);

        // Get token decimals
        uint8 tokenDecimals = IERC20Metadata(token).decimals();
        uint8 usdcDecimals = IERC20Metadata(usdc).decimals();

        unchecked {
            int8 diff = int8(tokenDecimals) - int8(usdcDecimals);
            uint256 numerator = usdcReserve * 10 ** usdcDecimals;

            if (diff > 0)
                return (numerator * (10 ** uint8(diff))) / tokenReserve;
            if (diff < 0)
                return numerator / (tokenReserve * (10 ** uint8(-diff)));
            return numerator / tokenReserve;
        }
    }

    // Modified mint function to use ETH price conversion
    function mint(
        address receiver,
        uint256 tierId,
        uint256 duration,
        uint256 discountPercent,
        bytes32 nonce,
        bytes memory signature
    ) external payable nonReentrant {
        Tier storage tier = tiers[tierId];

        _checkTierValid(tier, duration);
        if (discountPercent > 0) {
            _verifyAndUseDiscountCode(
                discountPercent,
                tierId,
                nonce,
                signature
            );
        }
        // Calculate fee in USD
        uint256 usdFee = getFee(tierId, tier.price, duration, discountPercent);
        // Convert USD fee to ETH
        uint256 ethFee = (usdFee * 10 ** IERC20Metadata(weth).decimals()) /
            getPriceInUsdc(weth);

        if (msg.value < ethFee) {
            revert InsufficientFunds();
        }

        _mintSubscription(receiver, tier, tierId, duration, usdFee);
    }

    // Modified extend function to use ETH price conversion
    function extend(
        uint256 tokenId,
        uint256 duration,
        uint256 discountPercent,
        bytes32 nonce,
        bytes memory signature
    ) external payable nonReentrant {
        SubscriptionPlan storage subscription = subscriptions[tokenId];
        _checkSubscriptionValid(subscription);
        Tier memory tier = tiers[subscription.tierId];
        _checkTierValid(tier, duration);
        if (discountPercent > 0) {
            _verifyAndUseDiscountCode(
                discountPercent,
                subscription.tierId,
                nonce,
                signature
            );
        }

        uint256 usdFee = getFee(
            subscription.tierId,
            tier.price,
            duration,
            discountPercent
        );
        uint256 ethFee = (usdFee * 10 ** IERC20Metadata(weth).decimals()) /
            getPriceInUsdc(weth);

        if (msg.value < ethFee) {
            revert InsufficientFunds();
        }

        _extendSubscription(subscription, tokenId, duration, usdFee);
    }

    function mintWithToken(
        address token,
        address receiver,
        uint256 tierId,
        uint256 duration,
        uint256 discountPercent,
        bytes32 nonce,
        bytes memory signature
    ) external nonReentrant {
        // Check if stablecoin is whitelisted
        if (!whitelistedTokens[token]) {
            revert TokenNotWhitelisted();
        }

        Tier storage tier = tiers[tierId];
        _checkTierValid(tier, duration);
        if (discountPercent > 0) {
            _verifyAndUseDiscountCode(
                discountPercent,
                tierId,
                nonce,
                signature
            );
        }

        uint256 fee = getFee(tierId, tier.price, duration, discountPercent);
        if (token != usdc) {
            fee =
                (fee * 10 ** IERC20Metadata(token).decimals()) /
                getPriceInUsdc(token);
        }

        bool success = IERC20(token).transferFrom(
            msg.sender,
            address(this),
            fee
        );
        if (!success) {
            revert InsufficientFunds();
        }

        _mintSubscription(receiver, tier, tierId, duration, fee);
    }

    function extendWithToken(
        address token,
        uint256 tokenId,
        uint256 duration,
        uint256 discountPercent,
        bytes32 nonce,
        bytes memory signature
    ) external nonReentrant {
        // Check if stablecoin is whitelisted
        if (!whitelistedTokens[token]) {
            revert TokenNotWhitelisted();
        }

        SubscriptionPlan storage subscription = subscriptions[tokenId];
        _checkSubscriptionValid(subscription);
        Tier memory tier = tiers[subscription.tierId];
        _checkTierValid(tier, duration);
        if (discountPercent > 0) {
            _verifyAndUseDiscountCode(
                discountPercent,
                subscription.tierId,
                nonce,
                signature
            );
        }

        uint256 fee = getFee(
            subscription.tierId,
            tier.price,
            duration,
            discountPercent
        );
        if (token != usdc) {
            fee =
                (fee * 10 ** IERC20Metadata(token).decimals()) /
                getPriceInUsdc(token);
        }

        bool success = IERC20(token).transferFrom(
            msg.sender,
            address(this),
            fee
        );
        if (!success) {
            revert InsufficientFunds();
        }
        _extendSubscription(subscription, tokenId, duration, fee);
    }

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

    function setBaseURI(string memory _baseTokenURI) public onlyOwner {
        baseTokenURI = _baseTokenURI;
        emit ChangeBaseTokenURI(_baseTokenURI);
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

    // Function to add or remove stablecoins from whitelist
    function setTokenWhitelist(
        address token,
        bool isWhitelisted
    ) external onlyOwner {
        if (token == address(0)) {
            revert AddressZero();
        }
        whitelistedTokens[token] = isWhitelisted;
        emit TokenWhitelistUpdated(token, isWhitelisted);
    }

    // Function to withdraw stablecoins
    function withdrawToken(
        address token,
        address receiver,
        uint256 amount
    ) external onlyOwner {
        if (receiver == address(0)) {
            revert AddressZero();
        }
        if (!whitelistedTokens[token]) {
            revert TokenNotWhitelisted();
        }
        if (amount > 0) {
            bool success = IERC20(token).transfer(receiver, amount);
            if (!success) revert("Token withdrawal failed");
            emit TokenWithdraw(token, receiver, amount);
        }
    }

    function setOperator(address _operator) external onlyOwner {
        if (_operator == address(0)) {
            revert AddressZero();
        }
        operator = _operator;
        emit SetOperator(_operator);
    }

    function setMaxDiscountPercent(
        uint256 _discountPercent
    ) external onlyOwner {
        require(_discountPercent <= 100, "Invalid discount percent");
        maxDiscountPercent = _discountPercent;
        emit SetMaxDiscountPercent(maxDiscountPercent);
    }

    function setDiscountPackage(
        uint256 tierId,
        uint256 duration,
        uint256 percent
    ) external onlyOwner {
        discountPercents[tierId][duration] = percent;
        emit SetDiscountPackage(tierId, duration, percent);
    }

    function setUniswapRouter(address _uniswapRouter) external onlyOwner {
        if (_uniswapRouter == address(0)) {
            revert AddressZero();
        }
        uniswapRouter = _uniswapRouter;
        weth = IUniswapV2Router02(_uniswapRouter).WETH();
    }

    function setUsdc(address _usdc) external onlyOwner {
        if (_usdc == address(0)) {
            revert AddressZero();
        }
        usdc = _usdc;
    }

    function _checkSubscriptionValid(
        SubscriptionPlan memory subscription
    ) internal view {
        if (subscription.owner == address(0)) {
            revert InvalidSubscriptionPlan();
        }
        if (block.timestamp > subscription.expiredTime) {
            revert SubscriptionExpired();
        }
    }

    function _checkTierValid(Tier memory tier, uint256 duration) internal pure {
        if (tier.price == 0) {
            revert InvalidTier();
        }
        if (!tier.enabled) {
            revert TierDisabled();
        }
        if (duration == 0) {
            revert InvalidDuration();
        }
    }

    function _mintSubscription(
        address receiver,
        Tier storage tier,
        uint256 tierId,
        uint256 duration,
        uint256 usdFee
    ) internal {
        if (receiver == address(0)) {
            receiver = msg.sender;
        }
        uint256 tokenId = nextTokenId++;
        _mint(receiver, tokenId);

        uint256 expiredTime = block.timestamp + duration * DURATION_UNIT;
        subscriptions[tokenId] = SubscriptionPlan({
            startedTime: block.timestamp,
            expiredTime: expiredTime,
            tierId: tierId,
            owner: receiver
        });
        tier.quantity++;

        emit Mint(
            tokenId,
            tierId,
            usdFee, // We still emit the USD fee for consistency
            block.timestamp,
            expiredTime,
            receiver
        );
    }

    function _extendSubscription(
        SubscriptionPlan storage subscription,
        uint256 tokenId,
        uint256 duration,
        uint256 usdFee
    ) internal {
        uint256 oldExpiredTime = subscription.expiredTime;
        subscription.expiredTime += duration * DURATION_UNIT;
        emit Extend(tokenId, usdFee, oldExpiredTime, subscription.expiredTime);
    }

    function _verifyAndUseDiscountCode(
        uint256 discountPercent,
        uint256 tierId,
        bytes32 nonce,
        bytes memory signature
    ) internal {
        if (discountPercent > maxDiscountPercent) {
            revert InvalidDiscountPercent();
        }
        if (usedCodes[nonce] != address(0)) {
            revert DiscountCodeAlreadyUsed();
        }
        bool verified = Verify.verifySignature(
            keccak256(
                abi.encodePacked(nonce, msg.sender, discountPercent, tierId)
            ),
            signature,
            operator
        );
        if (!verified) {
            revert InvalidSignature();
        }
        usedCodes[nonce] = msg.sender;
        emit DiscountCodeUsed(msg.sender, nonce);
    }

    receive() external payable {}
}
