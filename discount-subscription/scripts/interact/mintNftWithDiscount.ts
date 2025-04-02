import { ethers } from "hardhat";
import discountNft from "../deploy/discount_nft.json";
import { generateSignature } from "../../test/helper/helper"
import { operator, privKey } from "../../config";
import { parseWithDecimal } from "../../test/utils/fixtures";

async function main() {
  const discountNftContract = await ethers.getContractAt(
    "DiscountNFT",
    discountNft.contract
  );

  const discountPercent = 20;
  const userAmount = parseWithDecimal('0.0006');
  const tierId = 1
  const duration = 1;
  const nonce = ethers.encodeBytes32String('AXB4DC')
  const signer = await ethers.getSigner(operator);
  const userWallet = new ethers.Wallet(privKey, ethers.provider);
  const signature = await generateSignature(
    signer,
    ['bytes32', 'address', 'uint256', 'uint256'],
    [nonce, userWallet.address, discountPercent, tierId]
  );
  console.log(nonce)
  console.log(signature)
  console.log(userAmount)

  const tx = await discountNftContract.connect(userWallet).mintNftWithDiscount(
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
