import { ethers } from "hardhat";
import discountNft from "../deploy/discount_nft.json";
import { payer } from "../../config";

async function main() {
  const discountNftContract = await ethers.getContractAt(
    "DiscountNFT",
    discountNft.contract
  );

  const tx = await discountNftContract.setPayer(payer);

  await tx.wait(); 
  console.log("Update successfully : ",tx.hash);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
