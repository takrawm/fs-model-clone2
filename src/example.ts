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

// 既存期間の次年度を自動生成して予測
const forecastResult = fam.compute();
const [forecastPeriodId] = Object.keys(forecastResult);
const forecastValues = forecastResult[forecastPeriodId]!;

// 比較用に直近年度の実績を取得（予測年度の1年前）
const previousPeriodId = decrementFiscalYear(forecastPeriodId);
const actualPrevious = periodValues(previousPeriodId);

// 結果表示
console.log(`\n=== ${forecastPeriodId} 予測結果 ===`);
printKPI("商品単価", forecastValues.unit_price, "円");
printKPI("販売数量", forecastValues.quantity, "個");
printMoney("売上高", forecastValues.revenue);
printMoney("売上原価", forecastValues.cogs);
printMoney("売上総利益", forecastValues.gross_profit);
printMoney("減価償却費", forecastValues.depreciation);
printMoney("その他販管費", forecastValues.other_opex);
printMoney("販管費合計", forecastValues.total_opex);
printMoney("営業利益", forecastValues.operating_profit);
printMoney("法人税等", forecastValues.income_tax);
printMoney("当期純利益", forecastValues.net_income);

console.log(`\n=== ${previousPeriodId} 実績 vs ${forecastPeriodId} 予測 ===`);
printComparison("売上高", actualPrevious.revenue, forecastValues.revenue);
printComparison(
  "営業利益",
  actualPrevious.operating_profit,
  forecastValues.operating_profit
);
printComparison(
  "法人税等",
  actualPrevious.income_tax,
  forecastValues.income_tax
);
printComparison(
  "当期純利益",
  actualPrevious.net_income,
  forecastValues.net_income
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

function decrementFiscalYear(periodId: string): string {
  const match = periodId.match(/^(.*?)(\d+)$/);
  if (!match) return periodId;
  const [, prefix, numberPart] = match;
  const nextNumber = Math.max(Number(numberPart) - 1, 0);
  return `${prefix}${nextNumber}`;
}
