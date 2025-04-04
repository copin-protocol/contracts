import fs from "fs";
import { ethers } from "hardhat";
import { operator, subContractAddress } from "../../config";

async function deployContract() {
  let subDiscountContract;

  const [owner] = await ethers.getSigners();

  try {
    subDiscountContract = await ethers.deployContract("SubscriptionDiscount", [
      subContractAddress,
      owner,
      operator,
    ]);
    await subDiscountContract.waitForDeployment();

    console.log("Contracts deployed successfully.");
    return subDiscountContract;
  } catch (error) {
    console.error("Error deploying contracts:", error);
    throw error;
  }
}

async function saveContractAddress(subDiscountContract: any) {
  try {
    const address = JSON.stringify(
      {
        contract: subDiscountContract.target,
      },
      null,
      4
    );

    fs.writeFile(
      "./scripts/deploy/subscription-discount.json",
      address,
      "utf8",
      (error) => {
        if (error) {
          console.error("Error saving contract address:", error);
        } else {
          console.log("Deployed contract address:", address);
        }
      }
    );
  } catch (error) {
    console.error("Error saving contract address:", error);
    throw error;
  }
}

async function main() {
  let contract;
  try {
    contract = await deployContract();

    await saveContractAddress(contract);

    console.log("Contract deployment completed successfully.");
  } catch (error) {
    console.error("Unhandled error:", error);
  }
}

main().catch((error) => {
  console.error("Unhandled error:", error);
  process.exitCode = 1;
});
