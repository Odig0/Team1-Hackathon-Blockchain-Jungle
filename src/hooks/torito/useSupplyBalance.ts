"use client";

import { useReadContract, useAccount } from "wagmi";
import {
  TORITO_CONTRACT_ADDRESS,
  TORITO_ABI,
  USDC_TOKEN_ADDRESS,
} from "@/config/toritoContract";
import { formatUnits } from "viem";
import { useEffect } from "react";

export const useSupplyBalance = () => {
  const { address } = useAccount();

  const {
    data,
    isLoading,
    refetch,
  } = useReadContract({
    address: TORITO_CONTRACT_ADDRESS,
    abi: TORITO_ABI,
    functionName: "supplies",
    args: address && USDC_TOKEN_ADDRESS ? [address, USDC_TOKEN_ADDRESS] : undefined,
    query: {
      enabled: !!address && !!USDC_TOKEN_ADDRESS,
    },
  });

  // La función supplies retorna [owner, scaledBalance, token, status]
  const formattedShares = data
    ? formatUnits((data as [string, bigint, string, number])[1], 6)
    : "0";

  // Auto-refetch cuando cambia la dirección
  useEffect(() => {
    if (address) {
      refetch();
    }
  }, [address, refetch]);

  return {
    formattedShares,
    isLoading,
    refetch,
  };
};
