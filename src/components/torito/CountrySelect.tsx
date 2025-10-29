"use client";

import type React from "react";

interface Country {
  id: number;
  name: string;
  code: string;
  rate: number;
  symbol: string;
}

// Lista de países de ejemplo
const COUNTRIES: Country[] = [
  { id: 1, name: "Bolivia", code: "BOB", rate: 12, symbol: "Bs" },
  { id: 2, name: "Argentina", code: "ARS", rate: 350, symbol: "$" },
  { id: 3, name: "México", code: "MXN", rate: 17, symbol: "$" },
  { id: 4, name: "Colombia", code: "COP", rate: 4000, symbol: "$" },
];

interface CountrySelectProps {
  countryId: number;
  onSelect: (id: number) => void;
  formatRate: (rate: number) => string;
}

export const CountrySelect: React.FC<CountrySelectProps> = ({ countryId, onSelect }) => {
  return (
    <div className="relative group">
      <select
        value={countryId}
        onChange={e => onSelect(Number(e.target.value))}
        className="w-full bg-white border-2 border-gray-300 rounded-2xl px-4 py-3 text-gray-800 font-semibold appearance-none cursor-pointer hover:border-blue-400 hover:bg-blue-50 focus:outline-none focus:border-blue-500 focus:bg-blue-50 focus:ring-2 focus:ring-blue-200 transition-all duration-200 shadow-sm hover:shadow-md"
      >
        {COUNTRIES.map(country => (
          <option key={country.id} value={country.id}>
            {country.code} {country.name}
          </option>
        ))}
      </select>
      <div className="absolute right-4 top-1/2 transform -translate-y-1/2 pointer-events-none">
        <svg className="w-5 h-5 text-gray-600 group-hover:text-blue-600 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </div>
    </div>
  );
};
