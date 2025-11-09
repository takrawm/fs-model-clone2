import type { AccountId, Rule } from "../model/types.ts";

export const forecastRules: Record<AccountId, Rule> = {
  unit_price: {
    type: "GROWTH_RATE",
    rate: 0.1,
    ref: "unit_price",
  },
  quantity: {
    type: "GROWTH_RATE",
    rate: 0.1,
    ref: "quantity",
  },
  revenue: {
    type: "CALCULATION",
    expression: {
      type: "MUL",
      left: { type: "ACCOUNT", id: "unit_price" satisfies AccountId },
      right: { type: "ACCOUNT", id: "quantity" satisfies AccountId },
    },
  },
  cogs: {
    type: "PERCENTAGE",
    percentage: 0.6,
    ref: "revenue" satisfies AccountId,
  },
  gross_profit: {
    type: "CALCULATION",
    expression: {
      type: "SUB",
      left: { type: "ACCOUNT", id: "revenue" satisfies AccountId },
      right: { type: "ACCOUNT", id: "cogs" satisfies AccountId },
    },
  },
  depreciation: {
    type: "PERCENTAGE",
    percentage: 0.1,
    ref: "cogs" satisfies AccountId,
  },
  other_opex: {
    type: "INPUT",
    value: 70000,
  },
  total_opex: {
    type: "CALCULATION",
    expression: {
      type: "ADD",
      left: { type: "ACCOUNT", id: "depreciation" satisfies AccountId },
      right: { type: "ACCOUNT", id: "other_opex" satisfies AccountId },
    },
  },
  operating_profit: {
    type: "CALCULATION",
    expression: {
      type: "SUB",
      left: { type: "ACCOUNT", id: "gross_profit" satisfies AccountId },
      right: { type: "ACCOUNT", id: "total_opex" satisfies AccountId },
    },
  },
  income_tax: {
    type: "CALCULATION",
    expression: {
      type: "MUL",
      left: { type: "ACCOUNT", id: "operating_profit" satisfies AccountId },
      right: { type: "NUMBER", value: 0.3 },
    },
  },
  net_income: {
    type: "CALCULATION",
    expression: {
      type: "SUB",
      left: { type: "ACCOUNT", id: "operating_profit" satisfies AccountId },
      right: { type: "ACCOUNT", id: "income_tax" satisfies AccountId },
    },
  },
  capex: {
    type: "REFERENCE",
    ref: "depreciation",
  },
  cash: {
    type: "BALANCE_CHANGE",
    flows: [],
  },
  account_receivable: {
    type: "PROPORTIONATE",
    ref: "revenue",
  },
  tangible_assets: {
    type: "BALANCE_CHANGE",
    flows: [
      { ref: "capex" satisfies AccountId, sign: "PLUS" },
      { ref: "depreciation" satisfies AccountId, sign: "MINUS" },
    ],
  },
  assets_total: {
    type: "CALCULATION",
    expression: {
      type: "ADD",
      left: { type: "ACCOUNT", id: "cash" satisfies AccountId },
      right: {
        type: "ADD",
        left: { type: "ACCOUNT", id: "account_receivable" satisfies AccountId },
        right: { type: "ACCOUNT", id: "tangible_assets" satisfies AccountId },
      },
    },
  },
  account_payable: {
    type: "GROWTH_RATE",
    rate: 0.05,
    ref: "account_payable",
  },
  bills_payable: {
    type: "PROPORTIONATE",
    ref: "cogs",
  },
  liabilities_total: {
    type: "CALCULATION",
    expression: {
      type: "ADD",
      left: { type: "ACCOUNT", id: "account_payable" satisfies AccountId },
      right: { type: "ACCOUNT", id: "bills_payable" satisfies AccountId },
    },
  },
  retained_earnings: {
    type: "BALANCE_CHANGE",
    flows: [{ ref: "net_income" satisfies AccountId, sign: "PLUS" }],
  },
};
