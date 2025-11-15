// src/utils/financialAnalysis.ts

import type {
  AccountId,
  PeriodId,
  RatioConfig,
  YearOverYearConfig,
} from "../model/types";
import type { SimpleFAM } from "../fam/simpleFam";

// バランスチェック結果
export interface BalanceCheck {
  periodId: PeriodId;
  assetsTotal: number;
  equityAndLiabilitiesTotal: number;
  difference: number;
  isBalanced: boolean;
}

// 比率計算結果
export interface Ratio {
  periodId: PeriodId;
  baseAccountId: AccountId; // 基準となる科目ID
  targetAccountId: AccountId; // 比率を計算する科目ID
  ratioType: "vsAccount";
  value: number;
  label: string;
}

// 前期比計算結果
export interface YearOverYear {
  periodId: PeriodId;
  previousPeriodId: PeriodId;
  accountId: AccountId;
  currentValue: number;
  previousValue: number;
  changeRate: number; // 変化率（%）
  changeAmount: number; // 変化額
}

// 財務分析クラス
export class FinancialAnalysis {
  // 固定のアカウントID（Mapに保存して高速アクセス）
  private readonly ASSETS_TOTAL_ID: AccountId = "assets_total" as AccountId;
  private readonly EQUITY_AND_LIABILITIES_TOTAL_ID: AccountId =
    "equity_and_liabilities_total" as AccountId;

  constructor(private fam: SimpleFAM) {}

  /**
   * バランスチェック（資産合計と負債・純資産合計の貸借一致）
   * assets_totalとequity_and_liabilities_totalの間で行う
   */
  checkBalance(periodId: PeriodId): BalanceCheck | null {
    const assetsTotal =
      this.fam.getValue(periodId, this.ASSETS_TOTAL_ID) ?? null;
    const equityAndLiabilitiesTotal =
      this.fam.getValue(periodId, this.EQUITY_AND_LIABILITIES_TOTAL_ID) ?? null;

    if (assetsTotal === null || equityAndLiabilitiesTotal === null) {
      return null;
    }

    const difference = Math.abs(assetsTotal - equityAndLiabilitiesTotal);
    const isBalanced = difference < 0.01; // 0.01未満の差は許容

    return {
      periodId,
      assetsTotal,
      equityAndLiabilitiesTotal,
      difference,
      isBalanced,
    };
  }

  /**
   * 比率計算（ユーザー指定の組み合わせのみ）
   * @param periodId - 期間ID
   * @param ratioConfig - 比率計算の設定
   *   例: { revenue: ["gross_profit", "operating_profit"], cogs: ["other_opex"] }
   */
  calculateRatios(periodId: PeriodId, ratioConfig: RatioConfig): Ratio[] {
    const ratios: Ratio[] = [];

    for (const [baseAccountId, targetAccountIds] of Object.entries(
      ratioConfig
    )) {
      const baseValue = this.fam.getValue(periodId, baseAccountId as AccountId);

      if (baseValue === null || baseValue === undefined || baseValue === 0) {
        continue; // 基準値が0の場合はスキップ
      }

      const allAccounts = this.fam.getAllAccounts();
      const baseAccount = allAccounts.find((acc) => acc.id === baseAccountId);
      const baseAccountName = baseAccount?.accountName ?? baseAccountId;

      for (const targetAccountId of targetAccountIds) {
        const targetValue = this.fam.getValue(
          periodId,
          targetAccountId as AccountId
        );

        if (targetValue === null || targetValue === undefined) {
          continue;
        }

        const targetAccount = allAccounts.find(
          (acc) => acc.id === targetAccountId
        );
        const targetAccountName = targetAccount?.accountName ?? targetAccountId;

        const ratio = (targetValue / baseValue) * 100;

        ratios.push({
          periodId,
          baseAccountId: baseAccountId as AccountId,
          targetAccountId: targetAccountId as AccountId,
          ratioType: "vsAccount",
          value: ratio,
          label: `${targetAccountName} / ${baseAccountName}`,
        });
      }
    }

    return ratios;
  }

  /**
   * 前期比計算（ユーザー指定の科目のみ）
   * @param currentPeriodId - 現在の期間ID
   * @param previousPeriodId - 前期の期間ID
   * @param yoyConfig - 前期比を計算したい科目IDの配列
   */
  calculateYearOverYear(
    currentPeriodId: PeriodId,
    previousPeriodId: PeriodId,
    yoyConfig: YearOverYearConfig
  ): YearOverYear[] {
    const results: YearOverYear[] = [];

    for (const accountId of yoyConfig) {
      const currentValue = this.fam.getValue(currentPeriodId, accountId);
      const previousValue = this.fam.getValue(previousPeriodId, accountId);

      if (
        currentValue === null ||
        currentValue === undefined ||
        previousValue === null ||
        previousValue === undefined
      ) {
        continue;
      }

      const changeAmount = currentValue - previousValue;
      const changeRate =
        previousValue !== 0
          ? ((currentValue - previousValue) / previousValue) * 100
          : currentValue !== 0
          ? Infinity
          : 0;

      results.push({
        periodId: currentPeriodId,
        previousPeriodId,
        accountId,
        currentValue,
        previousValue,
        changeRate,
        changeAmount,
      });
    }

    return results;
  }
}
