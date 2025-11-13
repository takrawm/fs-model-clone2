import { useState, useCallback } from "react";
import type { Column } from "react-data-grid";
import { SimpleFAM } from "../fam/simpleFam";
import { forecastRules } from "../data/forecastRules";
import { seedAccounts } from "../data/seedAccountData";
import { seedPeriods } from "../data/seedPeriodData";
import { seedActualValues } from "../data/seedValueData";

// react-data-grid の Row 型を定義
interface Row {
  id: string;
  accountName: string;
  [period: string]: string | number | undefined;
}

export function useFinancialModel() {
  const [columns, setColumns] = useState<Column<Row>[]>([]);
  const [rows, setRows] = useState<Row[]>([]);

  const runCompute = useCallback(() => {
    // 1. FAMのインスタンス化とセットアップ
    const fam = new SimpleFAM();
    fam.setAccounts(seedAccounts);
    fam.setPeriods(seedPeriods);
    fam.loadInputData(seedActualValues);
    fam.setRules(forecastRules);

    // 2. 予測計算の実行
    // seedPeriods の最後は 2025-3-ANNUAL なので、
    // compute() は 2026-3-ANNUAL を計算します。
    const forecastResult = fam.compute();

    // 3. 結果の取得
    const periodId = Object.keys(forecastResult)[0]; // "2026-3-ANNUAL"
    if (!periodId) return;

    const forecastValues = forecastResult[periodId];
    const allAccounts = fam.getAllAccounts();

    // 4. react-data-grid 向けのデータ整形
    const newColumns: Column<Row>[] = [
      {
        key: "accountName",
        name: "Account",
        width: 200,
        frozen: true, // 行ヘッダーを固定
      },
      {
        key: periodId,
        name: periodId,
        width: 180,
        // 数値をフォーマット
        formatter: ({ row }) => {
          const value = row[periodId];
          if (typeof value === "number") {
            return value.toLocaleString();
          }
          return value;
        },
      },
    ];

    const newRows: Row[] = allAccounts
      .filter(
        (account) =>
          forecastValues[account.id] !== undefined &&
          !account.id.endsWith("_cf_adj") && // CFの調整項目は非表示
          !account.id.endsWith("_cf_wc") // 運転資本項目も非表示
      )
      .map((account) => ({
        id: account.id,
        accountName: account.accountName,
        [periodId]: forecastValues[account.id],
      }));

    // 5. Stateの更新
    setColumns(newColumns);
    setRows(newRows);
  }, []);

  return { columns, rows, runCompute };
}
