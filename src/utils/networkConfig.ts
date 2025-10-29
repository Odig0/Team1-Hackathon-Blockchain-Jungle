// Direcciones de USDT por red
// NOTE: Estas direcciones se mantienen igual que antes por compatibilidad de pruebas,
// pero puedes reemplazarlas con la dirección correcta de USDT en cada red.
const USDT_ADDRESSES: Record<number, string> = {
  // Avalanche Mainnet (USDT)
  43114: "0xde3a24028580884448a5397872046a019649b084", // Avalanche C-Chain
  
  // Avalanche Mainnet
  8453: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
  
  // Avalanche Mainnet
  84532: "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
  
  // Ethereum Mainnet (fallback)
  1: "0xdAC17F958D2ee523a2206206994597C13D831ec7",
};

export const getUSDTAddress = (chainId: number): string => {
  return USDT_ADDRESSES[chainId] || USDT_ADDRESSES[84532]; // Default to avalanche Sepolia
};
