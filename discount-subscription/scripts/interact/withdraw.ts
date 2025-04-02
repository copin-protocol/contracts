import { ethers } from "hardhat";
import subDiscount from "../deploy/subscription-discount.json";
import {parseWithDecimal} from '../../test/utils/fixtures'

async function main() {
  const subDiscountContract = await ethers.getContractAt(
    "SubscriptionDiscount",
    subDiscount.contract
  );

  const withdrawAmount = parseWithDecimal("0.01");

  const tx = await subDiscountContract.withdrawEth(withdrawAmount);
  await tx.wait(); 
  console.log("Withdraw successfully : ",tx.hash);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
