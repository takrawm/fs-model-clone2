// src/fam/cfRuleBuilders.ts

import type { AccountId, FormulaNode } from "../model/types.ts";

/**
 * CF計算ルール構築用のヘルパー関数
 *
 * これらの関数は、generateCashFlowRules内で使用されるFormulaNodeの構築パターンを
 * 抽象化し、重複を削減するために使用されます。
 * ruleHandlers.tsで定義されている計算パターンと同様の責務を持ちますが、
 * CF計算専用のヘルパーとして分離されています。
 */

/**
 * 科目の前期比差額を計算するFormulaNodeを構築します
 *
 * 計算式: 当期値 - 前期値
 *
 * @param accountId - 対象となる科目ID
 * @returns 差額計算のFormulaNode
 */
export function getPreviousPeriodDifferenceForAccount(
  accountId: AccountId
): FormulaNode {
  return {
    type: "BINARY_OP",
    op: "SUB",
    left: { type: "ACCOUNT", id: accountId },
    right: { type: "ACCOUNT", id: accountId, period: { offset: -1 } },
  };
}

/**
 * FormulaNodeに符号を掛けるFormulaNodeを構築する
 * 既存の計算式に符号を掛けるため、差額計算や合計計算の結果に符号を適用する場合に使う
 *
 * 計算式: formulaNode × sign
 *
 * @param formulaNode - 符号を掛ける対象のFormulaNode
 * @param sign - 符号（1または-1）
 * @returns 符号を掛けたFormulaNode
 */
export function multiplyFormulaNodeBySign(
  formulaNode: FormulaNode,
  sign: number
): FormulaNode {
  return {
    type: "BINARY_OP",
    op: "MUL",
    left: formulaNode,
    right: { type: "NUMBER", value: sign },
  };
}

/**
 * 科目に符号を掛けるFormulaNodeを構築します
 *
 * 計算式: 科目 × sign
 *
 * @param accountId - 対象となる科目ID
 * @param sign - 符号（1または-1）
 * @returns 符号を掛けたFormulaNode
 */
export function multiplyAccountBySign(
  accountId: AccountId,
  sign: number
): FormulaNode {
  return {
    type: "BINARY_OP",
    op: "MUL",
    left: { type: "ACCOUNT", id: accountId },
    right: { type: "NUMBER", value: sign },
  };
}

/**
 * 複数のFormulaNodeを合計するFormulaNodeを構築します
 *
 * 計算式: item1 + item2 + ... + itemN
 *
 * @param items - 合計するFormulaNodeの配列
 * @param baseNode - 起点となるFormulaNode（最初の項目）
 * @returns 合計のFormulaNode
 */
export function sumFormulaNodes(
  items: FormulaNode[],
  baseNode: FormulaNode
): FormulaNode {
  return items.reduce<FormulaNode>(
    (acc, item) => ({
      type: "BINARY_OP",
      op: "ADD",
      left: acc,
      right: item,
    }),
    baseNode
  );
}
