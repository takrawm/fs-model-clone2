// 使用例: example.ts

import { SimpleFAM } from "./fam/simpleFam.ts";
import { forecastRules } from "./data/forecastRules.ts";
import { seedAccounts } from "./data/seedAccountData.ts";
import { seedPeriods } from "./data/seedPeriodData.ts";
import { seedActualValues } from "./data/seedValueData.ts";
import type { AccountId } from "./model/types.ts";

const fam = new SimpleFAM();
fam.setAccounts(seedAccounts);
fam.setPeriods(seedPeriods);
fam.loadInputData(seedActualValues);
fam.setRules(forecastRules);

// 既存期間の次年度を自動生成して予測
const forecastResult = fam.compute();
const [forecastPeriodId] = Object.keys(forecastResult);
const forecastValues = forecastResult[forecastPeriodId]!;

// 比較用に直近年度の実績を取得（予測年度の1年前）
const previousPeriodId = decrementFiscalYear(forecastPeriodId);
const actualPrevious = periodValues(previousPeriodId);

const plAccounts = seedAccounts.filter((account) => account.fs_type === "PL");
const kpiAccounts = plAccounts.filter((account) =>
  /単価|数量/.test(account.AccountName ?? account.id)
);
const monetaryAccounts = seedAccounts.filter(
  (account) => !kpiAccounts.includes(account)
);

if (actualPrevious) {
  console.log(`\n=== ${previousPeriodId} 実績 ===`);
  for (const account of kpiAccounts) {
    const unit = /数量/.test(account.AccountName ?? account.id) ? "個" : "円";
    printKPI(account.AccountName, actualPrevious[account.id], unit);
  }
  for (const account of monetaryAccounts) {
    printMoney(account.AccountName, actualPrevious[account.id]);
  }
} else {
  console.log(`\n=== ${previousPeriodId} 実績 ===`);
  console.log("実績データが見つかりません。");
}

console.log(`\n=== ${forecastPeriodId} 予測結果 ===`);
for (const account of kpiAccounts) {
  const unit = /数量/.test(account.AccountName ?? account.id) ? "個" : "円";
  printKPI(account.AccountName, forecastValues[account.id], unit);
}
for (const account of monetaryAccounts) {
  printMoney(account.AccountName, forecastValues[account.id]);
}

console.log(`\n=== ${previousPeriodId} 実績 vs ${forecastPeriodId} 予測 ===`);
if (actualPrevious) {
  const comparisonIds = new Set<AccountId>([
    "revenue",
    "operating_profit",
    "income_tax",
    "net_income",
  ]);
  const comparisonAccounts = monetaryAccounts.filter((account) =>
    comparisonIds.has(account.id)
  );
  for (const account of comparisonAccounts) {
    printComparison(
      account.AccountName,
      actualPrevious[account.id],
      forecastValues[account.id]
    );
  }
} else {
  console.log("比較可能な実績データが見つかりません。");
}

// デバッグ用：AST構造を表示（コメント解除で確認可能）
// fam.printAST();

function periodValues(periodId: string): Record<string, number> | null {
  const values = seedActualValues.filter(
    (value) => value.periodId === periodId
  );
  if (!values.length) return null;
  return Object.fromEntries(
    values.map((value) => [value.accountId, value.value])
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
