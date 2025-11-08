// 使用例: example.ts

import { SimpleFAM } from "./fam/simpleFam.ts";

// シードデータの読み込み
const seedData = {
  actuals: {
    unit_price: 1000,
    quantity: 500,
    revenue: 500000,
    cogs: 300000,
    gross_profit: 200000,
    opex: 80000,
    operating_profit: 120000,
  },
};

// 予測ルールの定義
// Parameters<SimpleFAM["setRules"]>[0] は Record<string, Rule> と同じ型
// Parameters<T> は「関数型 T の引数リストをタプル（配列型）として返す」ユーティリティ型
// Parameters<SimpleFAM["setRules"]> は [Record<string, Rule>] という 1 要素のタプル型
const forecastRules: Parameters<SimpleFAM["setRules"]>[0] = {
  // 商品単価を1050円に値上げ
  unit_price: {
    type: "INPUT",
    value: 1050,
  },

  // 販売数量を550個に増加
  quantity: {
    type: "INPUT",
    value: 550,
  },

  // 売上高 = 単価 × 数量
  revenue: {
    type: "CALCULATION",
    expression: {
      type: "MUL",
      left: { type: "ACCOUNT", id: "unit_price" },
      right: { type: "ACCOUNT", id: "quantity" },
    },
  },

  // 売上原価 = 売上高 × 0.6
  cogs: {
    type: "CALCULATION",
    expression: {
      type: "MUL",
      left: { type: "ACCOUNT", id: "revenue" },
      right: { type: "NUMBER", value: 0.6 },
    },
  },

  // 売上総利益 = 売上高 - 売上原価
  gross_profit: {
    type: "CALCULATION",
    expression: {
      type: "SUB",
      left: { type: "ACCOUNT", id: "revenue" },
      right: { type: "ACCOUNT", id: "cogs" },
    },
  },

  // 販管費は前期と同額
  opex: {
    type: "INPUT",
    value: 80000,
  },

  // 営業利益 = 売上総利益 - 販管費
  operating_profit: {
    type: "CALCULATION",
    expression: {
      type: "SUB",
      left: { type: "ACCOUNT", id: "gross_profit" },
      right: { type: "ACCOUNT", id: "opex" },
    },
  },
};

// FAMを初期化して計算
const fam = new SimpleFAM();
fam.loadActuals(seedData.actuals);
fam.setRules(forecastRules);

// デバッグ用：AST構造を表示
fam.printAST();

// 予測計算の実行
const forecast = fam.compute();

// 結果の表示
console.log("\n=== 予測結果 ===");
console.log("商品単価:", forecast.unit_price, "円");
console.log("販売数量:", forecast.quantity, "個");
console.log("売上高:", forecast.revenue.toLocaleString(), "円");
console.log("売上原価:", forecast.cogs.toLocaleString(), "円");
console.log("売上総利益:", forecast.gross_profit.toLocaleString(), "円");
console.log("販管費:", forecast.opex.toLocaleString(), "円");
console.log("営業利益:", forecast.operating_profit.toLocaleString(), "円");

// 前期との比較
console.log("\n=== 前期比較 ===");
console.log(
  "売上高:",
  `${seedData.actuals.revenue.toLocaleString()}円 → ` +
    `${forecast.revenue.toLocaleString()}円 ` +
    `(+${((forecast.revenue / seedData.actuals.revenue - 1) * 100).toFixed(
      1
    )}%)`
);
console.log(
  "営業利益:",
  `${seedData.actuals.operating_profit.toLocaleString()}円 → ` +
    `${forecast.operating_profit.toLocaleString()}円 ` +
    `(+${(
      (forecast.operating_profit / seedData.actuals.operating_profit - 1) *
      100
    ).toFixed(1)}%)`
);
