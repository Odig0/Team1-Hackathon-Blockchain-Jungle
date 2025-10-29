"use client";

import type React from "react";

interface Country {
  code: string;
  symbol: string;
  rate: number;
}

interface DepositBorrowCalculatorProps {
  usdt: string;
  setUsdt: (value: string) => void;
  country: Country;
  formattedLocal: string;
  loanAmount: number;
  fmt: (value: number, locale?: string, decimals?: number) => string;
  validationError?: string | null;
}

export const DepositBorrowCalculator: React.FC<DepositBorrowCalculatorProps> = ({
  usdt,
  setUsdt,
  country,
  formattedLocal,
  loanAmount,
  fmt,
  validationError,
}) => {
  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-bold text-gray-800 mb-3">💰 Deposit USDC</label>
        <div className="relative group">
          <div className="absolute left-4 top-1/2 transform -translate-y-1/2 text-2xl text-green-500 group-focus-within:scale-110 transition-transform">+</div>
          <input
            type="text"
            value={usdt}
            onChange={e => setUsdt(e.target.value)}
            placeholder="0.00"
            className={`w-full border-2 rounded-2xl px-12 py-4 text-lg font-semibold transition-all duration-200 shadow-sm ${
              validationError
                ? "border-red-300 bg-red-50 focus:border-red-500 focus:ring-2 focus:ring-red-200"
                : "border-gray-300 bg-white hover:border-green-400 hover:bg-green-50 focus:border-green-500 focus:bg-green-50 focus:ring-2 focus:ring-green-200 hover:shadow-md"
            } focus:outline-none`}
          />
          <div className="absolute right-4 top-1/2 transform -translate-y-1/2 text-gray-600 font-bold group-focus-within:text-green-600 transition-colors">USDC</div>
        </div>
        {validationError && <div className="mt-2 text-sm text-red-600 font-medium">💡 {validationError}</div>}
      </div>

      {!validationError && (!usdt || parseFloat(usdt) === 0) && (
        <div className="bg-yellow-50 border-2 border-yellow-200 rounded-2xl p-4 animate-pulse-slow">
          <div className="flex items-center gap-2">
            <span className="text-yellow-600">💡</span>
            <span className="text-sm font-bold text-gray-700">Enter an amount to see how much you can borrow</span>
          </div>
        </div>
      )}

      {usdt && parseFloat(usdt) > 0 && !validationError && (
        <div className="space-y-3 pt-2 animate-fade-in">
          <div className="bg-gradient-to-r from-green-50 to-emerald-50 border-2 border-green-200 rounded-2xl p-4 hover:shadow-md transition-shadow">
            <div className="flex justify-between items-center">
              <span className="text-sm font-bold text-gray-700">💵 You'll receive in {country.code}</span>
              <span className="text-lg font-extrabold text-green-700">
                {country.symbol} {formattedLocal}
              </span>
            </div>
          </div>

          <div className="bg-gradient-to-r from-blue-50 to-cyan-50 border-2 border-blue-200 rounded-2xl p-4 hover:shadow-md transition-shadow">
            <div className="flex justify-between items-center">
              <span className="text-sm font-bold text-gray-700">🎯 Loan (50%)</span>
              <span className="text-lg font-extrabold text-blue-700">
                {country.symbol} {fmt(loanAmount)}
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
