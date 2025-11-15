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
const plAccounts = allAccounts.filter((account) => account.sheetType === "PL");
const bsAccounts = allAccounts.filter((account) => account.sheetType === "BS");
const cfAccounts = allAccounts.filter((account) => account.sheetType === "CF");
const ppeAccounts = allAccounts.filter(
  (account) => account.sheetType === "PP&E"
);

// KPI科目（単価・数量）を分離
const kpiAccounts = plAccounts.filter((account) =>
  /単価|数量/.test(account.accountName ?? account.id)
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
    const unit = /数量/.test(account.accountName ?? account.id) ? "個" : "円";
    printKPI(account.accountName, actualPrevious[account.id], unit);
  }
  for (const account of monetaryPlAccounts) {
    printAccount(account.accountName, actualPrevious[account.id]);
  }

  // BS（貸借対照表）
  console.log("\n【貸借対照表】");
  for (const account of bsAccounts) {
    printAccount(account.accountName, actualPrevious[account.id]);
  }

  // CF（キャッシュフロー計算書）
  console.log("\n【キャッシュフロー計算書】");
  for (const account of cfAccounts) {
    printAccount(account.accountName, actualPrevious[account.id]);
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
  const unit = /数量/.test(account.accountName ?? account.id) ? "個" : "円";
  printKPI(account.accountName, forecastValues[account.id], unit);
}
for (const account of monetaryPlAccounts) {
  printAccount(
    account.accountName,
    forecastValues[account.id],
    actualPrevious?.[account.id]
  );
}

// BS（貸借対照表）
console.log("\n【貸借対照表】");
for (const account of bsAccounts) {
  printAccount(
    account.accountName,
    forecastValues[account.id],
    actualPrevious?.[account.id]
  );
}

// CF（キャッシュフロー計算書）
console.log("\n【キャッシュフロー計算書】");
for (const account of cfAccounts) {
  printAccount(
    account.accountName,
    forecastValues[account.id],
    actualPrevious?.[account.id]
  );
}

// PP&E（設備関連）
if (ppeAccounts.length > 0) {
  console.log("\n【設備関連】");
  for (const account of ppeAccounts) {
    printAccount(
      account.accountName,
      forecastValues[account.id],
      actualPrevious?.[account.id]
    );
  }
}

// 貸借一致チェック
printBalanceCheck(
  forecastPeriodId,
  previousPeriodId,
  forecastValues,
  actualPrevious
);

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

function printAccount(
  label: string | undefined,
  forecastValue: number | undefined,
  actualValue?: number | undefined
) {
  if (forecastValue == null) return;

  // 実績値がある場合は比較表示、ない場合は単純表示
  if (actualValue != null) {
    const diff = forecastValue - actualValue;
    const diffRate = ((forecastValue / actualValue - 1) * 100).toFixed(1);
    const diffSign = diff >= 0 ? "+" : "";
    console.log(
      `  ${
        label ?? "不明"
      }: ${actualValue.toLocaleString()}円 → ${forecastValue.toLocaleString()}円 (${diffSign}${diff.toLocaleString()}円, ${diffSign}${diffRate}%)`
    );
  } else {
    console.log(`  ${label ?? "不明"}: ${forecastValue.toLocaleString()} 円`);
  }
}

function printBalanceCheck(
  forecastPeriodId: string,
  previousPeriodId: string,
  forecastValues: Record<string, number>,
  actualValues?: Record<string, number> | null
) {
  console.log("\n=== 貸借一致チェック ===");

  const forecastAssets = forecastValues["assets_total"] ?? 0;
  const forecastEquityAndLiabilities =
    forecastValues["equity_and_liabilities_total"] ?? 0;
  const forecastDiff = forecastAssets - forecastEquityAndLiabilities;

  console.log(
    `\n【${forecastPeriodId} 予測】\n  資産合計: ${forecastAssets.toLocaleString()} 円\n  負債・純資産合計: ${forecastEquityAndLiabilities.toLocaleString()} 円\n  差額: ${forecastDiff.toLocaleString()} 円`
  );

  if (actualValues) {
    const actualAssets = actualValues["assets_total"] ?? 0;
    const actualEquityAndLiabilities =
      actualValues["equity_and_liabilities_total"] ?? 0;
    const actualDiff = actualAssets - actualEquityAndLiabilities;

    console.log(
      `\n【${previousPeriodId} 実績】\n  資産合計: ${actualAssets.toLocaleString()} 円\n  負債・純資産合計: ${actualEquityAndLiabilities.toLocaleString()} 円\n  差額: ${actualDiff.toLocaleString()} 円`
    );
  }

  if (forecastDiff === 0) {
    console.log("\n✓ 貸借が一致しています。");
  } else {
    console.log(
      `\n⚠ 貸借が一致していません。差額: ${forecastDiff.toLocaleString()} 円`
    );
  }
}

function decrementFiscalYear(periodId: string): string {
  // "2026-3-ANNUAL" 形式に対応
  const match = periodId.match(/^(\d{4})-(\d+)-ANNUAL$/);
  if (match) {
    const year = parseInt(match[1], 10);
    return `${year - 1}-${match[2]}-ANNUAL`;
  }

  return periodId;
}
