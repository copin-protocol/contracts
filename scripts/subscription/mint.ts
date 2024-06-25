import { ethers, run } from "hardhat";
import { abi } from "../../artifacts/contracts/Subscription.sol/Subscription.json";

async function main() {
  const [wallet1] = await ethers.getSigners();

  const collection = await new ethers.Contract(
    "0xE77C8B98D21e7Aa2960A90AebDf0B50EAb83Ff55",
    abi,
    wallet1 as any
  );
  const tx = await collection.mint(1, 1, {
    value: ethers.utils.parseEther("0.01"),
  });
  console.log(tx);
}

main();
