import fs from "fs";
import { ethers } from "hardhat";
import { operator, nftSubContractAddress } from "../../config";

async function deployContract() {
  let referralRebateContract;

  const [owner] = await ethers.getSigners();

  try {
    referralRebateContract = await ethers.deployContract("DiscountNFT", [
      nftSubContractAddress,
      owner,
      operator,
    ]);
    await referralRebateContract.waitForDeployment();

    console.log("Contracts deployed successfully.");
    return referralRebateContract;
  } catch (error) {
    console.error("Error deploying contracts:", error);
    throw error;
  }
}

async function saveContractAddress(referralRebateContract: any) {
  try {
    const address = JSON.stringify(
      {
        contract: referralRebateContract.target,
      },
      null,
      4
    );

    fs.writeFile(
      "./scripts/deploy/discount_nft.json",
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
