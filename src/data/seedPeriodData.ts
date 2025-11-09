import type { Period } from "../model/types.ts";

export const FISCAL_YEAR_END = 3;

export const seedPeriods: Period[] = [
  {
    id: "2024-3-ANNUAL",
    year: 2024,
    month: 3,
    label: "FY2024",
    isFiscalYearEnd: true,
    fiscalYear: 2024,
    periodType: "ANNUAL",
  },
  {
    id: "2025-3-ANNUAL",
    year: 2025,
    month: 3,
    label: "FY2025",
    isFiscalYearEnd: true,
    fiscalYear: 2025,
    periodType: "ANNUAL",
  },
];
