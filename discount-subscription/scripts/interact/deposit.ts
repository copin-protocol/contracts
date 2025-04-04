import { ethers } from "hardhat";
import subDiscount from "../deploy/subscription-discount.json";
import { parseWithDecimal } from '../../test/utils/fixtures'

async function main() {
  const subDiscountContract = await ethers.getContractAt(
    "SubscriptionDiscount",
    subDiscount.contract
  );

  const depositAmount = parseWithDecimal("0.01");
  const tx = await subDiscountContract.depositEth({ value: depositAmount });
  await tx.wait();
  console.log("Deposit successfully : ", tx.hash);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
