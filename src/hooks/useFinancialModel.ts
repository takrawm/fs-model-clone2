import { useState, useCallback, useEffect, useRef } from "react";
import type { Column } from "react-data-grid";
import { SimpleFAM } from "../fam/simpleFam";
import { forecastRules } from "../data/forecastRules";
import { seedAccounts } from "../data/seedAccountData";
import { seedPeriods } from "../data/seedPeriodData";
import { seedActualValues } from "../data/seedValueData";
import { getRuleDescription } from "../utils/ruleDescription";
import { FinancialAnalysis } from "../utils/financialAnalysis";
import type { Ratio, YearOverYear } from "../utils/financialAnalysis";
import { ratioConfig, yearOverYearConfig } from "../config/analysisConfig";
import { BASE_PROFIT_CF_ACCOUNT_ID } from "../config/financialModelConfig";
import type {
  Account,
  AccountId,
  Period,
  PeriodId,
  FsType,
} from "../model/types";

// react-data-grid の Row 型を定義

// アカウント行（期間の値を持つ）
export interface AccountRow {
  id: AccountId;
  accountName: string;
  ruleDescription: string;
  rowType: "account";
  fsType: FsType;
  // 期間列の値: PeriodId（stringのエイリアス）をキーとして持つ
  // 実際のキーは string 型だが、PeriodId の値が入ることが想定される
  [period: string]: string | number | undefined;
}

// FSヘッダー行（期間の値を持たない）
export interface FsHeaderRow {
  id: string;
  accountName: string;
  ruleDescription: string;
  rowType: "fs-header";
  fsType: FsType;
}

// バランスチェック行
export interface BalanceCheckRow {
  id: string;
  accountName: string;
  ruleDescription: string;
  rowType: "balance-check";
  fsType?: FsType;
  [period: string]: string | number | undefined;
}

// 比率行
export interface RatioRow {
  id: string;
  accountName: string;
  ruleDescription: string;
  rowType: "ratio";
  fsType?: FsType;
  ratioType: "vsAccount";
  [period: string]: string | number | undefined;
}

// 前期比行
export interface YearOverYearRow {
  id: string;
  accountName: string;
  ruleDescription: string;
  rowType: "yoy";
  fsType?: FsType;
  [period: string]: string | number | undefined;
}

export type Row =
  | AccountRow
  | FsHeaderRow
  | BalanceCheckRow
  | RatioRow
  | YearOverYearRow;

export function useFinancialModel() {
  // Column<Row>[]は、Row型の行データを扱うColumnの配列
  // Column<Row>：TRowがRowに置き換えられたColumn型
  const [columns, setColumns] = useState<Column<Row>[]>([]);
  const [rows, setRows] = useState<Row[]>([]);
  // Reactがrefオブジェクト（{ current: ... }）を内部で保持し、再レンダリング後も同じrefオブジェクトを返す
  const famInstanceRef = useRef<SimpleFAM | null>(null);
  const [displayPeriods, setDisplayPeriods] = useState<Period[]>([]);

  // 初期表示: FY2025のデータを表示
  useEffect(() => {
    const fam = new SimpleFAM();
    fam.setAccounts(seedAccounts);
    // FY2025のみを表示（今回はシードデータにid: "2025-3-ANNUAL"しか入っていない）
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

    famInstanceRef.current = fam;
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
    const fsTypeOrder: FsType[] = ["PL", "BS", "PP&E", "CF", "OTHER"];

    // fsTypeごとにアカウントをグループ化し、特殊なアカウントを事前に抽出
    const accountMapByFsType = new Map<
      FsType,
      {
        regular: Account[]; // 通常のアカウント（cash_change_cfを除く）
        baseProfit?: Account; // isCfBaseProfitがtrueのアカウント（CFのみ）
        cashChangeCf?: Account; // cash_change_cf（CFのみ）
      }
    >();

    // 事前にアカウントを分類
    for (const fsType of fsTypeOrder) {
      const accountsOfThisFsType = allAccounts.filter(
        (acc) => acc.fs_type === fsType
      );

      if (accountsOfThisFsType.length === 0) {
        continue;
      }

      const regular: Account[] = [];
      let baseProfit: Account | undefined;
      let cashChangeCf: Account | undefined;

      for (const account of accountsOfThisFsType) {
        if (account.id === "cash_change_cf") {
          cashChangeCf = account;
        } else if (account.id === BASE_PROFIT_CF_ACCOUNT_ID) {
          // baseProfitのCF科目を検出（固定値で判定）
          baseProfit = account;
          // baseProfitはCFセクションの最初に表示するため、regularには含めない
        } else {
          regular.push(account);
        }
      }

      accountMapByFsType.set(fsType, {
        regular,
        ...(baseProfit && { baseProfit }),
        ...(cashChangeCf && { cashChangeCf }),
      });
    }

    // 描画対象の行を計算
    const renderRows: Row[] = [];

    // 財務分析インスタンスを作成（バランスチェックで使用）
    const analysis = new FinancialAnalysis(fam);

    // 全期間のIDを取得
    const periodIds = periods.map((p) => p.id);

    // 比率と前期比を事前に計算
    const allRatios = analysis.calculateRatios(periodIds, ratioConfig);
    const allYearOverYear = analysis.calculateYearOverYear(
      periodIds,
      yearOverYearConfig
    );

    // 比率をtargetAccountIdでグループ化
    const ratiosByTargetAccount = new Map<AccountId, Ratio[]>();
    for (const ratio of allRatios) {
      const existing = ratiosByTargetAccount.get(ratio.targetAccountId) || [];
      existing.push(ratio);
      ratiosByTargetAccount.set(ratio.targetAccountId, existing);
    }

    // 前期比をaccountIdでマッピング
    const yoyByAccountId = new Map<AccountId, YearOverYear>();
    for (const yoy of allYearOverYear) {
      yoyByAccountId.set(yoy.accountId, yoy);
    }

    for (const fsType of fsTypeOrder) {
      const accountsForFsType = accountMapByFsType.get(fsType);
      if (!accountsForFsType) {
        continue;
      }

      // FSヘッダーを表示
      renderRows.push({
        id: `fs-header-${fsType}`,
        accountName: fsType,
        ruleDescription: "",
        rowType: "fs-header",
        fsType: fsType,
      });

      // CFセクションの場合、まず当期純利益（CF）を表示
      if (fsType === "CF" && accountsForFsType.baseProfit) {
        // baseProfitのCF科目における各期間の値を取得
        const periodValues: Record<PeriodId, number> = {};
        for (const period of periods) {
          const value = getValueFromFam(
            fam,
            period.id,
            accountsForFsType.baseProfit.id
          );
          periodValues[period.id] = value;
        }

        const accountId = accountsForFsType.baseProfit.id; // BASE_PROFIT_CF_ACCOUNT_ID

        renderRows.push({
          id: accountId,
          accountName: accountsForFsType.baseProfit.accountName, // 既に「（CF）」が含まれている
          ruleDescription: getRuleDescription(accountId, accountsMap),
          rowType: "account",
          fsType: "CF",
          ...periodValues,
        });

        // YearOverYearを追加（該当する場合）
        // analysisConfig.tsのyearOverYearConfigにaccountIdが含まれている場合のみ表示
        const yoy = yoyByAccountId.get(accountId);
        if (yoy) {
          const yoyValues: Record<PeriodId, number> = {};
          for (const period of periods) {
            const changeRate = yoy.changeRates.get(period.id);
            if (changeRate !== undefined) {
              yoyValues[period.id] = changeRate;
            }
          }
          if (Object.keys(yoyValues).length > 0) {
            renderRows.push({
              id: `yoy-${accountId}`,
              accountName: "前期比",
              ruleDescription: "",
              rowType: "yoy",
              fsType: fsType,
              ...yoyValues,
            });
          }
        }

        // Ratioを追加（該当する場合）
        // analysisConfig.tsのratioConfigにaccountIdがtargetAccountIdとして含まれている場合のみ表示
        const ratios = ratiosByTargetAccount.get(accountId);
        if (ratios) {
          for (const ratio of ratios) {
            const ratioValues: Record<PeriodId, number> = {};
            for (const period of periods) {
              const value = ratio.values.get(period.id);
              if (value !== undefined) {
                ratioValues[period.id] = value;
              }
            }
            if (Object.keys(ratioValues).length > 0) {
              renderRows.push({
                id: `ratio-${ratio.baseAccountId}-${ratio.targetAccountId}`,
                accountName: ratio.label,
                ruleDescription: "",
                rowType: "ratio",
                ratioType: ratio.ratioType,
                fsType: fsType,
                ...ratioValues,
              });
            }
          }
        }
      }

      // 通常のアカウントを表示
      for (const account of accountsForFsType.regular) {
        //accountにおける各期間の値を取得
        const periodValues: Record<PeriodId, number> = {};
        for (const period of periods) {
          const value = getValueFromFam(fam, period.id, account.id);
          periodValues[period.id] = value;
        }

        const accountId = account.id;
        renderRows.push({
          id: accountId,
          accountName: account.accountName,
          ruleDescription: getRuleDescription(accountId, accountsMap),
          rowType: "account",
          fsType: fsType,
          ...periodValues,
        });

        // YearOverYearを追加（該当する場合）
        const yoy = yoyByAccountId.get(accountId);
        if (yoy) {
          const yoyValues: Record<PeriodId, number> = {};
          for (const period of periods) {
            const changeRate = yoy.changeRates.get(period.id);
            if (changeRate !== undefined) {
              yoyValues[period.id] = changeRate;
            }
          }
          if (Object.keys(yoyValues).length > 0) {
            renderRows.push({
              id: `yoy-${accountId}`,
              accountName: "前期比",
              ruleDescription: "",
              rowType: "yoy",
              fsType: fsType,
              ...yoyValues,
            });
          }
        }

        // Ratioを追加（該当する場合）
        const ratios = ratiosByTargetAccount.get(accountId);
        if (ratios) {
          for (const ratio of ratios) {
            const ratioValues: Record<PeriodId, number> = {};
            for (const period of periods) {
              const value = ratio.values.get(period.id);
              if (value !== undefined) {
                ratioValues[period.id] = value;
              }
            }
            if (Object.keys(ratioValues).length > 0) {
              renderRows.push({
                id: `ratio-${ratio.baseAccountId}-${ratio.targetAccountId}`,
                accountName: ratio.label,
                ruleDescription: "",
                rowType: "ratio",
                ratioType: ratio.ratioType,
                fsType: fsType,
                ...ratioValues,
              });
            }
          }
        }

        // BSセクションで、equity_and_liabilities_totalの直後にバランスチェック行を追加
        if (fsType === "BS" && accountId === "equity_and_liabilities_total") {
          const balanceCheckValues: Record<PeriodId, number> = {};
          for (const period of periods) {
            const balanceCheck = analysis.checkBalance(period.id);
            if (balanceCheck) {
              balanceCheckValues[period.id] = balanceCheck.difference;
            }
          }

          if (Object.keys(balanceCheckValues).length > 0) {
            renderRows.push({
              id: "balance-check",
              accountName: "バランスチェック",
              ruleDescription: "",
              rowType: "balance-check",
              fsType: "BS",
              ...balanceCheckValues,
            });
          }
        }
      }

      // CFセクションの最後に cash_change_cf を追加
      if (fsType === "CF" && accountsForFsType.cashChangeCf) {
        const periodValues: Record<PeriodId, number> = {};
        for (const period of periods) {
          const value = getValueFromFam(
            fam,
            period.id,
            accountsForFsType.cashChangeCf.id
          );
          periodValues[period.id] = value;
        }

        const accountId = accountsForFsType.cashChangeCf.id;
        renderRows.push({
          id: accountId,
          accountName: accountsForFsType.cashChangeCf.accountName,
          ruleDescription: getRuleDescription(accountId, accountsMap),
          rowType: "account",
          fsType: "CF",
          ...periodValues,
        });

        // YearOverYearを追加（該当する場合）
        const yoy = yoyByAccountId.get(accountId);
        if (yoy) {
          const yoyValues: Record<PeriodId, number> = {};
          for (const period of periods) {
            const changeRate = yoy.changeRates.get(period.id);
            if (changeRate !== undefined) {
              yoyValues[period.id] = changeRate;
            }
          }
          if (Object.keys(yoyValues).length > 0) {
            renderRows.push({
              id: `yoy-${accountId}`,
              accountName: "前期比",
              ruleDescription: "",
              rowType: "yoy",
              fsType: fsType,
              ...yoyValues,
            });
          }
        }

        // Ratioを追加（該当する場合）
        const ratios = ratiosByTargetAccount.get(accountId);
        if (ratios) {
          for (const ratio of ratios) {
            const ratioValues: Record<PeriodId, number> = {};
            for (const period of periods) {
              const value = ratio.values.get(period.id);
              if (value !== undefined) {
                ratioValues[period.id] = value;
              }
            }
            if (Object.keys(ratioValues).length > 0) {
              renderRows.push({
                id: `ratio-${ratio.baseAccountId}-${ratio.targetAccountId}`,
                accountName: ratio.label,
                ruleDescription: "",
                rowType: "ratio",
                ratioType: ratio.ratioType,
                fsType: fsType,
                ...ratioValues,
              });
            }
          }
        }
      }
    }

    // カラム定義（フォーマッターなし、JSXを含まない）
    const newColumns: Column<Row>[] = [
      {
        // columnsのkeyプロパティとrowオブジェクトのプロパティ名が一致する必要
        key: "accountName",
        name: "Account",
        width: 250,
        frozen: true,
        cellClass: (row) => {
          if (row.rowType === "fs-header") return "fs-header-cell";
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
    if (!famInstanceRef.current) return;

    // 予測計算の実行
    const forecastResult = famInstanceRef.current.compute();
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
    updateGrid(famInstanceRef.current, updatedPeriods);
  }, [displayPeriods, updateGrid]);

  return { columns, rows, runCompute };
}
