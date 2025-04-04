import { ethers } from "hardhat";
import subDiscount from "../deploy/subscription-discount.json";
import { generateSignature } from "../../test/helper/helper"
import { operator, privKey } from "../../config";
import { parseWithDecimal } from "../../test/utils/fixtures";

async function main() {
  const subscriptionDiscountContract = await ethers.getContractAt(
    "SubscriptionDiscount",
    subDiscount.contract
  );

  const nftPrice = parseWithDecimal('0.0006');
  const discountPercent = 20;
  const priceWithDiscount = nftPrice * BigInt(100 - discountPercent) / BigInt(100);
  const userAmount = priceWithDiscount;
  const tierId = 1
  const duration = 1;
  const nonce = ethers.encodeBytes32String('AXB2DC')
  const signer = await ethers.getSigner(operator);
  const userWallet = new ethers.Wallet(privKey, ethers.provider);
  const signature = await generateSignature(
    signer,
    ['bytes32', 'address', 'uint256', 'uint256'],
    [nonce, userWallet.address, discountPercent, tierId]
  );

  const tx = await subscriptionDiscountContract.connect(userWallet).mint(
    userWallet.address,
    discountPercent,
    nonce,
    signature,
    tierId,
    duration,
    { value: userAmount }
  )
  await tx.wait();
  console.log("Mint nft with discount successfully : ", tx.hash);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
