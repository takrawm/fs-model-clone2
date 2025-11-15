// src/fam/dcfRuleBuilder.ts

import type { AccountId, FormulaNode } from "../model/types.ts";
import { sumFormulaNodes } from "./cfRuleBuilders.ts";

/**
 * DCF計算ルール構築用のヘルパー関数
 *
 * これらの関数は、generateDcfRules内で使用されるFormulaNodeの構築パターンを
 * 抽象化し、重複を削減するために使用されます。
 * cfRuleBuilders.tsで定義されている計算パターンと同様の責務を持ちますが、
 * DCF計算専用のヘルパーとして分離されています。
 */

/**
 * 営業利益に対する税金のFormulaNodeを構築します
 *
 * 計算式: 営業利益 × 税率
 *
 * @param operatingProfitAccountId - 営業利益の科目ID
 * @param taxRate - 税率（0-1の範囲）
 * @returns 税金計算のFormulaNode
 */
export function buildTaxOnOperatingProfitFormulaNode(
  operatingProfitAccountId: AccountId,
  taxRate: number
): FormulaNode {
  return {
    type: "BINARY_OP",
    op: "MUL",
    left: { type: "ACCOUNT", id: operatingProfitAccountId },
    right: { type: "NUMBER", value: taxRate },
  };
}

/**
 * NOPLAT（税引後営業利益）のFormulaNodeを構築します
 *
 * 計算式: 営業利益（DCF） - 税金（対営業利益）
 *
 * @param operatingProfitDcfAccountId - 営業利益（DCF）の科目ID
 * @param taxOnOperatingProfitAccountId - 税金（対営業利益）の科目ID
 * @returns NOPLAT計算のFormulaNode
 */
export function buildNoplatFormulaNode(
  operatingProfitDcfAccountId: AccountId,
  taxOnOperatingProfitAccountId: AccountId
): FormulaNode {
  return {
    type: "BINARY_OP",
    op: "SUB",
    left: { type: "ACCOUNT", id: operatingProfitDcfAccountId },
    right: { type: "ACCOUNT", id: taxOnOperatingProfitAccountId },
  };
}

/**
 * フリーキャッシュフロー（FCF）のFormulaNodeを構築します
 *
 * 計算式: NOPLAT + (調整項目1 + 調整項目2 + ...)
 *
 * @param noplatAccountId - NOPLATの科目ID
 * @param adjustmentItems - 調整項目のFormulaNode配列
 * @returns FCF計算のFormulaNode
 */
export function buildFcfFormulaNode(
  noplatAccountId: AccountId,
  adjustmentItems: FormulaNode[]
): FormulaNode {
  return sumFormulaNodes(adjustmentItems, {
    type: "ACCOUNT",
    id: noplatAccountId,
  });
}

/**
 * 現在価値係数の値を計算します
 *
 * 計算式: 1 / ((1 + WACC)^(n - 0.5))
 * 期央主義を採用し、基準年度からn年目の場合、n - 0.5年後に割り引きます
 *
 * @param yearsFromBase - 基準年度からの年数（n）
 * @param wacc - 加重平均資本コスト（0-1の範囲）
 * @returns 現在価値係数の値
 */
export function calculatePresentValueFactor(
  yearsFromBase: number,
  wacc: number
): number {
  const discountPeriod = yearsFromBase - 0.5; // 期央主義
  return 1 / Math.pow(1 + wacc, discountPeriod);
}
