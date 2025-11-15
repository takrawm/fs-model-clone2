import type { AccountId, Rule } from "../model/types.ts";
import { TAX_RATE } from "../config/financialModelConfig.ts";

export const forecastRules: Record<AccountId, Rule> = {
  unit_price: {
    type: "GROWTH_RATE",
    rate: 0.1,
  },
  quantity: {
    type: "GROWTH_RATE",
    rate: 0.1,
  },
  revenue: {
    type: "CALCULATION",
    formulaNode: {
      type: "BINARY_OP",
      op: "MUL",
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
    formulaNode: {
      type: "BINARY_OP",
      op: "SUB",
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
    formulaNode: {
      type: "BINARY_OP",
      op: "ADD",
      left: { type: "ACCOUNT", id: "depreciation" satisfies AccountId },
      right: { type: "ACCOUNT", id: "other_opex" satisfies AccountId },
    },
  },
  operating_profit: {
    type: "CALCULATION",
    formulaNode: {
      type: "BINARY_OP",
      op: "SUB",
      left: { type: "ACCOUNT", id: "gross_profit" satisfies AccountId },
      right: { type: "ACCOUNT", id: "total_opex" satisfies AccountId },
    },
  },
  income_tax: {
    type: "CALCULATION",
    formulaNode: {
      type: "BINARY_OP",
      op: "MUL",
      left: { type: "ACCOUNT", id: "operating_profit" satisfies AccountId },
      right: { type: "NUMBER", value: TAX_RATE },
    },
  },
  net_income: {
    type: "CALCULATION",
    formulaNode: {
      type: "BINARY_OP",
      op: "SUB",
      left: { type: "ACCOUNT", id: "operating_profit" satisfies AccountId },
      right: { type: "ACCOUNT", id: "income_tax" satisfies AccountId },
    },
  },
  capex: {
    type: "PERCENTAGE",
    percentage: 0.2,
    ref: "cogs" satisfies AccountId,
  },
  cash: {
    type: "BALANCE_CHANGE",
    flowAccounts: [],
  },
  account_receivable: {
    type: "PROPORTIONATE",
    ref: "revenue",
  },
  tangible_assets: {
    type: "BALANCE_CHANGE",
    flowAccounts: [
      { ref: "capex" satisfies AccountId, sign: "PLUS" },
      { ref: "depreciation" satisfies AccountId, sign: "MINUS" },
    ],
  },
  assets_total: {
    type: "CALCULATION",
    formulaNode: {
      type: "BINARY_OP",
      op: "ADD",
      left: { type: "ACCOUNT", id: "cash" satisfies AccountId },
      right: {
        type: "BINARY_OP",
        op: "ADD",
        left: { type: "ACCOUNT", id: "account_receivable" satisfies AccountId },
        right: { type: "ACCOUNT", id: "tangible_assets" satisfies AccountId },
      },
    },
  },
  account_payable: {
    type: "GROWTH_RATE",
    rate: 0.05,
  },
  bills_payable: {
    type: "PROPORTIONATE",
    ref: "cogs",
  },
  liabilities_total: {
    type: "CALCULATION",
    formulaNode: {
      type: "BINARY_OP",
      op: "ADD",
      left: { type: "ACCOUNT", id: "account_payable" satisfies AccountId },
      right: { type: "ACCOUNT", id: "bills_payable" satisfies AccountId },
    },
  },
  retained_earnings: {
    type: "BALANCE_CHANGE",
    flowAccounts: [{ ref: "net_income" satisfies AccountId, sign: "PLUS" }],
  },
  // 負債・純資産合計（貸借一致確認用）
  equity_and_liabilities_total: {
    type: "CALCULATION",
    formulaNode: {
      type: "BINARY_OP",
      op: "ADD",
      left: { type: "ACCOUNT", id: "liabilities_total" satisfies AccountId },
      right: { type: "ACCOUNT", id: "retained_earnings" satisfies AccountId },
    },
  },
  // 以下を末尾に追加
  cash_change_cf: {
    type: "INPUT", // このルールは動的に上書きされる
    value: 0,
  },
};
