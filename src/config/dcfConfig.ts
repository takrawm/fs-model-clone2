// src/config/dcfConfig.ts

export interface DCFConfig {
  baseYear: number;
  forecastYears: number;
  terminalGrowthRate: number; // (例: 0.02 は 2%)
  wacc: number; // (例: 0.05 は 5%)
}

/**
 * DCF（ディスカウンテッド・キャッシュフロー）分析用の設定
 */
export const dcfConfig: DCFConfig = {
  /**
   * 基準年度 (FY)
   * この年度の実績値をベースに予測を開始します
   */
  baseYear: 2025,

  /**
   * 予測期間 (年数)
   * 詳細な予測を行う年数
   */
  forecastYears: 5,

  /**
   * 永久成長率 (Terminal Growth Rate)
   * 予測期間終了後のFCFの永久的な成長率
   */
  terminalGrowthRate: 0.02, // 2.0%

  /**
   * 加重平均資本コスト (WACC: Weighted Average Cost of Capital)
   * FCFを現在価値に割り引くための割引率
   */
  wacc: 0.05, // 5.0%
};

