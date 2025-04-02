import { ethers } from "hardhat";
import subDiscount from "../deploy/subscription-discount.json";
import { operator } from "../../config";

async function main() {
  const subDiscountContract = await ethers.getContractAt(
    "SubscriptionDiscount",
    subDiscount.contract
  );

  const discountPercent = 60
  const tx = await subDiscountContract.setMaxDiscountPercent(discountPercent);

  await tx.wait(); 
  console.log("Update successfully : ",tx.hash);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
