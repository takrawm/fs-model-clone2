// src/config/financialModelConfig.ts

import type { AccountId } from "../model/types";

/**
 * 財務モデルの設定
 * baseProfitのCF科目IDを固定値で管理
 */
export const BASE_PROFIT_CF_ACCOUNT_ID: AccountId =
  "baseProfit_cf" as AccountId;
