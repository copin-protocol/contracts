import { loadFixture as loadFixtureToolbox } from "@nomicfoundation/hardhat-toolbox/network-helpers";
import "@nomiclabs/hardhat-ethers";
import { expect } from "chai";
import { ethers } from "hardhat";
import { completeFixture } from "../utils/fixtures";
import { generateSignature } from "../helper/helper"
import { parseWithDecimal } from '../utils/fixtures'

describe("NftDiscountTest", function () {
  let subContract: any;
  let subDiscountContract: any;
  let subContractAddress: any;
  let wallets: any;

  const fixture = async () => {
    const { subContract, subDiscountContract } = await completeFixture();
    const subContractAddress = subContract.target;
    wallets = await ethers.getSigners();
    return {
      subContract,
      subDiscountContract,
      subContractAddress,
      wallets,
    };
  };

  beforeEach("load fixture", async () => {
    ({
      subContract,
      subDiscountContract,
      subContractAddress,
      wallets,
    } = await loadFixtureToolbox(fixture));
  });

  describe("Deployment", function () {
    it("Should initialize nft contract with correct initial values", async () => {
      expect(await subContract.target).to.equal(subContractAddress);
      expect(await subDiscountContract.operator()).to.equal(
        wallets[1].address
      );
      expect(await subDiscountContract.payer()).to.equal(wallets[0].address);
    });
  });

    // ==============================================================================================================
    describe("SetMaxDiscountPercent", function () {
    it("Should set max discount percent when called by owner", async function () {
      const newMaxDiscountPercent = 60;

      const tx = await subDiscountContract.connect(wallets[0]).setMaxDiscountPercent(newMaxDiscountPercent);
      expect(await subDiscountContract.maxDiscountPercent()).to.equal(newMaxDiscountPercent);
      
      await expect(tx)
        .to.emit(subDiscountContract, "MaxDiscountPercentSet")
        .withArgs(newMaxDiscountPercent);
    });
  
    it("Should revert when called by non-owner", async function () {
      const newMaxDiscountPercent = 40;
      await expect(
        subDiscountContract.connect(wallets[1]).setMaxDiscountPercent(newMaxDiscountPercent)
      ).to.be.revertedWith("UNAUTHORIZED");
    });
  
    it("Should accept zero discount percent", async function () {
      await subDiscountContract.connect(wallets[0]).setMaxDiscountPercent(0);
      expect(await subDiscountContract.maxDiscountPercent()).to.equal(0);
    });
  });

  // ==============================================================================================================
  describe("deposit", function () {

    it("Should deposit eth successfully", async () => {
      const amount = parseWithDecimal("1");
      await expect(
        subDiscountContract.connect(wallets[0]).depositEth({ value: amount })
      )
        .to.emit(subDiscountContract, "Deposited")
        .withArgs(wallets[0].address, amount);

      const available = await ethers.provider.getBalance(subDiscountContract.target);
      expect(available).to.equal(parseWithDecimal("1"));
    });

    it("Revert if not operator", async function () {
      const amount = parseWithDecimal("0");
      await expect(
        subDiscountContract.connect(wallets[2]).depositEth({ value: amount })
      ).to.be.reverted;
    });

    it("Emit Deposited event", async function () {
      const amount = parseWithDecimal("1");
      await expect(subDiscountContract.connect(wallets[0]).depositEth({ value: amount }))
        .to.emit(subDiscountContract, "Deposited")
        .withArgs(wallets[0].address, amount);
    });
  });

  // ==============================================================================================================

  describe("withdraw", function () {

    it("Should withraw eth successfully", async () => {
      const depositAmount = parseWithDecimal("15");
      const withdrawAmount = parseWithDecimal("2");
      await subDiscountContract.connect(wallets[0]).depositEth({ value: depositAmount });

      const beforeBalance = await ethers.provider.getBalance(
        wallets[0].address
      );

      await subDiscountContract.connect(wallets[0]).withdrawEth(withdrawAmount)
      const available = await ethers.provider.getBalance(subDiscountContract.target);
      expect(available).to.equal(parseWithDecimal("13"));

      const afterBalance = await ethers.provider.getBalance(wallets[0].address);
      expect(afterBalance).to.closeTo((beforeBalance + parseWithDecimal("2")), parseWithDecimal("0.1"));
    });

    it("Revert if not operator", async function () {
      const amount = parseWithDecimal("0");
      await expect(
        subDiscountContract.connect(wallets[2]).withdrawEth(amount)
      ).to.be.reverted;
    });

    it("Emit Withdrawn event", async function () {
      const depositAmount = parseWithDecimal("10");
      const withdrawAmount = parseWithDecimal("2");
      await subDiscountContract.connect(wallets[0]).depositEth({ value: depositAmount });
      await expect(subDiscountContract.connect(wallets[0]).withdrawEth(withdrawAmount))
        .to.emit(subDiscountContract, "Withdrawn")
        .withArgs(wallets[0].address, withdrawAmount);
    });
  });

  // ==============================================================================================================
  // Mint with discount

  describe("mint", function () {
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

      await subDiscountContract
        .connect(ownerWallet)
        .setOperator(operatorWallet.address);

      await subDiscountContract.connect(ownerWallet).depositEth({ value: depositAmount });
      let totalSupplyBefore = await subContract.totalSupply();
      const tokenId = totalSupplyBefore + 1n;
      await expect(subDiscountContract.connect(userWallet).mint(
        userWallet.address,
        discountPercent,
        nonce,
        signature,
        tierId,
        duration,
        { value: userAmount }
      ))
        .to.emit(subDiscountContract, "MintDiscounted")
        .withArgs(userWallet.address, tokenId, nonce, discountPercent);

      const totalSupplyAfter = await subContract.totalSupply();
      expect(totalSupplyAfter).to.equal(totalSupplyBefore + 1n);
      // Check owner of NFT
      const owner = await subContract.ownerOf(tokenId);
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

      await subDiscountContract
        .connect(ownerWallet)
        .setOperator(operatorWallet.address);

      await subDiscountContract.connect(ownerWallet).depositEth({ value: depositAmount });

      await expect(subDiscountContract.connect(userWallet).mint(
        userWallet,
        discountPercent,
        nonce,
        signature,
        tierId,
        duration,
        { value: userAmount })).to.be.revertedWith(
          "Over max discount percent"
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

      await subDiscountContract
        .connect(ownerWallet)
        .setOperator(operatorWallet.address);

      await subDiscountContract.connect(ownerWallet).depositEth({ value: depositAmount });

      await expect(subDiscountContract.connect(userWallet).mint(
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
      await subDiscountContract
        .connect(ownerWallet)
        .setOperator(operatorWallet.address);

      await subDiscountContract.connect(ownerWallet).depositEth({ value: depositAmount });

      await expect(subDiscountContract.connect(userWallet).mint(
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
      await subDiscountContract
        .connect(ownerWallet)
        .setOperator(operatorWallet.address);

      await subDiscountContract.connect(ownerWallet).depositEth({ value: depositAmount });

      await expect(subDiscountContract.connect(userWallet).mint(
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
      await subDiscountContract
        .connect(ownerWallet)
        .setOperator(operatorWallet.address);

      await subDiscountContract.connect(ownerWallet).depositEth({ value: depositAmount });

      await subDiscountContract.connect(userWallet).mint(
        userWallet.address,
        discountPercent,
        nonce,
        signature,
        tierId,
        duration,
        { value: userAmount }
      )

      await expect(subDiscountContract.connect(userWallet).mint(
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
      await subDiscountContract
        .connect(ownerWallet)
        .setOperator(operatorWallet.address);

      await subDiscountContract.connect(ownerWallet).depositEth({ value: depositAmount });

      await expect(subDiscountContract.connect(userWallet).mint(
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
      await subDiscountContract
        .connect(ownerWallet)
        .setOperator(operatorWallet.address);

      await subDiscountContract.connect(ownerWallet).depositEth({ value: depositAmount });
      await expect(subDiscountContract.connect(userWallet).mint(
        userWallet.address,
        discountPercent,
        nonce,
        signature,
        tierId,
        duration,
        { value: userAmount }
      )).to.be.revertedWith("Insufficient discount fund");
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
      await subDiscountContract
        .connect(ownerWallet)
        .setOperator(operatorWallet.address);

      await subDiscountContract.connect(ownerWallet).depositEth({ value: depositAmount });
      await expect(subDiscountContract.connect(userWallet).mint(
        userWallet.address,
        discountPercent,
        nonce,
        signature,
        tierId,
        duration,
        { value: userAmount }
      )).to.be.revertedWith("Insufficient discount fund");
    });
  });

  // ==============================================================================================================
  // setOperator

  describe("setOperator", function () {
    it("Should set operator successfully", async () => {
      await subDiscountContract
        .connect(wallets[0])
        .setOperator(wallets[2].address);

      expect(await subDiscountContract.operator()).to.equal(
        wallets[2].address
      );
    });

    it("Emit OperatorSet event", async () => {
      const setOperator = await subDiscountContract
        .connect(wallets[0])
        .setOperator(wallets[2].address);

      await expect(setOperator)
        .to.emit(subDiscountContract, "OperatorSet")
        .withArgs(wallets[2].address);
    });
  });

  // ==============================================================================================================
  // setPayer

  describe("setPayer", function () {
    it("Should set operator successfully", async () => {
      await subDiscountContract
        .connect(wallets[0])
        .setPayer(wallets[2].address);

      expect(await subDiscountContract.payer()).to.equal(wallets[2].address);
    });

    it("Emit setPayer event", async () => {
      const setPayer = await subDiscountContract
        .connect(wallets[0])
        .setPayer(wallets[2].address);

      await expect(setPayer)
        .to.emit(subDiscountContract, "PayerSet")
        .withArgs(wallets[2].address);
    });
  });
});
