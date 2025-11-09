// src/model/periodUtils.ts
import { FISCAL_YEAR_END } from "../data/seedPeriodData.ts";
import type { Period, PeriodId, PeriodType } from "../model/types.ts";

/**
 * fiscalYearを計算する
 * 例：3月決算の場合、2023年1-3月は2023年度、2023年4-12月は2024年度
 */
export function calculateFiscalYear(year: number, month: number): number {
  return month <= FISCAL_YEAR_END ? year : year + 1;
}

/**
 * monthがFISCAL_YEAR_ENDと一致するかチェック
 */
export function isFiscalYearEnd(month: number): boolean {
  return month === FISCAL_YEAR_END;
}

/**
 * periodTypeに応じて適切なmonthを決定する
 * - ANNUAL: FISCAL_YEAR_END
 * - SEMI-ANNUAL: FISCAL_YEAR_ENDまたは(FISCAL_YEAR_END + 6) % 12（0なら12に補正）
 * - MONTHLY: 引数のmonthをそのまま使用
 */
export function determineMonth(periodType: PeriodType, month: number): number {
  switch (periodType) {
    case "ANNUAL":
      return FISCAL_YEAR_END;
    case "MONTHLY":
      return month;
    default:
      return month;
  }
}

/**
 * Period IDを生成する
 * 形式: "YYYY-M-PERIODTYPE" (例: "2023-3-ANNUAL")
 */
export function generatePeriodId(
  year: number,
  month: number,
  periodType: PeriodType
): PeriodId {
  return `${year}-${month}-${periodType}`;
}

/**
 * Periodオブジェクトを作成する
 */
export function createPeriod(
  year: number,
  month: number,
  periodType: PeriodType,
  customLabel?: string
): Period {
  const fiscalYear = calculateFiscalYear(year, month);
  const id = generatePeriodId(year, month, periodType);
  const label =
    customLabel || `${year}年${month}月（${periodTypeToJapanese(periodType)}）`;

  return {
    id,
    year,
    month,
    label,
    isFiscalYearEnd: isFiscalYearEnd(month),
    fiscalYear,
    periodType,
  };
}

/**
 * periodTypeを日本語に変換
 */
function periodTypeToJapanese(periodType: PeriodType): string {
  switch (periodType) {
    case "ANNUAL":
      return "年次";
    case "MONTHLY":
      return "月次";
    default:
      return "";
  }
}
