// 使用例: example.ts

import { SimpleFAM } from "./fam/simpleFam.ts";
import { forecastRules } from "./data/forecastRules.ts";
import { seedAccounts } from "./data/seedAccountData.ts";
import { seedPeriods } from "./data/seedPeriodData.ts";
import { seedActualValues } from "./data/seedValueData.ts";

const fam = new SimpleFAM();
fam.setAccounts(seedAccounts);
fam.setPeriods(seedPeriods);
fam.loadInputData(seedActualValues);
fam.setRules(forecastRules);

// 既存期間の次年度を自動生成して予測
const forecastResult = fam.compute();
const [forecastPeriodId] = Object.keys(forecastResult);
const forecastValues = forecastResult[forecastPeriodId]!;

// 全てのアカウントを取得（動的に追加されたCF科目も含む）
const allAccounts = fam.getAllAccounts();

// 比較用に直近年度の実績を取得（予測年度の1年前）
const previousPeriodId = decrementFiscalYear(forecastPeriodId);
const actualPrevious = periodValues(previousPeriodId);

// 財務諸表ごとに科目を分類
const plAccounts = allAccounts.filter((account) => account.fs_type === "PL");
const bsAccounts = allAccounts.filter((account) => account.fs_type === "BS");
const cfAccounts = allAccounts.filter((account) => account.fs_type === "CF");
const ppeAccounts = allAccounts.filter((account) => account.fs_type === "PP&E");

// KPI科目（単価・数量）を分離
const kpiAccounts = plAccounts.filter((account) =>
  /単価|数量/.test(account.AccountName ?? account.id)
);
const monetaryPlAccounts = plAccounts.filter(
  (account) => !kpiAccounts.includes(account)
);

// 実績データの表示
if (actualPrevious) {
  console.log(`\n=== ${previousPeriodId} 実績 ===`);

  // PL（損益計算書）
  console.log("\n【損益計算書】");
  for (const account of kpiAccounts) {
    const unit = /数量/.test(account.AccountName ?? account.id) ? "個" : "円";
    printKPI(account.AccountName, actualPrevious[account.id], unit);
  }
  for (const account of monetaryPlAccounts) {
    printMoney(account.AccountName, actualPrevious[account.id]);
  }

  // BS（貸借対照表）
  console.log("\n【貸借対照表】");
  for (const account of bsAccounts) {
    printMoney(account.AccountName, actualPrevious[account.id]);
  }

  // CF（キャッシュフロー計算書）
  console.log("\n【キャッシュフロー計算書】");
  for (const account of cfAccounts) {
    printMoney(account.AccountName, actualPrevious[account.id]);
  }
} else {
  console.log(`\n=== ${previousPeriodId} 実績 ===`);
  console.log("実績データが見つかりません。");
}

// 予測結果の表示
console.log(`\n=== ${forecastPeriodId} 予測結果 ===`);

// PL（損益計算書）
console.log("\n【損益計算書】");
for (const account of kpiAccounts) {
  const unit = /数量/.test(account.AccountName ?? account.id) ? "個" : "円";
  printKPI(account.AccountName, forecastValues[account.id], unit);
}
for (const account of monetaryPlAccounts) {
  printMoney(account.AccountName, forecastValues[account.id]);
}

// BS（貸借対照表）
console.log("\n【貸借対照表】");
for (const account of bsAccounts) {
  printMoney(account.AccountName, forecastValues[account.id]);
}

// CF（キャッシュフロー計算書）
console.log("\n【キャッシュフロー計算書】");
for (const account of cfAccounts) {
  printMoney(account.AccountName, forecastValues[account.id]);
}

// PP&E（設備関連）
if (ppeAccounts.length > 0) {
  console.log("\n【設備関連】");
  for (const account of ppeAccounts) {
    printMoney(account.AccountName, forecastValues[account.id]);
  }
}

// 実績 vs 予測の比較
console.log(`\n=== ${previousPeriodId} 実績 vs ${forecastPeriodId} 予測 ===`);
if (actualPrevious) {
  // PL科目の比較
  console.log("\n【損益計算書】");
  for (const account of monetaryPlAccounts) {
    const actual = actualPrevious[account.id];
    const forecast = forecastValues[account.id];
    if (actual != null && forecast != null) {
      printComparison(account.AccountName, actual, forecast);
    }
  }

  // BS科目の比較
  console.log("\n【貸借対照表】");
  for (const account of bsAccounts) {
    const actual = actualPrevious[account.id];
    const forecast = forecastValues[account.id];
    if (actual != null && forecast != null) {
      printComparison(account.AccountName, actual, forecast);
    }
  }

  // CF科目の比較
  console.log("\n【キャッシュフロー計算書】");
  for (const account of cfAccounts) {
    const actual = actualPrevious[account.id];
    const forecast = forecastValues[account.id];
    if (actual != null && forecast != null) {
      printComparison(account.AccountName, actual, forecast);
    }
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

function printKPI(
  label: string | undefined,
  value: number | undefined,
  unit: string
) {
  if (value == null) return;
  console.log(`  ${label ?? "不明"}: ${value.toLocaleString()}${unit}`);
}

function printMoney(label: string | undefined, value: number | undefined) {
  if (value == null) return;
  console.log(`  ${label ?? "不明"}: ${value.toLocaleString()} 円`);
}

function printComparison(
  label: string | undefined,
  actual: number | undefined,
  forecastValue: number | undefined
) {
  if (actual == null || forecastValue == null) return;
  const diff = forecastValue - actual;
  const diffRate = ((forecastValue / actual - 1) * 100).toFixed(1);
  const diffSign = diff >= 0 ? "+" : "";
  console.log(
    `  ${
      label ?? "不明"
    }: ${actual.toLocaleString()}円 → ${forecastValue.toLocaleString()}円 (${diffSign}${diff.toLocaleString()}円, ${diffSign}${diffRate}%)`
  );
}

function decrementFiscalYear(periodId: string): string {
  // "2026-3-ANNUAL" 形式に対応
  const match = periodId.match(/^(\d{4})-(\d+)-ANNUAL$/);
  if (match) {
    const year = parseInt(match[1], 10);
    return `${year - 1}-${match[2]}-ANNUAL`;
  }

  // フォールバック: 従来の形式（"FY2026"など）
  const fallbackMatch = periodId.match(/^(.*?)(\d+)$/);
  if (fallbackMatch) {
    const [, prefix, numberPart] = fallbackMatch;
    const nextNumber = Math.max(Number(numberPart) - 1, 0);
    return `${prefix}${nextNumber}`;
  }

  return periodId;
}
