import { ethers, run } from "hardhat";
import { BASE_TOKEN_URI, ROYALTY_RECEIVER } from "../test/utils/constants";

async function main() {
  const [wallet] = await ethers.getSigners();

  const Collection = await ethers.getContractFactory("Subscription");
  const collection = await Collection.deploy(
    wallet.address,
    ROYALTY_RECEIVER,
    BASE_TOKEN_URI
  );
  await collection.deployed();
  console.log("NFT Collection deployed to:", collection.address);

  await new Promise((resolve) => {
    setTimeout(() => {
      resolve(true);
    }, 10000);
  });

  await run("verify:verify", {
    address: collection.address,
    // address: "",
    constructorArguments: [wallet.address, ROYALTY_RECEIVER, BASE_TOKEN_URI],
  });
}

main();
