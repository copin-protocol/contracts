import { ethers, run } from "hardhat";
import { abi } from "../artifacts/contracts/Subscription.sol/Subscription.json";

async function main() {
  const [wallet] = await ethers.getSigners();

  const collection = await new ethers.Contract(
    "0x35C1d9d983F055DB1606374489df409B13558c1a",
    abi,
    wallet as any
  );
  const tx = await collection.addTier(
    ethers.utils.formatBytes32String("Premium"),
    ethers.utils.parseEther("0.0006")
  );
  console.log(tx);
}

main();
