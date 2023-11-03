import { ethers, run } from "hardhat";
import { abi } from "../artifacts/contracts/Subscription.sol/Subscription.json";

async function main() {
  const [, wallet2] = await ethers.getSigners();

  const collection = await new ethers.Contract(
    "0x24994b0F5cbDB1e1bbfc80d41875aAEFa713a2F0",
    abi,
    wallet2 as any
  );
  const tx = await collection.transferOwnership(
    "0x2a85DC83ed45091D75340Ad47C1072dfBbADd020"
  );
  console.log(tx);
}

main();
