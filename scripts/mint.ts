import { ethers, run } from "hardhat";
import { abi } from "../artifacts/contracts/Subscription.sol/Subscription.json";

async function main() {
  const [, wallet2] = await ethers.getSigners();

  const collection = await new ethers.Contract(
    "0x24994b0F5cbDB1e1bbfc80d41875aAEFa713a2F0",
    abi,
    wallet2 as any
  );
  const tx = await collection.mint(1, 1, {
    value: ethers.utils.parseEther("0.0006"),
  });
  console.log(tx);
}

main();
