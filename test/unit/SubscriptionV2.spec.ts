import { expect } from "../utils/expect";
import { ethers, waffle } from "hardhat";
import { completeFixtureV2 } from "../utils/fixtures";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { Contract, Event } from "ethers";
import { MONTH_UNIT } from "../utils/constants";
import { MockProvider } from "ethereum-waffle";

const USD_PRICE = ethers.utils.parseUnits("100", 6);

describe("SubscriptionV2", () => {
  const createFixtureLoader = waffle.createFixtureLoader;
  let loadFixture: any;
  let collection: Contract;
  let mockUSDC: Contract;
  let mockWETH: Contract;
  let mockRouter: Contract;
  let mockFactory: Contract;
  let mockPair: Contract;
  let wallets: SignerWithAddress[];
  let operator: SignerWithAddress;

  const fixture = async (wallets: SignerWithAddress[]) => {
    const {
      collection,
      mockUSDC,
      mockWETH,
      mockRouter,
      mockFactory,
      mockPair,
    } = await completeFixtureV2(wallets);
    return {
      collection,
      mockUSDC,
      mockWETH,
      mockRouter,
      mockFactory,
      mockPair,
    };
  };

  before("create fixture loader", async () => {
    wallets = await ethers.getSigners();
    operator = wallets[3];
    loadFixture = createFixtureLoader(wallets as any[]);
  });

  beforeEach("load fixture", async () => {
    ({ collection, mockUSDC, mockWETH, mockRouter, mockFactory, mockPair } =
      await loadFixture(fixture));

    // Setup tier
    await collection.addTier(
      ethers.utils.formatBytes32String("Premium"),
      USD_PRICE
    );

    // Setup token whitelist
    await collection.setTokenWhitelist(mockUSDC.address, true);
    await collection.setTokenWhitelist(mockWETH.address, true);

    // Mint tokens to users
    const mintAmount = ethers.utils.parseEther("1000");
    await mockUSDC.mint(wallets[1].address, mintAmount);
    await mockWETH.mint(wallets[1].address, mintAmount);

    // Approve tokens
    await mockUSDC
      .connect(wallets[1] as any)
      .approve(collection.address, ethers.constants.MaxUint256);
    await mockWETH
      .connect(wallets[1] as any)
      .approve(collection.address, ethers.constants.MaxUint256);
  });

  describe("Token Whitelist", () => {
    it("should set token whitelist", async () => {
      await collection.setTokenWhitelist(wallets[4].address, true);
      expect(await collection.whitelistedTokens(wallets[4].address)).to.be.true;

      await collection.setTokenWhitelist(wallets[4].address, false);
      expect(await collection.whitelistedTokens(wallets[4].address)).to.be
        .false;
    });

    it("should emit TokenWhitelistUpdated event", async () => {
      await expect(collection.setTokenWhitelist(wallets[4].address, true))
        .to.emit(collection, "TokenWhitelistUpdated")
        .withArgs(wallets[4].address, true);
    });

    it("should revert if caller is not owner", async () => {
      await expect(
        collection
          .connect(wallets[1] as any)
          .setTokenWhitelist(wallets[4].address, true)
      ).to.be.revertedWith("UNAUTHORIZED");
    });

    it("should revert if token address is zero", async () => {
      await expect(
        collection.setTokenWhitelist(ethers.constants.AddressZero, true)
      ).to.be.revertedWith("AddressZero()");
    });
  });

  describe("Price Oracle", () => {
    it("should get price in USDC", async () => {
      // Setup mock pair with 1 WETH = 2000 USDC
      const wethReserve = ethers.utils.parseEther("1");
      const usdcReserve = ethers.utils.parseUnits("2000", 6); // USDC has 6 decimals

      await mockPair.setReserves(wethReserve, usdcReserve);
      await mockPair.setToken0(mockWETH.address);
      await mockPair.setToken1(mockUSDC.address);

      const price = await collection.getPriceInUsdc(mockWETH.address);
      expect(price).to.equal(ethers.utils.parseUnits("2000", 6));
    });

    it("should handle different token decimals", async () => {
      // Create a token with 9 decimals
      const MockToken = await ethers.getContractFactory("MockERC20");
      const mockToken = await MockToken.deploy("MockToken", "MTK", 9);

      // Setup mock pair with 1 MTK = 10 USDC
      const tokenReserve = ethers.utils.parseUnits("1", 9);
      const usdcReserve = ethers.utils.parseUnits("10", 6);

      await mockPair.setReserves(tokenReserve, usdcReserve);
      await mockPair.setToken0(mockToken.address);
      await mockPair.setToken1(mockUSDC.address);

      const price = await collection.getPriceInUsdc(mockToken.address);
      expect(price).to.equal(ethers.utils.parseUnits("10", 6));
    });

    it("should revert if pair doesn't exist", async () => {
      await mockFactory.setPair(ethers.constants.AddressZero);

      await expect(
        collection.getPriceInUsdc(mockWETH.address)
      ).to.be.revertedWith("PriceNotAvailable()");
    });
  });

  describe("mintWithToken", () => {
    it("should mint with token", async () => {
      // Setup price conversion
      const wethReserve = ethers.utils.parseEther("1");
      const usdcReserve = ethers.utils.parseUnits("2000", 6);

      await mockPair.setReserves(wethReserve, usdcReserve);
      await mockPair.setToken0(mockWETH.address);
      await mockPair.setToken1(mockUSDC.address);

      // Mint with USDC
      const tx = await collection
        .connect(wallets[1] as any)
        .mintWithToken(
          mockUSDC.address,
          wallets[1].address,
          1,
          1,
          0,
          ethers.utils.formatBytes32String(""),
          "0x"
        );

      expect(await collection.ownerOf(1)).to.equal(wallets[1].address);

      const receipt = await tx.wait();

      const block = await ethers.provider.getBlock(receipt.blockNumber);
      const timestamp = block.timestamp;

      const subscription = await collection.subscriptions(1);
      expect(subscription.startedTime).to.equal(timestamp);
      expect(subscription.expiredTime).to.equal(timestamp + MONTH_UNIT);
      expect(subscription.tierId).to.equal(1);
      expect(subscription.owner).to.equal(wallets[1].address);

      // Check USDC transfer
      expect(await mockUSDC.balanceOf(collection.address)).to.equal(USD_PRICE);
    });

    it("should emit Mint event", async () => {
      const tx = await collection
        .connect(wallets[1] as any)
        .mintWithToken(
          mockUSDC.address,
          wallets[1].address,
          1,
          1,
          0,
          ethers.utils.formatBytes32String(""),
          "0x"
        );

      const receipt = await tx.wait();
      const block = await ethers.provider.getBlock(receipt.blockNumber);
      const timestamp = block.timestamp;

      await expect(tx)
        .to.emit(collection, "Mint")
        .withArgs(
          1,
          1,
          USD_PRICE,
          timestamp,
          timestamp + MONTH_UNIT,
          wallets[1].address
        );
    });

    it("should revert if token is not whitelisted", async () => {
      await expect(
        collection
          .connect(wallets[1] as any)
          .mintWithToken(
            wallets[4].address,
            wallets[1].address,
            1,
            1,
            0,
            ethers.utils.formatBytes32String(""),
            "0x"
          )
      ).to.be.revertedWith("TokenNotWhitelisted()");
    });

    it("should revert if insufficient funds", async () => {
      // Set balance to less than required
      await mockUSDC.burn(
        wallets[1].address,
        await mockUSDC.balanceOf(wallets[1].address)
      );
      await mockUSDC.mint(wallets[1].address, USD_PRICE.sub(1));

      await expect(
        collection
          .connect(wallets[1] as any)
          .mintWithToken(
            mockUSDC.address,
            wallets[1].address,
            1,
            1,
            0,
            ethers.utils.formatBytes32String(""),
            "0x"
          )
      ).to.be.revertedWith("ERC20: transfer amount exceeds balance");
    });
  });

  describe("extendWithToken", () => {
    let mintTimestamp: number;

    beforeEach("mint subscription", async () => {
      const tx = await collection
        .connect(wallets[1] as any)
        .mintWithToken(
          mockUSDC.address,
          wallets[1].address,
          1,
          1,
          0,
          ethers.utils.formatBytes32String(""),
          "0x"
        );

      const receipt = await tx.wait();

      const block = await ethers.provider.getBlock(receipt.blockNumber);
      mintTimestamp = block.timestamp;
    });

    it("should extend with token", async () => {
      await collection
        .connect(wallets[1] as any)
        .extendWithToken(
          mockUSDC.address,
          1,
          2,
          0,
          ethers.utils.formatBytes32String(""),
          "0x"
        );

      const subscription = await collection.subscriptions(1);
      expect(subscription.expiredTime).to.equal(
        mintTimestamp + MONTH_UNIT + MONTH_UNIT * 2
      );

      // Check USDC transfer
      const expectedBalance = USD_PRICE.add(USD_PRICE.mul(2));
      expect(await mockUSDC.balanceOf(collection.address)).to.equal(
        expectedBalance
      );
    });

    it("should emit Extend event", async () => {
      const tx = await collection
        .connect(wallets[1] as any)
        .extendWithToken(
          mockUSDC.address,
          1,
          2,
          0,
          ethers.utils.formatBytes32String(""),
          "0x"
        );

      const fee = USD_PRICE.mul(2);

      await expect(tx)
        .to.emit(collection, "Extend")
        .withArgs(
          1,
          fee,
          mintTimestamp + MONTH_UNIT,
          mintTimestamp + MONTH_UNIT + MONTH_UNIT * 2
        );
    });

    it("should revert if token is not whitelisted", async () => {
      await expect(
        collection
          .connect(wallets[1] as any)
          .extendWithToken(
            wallets[4].address,
            1,
            2,
            0,
            ethers.utils.formatBytes32String(""),
            "0x"
          )
      ).to.be.revertedWith("TokenNotWhitelisted()");
    });

    it("should revert if subscription is expired", async () => {
      await ethers.provider.send("evm_increaseTime", [MONTH_UNIT + 1]);
      await ethers.provider.send("evm_mine", []);

      await expect(
        collection
          .connect(wallets[1] as any)
          .extendWithToken(
            mockUSDC.address,
            1,
            2,
            0,
            ethers.utils.formatBytes32String(""),
            "0x"
          )
      ).to.be.revertedWith("SubscriptionExpired()");
    });

    it("should apply discount with extend", async () => {
      // Set up a discount package for tier 1, duration 2 months
      await collection.setDiscountPackage(1, 2, 10); // 10% discount

      // Extend with discount package
      const tx = await collection.connect(wallets[1] as any).extendWithToken(
        mockUSDC.address,
        1,
        2,
        0, // 0 means use package discount
        ethers.utils.formatBytes32String(""),
        "0x"
      );

      const receipt = await tx.wait();
      const block = await ethers.provider.getBlock(receipt.blockNumber);

      // Calculate expected fee with 10% discount
      const expectedFee = USD_PRICE.mul(2).mul(90).div(100);

      // Check subscription expiration
      const subscription = await collection.subscriptions(1);
      expect(subscription.expiredTime).to.equal(
        mintTimestamp + MONTH_UNIT + MONTH_UNIT * 2
      );

      // Check USDC transfer (original price + discounted extension)
      const expectedBalance = USD_PRICE.add(expectedFee);
      expect(await mockUSDC.balanceOf(collection.address)).to.equal(
        expectedBalance
      );

      // Verify event emission with discounted fee
      await expect(tx)
        .to.emit(collection, "Extend")
        .withArgs(
          1,
          expectedFee,
          mintTimestamp + MONTH_UNIT,
          mintTimestamp + MONTH_UNIT + MONTH_UNIT * 2
        );
    });

    it("should apply custom discount with extend using signature", async () => {
      // Create signature for discount
      const discountPercent = 15;
      const tierId = 1;
      const nonce = ethers.utils.formatBytes32String("discount123");

      const messageHash = ethers.utils.solidityKeccak256(
        ["bytes32", "address", "uint256", "uint256"],
        [nonce, wallets[1].address, discountPercent, tierId]
      );

      const signature = await operator.signMessage(
        ethers.utils.arrayify(messageHash)
      );

      // Set max discount
      await collection.setMaxDiscountPercent(30);

      // Extend with custom discount
      const tx = await collection
        .connect(wallets[1] as any)
        .extendWithToken(
          mockUSDC.address,
          1,
          2,
          discountPercent,
          nonce,
          signature
        );

      const receipt = await tx.wait();
      const block = await ethers.provider.getBlock(receipt.blockNumber);

      // Calculate expected fee with 15% discount
      const expectedFee = USD_PRICE.mul(2).mul(85).div(100);

      // Check subscription expiration
      const subscription = await collection.subscriptions(1);
      expect(subscription.expiredTime).to.equal(
        mintTimestamp + MONTH_UNIT + MONTH_UNIT * 2
      );

      // Check USDC transfer (original price + discounted extension)
      const expectedBalance = USD_PRICE.add(expectedFee);
      expect(await mockUSDC.balanceOf(collection.address)).to.equal(
        expectedBalance
      );

      // Verify event emission with discounted fee
      await expect(tx)
        .to.emit(collection, "Extend")
        .withArgs(
          1,
          expectedFee,
          mintTimestamp + MONTH_UNIT,
          mintTimestamp + MONTH_UNIT + MONTH_UNIT * 2
        );
    });
  });

  describe("withdrawToken", () => {
    beforeEach("mint with token", async () => {
      await collection
        .connect(wallets[1] as any)
        .mintWithToken(
          mockUSDC.address,
          wallets[1].address,
          1,
          1,
          0,
          ethers.utils.formatBytes32String(""),
          "0x"
        );
    });

    it("should withdraw token", async () => {
      await collection.withdrawToken(
        mockUSDC.address,
        wallets[2].address,
        USD_PRICE
      );

      expect(await mockUSDC.balanceOf(wallets[2].address)).to.equal(USD_PRICE);
      expect(await mockUSDC.balanceOf(collection.address)).to.equal(0);
    });

    it("should emit TokenWithdraw event", async () => {
      await expect(
        collection.withdrawToken(
          mockUSDC.address,
          wallets[2].address,
          USD_PRICE
        )
      )
        .to.emit(collection, "TokenWithdraw")
        .withArgs(mockUSDC.address, wallets[2].address, USD_PRICE);
    });

    it("should revert if caller is not owner", async () => {
      await expect(
        collection
          .connect(wallets[1] as any)
          .withdrawToken(mockUSDC.address, wallets[2].address, USD_PRICE)
      ).to.be.revertedWith("UNAUTHORIZED");
    });

    it("should revert if token is not whitelisted", async () => {
      await collection.setTokenWhitelist(mockUSDC.address, false);

      await expect(
        collection.withdrawToken(
          mockUSDC.address,
          wallets[2].address,
          USD_PRICE
        )
      ).to.be.revertedWith("TokenNotWhitelisted()");
    });

    it("should revert if receiver is zero address", async () => {
      await expect(
        collection.withdrawToken(
          mockUSDC.address,
          ethers.constants.AddressZero,
          USD_PRICE
        )
      ).to.be.revertedWith("AddressZero()");
    });
  });

  describe("Discount Code", () => {
    it("should mint with discount code", async () => {
      // Create signature for discount
      const discountPercent = 20;
      const tierId = 1;
      const nonce = ethers.utils.formatBytes32String("discount123");

      const messageHash = ethers.utils.solidityKeccak256(
        ["bytes32", "address", "uint256", "uint256"],
        [nonce, wallets[1].address, discountPercent, tierId]
      );

      const signature = await operator.signMessage(
        ethers.utils.arrayify(messageHash)
      );

      // Set max discount
      await collection.setMaxDiscountPercent(30);

      // Mint with discount
      await collection
        .connect(wallets[1] as any)
        .mintWithToken(
          mockUSDC.address,
          wallets[1].address,
          1,
          1,
          discountPercent,
          nonce,
          signature
        );

      // Check discount was applied (80% of original price)
      const discountedPrice = USD_PRICE.mul(80).div(100);
      expect(await mockUSDC.balanceOf(collection.address)).to.equal(
        discountedPrice
      );

      // Check code was marked as used
      expect(await collection.usedCodes(nonce)).to.equal(wallets[1].address);
    });

    it("should emit DiscountCodeUsed event", async () => {
      // Create signature for discount
      const discountPercent = 20;
      const tierId = 1;
      const nonce = ethers.utils.formatBytes32String("discount123");

      const messageHash = ethers.utils.solidityKeccak256(
        ["bytes32", "address", "uint256", "uint256"],
        [nonce, wallets[1].address, discountPercent, tierId]
      );

      const signature = await operator.signMessage(
        ethers.utils.arrayify(messageHash)
      );

      // Set max discount
      await collection.setMaxDiscountPercent(30);

      // Mint with discount
      await expect(
        collection
          .connect(wallets[1] as any)
          .mintWithToken(
            mockUSDC.address,
            wallets[1].address,
            1,
            1,
            discountPercent,
            nonce,
            signature
          )
      )
        .to.emit(collection, "DiscountCodeUsed")
        .withArgs(wallets[1].address, nonce);
    });

    it("should revert if discount percent exceeds max", async () => {
      // Create signature for discount
      const discountPercent = 40;
      const tierId = 1;
      const nonce = ethers.utils.formatBytes32String("discount123");

      const messageHash = ethers.utils.solidityKeccak256(
        ["bytes32", "address", "uint256", "uint256"],
        [nonce, wallets[1].address, discountPercent, tierId]
      );

      const signature = await operator.signMessage(
        ethers.utils.arrayify(messageHash)
      );

      // Set max discount
      await collection.setMaxDiscountPercent(30);

      // Attempt to mint with excessive discount
      await expect(
        collection
          .connect(wallets[1] as any)
          .mintWithToken(
            mockUSDC.address,
            wallets[1].address,
            1,
            1,
            discountPercent,
            nonce,
            signature
          )
      ).to.be.revertedWith("InvalidDiscountPercent()");
    });

    it("should revert if discount code already used", async () => {
      // Create signature for discount
      const discountPercent = 20;
      const tierId = 1;
      const nonce = ethers.utils.formatBytes32String("discount123");

      const messageHash = ethers.utils.solidityKeccak256(
        ["bytes32", "address", "uint256", "uint256"],
        [nonce, wallets[1].address, discountPercent, tierId]
      );

      const signature = await operator.signMessage(
        ethers.utils.arrayify(messageHash)
      );

      // Set max discount
      await collection.setMaxDiscountPercent(30);

      // Use the code once
      await collection
        .connect(wallets[1] as any)
        .mintWithToken(
          mockUSDC.address,
          wallets[1].address,
          1,
          1,
          discountPercent,
          nonce,
          signature
        );

      // Try to use it again
      await expect(
        collection
          .connect(wallets[1] as any)
          .mintWithToken(
            mockUSDC.address,
            wallets[1].address,
            1,
            1,
            discountPercent,
            nonce,
            signature
          )
      ).to.be.revertedWith("DiscountCodeAlreadyUsed()");
    });

    it("should revert if signature is invalid", async () => {
      // Create signature for discount with wrong signer
      const discountPercent = 20;
      const tierId = 1;
      const nonce = ethers.utils.formatBytes32String("discount123");

      const messageHash = ethers.utils.solidityKeccak256(
        ["bytes32", "address", "uint256", "uint256"],
        [nonce, wallets[1].address, discountPercent, tierId]
      );

      // Sign with wrong account
      const signature = await wallets[4].signMessage(
        ethers.utils.arrayify(messageHash)
      );

      // Set max discount
      await collection.setMaxDiscountPercent(30);

      // Try to use invalid signature
      await expect(
        collection
          .connect(wallets[1] as any)
          .mintWithToken(
            mockUSDC.address,
            wallets[1].address,
            1,
            1,
            discountPercent,
            nonce,
            signature
          )
      ).to.be.revertedWith("InvalidSignature()");
    });
  });

  describe("ETH-based mint with price conversion", () => {
    beforeEach("setup price oracle", async () => {
      // Setup price conversion: 1 ETH = 2000 USDC
      const wethReserve = ethers.utils.parseEther("1");
      const usdcReserve = ethers.utils.parseUnits("2000", 6);

      await mockPair.setReserves(wethReserve, usdcReserve);
      await mockPair.setToken0(mockWETH.address);
      await mockPair.setToken1(mockUSDC.address);
    });

    it("should mint with ETH using price conversion", async () => {
      // PRICE in USD = 0.0006 ETH
      // With ETH at 2000 USD, that's 0.0006 * 2000 = 1.2 USD
      // So we need to send 1.2 / 2000 = 0.0006 ETH
      const ethRequired = USD_PRICE.mul(ethers.utils.parseEther("1")).div(
        ethers.utils.parseUnits("2000", 6)
      );

      const tx = await collection
        .connect(wallets[1] as any)
        .mint(
          wallets[1].address,
          1,
          1,
          0,
          ethers.utils.formatBytes32String(""),
          "0x",
          { value: ethRequired }
        );

      expect(await collection.ownerOf(1)).to.equal(wallets[1].address);

      const receipt = await tx.wait();
      const block = await ethers.provider.getBlock(receipt.blockNumber);
      const timestamp = block.timestamp;

      const subscription = await collection.subscriptions(1);
      expect(subscription.startedTime).to.equal(timestamp);
      expect(subscription.expiredTime).to.equal(timestamp + MONTH_UNIT);
    });

    it("should revert if insufficient ETH sent", async () => {
      const ethRequired = USD_PRICE.mul(ethers.utils.parseEther("1")).div(
        ethers.utils.parseUnits("2000", 6)
      );

      await expect(
        collection
          .connect(wallets[1] as any)
          .mint(
            wallets[1].address,
            1,
            1,
            0,
            ethers.utils.formatBytes32String(""),
            "0x",
            { value: ethRequired.sub(1) }
          )
      ).to.be.revertedWith("InsufficientFunds()");
    });
  });

  describe("Configuration", () => {
    it("should set operator", async () => {
      await collection.setOperator(wallets[5].address);
      expect(await collection.operator()).to.equal(wallets[5].address);
    });

    it("should set max discount percent", async () => {
      await collection.setMaxDiscountPercent(50);
      expect(await collection.maxDiscountPercent()).to.equal(50);
    });

    it("should set discount package", async () => {
      await collection.setDiscountPackage(1, 3, 5); // 5% discount for 3-month package tier 1
      expect(await collection.discountPercents(1, 3)).to.equal(5);
    });

    it("should set Uniswap router", async () => {
      const newRouter = await ethers
        .getContractFactory("MockUniswapRouter")
        .then((f) => f.deploy());
      await collection.setUniswapRouter(newRouter.address);
      expect(await collection.uniswapRouter()).to.equal(newRouter.address);
    });

    it("should set USDC address", async () => {
      const newUSDC = await ethers
        .getContractFactory("MockERC20")
        .then((f) => f.deploy("New USDC", "NUSDC", 6));
      await collection.setUsdc(newUSDC.address);
      expect(await collection.usdc()).to.equal(newUSDC.address);
    });
  });

  describe("Using different stablecoins (USDT)", () => {
    let mockUSDT: Contract;

    beforeEach("setup MTK token", async () => {
      // Create a token with 6 decimals
      const MockToken = await ethers.getContractFactory("MockERC20");
      mockUSDT = await MockToken.deploy("USDT", "USDT", 6);

      // Setup mock pair with 1 MTK = 5 USDC
      const usdtReserve = ethers.utils.parseUnits("5", 6);
      const usdcReserve = ethers.utils.parseUnits("5", 6);

      await mockPair.setReserves(usdtReserve, usdcReserve);
      await mockPair.setToken0(mockUSDT.address);
      await mockPair.setToken1(mockUSDC.address);

      // Whitelist USDT
      await collection.setTokenWhitelist(mockUSDT.address, true);

      // Mint USDT to user
      const mintAmount = ethers.utils.parseUnits("1000", 6);
      await mockUSDT.mint(wallets[1].address, mintAmount);

      // Approve USDT
      await mockUSDT
        .connect(wallets[1] as any)
        .approve(collection.address, ethers.constants.MaxUint256);
    });

    it("should mint with USDT token", async () => {
      const expectedUSDTAmount = USD_PRICE;

      // Mint with USDT
      const tx = await collection
        .connect(wallets[1] as any)
        .mintWithToken(
          mockUSDT.address,
          wallets[1].address,
          1,
          1,
          0,
          ethers.utils.formatBytes32String(""),
          "0x"
        );

      const receipt = await tx.wait();
      const block = await ethers.provider.getBlock(receipt.blockNumber);
      const timestamp = block.timestamp;

      // Check token ownership
      expect(await collection.ownerOf(1)).to.equal(wallets[1].address);

      // Check subscription details
      const subscription = await collection.subscriptions(1);
      expect(subscription.startedTime).to.equal(timestamp);
      expect(subscription.expiredTime).to.equal(timestamp + MONTH_UNIT);
      expect(subscription.tierId).to.equal(1);

      // Check USDT transfer
      expect(await mockUSDT.balanceOf(collection.address)).to.equal(
        expectedUSDTAmount
      );
    });

    it("should extend with USDT token", async () => {
      // First mint with USDC
      const mintTx = await collection
        .connect(wallets[1] as any)
        .mintWithToken(
          mockUSDC.address,
          wallets[1].address,
          1,
          1,
          0,
          ethers.utils.formatBytes32String(""),
          "0x"
        );

      const mintReceipt = await mintTx.wait();
      const mintBlock = await ethers.provider.getBlock(mintReceipt.blockNumber);
      const mintTimestamp = mintBlock.timestamp;

      // Calculate expected USDT amount for 2 month extension
      const expectedUSDTAmount = USD_PRICE.mul(2);

      // Extend with USDT
      const extendTx = await collection
        .connect(wallets[1] as any)
        .extendWithToken(
          mockUSDT.address,
          1,
          2,
          0,
          ethers.utils.formatBytes32String(""),
          "0x"
        );

      // Check subscription expiration
      const subscription = await collection.subscriptions(1);
      expect(subscription.expiredTime).to.equal(
        mintTimestamp + MONTH_UNIT + MONTH_UNIT * 2
      );

      // Check USDT transfer
      expect(await mockUSDT.balanceOf(collection.address)).to.equal(
        expectedUSDTAmount
      );

      // Check USDC balance is still the same from mint
      expect(await mockUSDC.balanceOf(collection.address)).to.equal(USD_PRICE);
    });

    it("should apply discount with USDT token", async () => {
      // Set up a discount package for tier 1, duration 2 months
      await collection.setDiscountPackage(1, 2, 10); // 10% discount

      // First mint with USDC
      const mintTx = await collection
        .connect(wallets[1] as any)
        .mintWithToken(
          mockUSDC.address,
          wallets[1].address,
          1,
          1,
          0,
          ethers.utils.formatBytes32String(""),
          "0x"
        );

      const mintReceipt = await mintTx.wait();
      const mintBlock = await ethers.provider.getBlock(mintReceipt.blockNumber);
      const mintTimestamp = mintBlock.timestamp;

      // Calculate expected MTK amount with 10% discount
      // USD_PRICE*2*0.9 in MTK = USD_PRICE*2*0.9 / 5
      const discountedUsdPrice = USD_PRICE.mul(2).mul(90).div(100);

      // Extend with MTK using package discount
      const extendTx = await collection
        .connect(wallets[1] as any)
        .extendWithToken(
          mockUSDT.address,
          1,
          2,
          0, // Use package discount
          ethers.utils.formatBytes32String(""),
          "0x"
        );

      // Check subscription expiration
      const subscription = await collection.subscriptions(1);
      expect(subscription.expiredTime).to.equal(
        mintTimestamp + MONTH_UNIT + MONTH_UNIT * 2
      );

      // Check USDT transfer with discount
      expect(await mockUSDT.balanceOf(collection.address)).to.equal(
        discountedUsdPrice
      );
    });
  });
  describe("Using different tokens (MTK)", () => {
    let mockMTK: Contract;

    beforeEach("setup MTK token", async () => {
      // Create a token with 9 decimals
      const MockToken = await ethers.getContractFactory("MockERC20");
      mockMTK = await MockToken.deploy("MockToken", "MTK", 9);

      // Setup mock pair with 1 MTK = 5 USDC
      const mtkReserve = ethers.utils.parseUnits("1", 9);
      const usdcReserve = ethers.utils.parseUnits("5", 6);

      await mockPair.setReserves(mtkReserve, usdcReserve);
      await mockPair.setToken0(mockMTK.address);
      await mockPair.setToken1(mockUSDC.address);

      // Whitelist MTK
      await collection.setTokenWhitelist(mockMTK.address, true);

      // Mint MTK to user
      const mintAmount = ethers.utils.parseUnits("1000", 9);
      await mockMTK.mint(wallets[1].address, mintAmount);

      // Approve MTK
      await mockMTK
        .connect(wallets[1] as any)
        .approve(collection.address, ethers.constants.MaxUint256);
    });

    it("should mint with MTK token", async () => {
      // Calculate expected MTK amount
      // If 1 MTK = 5 USDC, then USD_PRICE in MTK = USD_PRICE / 5
      const expectedMTKAmount = USD_PRICE.mul(
        ethers.utils.parseUnits("1", 9)
      ).div(ethers.utils.parseUnits("5", 6));

      // Mint with MTK
      const tx = await collection
        .connect(wallets[1] as any)
        .mintWithToken(
          mockMTK.address,
          wallets[1].address,
          1,
          1,
          0,
          ethers.utils.formatBytes32String(""),
          "0x"
        );

      const receipt = await tx.wait();
      const block = await ethers.provider.getBlock(receipt.blockNumber);
      const timestamp = block.timestamp;

      // Check token ownership
      expect(await collection.ownerOf(1)).to.equal(wallets[1].address);

      // Check subscription details
      const subscription = await collection.subscriptions(1);
      expect(subscription.startedTime).to.equal(timestamp);
      expect(subscription.expiredTime).to.equal(timestamp + MONTH_UNIT);
      expect(subscription.tierId).to.equal(1);

      // Check MTK transfer
      expect(await mockMTK.balanceOf(collection.address)).to.equal(
        expectedMTKAmount
      );
    });

    it("should extend with MTK token", async () => {
      // First mint with USDC
      const mintTx = await collection
        .connect(wallets[1] as any)
        .mintWithToken(
          mockUSDC.address,
          wallets[1].address,
          1,
          1,
          0,
          ethers.utils.formatBytes32String(""),
          "0x"
        );

      const mintReceipt = await mintTx.wait();
      const mintBlock = await ethers.provider.getBlock(mintReceipt.blockNumber);
      const mintTimestamp = mintBlock.timestamp;

      // Calculate expected MTK amount for 2 month extension
      // If 1 MTK = 5 USDC, then USD_PRICE*2 in MTK = USD_PRICE*2 / 5
      const expectedMTKAmount = USD_PRICE.mul(2)
        .mul(ethers.utils.parseUnits("1", 9))
        .div(ethers.utils.parseUnits("5", 6));

      // Extend with MTK
      const extendTx = await collection
        .connect(wallets[1] as any)
        .extendWithToken(
          mockMTK.address,
          1,
          2,
          0,
          ethers.utils.formatBytes32String(""),
          "0x"
        );

      // Check subscription expiration
      const subscription = await collection.subscriptions(1);
      expect(subscription.expiredTime).to.equal(
        mintTimestamp + MONTH_UNIT + MONTH_UNIT * 2
      );

      // Check MTK transfer
      expect(await mockMTK.balanceOf(collection.address)).to.equal(
        expectedMTKAmount
      );

      // Check USDC balance is still the same from mint
      expect(await mockUSDC.balanceOf(collection.address)).to.equal(USD_PRICE);
    });

    it("should apply discount with MTK token", async () => {
      // Set up a discount package for tier 1, duration 2 months
      await collection.setDiscountPackage(1, 2, 10); // 10% discount

      // First mint with USDC
      const mintTx = await collection
        .connect(wallets[1] as any)
        .mintWithToken(
          mockUSDC.address,
          wallets[1].address,
          1,
          1,
          0,
          ethers.utils.formatBytes32String(""),
          "0x"
        );

      const mintReceipt = await mintTx.wait();
      const mintBlock = await ethers.provider.getBlock(mintReceipt.blockNumber);
      const mintTimestamp = mintBlock.timestamp;

      // Calculate expected MTK amount with 10% discount
      // USD_PRICE*2*0.9 in MTK = USD_PRICE*2*0.9 / 5
      const discountedUsdPrice = USD_PRICE.mul(2).mul(90).div(100);
      const expectedMTKAmount = discountedUsdPrice
        .mul(ethers.utils.parseUnits("1", 9))
        .div(ethers.utils.parseUnits("5", 6));

      // Extend with MTK using package discount
      const extendTx = await collection
        .connect(wallets[1] as any)
        .extendWithToken(
          mockMTK.address,
          1,
          2,
          0, // Use package discount
          ethers.utils.formatBytes32String(""),
          "0x"
        );

      // Check subscription expiration
      const subscription = await collection.subscriptions(1);
      expect(subscription.expiredTime).to.equal(
        mintTimestamp + MONTH_UNIT + MONTH_UNIT * 2
      );

      // Check MTK transfer with discount
      expect(await mockMTK.balanceOf(collection.address)).to.equal(
        expectedMTKAmount
      );
    });
  });
});
