// Direcciones de USDC por red
const USDC_ADDRESSES: Record<number, string> = {
  // Base Mainnet
  8453: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
  // Base Sepolia (testnet)
  84532: "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
  // Ethereum Mainnet (fallback)
  1: "0xdAC17F958D2ee523a2206206994597C13D831ec7",
};

export const getUSDCAddress = (chainId: number): string => {
  return USDC_ADDRESSES[chainId] || USDC_ADDRESSES[84532]; // Default to Base Sepolia
};
