import { ethers, run } from "hardhat";
import { abi } from "../../artifacts/contracts/Subscription.sol/Subscription.json";

async function main() {
  console.log(ethers.utils.formatBytes32String("VIP"));
  console.log(ethers.utils.parseEther("1").toString());
  const [wallet] = await ethers.getSigners();

  const collection = await new ethers.Contract(
    "0x15C03E0bA39Bd0Aa087BEF2e27AB7316A65bcC56",
    abi,
    wallet as any
  );
  const tx = await collection.addTier(
    ethers.utils.formatBytes32String("VIP"),
    ethers.utils.parseEther("0.006")
  );
  console.log(tx);
}

main();
