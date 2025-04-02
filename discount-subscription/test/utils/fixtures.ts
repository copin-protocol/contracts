import "@nomiclabs/hardhat-ethers";
import { ethers } from "hardhat";

export async function completeFixture() {

  const [owner, operator] = await ethers.getSigners();
  const SubContract = await ethers.getContractFactory("MockSubscription");
  const subContract = await SubContract.deploy();
  const SubscriptionDiscountContract = await ethers.getContractFactory("SubscriptionDiscount");
  const subDiscountContract = await SubscriptionDiscountContract.deploy(subContract.target, owner.address, operator.address);
  return { subContract, subDiscountContract };
}


export function parseWithDecimal(value: string, decimals = 18): bigint {
  return ethers.parseUnits(value, decimals);
}