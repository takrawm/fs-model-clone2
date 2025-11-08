import type { Account, TimelinePeriod, Value } from "../model/types.ts";

export const seedAccounts: Account[] = [
  {
    id: "unit_price",
    AccountName: "商品単価",
    GlobalAccountID: null,
    fs_type: "PL",
  },
  {
    id: "quantity",
    AccountName: "販売数量",
    GlobalAccountID: null,
    fs_type: "PL",
  },
  {
    id: "revenue",
    AccountName: "売上高",
    GlobalAccountID: null,
    fs_type: "PL",
  },
  {
    id: "cogs",
    AccountName: "売上原価",
    GlobalAccountID: null,
    fs_type: "PL",
  },
  {
    id: "gross_profit",
    AccountName: "売上総利益",
    GlobalAccountID: null,
    fs_type: "PL",
  },
  {
    id: "operating_profit",
    AccountName: "営業利益",
    GlobalAccountID: null,
    fs_type: "PL",
  },
  {
    id: "depreciation",
    AccountName: "減価償却費",
    GlobalAccountID: null,
    fs_type: "PL",
  },
  {
    id: "other_opex",
    AccountName: "その他販管費",
    GlobalAccountID: null,
    fs_type: "PL",
  },
  {
    id: "total_opex",
    AccountName: "販管費合計",
    GlobalAccountID: null,
    fs_type: "PL",
  },
  {
    id: "income_tax",
    AccountName: "法人税等",
    GlobalAccountID: null,
    fs_type: "PL",
  },
  {
    id: "net_income",
    AccountName: "当期純利益",
    GlobalAccountID: null,
    fs_type: "PL",
  },
];

export const seedPeriods: TimelinePeriod[] = [
  //   { id: "FY2023", label: "FY2023", offset: -1 },
  { id: "FY2024", label: "FY2024", offset: -1 },
  { id: "FY2025", label: "FY2025", offset: 0 },
];

export const seedActualValues: Value[] = [
  //   { accountId: "unit_price", periodId: "FY2023", value: 950, source: "ACTUAL" },
  //   { accountId: "quantity", periodId: "FY2023", value: 480, source: "ACTUAL" },
  //   { accountId: "revenue", periodId: "FY2023", value: 456000, source: "ACTUAL" },
  //   { accountId: "cogs", periodId: "FY2023", value: 273600, source: "ACTUAL" },
  //   {
  //     accountId: "gross_profit",
  //     periodId: "FY2023",
  //     value: 182400,
  //     source: "ACTUAL",
  //   },
  //   { accountId: "opex", periodId: "FY2023", value: 75000, source: "ACTUAL" },
  //   {
  //     accountId: "operating_profit",
  //     periodId: "FY2023",
  //     value: 107400,
  //     source: "ACTUAL",
  //   },
  //   {
  //     accountId: "income_tax",
  //     periodId: "FY2023",
  //     value: 32220,
  //     source: "ACTUAL",
  //   },
  //   {
  //     accountId: "net_income",
  //     periodId: "FY2023",
  //     value: 75180,
  //     source: "ACTUAL",
  //   },
  {
    accountId: "unit_price",
    periodId: "FY2025",
    value: 1000,
    source: "ACTUAL",
  },
  { accountId: "quantity", periodId: "FY2025", value: 500, source: "ACTUAL" },
  { accountId: "revenue", periodId: "FY2025", value: 500000, source: "ACTUAL" },
  { accountId: "cogs", periodId: "FY2025", value: 300000, source: "ACTUAL" },
  {
    accountId: "gross_profit",
    periodId: "FY2025",
    value: 200000,
    source: "ACTUAL",
  },
  {
    accountId: "depreciation",
    periodId: "FY2025",
    value: 10000,
    source: "ACTUAL",
  },
  {
    accountId: "other_opex",
    periodId: "FY2025",
    value: 70000,
    source: "ACTUAL",
  },
  {
    accountId: "total_opex",
    periodId: "FY2025",
    value: 80000,
    source: "ACTUAL",
  },
  {
    accountId: "operating_profit",
    periodId: "FY2025",
    value: 120000,
    source: "ACTUAL",
  },
  {
    accountId: "income_tax",
    periodId: "FY2025",
    value: 36000,
    source: "ACTUAL",
  },
  {
    accountId: "net_income",
    periodId: "FY2025",
    value: 84000,
    source: "ACTUAL",
  },
];
