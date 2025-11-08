// 使用例: example.ts

import { SimpleFAM } from "./fam/simpleFam.ts";
import { forecastRules } from "./data/forecastRules.ts";
import { seedActuals } from "./data/seedData.ts";

// FAMを初期化して計算
const fam = new SimpleFAM();
fam.loadActuals(seedActuals);
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
  `${seedActuals.revenue.toLocaleString()}円 → ` +
    `${forecast.revenue.toLocaleString()}円 ` +
    `(+${((forecast.revenue / seedActuals.revenue - 1) * 100).toFixed(1)}%)`
);
console.log(
  "営業利益:",
  `${seedActuals.operating_profit.toLocaleString()}円 → ` +
    `${forecast.operating_profit.toLocaleString()}円 ` +
    `(+${(
      (forecast.operating_profit / seedActuals.operating_profit - 1) *
      100
    ).toFixed(1)}%)`
);
