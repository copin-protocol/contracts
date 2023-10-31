import { ethers, network } from "hardhat";

async function main() {
  const [wallet] = await ethers.getSigners();

  const Collection = await ethers.getContractFactory("Factory");
  const collection = await Collection.deploy(wallet.address);
  await collection.deployed();
  console.log("NFT Collection deployed to:", collection.address);
}

main();
