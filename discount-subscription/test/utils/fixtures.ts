import "@nomiclabs/hardhat-ethers";
import { ethers } from "hardhat";

export async function completeFixture() {

  const [owner, operator] = await ethers.getSigners();
  const NftSubContract = await ethers.getContractFactory("MockNftSub");
  const nftSubContract = await NftSubContract.deploy();
  const DiscountNftContract = await ethers.getContractFactory("DiscountNFT");
  const discountNftContract = await DiscountNftContract.deploy(nftSubContract.target, owner.address, operator.address);
  return { nftSubContract, discountNftContract };
}


export function parseWithDecimal(value: string, decimals = 18): bigint {
  return ethers.parseUnits(value, decimals);
}