import { expect } from "../utils/expect";
import { ethers, waffle } from "hardhat";
import { completeFixture } from "../utils/fixtures";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { Contract, Event } from "ethers";
import { MONTH_UNIT } from "../utils/constants";

const PRICE = ethers.utils.parseEther("0.0006");

describe("Account", () => {
  const createFixtureLoader = waffle.createFixtureLoader;
  let loadFixture: any;
  let collection: Contract;
  let wallets: SignerWithAddress[];

  const fixture = async (wallets: SignerWithAddress[]) => {
    const { collection } = await completeFixture(wallets);
    return {
      collection,
    };
  };

  before("create fixture loader", async () => {
    wallets = await ethers.getSigners();
    loadFixture = createFixtureLoader(wallets as any[]);
  });
  beforeEach("load fixture", async () => {
    ({ collection } = await loadFixture(fixture));
  });

  describe("OWNERSHIP", () => {
    it("factory transferOwnership", async () => {
      await collection.transferOwnership(wallets[1].address);
      expect(await collection.owner()).to.equal(wallets[1].address);
      await collection
        .connect(wallets[1] as any)
        .addTier(ethers.utils.formatBytes32String("Premium"), PRICE);
      const tier1 = await collection.tiers(1);
      expect(tier1.name).to.equal(ethers.utils.formatBytes32String("Premium"));
    });
    it("emit event", async () => {
      await expect(collection.transferOwnership(wallets[1].address))
        .to.be.emit(collection, "OwnershipTransferred")
        .withArgs(wallets[0].address, wallets[1].address);
    });
    it("revert old owner action", async () => {
      await collection.transferOwnership(wallets[1].address);
      await expect(
        collection.addTier(ethers.utils.formatBytes32String("Premium"), PRICE)
      ).to.be.revertedWith("UNAUTHORIZED");
    });
  });

  describe("mint", () => {
    beforeEach("create tier", async () => {
      await collection.addTier(
        ethers.utils.formatBytes32String("Premium"),
        PRICE
      );
    });
    it("success", async () => {
      await collection.connect(wallets[1] as any).mint(1, 1, {
        value: PRICE,
      });
      expect(await collection.ownerOf(1)).is.equal(wallets[1].address);

      const blockNum = await ethers.provider.getBlockNumber();
      const block = await ethers.provider.getBlock(blockNum);
      const timestamp = block.timestamp;

      const subscription = await collection.subscriptions(1);
      expect(subscription.startedTime).is.equal(timestamp);
      expect(subscription.expiredTime).is.equal(timestamp + MONTH_UNIT);
      expect(subscription.tierId).is.equal(1);
      expect(subscription.owner).is.equal(wallets[1].address);
    });
    it("emit event", async () => {
      const tx = await collection.connect(wallets[1] as any).mint(1, 1, {
        value: PRICE,
      });
      const blockNum = await ethers.provider.getBlockNumber();
      const block = await ethers.provider.getBlock(blockNum);
      const timestamp = block.timestamp;
      await expect(tx)
        .to.emit(collection, "Mint")
        .withArgs(
          1,
          1,
          PRICE,
          timestamp,
          timestamp + MONTH_UNIT,
          wallets[1].address
        );
    });
    it("success 12 months", async () => {
      await collection.connect(wallets[1] as any).mint(1, 1, {
        value: PRICE.mul(12).mul(89).div(100),
      });
      expect(await collection.ownerOf(1)).is.equal(wallets[1].address);
    });
    it("revert InvalidTier()", async () => {
      const tx = collection.connect(wallets[1] as any).mint(2, 1, {
        value: PRICE,
      });
      await expect(tx).to.be.revertedWith("InvalidTier()");
    });
    it("revert TierDisabled()", async () => {
      await collection.enableTier(1, false);
      const tx = collection.connect(wallets[1] as any).mint(1, 1, {
        value: PRICE,
      });
      await expect(tx).to.be.revertedWith("TierDisabled()");
    });
    it("revert InvalidDuration()", async () => {
      const tx = collection.connect(wallets[1] as any).mint(1, 0, {
        value: PRICE,
      });
      await expect(tx).to.be.revertedWith("InvalidDuration()");

      const tx2 = collection.connect(wallets[1] as any).mint(1, 13, {
        value: PRICE.mul(13),
      });
      await expect(tx2).to.be.revertedWith("InvalidDuration()");
    });
    it("revert InsufficientFunds()", async () => {
      const tx = collection.connect(wallets[1] as any).mint(1, 1, {
        value: PRICE.sub(1),
      });
      await expect(tx).to.be.revertedWith("InsufficientFunds()");

      const tx2 = collection.connect(wallets[1] as any).mint(1, 12, {
        value: PRICE.mul(12).mul(89).div(100).sub(1),
      });
      await expect(tx2).to.be.revertedWith("InsufficientFunds()");
    });
  });

  describe("extend", () => {
    let mintTimestamp: number;
    beforeEach("create tier and mint", async () => {
      await collection.addTier(
        ethers.utils.formatBytes32String("Premium"),
        PRICE
      );
      await collection.connect(wallets[1] as any).mint(1, 1, {
        value: PRICE,
      });
      const blockNum = await ethers.provider.getBlockNumber();
      const block = await ethers.provider.getBlock(blockNum);
      mintTimestamp = block.timestamp;
    });
    it("success", async () => {
      await collection.connect(wallets[1] as any).extend(1, 1, {
        value: PRICE,
      });
      expect(await collection.ownerOf(1)).is.equal(wallets[1].address);

      const subscription = await collection.subscriptions(1);
      expect(subscription.startedTime).is.equal(mintTimestamp);
      expect(subscription.expiredTime).is.equal(
        mintTimestamp + MONTH_UNIT + MONTH_UNIT
      );
      expect(subscription.tierId).is.equal(1);
      expect(subscription.owner).is.equal(wallets[1].address);
    });
    it("emit event", async () => {
      const tx = await collection.connect(wallets[1] as any).extend(1, 3, {
        value: PRICE.mul(3).mul(98).div(100),
      });
      await expect(tx)
        .to.emit(collection, "Extend")
        .withArgs(
          1,
          PRICE.mul(3).mul(98).div(100),
          mintTimestamp + MONTH_UNIT,
          mintTimestamp + MONTH_UNIT + MONTH_UNIT * 3
        );
    });
    it("success 12 months", async () => {
      await collection.connect(wallets[1] as any).extend(1, 12, {
        value: PRICE.mul(12).mul(89).div(100),
      });
      expect(await collection.ownerOf(1)).is.equal(wallets[1].address);
    });
    it("revert TierDisabled()", async () => {
      await collection.enableTier(1, false);
      const tx = collection.connect(wallets[1] as any).extend(1, 1, {
        value: PRICE,
      });
      await expect(tx).to.be.revertedWith("TierDisabled()");
    });
    it("revert InvalidSubscriptionPlan()", async () => {
      const tx = collection.connect(wallets[1] as any).extend(2, 1, {
        value: PRICE,
      });
      await expect(tx).to.be.revertedWith("InvalidSubscriptionPlan()");
    });
    it("revert SubscriptionExpired()", async () => {
      await ethers.provider.send("evm_increaseTime", [MONTH_UNIT]);
      await ethers.provider.send("evm_mine", []);
      const tx = collection.connect(wallets[1] as any).extend(1, 1, {
        value: PRICE,
      });
      await expect(tx).to.be.revertedWith("SubscriptionExpired()");
    });
    it("revert InvalidDuration()", async () => {
      const tx = collection.connect(wallets[1] as any).extend(1, 0, {
        value: PRICE,
      });
      await expect(tx).to.be.revertedWith("InvalidDuration()");

      const tx2 = collection.connect(wallets[1] as any).extend(1, 13, {
        value: PRICE.mul(13),
      });
      await expect(tx2).to.be.revertedWith("InvalidDuration()");
    });
    it("revert InsufficientFunds()", async () => {
      const tx = collection.connect(wallets[1] as any).extend(1, 1, {
        value: PRICE.sub(1),
      });
      await expect(tx).to.be.revertedWith("InsufficientFunds()");

      const tx2 = collection.connect(wallets[1] as any).extend(1, 12, {
        value: PRICE.mul(12).mul(89).div(100).sub(1),
      });
      await expect(tx2).to.be.revertedWith("InsufficientFunds()");
    });
  });
  describe("addTier", () => {
    it("success", async () => {
      await collection.addTier(
        ethers.utils.formatBytes32String("PREMIUM"),
        PRICE
      );
      const tier1 = await collection.tiers(1);
      expect(tier1.name).to.equal(ethers.utils.formatBytes32String("PREMIUM"));
      expect(tier1.price).to.equal(PRICE);

      await collection.addTier(
        ethers.utils.formatBytes32String("VIP"),
        PRICE.mul(2)
      );
      const tier2 = await collection.tiers(2);
      expect(tier2.name).to.equal(ethers.utils.formatBytes32String("VIP"));
      expect(tier2.price).to.equal(PRICE.mul(2));
    });
    it("emit event", async () => {
      const tx = await collection.addTier(
        ethers.utils.formatBytes32String("PREMIUM"),
        PRICE
      );
      await expect(tx)
        .to.emit(collection, "AddTier")
        .withArgs(1, ethers.utils.formatBytes32String("PREMIUM"), PRICE);
    });
    it("revert only owner", async () => {
      const tx = collection
        .connect(wallets[1] as any)
        .addTier(ethers.utils.formatBytes32String("PREMIUM"), PRICE);
      await expect(tx).to.be.revertedWith("UNAUTHORIZED");
    });
    it("revert zero price", async () => {
      const tx = collection.addTier(
        ethers.utils.formatBytes32String("PREMIUM"),
        0
      );
      await expect(tx).to.be.revertedWith("ZeroPrice()");
    });
  });

  describe("changeTierPrice", () => {
    it("success", async () => {
      await collection.addTier(
        ethers.utils.formatBytes32String("PREMIUM"),
        PRICE
      );
      await collection.changeTierPrice(1, PRICE.mul(2));
      const tier = await collection.tiers(1);

      expect(tier.price).to.equal(PRICE.mul(2));
    });
    it("emit event", async () => {
      await collection.addTier(
        ethers.utils.formatBytes32String("PREMIUM"),
        PRICE
      );
      const tx = await collection.changeTierPrice(1, PRICE.mul(2));
      await expect(tx)
        .to.emit(collection, "ChangeTierPrice")
        .withArgs(1, PRICE, PRICE.mul(2));
    });
    it("revert only owner", async () => {
      await collection.addTier(
        ethers.utils.formatBytes32String("PREMIUM"),
        PRICE
      );
      const tx = collection
        .connect(wallets[1] as any)
        .changeTierPrice(1, PRICE.mul(2));
      await expect(tx).to.be.revertedWith("UNAUTHORIZED");
    });
    it("revert zero price", async () => {
      await collection.addTier(
        ethers.utils.formatBytes32String("PREMIUM"),
        PRICE
      );
      const tx = collection.changeTierPrice(1, 0);
      await expect(tx).to.be.revertedWith("ZeroPrice()");
    });
    it("revert invalid tier", async () => {
      const tx = collection.changeTierPrice(1, 0);
      await expect(tx).to.be.revertedWith("InvalidTier()");
    });
  });

  describe("enableTier", () => {
    it("success", async () => {
      await collection.addTier(
        ethers.utils.formatBytes32String("PREMIUM"),
        PRICE
      );
      await collection.enableTier(1, false);
      const tier1 = await collection.tiers(1);
      expect(tier1.enabled).to.equal(false);
      await collection.enableTier(1, true);
      const tier2 = await collection.tiers(1);
      expect(tier2.enabled).to.equal(true);
    });
    it("emit event", async () => {
      await collection.addTier(
        ethers.utils.formatBytes32String("PREMIUM"),
        PRICE
      );
      const tx = await collection.enableTier(1, false);
      await expect(tx).to.emit(collection, "EnableTier").withArgs(1, false);
    });
    it("revert only owner", async () => {
      await collection.addTier(
        ethers.utils.formatBytes32String("PREMIUM"),
        PRICE
      );
      const tx = collection.connect(wallets[1] as any).enableTier(1, false);
      await expect(tx).to.be.revertedWith("UNAUTHORIZED");
    });
    it("revert invalid tier", async () => {
      const tx = collection.enableTier(1, false);
      await expect(tx).to.be.revertedWith("InvalidTier()");
    });
  });

  describe("withdrawEth", () => {
    it("success", async () => {
      await collection.addTier(
        ethers.utils.formatBytes32String("PREMIUM"),
        PRICE
      );
      await collection.connect(wallets[1] as any).mint(1, 1, {
        value: PRICE,
      });
      const beforeBalance = await ethers.provider.getBalance(
        wallets[2].address
      );

      await collection.withdrawEth(wallets[2].address, PRICE);
      const afterBalance = await ethers.provider.getBalance(wallets[2].address);

      expect(afterBalance.sub(PRICE)).to.equal(beforeBalance);
    });
    it("emit event", async () => {
      await collection.addTier(
        ethers.utils.formatBytes32String("PREMIUM"),
        PRICE
      );
      await collection.connect(wallets[1] as any).mint(1, 1, {
        value: PRICE,
      });

      const tx = await collection.withdrawEth(wallets[2].address, PRICE);
      await expect(tx)
        .to.emit(collection, "EthWithdraw")
        .withArgs(wallets[2].address, PRICE);
    });
    it("revert only owner", async () => {
      await collection.addTier(
        ethers.utils.formatBytes32String("PREMIUM"),
        PRICE
      );
      await collection.connect(wallets[1] as any).mint(1, 1, {
        value: PRICE,
      });

      const tx = collection
        .connect(wallets[1] as any)
        .withdrawEth(wallets[2].address, PRICE);
      await expect(tx).to.be.revertedWith("UNAUTHORIZED");
    });
    it("revert zero address", async () => {
      await collection.addTier(
        ethers.utils.formatBytes32String("PREMIUM"),
        PRICE
      );
      await collection.connect(wallets[1] as any).mint(1, 1, {
        value: PRICE,
      });

      const tx = collection.withdrawEth(ethers.constants.AddressZero, PRICE);
      await expect(tx).to.be.revertedWith("AddressZero()");
    });
    it("revert invalid withdrawal amount", async () => {
      await collection.addTier(
        ethers.utils.formatBytes32String("PREMIUM"),
        PRICE
      );
      await collection.connect(wallets[1] as any).mint(1, 1, {
        value: PRICE,
      });

      const tx = collection.withdrawEth(wallets[2].address, PRICE.mul(2));
      await expect(tx).to.be.revertedWith("EthWithdrawalFailed()");
    });
  });
});
