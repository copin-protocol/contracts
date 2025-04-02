import { ethers } from "hardhat";

export async function generateSignature(signer: any, keys: string[], values: any) {
  let messageHash = ethers.solidityPackedKeccak256(keys, values);
  let messageHashBinary = ethers.getBytes(messageHash);
  return signer.signMessage(messageHashBinary);
};

export async function generateNonce(key: string[], nonce: any) {
  return ethers.solidityPackedKeccak256(key, nonce);
};
