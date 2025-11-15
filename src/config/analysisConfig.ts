// src/config/analysisConfig.ts

import type { RatioConfig, YearOverYearConfig } from "../model/types";

// 比率計算の設定
// 例: 売上高に対して売上総利益と営業利益の比率、売上原価に対してその他販管費の比率
export const ratioConfig: RatioConfig = {
  revenue: ["gross_profit", "operating_profit"],
  cogs: ["other_opex"],
  // 必要に応じて追加
};

// 前期比計算の設定
// 前期比を計算したい科目IDの配列
export const yearOverYearConfig: YearOverYearConfig = [
  "revenue",
  "gross_profit",
  "operating_profit",
  "net_income",
  // 必要に応じて追加
];
