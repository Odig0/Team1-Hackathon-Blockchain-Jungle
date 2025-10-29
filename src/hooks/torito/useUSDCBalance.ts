"use client";

import { useReadContract, useAccount } from "wagmi";
import { formatUnits } from "viem";
import { USDC_TOKEN_ADDRESS } from "@/config/toritoContract";

// ABI del ERC20 para balanceOf
const ERC20_ABI = [
  {
    inputs: [{ name: "account", type: "address" }],
    name: "balanceOf",
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
] as const;

export const useUSDCBalance = () => {
  const { address } = useAccount();

  const { data, isLoading } = useReadContract({
    address: USDC_TOKEN_ADDRESS,
    abi: ERC20_ABI,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
    query: {
      enabled: !!address && !!USDC_TOKEN_ADDRESS,
    },
  });

  // USDC tiene 6 decimales (igual que USDC)
  const balance = data ? parseFloat(formatUnits(data as bigint, 6)) : 0;

  return {
    balance,
    isLoading,
  };
};
