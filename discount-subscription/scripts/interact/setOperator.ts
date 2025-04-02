import { ethers } from "hardhat";
import subDiscount from "../deploy/subscription-discount.json";
import { operator } from "../../config";

async function main() {
  const discountNftContract = await ethers.getContractAt(
    "SubscriptionDiscount",
    subDiscount.contract
  );

  const tx = await discountNftContract.setOperator(operator);

  await tx.wait(); 
  console.log("Update successfully : ",tx.hash);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
