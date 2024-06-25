import { ethers, run } from "hardhat";
import { abi } from "../../artifacts/contracts/Subscription.sol/Subscription.json";

async function main() {
  const [wallet1, wallet2] = await ethers.getSigners();

  const collection = await new ethers.Contract(
    "0xE06c2497422b6428350E2E7da24d3FE816166983",
    abi,
    wallet1 as any
  );
  const tx = await collection.transferOwnership(wallet2.address);
  console.log(tx);
}

main();
