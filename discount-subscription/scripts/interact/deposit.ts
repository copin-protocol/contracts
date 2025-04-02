import { ethers } from "hardhat";
import discountNft from "../deploy/discount_nft.json";
import {parseWithDecimal} from '../../test/utils/fixtures'

async function main() {
  const discountNftContract = await ethers.getContractAt(
    "DiscountNFT",
    discountNft.contract
  );

  const depositAmount = parseWithDecimal("0.01");
  const tx = await discountNftContract.depositEth({value: depositAmount});
  await tx.wait(); 
  console.log("Deposit successfully : ",tx.hash);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
