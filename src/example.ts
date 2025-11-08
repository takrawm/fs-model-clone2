// 使用例: example.ts

import { SimpleFAM } from "./fam/simpleFam.ts";
import { forecastRules } from "./data/forecastRules.ts";
import {
  seedAccounts,
  seedActualValues,
  seedPeriods,
} from "./data/seedData.ts";

const fam = new SimpleFAM();
fam.setAccounts(seedAccounts);
fam.setPeriods(seedPeriods);
fam.loadActuals(seedActualValues);
fam.setRules(forecastRules);

// FY2025 の予測を実行（FY2023/FY2024はシード実績として取り込み済み）
const targetPeriods = ["FY2025"];
const forecast = fam.compute(targetPeriods);
const forecastFY2025 = forecast["FY2025"];

// 比較用に FY2024 実績を取得
const actualFY2024 = periodValues("FY2024");

// 結果表示
console.log("\n=== FY2025 予測結果 ===");
printKPI("商品単価", forecastFY2025.unit_price, "円");
printKPI("販売数量", forecastFY2025.quantity, "個");
printMoney("売上高", forecastFY2025.revenue);
printMoney("売上原価", forecastFY2025.cogs);
printMoney("売上総利益", forecastFY2025.gross_profit);
printMoney("販管費", forecastFY2025.opex);
printMoney("営業利益", forecastFY2025.operating_profit);

console.log("\n=== FY2024 実績 vs FY2025 予測 ===");
printComparison("売上高", actualFY2024.revenue, forecastFY2025.revenue);
printComparison(
  "営業利益",
  actualFY2024.operating_profit,
  forecastFY2025.operating_profit
);

// デバッグ用：AST構造を表示（コメント解除で確認可能）
// fam.printAST();

function periodValues(periodId: string): Record<string, number> {
  return Object.fromEntries(
    seedActualValues
      .filter((value) => value.periodId === periodId)
      .map((value) => [value.accountId, value.value])
  );
}

function printKPI(label: string, value: number | undefined, unit: string) {
  if (value == null) return;
  console.log(`${label}: ${value.toLocaleString()}${unit}`);
}

function printMoney(label: string, value: number | undefined) {
  if (value == null) return;
  console.log(`${label}: ${value.toLocaleString()} 円`);
}

function printComparison(
  label: string,
  actual: number | undefined,
  forecastValue: number | undefined
) {
  if (actual == null || forecastValue == null) return;
  const diffRate = ((forecastValue / actual - 1) * 100).toFixed(1);
  console.log(
    `${label}: ${actual.toLocaleString()}円 → ${forecastValue.toLocaleString()}円 (+${diffRate}%)`
  );
}
