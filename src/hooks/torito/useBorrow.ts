"use client";

import { useState } from "react";
import { useWriteContract, useAccount } from "wagmi";
import { parseUnits } from "viem";
import {
  TORITO_CONTRACT_ADDRESS,
  TORITO_ABI,
  USDT_TOKEN_ADDRESS,
  stringToBytes32,
} from "@/config/toritoContract";

export const useBorrow = () => {
  const { address } = useAccount();
  const [isBorrowing, setIsBorrowing] = useState(false);
  const [isConfirmed, setIsConfirmed] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const { writeContractAsync } = useWriteContract();

  const borrow = async (
    collateralToken: string,
    borrowFiat: string,
    fiatCurrency: string
  ): Promise<void> => {
    if (!address) {
      throw new Error("Wallet not connected");
    }

    setIsBorrowing(true);
    setError(null);
    setIsConfirmed(false);

    try {
      // El monto que se pide prestado en moneda local (Bs)
      const borrowAmount = parseUnits(borrowFiat, 2);
      
      // Convertir la currency string a bytes32
      const currencyBytes32 = stringToBytes32(fiatCurrency);

      console.log("Borrow params:", {
        collateralToken,
        borrowAmount: borrowAmount.toString(),
        borrowFiat,
        fiatCurrency,
        currencyBytes32,
      });

      const hash = await writeContractAsync({
        address: TORITO_CONTRACT_ADDRESS,
        abi: TORITO_ABI,
        functionName: "borrow",
        args: [
          collateralToken as `0x${string}`, // collateralToken (el token que ya depositaste)
          borrowAmount, // borrowAmount en formato wei (monto en moneda local con 2 decimales)
          currencyBytes32, // fiatCurrency como bytes32
        ],
      });

      console.log("Borrow transaction sent:", hash);
      setIsConfirmed(true);
    } catch (err) {
      console.error("Borrow error:", err);
      setError(err as Error);
      throw err;
    } finally {
      setIsBorrowing(false);
    }
  };

  return {
    borrow,
    isBorrowing,
    isConfirmed,
    error,
  };
};
