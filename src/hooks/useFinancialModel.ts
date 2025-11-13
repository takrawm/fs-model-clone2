import { useState, useCallback, useEffect } from "react";
import type { Column } from "react-data-grid";
import { SimpleFAM } from "../fam/simpleFam";
import { forecastRules } from "../data/forecastRules";
import { seedAccounts } from "../data/seedAccountData";
import { seedPeriods } from "../data/seedPeriodData";
import { seedActualValues } from "../data/seedValueData";
import { getRuleDescription } from "../utils/ruleDescription";
import type { Account, AccountId, Period } from "../model/types";

// react-data-grid の Row 型を定義
export interface Row {
  id: string;
  accountName: string;
  ruleDescription: string;
  rowType: "fs-header" | "account";
  fsType?: string;
  isTotal?: boolean;
  isCfSource?: boolean;
  [period: string]: string | number | undefined;
}

export function useFinancialModel() {
  const [columns, setColumns] = useState<Column<Row>[]>([]);
  const [rows, setRows] = useState<Row[]>([]);
  const [famInstance, setFamInstance] = useState<SimpleFAM | null>(null);
  const [displayPeriods, setDisplayPeriods] = useState<Period[]>([]);

  // 初期表示: FY2025のデータを表示
  useEffect(() => {
    const fam = new SimpleFAM();
    fam.setAccounts(seedAccounts);
    // FY2025のみを表示（FY2024を除外）
    const displayPeriods = seedPeriods.filter((p) => p.id === "2025-3-ANNUAL");
    fam.setPeriods(displayPeriods);
    fam.loadInputData(seedActualValues);
    fam.setRules(forecastRules);

    // 初期表示時にもCFルールを生成するため、一時的にcompute()を呼ぶ
    // CFルールはcompute()内でgenerateCashFlowRules()によって生成される
    // ただし、生成された期間（FY2026）は表示に含めず、FY2025のみを表示する
    try {
      // CFルール生成のため、一時的にcompute()を呼ぶ
      fam.compute();
      // 生成された期間を削除（FY2025のみを表示）
      // SimpleFAMのperiodsはprivateなので、setPeriodsで再設定する
      fam.setPeriods(displayPeriods);
    } catch (e) {
      console.error("CFルール生成エラー:", e);
    }

    setFamInstance(fam);
    setDisplayPeriods(displayPeriods);
    updateGrid(fam, displayPeriods);
  }, []);

  const updateGrid = useCallback((fam: SimpleFAM, periods: Period[]) => {
    const allAccounts = fam.getAllAccounts();
    const accountsMap = new Map<AccountId, Account>();
    for (const account of allAccounts) {
      accountsMap.set(account.id, account);
    }

    // 財務諸表タイプの順序
    const fsTypeOrder = ["PL", "BS", "PP&E", "CF", "OTHER"];

    // 描画対象の行を計算
    const renderRows: Row[] = [];

    for (const fsType of fsTypeOrder) {
      // cash_change_cf を一時的に除外
      const filteredAccounts = allAccounts.filter(
        (acc) => acc.fs_type === fsType && acc.id !== "cash_change_cf"
      );

      // CF以外、またはCFで勘定がある場合
      if (
        filteredAccounts.length > 0 ||
        (fsType === "CF" && allAccounts.some((a) => a.id === "cash_change_cf"))
      ) {
        renderRows.push({
          id: `fs-header-${fsType}`,
          accountName: fsType,
          ruleDescription: "",
          rowType: "fs-header",
          fsType: fsType,
        });
      } else {
        continue; // 描画するものがなければFSヘッダもスキップ
      }

      // CFセクションの場合、まず当期純利益（CF）を表示
      if (fsType === "CF") {
        const baseProfitAccount = allAccounts.find((acc) => acc.isCfBaseProfit);
        if (baseProfitAccount) {
          const periodValues: Record<string, number> = {};
          for (const period of periods) {
            const value = getValueFromFam(fam, period.id, baseProfitAccount.id);
            periodValues[period.id] = value;
          }

          renderRows.push({
            id: `${baseProfitAccount.id}-cf`,
            accountName: `${baseProfitAccount.accountName}（CF）`,
            ruleDescription: getRuleDescription(
              baseProfitAccount.id,
              accountsMap
            ),
            rowType: "account",
            fsType: "CF",
            ...periodValues,
          });
        }
      }

      for (const account of filteredAccounts) {
        const periodValues: Record<string, number> = {};
        for (const period of periods) {
          const value = getValueFromFam(fam, period.id, account.id);
          periodValues[period.id] = value;
        }

        const isCfSource =
          account.id.endsWith("_cf_adj") || account.id.endsWith("_cf_wc");

        renderRows.push({
          id: account.id,
          accountName: account.accountName,
          ruleDescription: getRuleDescription(account.id, accountsMap),
          rowType: "account",
          fsType: fsType,
          isCfSource: isCfSource,
          ...periodValues,
        });
      }

      // CFセクションの最後に cash_change_cf を isTotal フラグ付きで追加
      if (fsType === "CF") {
        const cashChangeAccount = allAccounts.find(
          (acc) => acc.id === "cash_change_cf"
        );
        if (cashChangeAccount) {
          const periodValues: Record<string, number> = {};
          for (const period of periods) {
            const value = getValueFromFam(fam, period.id, cashChangeAccount.id);
            periodValues[period.id] = value;
          }

          renderRows.push({
            id: cashChangeAccount.id,
            accountName: cashChangeAccount.accountName,
            ruleDescription: getRuleDescription(
              cashChangeAccount.id,
              accountsMap
            ),
            rowType: "account",
            fsType: "CF",
            isTotal: true,
            ...periodValues,
          });
        }
      }
    }

    // カラム定義（フォーマッターなし、JSXを含まない）
    const newColumns: Column<Row>[] = [
      {
        key: "accountName",
        name: "Account",
        width: 250,
        frozen: true,
        cellClass: (row) => {
          if (row.rowType === "fs-header") return "fs-header-cell";
          if (row.isCfSource) return "cf-source-cell";
          return "";
        },
      },
      {
        key: "ruleDescription",
        name: "Forecast Rule",
        width: 350,
        frozen: true,
        cellClass: (row) => {
          if (row.rowType === "fs-header") return "fs-header-cell";
          return "";
        },
      },
    ];

    // 期間列を追加
    for (const period of periods) {
      newColumns.push({
        key: period.id,
        name: period.label ?? period.id,
        width: 150,
        cellClass: (row) => {
          if (row.rowType === "fs-header") return "fs-header-cell";
          if (row.isTotal) return "total-row-cell";
          return "";
        },
      });
    }

    setColumns(newColumns);
    setRows(renderRows);
  }, []);

  // FAMから値を取得するヘルパー関数
  const getValueFromFam = (
    fam: SimpleFAM,
    periodId: string,
    accountId: string
  ): number => {
    return fam.getValue(periodId, accountId as AccountId) ?? 0;
  };

  const runCompute = useCallback(() => {
    if (!famInstance) return;

    // 予測計算の実行
    const forecastResult = famInstance.compute();
    const periodId = Object.keys(forecastResult)[0]; // "2026-3-ANNUAL"
    if (!periodId) return;

    // 新しい期間を取得（SimpleFAMの内部状態から取得する必要がある）
    // 簡易的に、displayPeriodsの最後の期間の次年度を計算
    const latestPeriod = displayPeriods[displayPeriods.length - 1];
    if (!latestPeriod) return;

    // 新しい期間を作成（簡易的に、年を+1）
    const newPeriod: Period = {
      id: periodId,
      year: latestPeriod.year + 1,
      month: latestPeriod.month,
      label: `FY${latestPeriod.year + 1}`,
      isFiscalYearEnd: latestPeriod.isFiscalYearEnd,
      fiscalYear: latestPeriod.fiscalYear + 1,
      periodType: latestPeriod.periodType,
    };

    const updatedPeriods = [...displayPeriods, newPeriod];
    setDisplayPeriods(updatedPeriods);
    updateGrid(famInstance, updatedPeriods);
  }, [famInstance, displayPeriods, updateGrid]);

  return { columns, rows, runCompute };
}
