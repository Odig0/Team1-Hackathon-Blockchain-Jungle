"use client";

import { useState } from "react";

interface Country {
  id: number;
  name: string;
  code: string;
  rate: number;
  symbol: string;
}

const COUNTRIES: Country[] = [
  { id: 1, name: "Bolivia", code: "BOB", rate: 12, symbol: "Bs" },
  { id: 2, name: "Argentina", code: "ARS", rate: 350, symbol: "$" },
  { id: 3, name: "México", code: "MXN", rate: 17, symbol: "$" },
  { id: 4, name: "Colombia", code: "COP", rate: 4000, symbol: "$" },
];

export const useDeposit = () => {
  const [countryId, setCountryId] = useState<number>(1);
  const [usdt, setUsdt] = useState<string>("");

  const country = COUNTRIES.find(c => c.id === countryId) || COUNTRIES[0];
  const usdtNum = parseFloat(usdt) || 0;
  const localAmount = usdtNum * country.rate;
  const loanAmount = localAmount * 0.5;

  return {
    countryId,
    setCountryId,
    country,
    usdt,
    setUsdt,
    usdtNum,
    localAmount,
    loanAmount,
  };
};
