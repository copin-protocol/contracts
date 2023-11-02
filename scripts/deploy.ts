import { ethers, run } from "hardhat";

async function main() {
  const [wallet] = await ethers.getSigners();

  const Collection = await ethers.getContractFactory("Subscription");
  const collection = await Collection.deploy(wallet.address);
  await collection.deployed();
  console.log("NFT Collection deployed to:", collection.address);

  await new Promise((resolve) => {
    setTimeout(() => {
      resolve(true);
    }, 10000);
  });

  await run("verify:verify", {
    address: collection.address,
    constructorArguments: [wallet.address],
  });
}

main();
