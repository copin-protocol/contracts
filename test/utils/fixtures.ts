import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { ethers } from "hardhat";
// async function v3CoreFactoryFixture([wallet]) {
//   return await waffle.deployContract(wallet, {
//     bytecode: FACTORY_BYTECODE,
//     abi: FACTORY_ABI,
//   });
// }

export async function completeFixture([wallet]: SignerWithAddress[]) {
  const Collection = await ethers.getContractFactory("Subscription");
  const collection = await Collection.deploy(
    wallet.address,
    wallet.address,
    "https://api.copin.io/nft-subscriptions/metadata/"
  );

  return {
    collection,
  };
}

export async function completeFixtureV2(wallets: SignerWithAddress[]) {
  const [owner, user1, user2, operator] = wallets;

  // Deploy mock tokens
  const MockERC20 = await ethers.getContractFactory("MockERC20");
  const mockUSDC = await MockERC20.deploy("USDC", "USDC", 6);
  const mockWETH = await MockERC20.deploy("WETH", "WETH", 18);

  // Deploy mock Uniswap contracts
  const MockUniswapRouter = await ethers.getContractFactory(
    "MockUniswapRouter"
  );
  const mockRouter = await MockUniswapRouter.deploy();
  await mockRouter.setWETH(mockWETH.address);

  const MockUniswapFactory = await ethers.getContractFactory(
    "MockUniswapFactory"
  );
  const mockFactory = await MockUniswapFactory.deploy();
  await mockRouter.setFactory(mockFactory.address);

  const MockUniswapPair = await ethers.getContractFactory("MockUniswapPair");
  const mockPair = await MockUniswapPair.deploy();
  await mockFactory.setPair(mockPair.address);

  // Deploy SubscriptionV2
  const SubscriptionV2 = await ethers.getContractFactory("SubscriptionV2");
  const collection = await SubscriptionV2.deploy(
    owner.address,
    operator.address,
    "https://api.copin.io/nft-subscriptions/metadata/",
    mockRouter.address,
    mockUSDC.address
  );

  return {
    collection,
    mockUSDC,
    mockWETH,
    mockRouter,
    mockFactory,
    mockPair,
  };
}
