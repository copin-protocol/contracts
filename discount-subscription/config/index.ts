import * as dotEnv from 'dotenv';

dotEnv.config();

export const coinMcApiKey : string | any = process.env.COINMARKETCAP_API_KEY;
export const privKey : string | any = process.env.PRIVATE_KEY;
export const opscanApiKey: string | any = process.env.OPSCAN_API_KEY; 
export const testnetNodeUrl: string | any = process.env.ALCHEMY_API_TESTNET;
export const mainnetNodeUrl: string | any = process.env.ALCHEMY_API_MAINNET;
export const operator: string | any = process.env.OPERATOR;
export const payer: string | any = process.env.PAYER;
export const owner: string | any = process.env.OWNER;
export const nftSubContractAddress: string | any = process.env.NFT_SUB_CONTRACT_ADDRESS;
