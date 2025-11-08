import type { SimpleFAM } from "../fam/simpleFam.ts";
import type { AccountId } from "../model/types.ts";

type RuleMap = Parameters<SimpleFAM["setRules"]>[0];

export const forecastRules: RuleMap = {
  unit_price: {
    type: "INPUT",
    value: 1050,
  },
  quantity: {
    type: "INPUT",
    value: 550,
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
    type: "CALCULATION",
    expression: {
      type: "MUL",
      left: { type: "ACCOUNT", id: "revenue" satisfies AccountId },
      right: { type: "NUMBER", value: 0.6 },
    },
  },
  gross_profit: {
    type: "CALCULATION",
    expression: {
      type: "SUB",
      left: { type: "ACCOUNT", id: "revenue" satisfies AccountId },
      right: { type: "ACCOUNT", id: "cogs" satisfies AccountId },
    },
  },
  opex: {
    type: "INPUT",
    value: 80000,
  },
  operating_profit: {
    type: "CALCULATION",
    expression: {
      type: "SUB",
      left: { type: "ACCOUNT", id: "gross_profit" satisfies AccountId },
      right: { type: "ACCOUNT", id: "opex" satisfies AccountId },
    },
  },
};
