"use client";

import { useState } from "react";
import {
  useWriteContract,
  useWaitForTransactionReceipt,
  useReadContract,
  useAccount,
} from "wagmi";
import { parseUnits } from "viem";
import {
  TORITO_CONTRACT_ADDRESS,
  TORITO_ABI,
  USDC_TOKEN_ADDRESS,
} from "@/config/toritoContract";

// ABI del ERC20 para approve
const ERC20_ABI = [
  {
    inputs: [
      { name: "spender", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    name: "approve",
    outputs: [{ name: "", type: "bool" }],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      { name: "owner", type: "address" },
      { name: "spender", type: "address" },
    ],
    name: "allowance",
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
] as const;

export const useSupply = () => {
  const { address } = useAccount();
  const [isSupplying, setIsSupplying] = useState(false);
  const [isConfirmed, setIsConfirmed] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const { writeContractAsync: writeApprove } = useWriteContract();
  const { writeContractAsync: writeSupply } = useWriteContract();

  // Leer el allowance actual
  const { data: allowanceData } = useReadContract({
    address: USDC_TOKEN_ADDRESS,
    abi: ERC20_ABI,
    functionName: "allowance",
    args: address && TORITO_CONTRACT_ADDRESS ? [address, TORITO_CONTRACT_ADDRESS] : undefined,
    query: {
      enabled: !!address && !!TORITO_CONTRACT_ADDRESS,
    },
  });

  const needsApproval = (amount: string): boolean => {
    if (!allowanceData || !amount) return true;
    const amountWei = parseUnits(amount, 6); // USDC tiene 6 decimales
    return (allowanceData as bigint) < amountWei;
  };

  const approve = async (amount: string): Promise<void> => {
    if (!address) {
      throw new Error("Wallet not connected");
    }

    setIsSupplying(true);
    setError(null);
    try {
      const amountWei = parseUnits(amount, 6);
      
      const hash = await writeApprove({
        address: USDC_TOKEN_ADDRESS,
        abi: ERC20_ABI,
        functionName: "approve",
        args: [TORITO_CONTRACT_ADDRESS, amountWei],
      });

      console.log("Approval transaction sent:", hash);
    } catch (err) {
      setError(err as Error);
      throw err;
    } finally {
      setIsSupplying(false);
    }
  };

  const supply = async (amount: string): Promise<void> => {
    if (!address) {
      throw new Error("Wallet not connected");
    }

    setIsSupplying(true);
    setError(null);
    setIsConfirmed(false);
    try {
      const amountWei = parseUnits(amount, 6);

      const hash = await writeSupply({
        address: TORITO_CONTRACT_ADDRESS,
        abi: TORITO_ABI,
        functionName: "supply",
        args: [USDC_TOKEN_ADDRESS, amountWei],
      });

      console.log("Supply transaction sent:", hash);
      setIsConfirmed(true);
    } catch (err) {
      setError(err as Error);
      throw err;
    } finally {
      setIsSupplying(false);
    }
  };

  return {
    supply,
    approve,
    needsApproval,
    isSupplying,
    isConfirmed,
    error,
  };
};
