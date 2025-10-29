export interface Country {
  id: number;
  name: string;
  code: string;
  rate: number;
  symbol: string;
}

export const COUNTRIES: Country[] = [
  { id: 1, name: "Bolivia", code: "BOB", rate: 12, symbol: "Bs" },
  { id: 2, name: "Argentina", code: "ARS", rate: 350, symbol: "$" },
  { id: 3, name: "México", code: "MXN", rate: 17, symbol: "$" },
  { id: 4, name: "Colombia", code: "COP", rate: 4000, symbol: "$" },
];

export const DEFAULT_COUNTRY_ID = 1;
