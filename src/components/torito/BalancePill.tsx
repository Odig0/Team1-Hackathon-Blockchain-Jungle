"use client";

import type React from "react";

interface BalancePillProps {
  label: React.ReactNode;
  value?: string;
  skeleton?: boolean;
}

export const BalancePill: React.FC<BalancePillProps> = ({ label, value, skeleton }) => {
  return (
    <div className="bg-gradient-to-r from-purple-50 to-pink-50 border-2 border-purple-200 rounded-full px-6 py-3 shadow-md">
      <div className="flex items-center gap-2">
        <span className="text-sm font-bold text-gray-700">{label}</span>
        {skeleton ? (
          <div className="animate-pulse bg-gray-300 h-5 w-24 rounded"></div>
        ) : (
          <span className="text-sm font-extrabold text-purple-700">{value || "0 USDC"}</span>
        )}
      </div>
    </div>
  );
};
