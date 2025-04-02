import { loadFixture as loadFixtureToolbox } from "@nomicfoundation/hardhat-toolbox/network-helpers";
import "@nomiclabs/hardhat-ethers";
import { expect } from "chai";
import { ethers } from "hardhat";
import { completeFixture } from "../utils/fixtures";
import { generateSignature, generateNonce } from "../helper/helper"
import { parseWithDecimal } from '../utils/fixtures'

describe("NftDiscountTest", function () {
  let nftSubContract: any;
  let discountNftContract: any;
  let discountNftAddress: any;
  let nftSubContractAddress: any;
  let wallets: any;

  const fixture = async () => {
    const { nftSubContract, discountNftContract } = await completeFixture();
    const nftSubContractAddress = nftSubContract.target;
    const discountNftAddress = discountNftContract.target;
    wallets = await ethers.getSigners();
    return {
      nftSubContract,
      discountNftContract,
      nftSubContractAddress,
      discountNftAddress,
      wallets,
    };
  };

  beforeEach("load fixture", async () => {
    ({
      nftSubContract,
      discountNftContract,
      nftSubContractAddress,
      discountNftAddress,
      wallets,
    } = await loadFixtureToolbox(fixture));
  });

  describe("Deployment", function () {
    it("Should initialize nft contract with correct initial values", async () => {
      expect(await nftSubContract.target).to.equal(nftSubContractAddress);
      expect(await discountNftContract.operator()).to.equal(
        wallets[1].address
      );
      expect(await discountNftContract.payer()).to.equal(wallets[0].address);
    });
  });

  // ==============================================================================================================
  describe("deposit", function () {

    it("Should deposit eth successfully", async () => {
      const amount = parseWithDecimal("1");
      await expect(
        discountNftContract.connect(wallets[0]).depositEth({ value: amount })
      )
        .to.emit(discountNftContract, "Deposited")
        .withArgs(wallets[0].address, amount);

      const available = await ethers.provider.getBalance(discountNftContract.target);
      expect(available).to.equal(parseWithDecimal("1"));
    });

    it("Revert if not operator", async function () {
      const amount = parseWithDecimal("0");
      await expect(
        discountNftContract.connect(wallets[2]).depositEth({ value: amount })
      ).to.be.reverted;
    });

    it("Emit Deposited event", async function () {
      const amount = parseWithDecimal("1");
      await expect(discountNftContract.connect(wallets[0]).depositEth({ value: amount }))
        .to.emit(discountNftContract, "Deposited")
        .withArgs(wallets[0].address, amount);
    });
  });

  // ==============================================================================================================

  describe("withdraw", function () {

    it("Should withraw eth successfully", async () => {
      const depositAmount = parseWithDecimal("15");
      const withdrawAmount = parseWithDecimal("2");
      await discountNftContract.connect(wallets[0]).depositEth({ value: depositAmount });

      const beforeBalance = await ethers.provider.getBalance(
        wallets[0].address
      );

      await discountNftContract.connect(wallets[0]).withdrawEth(withdrawAmount)
      const available = await ethers.provider.getBalance(discountNftContract.target);
      expect(available).to.equal(parseWithDecimal("13"));

      const afterBalance = await ethers.provider.getBalance(wallets[0].address);
      expect(afterBalance).to.closeTo((beforeBalance + parseWithDecimal("2")), parseWithDecimal("0.1"));
    });

    it("Revert if not operator", async function () {
      const amount = parseWithDecimal("0");
      await expect(
        discountNftContract.connect(wallets[2]).withdrawEth(amount)
      ).to.be.reverted;
    });

    it("Emit Withdrawn event", async function () {
      const depositAmount = parseWithDecimal("10");
      const withdrawAmount = parseWithDecimal("2");
      await discountNftContract.connect(wallets[0]).depositEth({ value: depositAmount });
      await expect(discountNftContract.connect(wallets[0]).withdrawEth(withdrawAmount))
        .to.emit(discountNftContract, "Withdrawn")
        .withArgs(wallets[0].address, withdrawAmount);
    });
  });

  // ==============================================================================================================
  // Mint nft with discount

  describe("mintNft", function () {
    it("Should mint nft successfully", async () => {
      const ownerWallet = wallets[0];
      const userWallet = wallets[1];
      const operatorWallet = wallets[2];
      const userAmount = parseWithDecimal("0.0255");
      const depositAmount = parseWithDecimal("1");
      const discountPercent = 15;
      const nonce = ethers.encodeBytes32String('AXB1DC')
      const tierId = 1;
      const duration = 1;
      const signature = await generateSignature(
        operatorWallet,
        ['bytes32', 'address', 'uint256', 'uint256'],
        [nonce, userWallet.address, discountPercent, tierId]
      );

      await discountNftContract
        .connect(ownerWallet)
        .setOperator(operatorWallet.address);

      await discountNftContract.connect(ownerWallet).depositEth({ value: depositAmount });
      let totalSupplyBefore = await nftSubContract.totalSupply();
      const tokenId = totalSupplyBefore + 1n;
      await expect(discountNftContract.connect(userWallet).mintNftWithDiscount(
        userWallet.address,
        discountPercent,
        nonce,
        signature,
        tierId,
        duration,
        { value: userAmount }
      ))
        .to.emit(discountNftContract, "MintNFT")
        .withArgs(userWallet.address, discountPercent, nonce, tokenId);

      const totalSupplyAfter = await nftSubContract.totalSupply();
      expect(totalSupplyAfter).to.equal(totalSupplyBefore + 1n);
      // Check owner of NFT
      const owner = await nftSubContract.ownerOf(tokenId);
      expect(owner).to.equal(userWallet.address);
    });

    it("Revert if invalid discount code", async function () {
      const ownerWallet = wallets[0];
      const userWallet = wallets[1];
      const operatorWallet = wallets[2];
      const userAmount = parseWithDecimal("0.0255");
      const depositAmount = parseWithDecimal("1");
      const nonce = ethers.encodeBytes32String('AXB2DC')
      const discountPercent = 55;
      const tierId = 1;
      const duration = 1;

      const signature = await generateSignature(
        operatorWallet,
        ['bytes32', 'address', 'uint256', 'uint256'],
        [nonce, userWallet.address, discountPercent, tierId]
      );

      await discountNftContract
        .connect(ownerWallet)
        .setOperator(operatorWallet.address);

      await discountNftContract.connect(ownerWallet).depositEth({ value: depositAmount });

      await expect(discountNftContract.connect(userWallet).mintNftWithDiscount(
        userWallet,
        discountPercent,
        nonce,
        signature,
        tierId,
        duration,
        { value: userAmount })).to.be.revertedWith(
          "Invalid discount"
        );
    });

    it("Revert if invalid signature due to diff discount code", async function () {
      const ownerWallet = wallets[0];
      const userWallet = wallets[1];
      const operatorWallet = wallets[2];
      const userAmount = parseWithDecimal("0.0255");
      const depositAmount = parseWithDecimal("1");
      const nonce = ethers.encodeBytes32String('AXB2DC')
      const discountPercent = 15;
      const tierId = 1;
      const duration = 1;
      const fakeDiscountPercent = 40;

      const signature = await generateSignature(
        operatorWallet,
        ['bytes32', 'address', 'uint256', 'uint256'],
        [nonce, userWallet.address, discountPercent, tierId]
      );

      await discountNftContract
        .connect(ownerWallet)
        .setOperator(operatorWallet.address);

      await discountNftContract.connect(ownerWallet).depositEth({ value: depositAmount });

      await expect(discountNftContract.connect(userWallet).mintNftWithDiscount(
        userWallet,
        fakeDiscountPercent,
        nonce,
        signature,
        tierId,
        duration,
        { value: userAmount })).to.be.revertedWith(
          "Invalid signature"
        );
    });

    it("Revert if invalid signature due to diff trader wallet", async function () {
      const ownerWallet = wallets[0];
      const userWallet = wallets[1];
      const operatorWallet = wallets[2];
      const fakeuserWallet = wallets[3];
      const userAmount = parseWithDecimal("0.0255");
      const depositAmount = parseWithDecimal("1");
      const nonce = ethers.encodeBytes32String('AXB3DC')
      const discountPercent = 15;
      const tierId = 1;
      const duration = 1;

      const signature = await generateSignature(
        operatorWallet,
        ['bytes32', 'address', 'uint256', 'uint256'],
        [nonce, userWallet.address, discountPercent, tierId]
      );
      await discountNftContract
        .connect(ownerWallet)
        .setOperator(operatorWallet.address);

      await discountNftContract.connect(ownerWallet).depositEth({ value: depositAmount });

      await expect(discountNftContract.connect(userWallet).mintNftWithDiscount(
        fakeuserWallet,
        discountPercent,
        nonce,
        signature,
        tierId,
        duration,
        { value: userAmount })).to.be.revertedWith(
          "Invalid signature"
        );
    });

    it("Revert if invalid signature due to diff operator wallet", async function () {
      const ownerWallet = wallets[0];
      const userWallet = wallets[1];
      const operatorWallet = wallets[2];
      const fakeuserOperator = wallets[3];
      const userAmount = parseWithDecimal("0.0255");
      const depositAmount = parseWithDecimal("1");
      const nonce = ethers.encodeBytes32String('AXB4DC')
      const discountPercent = 15;
      const tierId = 1;
      const duration = 1;

      const signature = await generateSignature(
        fakeuserOperator,
        ['bytes32', 'address', 'uint256', 'uint256'],
        [nonce, userWallet.address, discountPercent, tierId]
      );
      await discountNftContract
        .connect(ownerWallet)
        .setOperator(operatorWallet.address);

      await discountNftContract.connect(ownerWallet).depositEth({ value: depositAmount });

      await expect(discountNftContract.connect(userWallet).mintNftWithDiscount(
        userWallet,
        discountPercent,
        nonce,
        signature,
        tierId,
        duration,
        { value: userAmount })).to.be.revertedWith(
          "Invalid signature"
        );
    });

    //Revert if already redeemed
    it("Revert if already redeemed", async function () {
      const ownerWallet = wallets[0];
      const userWallet = wallets[1];
      const operatorWallet = wallets[2];
      const userAmount = parseWithDecimal("0.0255");
      const depositAmount = parseWithDecimal("1");
      const discountPercent = 15;
      const nonce = ethers.encodeBytes32String('AXB1DC')
      const tierId = 1;
      const duration = 1;
      const signature = await generateSignature(
        operatorWallet,
        ['bytes32', 'address', 'uint256', 'uint256'],
        [nonce, userWallet.address, discountPercent, tierId]
      );
      await discountNftContract
        .connect(ownerWallet)
        .setOperator(operatorWallet.address);

      await discountNftContract.connect(ownerWallet).depositEth({ value: depositAmount });

      await discountNftContract.connect(userWallet).mintNftWithDiscount(
        userWallet.address,
        discountPercent,
        nonce,
        signature,
        tierId,
        duration,
        { value: userAmount }
      )

      await expect(discountNftContract.connect(userWallet).mintNftWithDiscount(
        userWallet.address,
        discountPercent,
        nonce,
        signature,
        tierId,
        duration,
        { value: userAmount }
      )).to.be.revertedWith("Already redeemed");
    });

    //Revert if insufficient user fund
    it("Revert if insufficient user fund", async function () {
      const ownerWallet = wallets[0];
      const userWallet = wallets[1];
      const operatorWallet = wallets[2];
      const userAmount = parseWithDecimal("0.02");
      const depositAmount = parseWithDecimal("1");
      const discountPercent = 15;
      const nonce = ethers.encodeBytes32String('AXB1DC')
      const tierId = 1;
      const duration = 1;
      const signature = await generateSignature(
        operatorWallet,
        ['bytes32', 'address', 'uint256', 'uint256'],
        [nonce, userWallet.address, discountPercent, tierId]
      );
      await discountNftContract
        .connect(ownerWallet)
        .setOperator(operatorWallet.address);

      await discountNftContract.connect(ownerWallet).depositEth({ value: depositAmount });

      await expect(discountNftContract.connect(userWallet).mintNftWithDiscount(
        userWallet.address,
        discountPercent,
        nonce,
        signature,
        tierId,
        duration,
        { value: userAmount }
      )).to.be.revertedWith("Insufficient user fund");
    });

    //Revert if insufficient fund contract
    it("Revert if insufficient fund contract", async function () {
      const ownerWallet = wallets[0];
      const userWallet = wallets[1];
      const operatorWallet = wallets[2];
      const userAmount = parseWithDecimal("0.018");
      const depositAmount = parseWithDecimal("0.01");
      const discountPercent = 40;
      const nonce = ethers.encodeBytes32String('AXB1DC')
      const tierId = 1;
      const duration = 1;
      const signature = await generateSignature(
        operatorWallet,
        ['bytes32', 'address', 'uint256', 'uint256'],
        [nonce, userWallet.address, discountPercent, tierId]
      );
      await discountNftContract
        .connect(ownerWallet)
        .setOperator(operatorWallet.address);

      await discountNftContract.connect(ownerWallet).depositEth({ value: depositAmount });
      await expect(discountNftContract.connect(userWallet).mintNftWithDiscount(
        userWallet.address,
        discountPercent,
        nonce,
        signature,
        tierId,
        duration,
        { value: userAmount }
      )).to.be.revertedWith("Insufficient fund");
    });

    // Transfer nft failed
    it("Revert if transfer nft failed", async function () {
      const ownerWallet = wallets[0];
      const userWallet = wallets[1];
      const operatorWallet = wallets[2];
      const userAmount = parseWithDecimal("0.018");
      const depositAmount = parseWithDecimal("0.01");
      const discountPercent = 40;
      const nonce = ethers.encodeBytes32String('AXB1DC')
      const tierId = 1;
      const duration = 1;
      const signature = await generateSignature(
        operatorWallet,
        ['bytes32', 'address', 'uint256', 'uint256'],
        [nonce, userWallet.address, discountPercent, tierId]
      );
      await discountNftContract
        .connect(ownerWallet)
        .setOperator(operatorWallet.address);

      await discountNftContract.connect(ownerWallet).depositEth({ value: depositAmount });
      await expect(discountNftContract.connect(userWallet).mintNftWithDiscount(
        userWallet.address,
        discountPercent,
        nonce,
        signature,
        tierId,
        duration,
        { value: userAmount }
      )).to.be.revertedWith("Insufficient fund");
    });
  });

  // ==============================================================================================================
  // setOperator

  describe("setOperator", function () {
    it("Should set operator successfully", async () => {
      await discountNftContract
        .connect(wallets[0])
        .setOperator(wallets[2].address);

      expect(await discountNftContract.operator()).to.equal(
        wallets[2].address
      );
    });

    it("Emit OperatorSet event", async () => {
      const setOperator = await discountNftContract
        .connect(wallets[0])
        .setOperator(wallets[2].address);

      await expect(setOperator)
        .to.emit(discountNftContract, "OperatorSet")
        .withArgs(wallets[2].address);
    });
  });

  // ==============================================================================================================
  // setPayer

  describe("setPayer", function () {
    it("Should set operator successfully", async () => {
      await discountNftContract
        .connect(wallets[0])
        .setPayer(wallets[2].address);

      expect(await discountNftContract.payer()).to.equal(wallets[2].address);
    });

    it("Emit setPayer event", async () => {
      const setPayer = await discountNftContract
        .connect(wallets[0])
        .setPayer(wallets[2].address);

      await expect(setPayer)
        .to.emit(discountNftContract, "PayerSet")
        .withArgs(wallets[2].address);
    });
  });
});
