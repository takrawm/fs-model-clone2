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

// 比率計算結果（期間ごとの値を保持）
export interface Ratio {
  baseAccountId: AccountId; // 基準となる科目ID
  targetAccountId: AccountId; // 比率を計算する科目ID
  ratioType: "vsAccount";
  label: string;
  // 期間ごとの比率値
  values: Map<PeriodId, number>;
}

// 前期比計算結果（期間ごとの値を保持）
export interface YearOverYear {
  accountId: AccountId;
  // 期間ごとの変化率（%）
  changeRates: Map<PeriodId, number>;
}

// 財務分析クラス
export class FinancialAnalysis {
  // 固定のアカウントID（Mapに保存して高速アクセス）
  private readonly ASSETS_TOTAL_ID: AccountId = "assets_total" as AccountId;
  private readonly EQUITY_AND_LIABILITIES_TOTAL_ID: AccountId =
    "equity_and_liabilities_total" as AccountId;

  private fam: SimpleFAM;

  constructor(fam: SimpleFAM) {
    this.fam = fam;
  }

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
    const isBalanced = difference === 0; // 完全一致をチェック

    return {
      periodId,
      assetsTotal,
      equityAndLiabilitiesTotal,
      difference,
      isBalanced,
    };
  }

  /**
   * 全期間のバランスチェックを実行し、全ての期間でisBalanced === trueかどうかを判定する
   * @returns 全ての期間でバランスが取れている場合true、そうでない場合false
   */
  areAllPeriodsBalanced(): boolean {
    const periods = this.fam.getAllPeriods();

    // 期間が存在しない場合はtrueを返す（バランス不整合ではない）
    if (periods.length === 0) {
      return true;
    }

    // 全ての期間についてバランスチェックを実行
    for (const period of periods) {
      const balanceCheck = this.checkBalance(period.id);

      // バランスチェックがnullの場合は、その期間のデータが不完全とみなす
      // データが不完全な場合は、バランスが取れているとは言えないためfalseを返す
      if (balanceCheck === null) {
        return false;
      }

      // いずれかの期間でバランスが取れていない場合はfalseを返す
      if (!balanceCheck.isBalanced) {
        return false;
      }
    }

    // 全ての期間でバランスが取れている場合のみtrueを返す
    return true;
  }

  /**
   * 比率計算（ユーザー指定の組み合わせのみ）
   * 全期間を処理し、baseAccountIdとtargetAccountIdの組み合わせごとに1つのオブジェクトを返す
   * @param periods - 全期間の配列
   * @param ratioConfig - 比率計算の設定
   *   例: { revenue: ["gross_profit", "operating_profit"], cogs: ["other_opex"] }
   */
  calculateRatios(periods: PeriodId[], ratioConfig: RatioConfig): Ratio[] {
    const ratiosMap = new Map<string, Ratio>();

    const allAccounts = this.fam.getAllAccounts();

    for (const [baseAccountId, targetAccountIds] of Object.entries(
      ratioConfig
    )) {
      const baseAccount = allAccounts.find((acc) => acc.id === baseAccountId);
      const baseAccountName = baseAccount?.accountName ?? baseAccountId;

      for (const targetAccountId of targetAccountIds) {
        const key = `${baseAccountId}-${targetAccountId}`;
        const values = new Map<PeriodId, number>();

        const targetAccount = allAccounts.find(
          (acc) => acc.id === targetAccountId
        );
        const targetAccountName = targetAccount?.accountName ?? targetAccountId;

        // 全期間について比率を計算
        for (const periodId of periods) {
          const baseValue = this.fam.getValue(
            periodId,
            baseAccountId as AccountId
          );
          const targetValue = this.fam.getValue(
            periodId,
            targetAccountId as AccountId
          );

          if (
            baseValue !== null &&
            baseValue !== undefined &&
            baseValue !== 0 &&
            targetValue !== null &&
            targetValue !== undefined
          ) {
            const ratio = (targetValue / baseValue) * 100;
            values.set(periodId, ratio);
          }
        }

        // 値が1つでも存在する場合のみオブジェクトを作成
        if (values.size > 0) {
          ratiosMap.set(key, {
            baseAccountId: baseAccountId as AccountId,
            targetAccountId: targetAccountId as AccountId,
            ratioType: "vsAccount",
            label: `${targetAccountName} / ${baseAccountName}`,
            values,
          });
        }
      }
    }

    return Array.from(ratiosMap.values());
  }

  /**
   * 前期比計算（ユーザー指定の科目のみ）
   * 全期間を処理し、accountIdごとに1つのオブジェクトを返す
   * @param periods - 全期間の配列（時系列順）
   * @param yoyConfig - 前期比を計算したい科目IDの配列
   */
  calculateYearOverYear(
    periods: PeriodId[],
    yoyConfig: YearOverYearConfig
  ): YearOverYear[] {
    const yoyMap = new Map<AccountId, YearOverYear>();

    for (const accountId of yoyConfig) {
      const changeRates = new Map<PeriodId, number>();

      // 2期間目以降について前期比を計算
      for (let i = 1; i < periods.length; i++) {
        const currentPeriodId = periods[i];
        const previousPeriodId = periods[i - 1];

        const currentValue = this.fam.getValue(currentPeriodId, accountId);
        const previousValue = this.fam.getValue(previousPeriodId, accountId);

        if (
          currentValue !== null &&
          currentValue !== undefined &&
          previousValue !== null &&
          previousValue !== undefined
        ) {
          const changeRate =
            previousValue !== 0
              ? ((currentValue - previousValue) / previousValue) * 100
              : currentValue !== 0
              ? Infinity
              : 0;
          changeRates.set(currentPeriodId, changeRate);
        }
      }

      // 値が1つでも存在する場合のみオブジェクトを作成
      if (changeRates.size > 0) {
        yoyMap.set(accountId, {
          accountId,
          changeRates,
        });
      }
    }

    return Array.from(yoyMap.values());
  }
}
