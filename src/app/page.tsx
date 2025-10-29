"use client";

import { useEffect, useState } from "react";
import { CheckCircleIcon, ExclamationTriangleIcon } from "@heroicons/react/24/outline";
import Link from "next/link";
import Footer from "src/components/Footer";
import ToritoSvg from "src/svg/ToritoSvg";
import { useAccount } from "wagmi";
import LoginButton from "../components/LoginButton";
import SignupButton from "../components/SignupButton";
import { DepositBorrowCalculator } from "../components/torito/AmountRow";
import { BalancePill } from "../components/torito/BalancePill";
import { BorrowModal } from "../components/torito/BorrowModal";
import { CountrySelect } from "../components/torito/CountrySelect";
import { useDeposit } from "../hooks/torito/useDeposit";
import { useSupply } from "../hooks/torito/useSupply";
import { useSupplyBalance } from "../hooks/torito/useSupplyBalance";
import { useUSDCBalance } from "../hooks/torito/useUSDCBalance";
import { fmt } from "../utils/number";

export default function Page() {
  const { address } = useAccount();
  const { countryId, setCountryId, country, usdt, setUsdt, usdtNum, localAmount, loanAmount } = useDeposit();
  const { supply, approve, needsApproval, isSupplying, isConfirmed, error: supplyError } = useSupply();
  const { formattedShares, isLoading: isLoadingBalance, refetch: refetchBalance } = useSupplyBalance();
  const { balance: walletUsdcBalance, isLoading: isLoadingUsdcBalance } = useUSDCBalance();

  const [alert, setAlert] = useState<null | { type: "success" | "error"; text: string }>(null);
  const [validationError, setValidationError] = useState<string | null>(null);

  // Validation logic
  const validateUSDTInput = (value: string): string | null => {
    if (!value || value.trim() === "") {
      return "Enter USDC amount";
    }

    const numValue = Number(value);

    if (isNaN(numValue)) {
      return "Must be a valid number";
    }

    if (numValue <= 0) {
      return "Amount must be greater than 0";
    }

    if (numValue > walletUsdcBalance && walletUsdcBalance > 0) {
      return `Not enough USDC (you have ${fmt(walletUsdcBalance)})`;
    }

    // Check for too many decimal places (USDC has 6 decimals max)
    const decimalParts = value.split(".");
    if (decimalParts.length > 1 && decimalParts[1].length > 6) {
      return "Maximum 6 decimal places allowed";
    }

    return null;
  };

  // Validate on USDC change
  useEffect(() => {
    if (usdt) {
      const error = validateUSDTInput(usdt);
      setValidationError(error);
    } else {
      setValidationError(null);
    }
  }, [usdt, walletUsdcBalance]);

  const isValidInput = !validationError && usdt && usdtNum > 0;

  // Efecto para manejar confirmaciones de transacción
  useEffect(() => {
    if (isConfirmed) {
      setAlert({
        type: "success",
        text: "Deposit successfully confirmed on the blockchain!",
      });
      refetchBalance();
      setTimeout(() => setAlert(null), 5000);
    }
  }, [isConfirmed, refetchBalance]);

  // Efecto para manejar errores de transacción
  useEffect(() => {
    if (supplyError) {
      setAlert({
        type: "error",
        text: "Transaction error. Check your USDC balance and allowance.",
      });
    }
  }, [supplyError]);

  const onSend = async () => {
    const validationErr = validateUSDTInput(usdt);
    if (validationErr || !isValidInput || isSupplying) {
      if (validationErr) {
        setAlert({
          type: "error",
          text: validationErr,
        });
      }
      return;
    }

    try {
      setAlert(null);
      setValidationError(null);

      if (needsApproval(usdt)) {
        await approve(usdt);
        setAlert(null);
      }
      await supply(usdt);
      setUsdt("");
    } catch (error) {
      console.error("Error in supply:", error);
      setAlert({
        type: "error",
        text: "Could not send transaction. Check your connection and balance.",
      });
    }
  };

  return (
    <div className="flex h-full w-full flex-col">
      {/* Header - Torito */}
      <section className="mt-6 mb-6 flex w-full flex-col md:flex-row max-w-4xl mx-auto px-6">
        <div className="flex w-full flex-row items-center justify-between gap-2 md:gap-0">
          <div className="cursor-pointer">
            <ToritoSvg />
          </div>
          <div className="flex items-center gap-3">
            <SignupButton />
            {!address && <LoginButton />}
          </div>
        </div>
      </section>

      {/* Contenido principal de Torito */}
      <section className="flex items-center flex-col flex-grow w-full min-h-screen bg-gray-50">
        <div className="w-full max-w-4xl px-6 flex flex-col gap-6 items-center">
          <h1 className="text-center w-full leading-tight pt-10">
            <span className="block text-5xl md:text-6xl font-extrabold text-gray-800">
              Deposit dollars,
              <br className="hidden md:block" /> borrow 50%
              <br />
              in local currency
            </span>
          </h1>

          <div className="flex gap-4 flex-wrap justify-center">
            <BalancePill
              label={<>💰 Your ETH:</>}
              value={isLoadingUsdcBalance ? undefined : `${fmt(walletUsdcBalance, "es-BO", 6)} ETH`}
              skeleton={isLoadingUsdcBalance}
            />
            <BalancePill
              label={
                <>
                  <span style={{ display: "inline-block", transform: "scaleX(-1)" }}>🐂</span> In Torito:
                </>
              }
              value={isLoadingBalance ? undefined : `${fmt(parseFloat(formattedShares), "es-BO", 6)} ETH`}
              skeleton={isLoadingBalance}
            />
          </div>

          {/* Botón para ver deuda */}
          <Link
            href="/deuda"
            className="mt-4 px-6 py-3 bg-gradient-to-r from-purple-500 to-pink-600 hover:from-purple-600 hover:to-pink-700 text-white font-bold rounded-2xl shadow-lg hover:shadow-xl transition-all duration-200 transform hover:scale-105 active:scale-95"
          >
            📊 View and pay my loan
          </Link>
        </div>

        <div className="w-full max-w-4xl mt-8 px-6">
          <div className="bg-white rounded-3xl shadow-xl p-8 md:p-10 lg:p-12 border-2 border-gray-100">
            {alert && (
              <div
                className={`mb-6 rounded-2xl border-2 px-5 py-4 flex items-center gap-3 ${
                  alert.type === "success"
                    ? "bg-green-50 border-green-200 text-green-800"
                    : "bg-red-50 border-red-200 text-red-800"
                }`}
              >
                {alert.type === "success" ? (
                  <CheckCircleIcon className="h-6 w-6 flex-shrink-0" />
                ) : (
                  <ExclamationTriangleIcon className="h-6 w-6 flex-shrink-0" />
                )}
                <span className="text-sm font-medium">{alert.text}</span>
                <button
                  type="button"
                  onClick={() => setAlert(null)}
                  className="ml-auto text-xl hover:opacity-70 transition-opacity"
                >
                  ✕
                </button>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
              <div>
                <label className="block text-sm font-bold text-gray-800 mb-3">🌍 Your Country</label>
                <CountrySelect countryId={countryId} onSelect={setCountryId} formatRate={n => fmt(n)} />
              </div>
              <div className="flex flex-col justify-end">
                <label className="block text-sm font-bold text-gray-800 mb-3">💱 Exchange Rate</label>
                <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border-2 border-blue-200 rounded-2xl px-5 py-4">
                  <div className="text-center">
                    <div className="text-lg font-bold text-blue-800">
                      1 USDC = {country.symbol} {fmt(country.rate)}
                    </div>
                    <div className="text-sm text-blue-600 mt-1">{country.code} • Updated instantly</div>
                  </div>
                </div>
              </div>
            </div>

            <div className="mb-8">
              <DepositBorrowCalculator
                usdt={usdt}
                setUsdt={setUsdt}
                country={country}
                formattedLocal={fmt(localAmount)}
                loanAmount={loanAmount}
                fmt={fmt}
                validationError={validationError}
              />
            </div>

            <div className="flex flex-col items-center space-y-4">
              <button
                type="button"
                onClick={onSend}
                disabled={!isValidInput || isSupplying}
                className={`w-full max-w-md rounded-2xl px-8 py-4 font-bold text-lg shadow-lg transition-all duration-200 transform ${
                  isValidInput && !isSupplying
                    ? "bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white shadow-green-200 hover:shadow-xl hover:scale-[1.02] active:scale-[0.98]"
                    : "bg-gray-200 text-gray-500 cursor-not-allowed shadow-gray-100"
                }`}
              >
                {isSupplying ? (
                  <div className="flex items-center justify-center">
                    <span className="loading loading-spinner loading-md mr-3" />
                    Processing...
                  </div>
                ) : isValidInput && needsApproval(usdt) ? (
                  "🔐 Approve and Deposit USDC"
                ) : isValidInput ? (
                  "💰 Deposit USDC"
                ) : validationError ? (
                  "Fix the errors"
                ) : (
                  "Enter an amount to continue"
                )}
              </button>

              {isValidInput && !isSupplying && (
                <div className="text-center space-y-1">
                  <div className="text-sm text-gray-600">⚡ Fast and secure deposit</div>
                  <div className="text-xs text-gray-500">Your transaction will be confirmed on the blockchain</div>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="h-10" />
      </section>

      {/* Botón flotante de préstamo en la esquina inferior izquierda */}
      <div className="fixed bottom-8 left-8 z-40">
        <BorrowModal />
      </div>

      <Footer />
    </div>
  );
}
