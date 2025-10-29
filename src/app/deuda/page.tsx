"use client";

import { useState } from "react";
import { ArrowLeftIcon, CheckCircleIcon, ExclamationTriangleIcon } from "@heroicons/react/24/outline";
import Link from "next/link";
import Footer from "src/components/Footer";
import ToritoSvg from "src/svg/ToritoSvg";
import { useAccount } from "wagmi";
import LoginButton from "../../components/LoginButton";
import SignupButton from "../../components/SignupButton";
import { BalancePill } from "../../components/torito/BalancePill";
import { fmt } from "../../utils/number";

export default function DeudaPage() {
  const { address } = useAccount();
  const [alert, setAlert] = useState<null | { type: "success" | "error"; text: string }>(null);
  const [paymentAmount, setPaymentAmount] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);

  // Mock data - reemplazar con hooks reales
  const totalDebtUSDT = 500; // USDC (préstamo original)
  const debtInLocal = 6000; // Bs - Esta es la deuda a pagar
  const exchangeRate = 12; // 1 USDC = 12 Bs
  const nextPaymentDate = "15 Nov 2025";
  const interestRate = 5; // %

  const handlePayment = async () => {
    if (!paymentAmount || parseFloat(paymentAmount) <= 0) {
      setAlert({
        type: "error",
        text: "Enter a valid amount to pay",
      });
      return;
    }

    if (parseFloat(paymentAmount) > debtInLocal) {
      setAlert({
        type: "error",
        text: "Amount cannot be greater than your total debt",
      });
      return;
    }

    setIsProcessing(true);
    setAlert(null);

    // Simular procesamiento
    setTimeout(() => {
      setIsProcessing(false);
      setAlert({
        type: "success",
        text: `Payment of ${paymentAmount} Bs processed successfully!`,
      });
      setPaymentAmount("");
    }, 2000);
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

      {/* Contenido principal */}
      <section className="flex items-center flex-col flex-grow w-full min-h-screen bg-gray-50">
        <div className="w-full max-w-4xl px-6 flex flex-col gap-6 items-center">
          {/* Botón volver */}
          <div className="w-full flex justify-start pt-10">
            <Link
              href="/"
              className="flex items-center gap-2 text-gray-600 hover:text-gray-800 transition-colors font-medium"
            >
              <ArrowLeftIcon className="h-5 w-5" />
              Back to home
            </Link>
          </div>

          <h1 className="text-center w-full leading-tight">
            <span className="block text-5xl md:text-6xl font-extrabold text-gray-800">
              Manage your loan
            </span>
            <span className="block text-xl md:text-2xl text-gray-600 mt-4">
              View and pay your loan at any time
            </span>
          </h1>

          <div className="flex gap-4 flex-wrap justify-center">
            <BalancePill
              label={<>💰 Préstamo Original:</>}
              value={`${fmt(totalDebtUSDT)} USDC`}
              skeleton={false}
            />
            <BalancePill
              label={<>💵 Deuda a Pagar:</>}
              value={`${fmt(debtInLocal)} Bs`}
              skeleton={false}
            />
          </div>
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

            {/* Resumen de deuda */}
            <div className="mb-8 p-6 bg-gradient-to-r from-purple-50 to-pink-50 rounded-2xl border-2 border-purple-200">
              <h2 className="text-2xl font-bold text-purple-900 mb-4">📊 Resumen de tu préstamo</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-white rounded-xl p-4 shadow-sm">
                  <div className="text-sm text-gray-600 mb-1">Préstamo original (USDC)</div>
                  <div className="text-2xl font-bold text-purple-700">{fmt(totalDebtUSDT)} USDC</div>
                  <div className="text-sm text-gray-500 mt-1">1 USDC = {exchangeRate} Bs</div>
                </div>
                <div className="bg-white rounded-xl p-4 shadow-sm">
                  <div className="text-sm text-gray-600 mb-1">Deuda a pagar (Bs)</div>
                  <div className="text-2xl font-bold text-red-700">{fmt(debtInLocal)} Bs</div>
                  <div className="text-sm text-gray-500 mt-1">En moneda local</div>
                </div>
                <div className="bg-white rounded-xl p-4 shadow-sm">
                  <div className="text-sm text-gray-600 mb-1">Tasa de interés</div>
                  <div className="text-2xl font-bold text-purple-700">{interestRate}%</div>
                  <div className="text-sm text-gray-500 mt-1">Anual</div>
                </div>
                <div className="bg-white rounded-xl p-4 shadow-sm">
                  <div className="text-sm text-gray-600 mb-1">Próximo pago</div>
                  <div className="text-lg font-bold text-purple-700">{nextPaymentDate}</div>
                </div>
                <div className="bg-white rounded-xl p-4 shadow-sm">
                  <div className="text-sm text-gray-600 mb-1">Estado</div>
                  <div className="text-lg font-bold text-green-600">✅ Al día</div>
                </div>
              </div>
            </div>

            {/* Formulario de pago */}
            <div className="mb-8">
              <label className="block text-sm font-bold text-gray-800 mb-3">💳 Pagar deuda en Bs</label>
              <div className="relative">
                <input
                  type="number"
                  step="0.01"
                  placeholder="0.00"
                  value={paymentAmount}
                  onChange={e => setPaymentAmount(e.target.value)}
                  className="w-full px-6 py-4 text-2xl font-bold border-2 border-gray-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500 transition-all hover:border-green-300 hover:bg-green-50"
                />
                <span className="absolute right-6 top-1/2 -translate-y-1/2 text-xl font-bold text-gray-400">
                  Bs
                </span>
              </div>
              <div className="flex justify-between mt-3 text-sm">
                <button
                  type="button"
                  onClick={() => setPaymentAmount((debtInLocal * 0.5).toFixed(2))}
                  className="text-blue-600 hover:text-blue-800 font-medium"
                >
                  50% ({fmt(debtInLocal * 0.5)} Bs)
                </button>
                <button
                  type="button"
                  onClick={() => setPaymentAmount(debtInLocal.toFixed(2))}
                  className="text-blue-600 hover:text-blue-800 font-medium"
                >
                  Pagar todo ({fmt(debtInLocal)} Bs)
                </button>
              </div>
            </div>

            {/* Botón de pago */}
            <div className="flex flex-col items-center space-y-4">
              <button
                type="button"
                onClick={handlePayment}
                disabled={!paymentAmount || parseFloat(paymentAmount) <= 0 || isProcessing}
                className={`w-full max-w-md rounded-2xl px-8 py-4 font-bold text-lg shadow-lg transition-all duration-200 transform ${
                  paymentAmount && parseFloat(paymentAmount) > 0 && !isProcessing
                    ? "bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white shadow-green-200 hover:shadow-xl hover:scale-[1.02] active:scale-[0.98]"
                    : "bg-gray-200 text-gray-500 cursor-not-allowed shadow-gray-100"
                }`}
              >
                {isProcessing ? (
                  <div className="flex items-center justify-center">
                    <span className="loading loading-spinner loading-md mr-3" />
                    Procesando pago...
                  </div>
                ) : (
                  "💰 Pagar deuda"
                )}
              </button>

              {paymentAmount && parseFloat(paymentAmount) > 0 && !isProcessing && (
                <div className="text-center space-y-1">
                  <div className="text-sm text-gray-600">⚡ Pago rápido y seguro en Bs</div>
                  <div className="text-xs text-gray-500">
                    Pagarás {paymentAmount} Bs de tu deuda total
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="h-10" />
      </section>

      <Footer />
    </div>
  );
}
