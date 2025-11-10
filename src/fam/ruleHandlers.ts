// src/fam/ruleHandlers.ts

import { makeFF } from "../engine/ast.ts";
import { NodeRegistry } from "../model/registry.ts";
import type {
  AccountId,
  FormulaNode,
  NodeId,
  PeriodId,
  RelativePeriodReference,
  Rule,
} from "../model/types.ts";

/**
 * ルールハンドラーのコンテキスト
 * 現在の設計は：
 * すべてのハンドラーが共通のRuleHandlerContext型を受け取る
 * 各ハンドラーは必要なプロパティだけを使用する
 * 使わないプロパティがあっても問題ない
 */
export interface RuleHandlerContext {
  periodId: PeriodId;
  accountId: AccountId;
  nodeRegistry: NodeRegistry;
  buildNode: (periodId: PeriodId, accountId: AccountId) => NodeId;
  buildFormula: (formula: FormulaNode) => NodeId;
  resolvePeriodId: (reference?: RelativePeriodReference) => PeriodId;
}

/**
 * 各ルールタイプごとの型エイリアス
 * 型の可読性を向上させるため、各ルールタイプを個別に定義します
 * 型の絞り込みは、実行時の値に対して、TypeScriptが型をより具体的に絞り込むこと
 * ここでは型レベルでの操作で、ユニオン型から特定の型を抽出する「型の抽出」を行っている
 *
 * 具体的な実装はsimpleFam.tsで定義
 */
// Extract<Rule, { type: "INPUT" }>は、Ruleからtype: "INPUT"を持つ型だけを抽出する
// 結果は { type: "INPUT"; value: number }
type InputRule = Extract<Rule, { type: "INPUT" }>;
type CalculationRule = Extract<Rule, { type: "CALCULATION" }>;
type FixedValueRule = Extract<Rule, { type: "FIXED_VALUE" }>;
type ReferenceRule = Extract<Rule, { type: "REFERENCE" }>;
type ProportionateRule = Extract<Rule, { type: "PROPORTIONATE" }>;
type GrowthRateRule = Extract<Rule, { type: "GROWTH_RATE" }>;
type PercentageRule = Extract<Rule, { type: "PERCENTAGE" }>;
type BalanceChangeRule = Extract<Rule, { type: "BALANCE_CHANGE" }>;

/**
 * ルールハンドラーの基本型
 * 各ルールタイプに対応するハンドラー関数のシグネチャを定義します
 */
type RuleHandlerFunction<T extends Rule> = (
  rule: T,
  context: RuleHandlerContext
) => NodeId;

/**
 * 各ルールタイプごとのハンドラー型
 * 型の可読性を向上させるため、各ルールタイプごとに個別に定義します
 */
type InputRuleHandler = RuleHandlerFunction<InputRule>;
type CalculationRuleHandler = RuleHandlerFunction<CalculationRule>;
type FixedValueRuleHandler = RuleHandlerFunction<FixedValueRule>;
type ReferenceRuleHandler = RuleHandlerFunction<ReferenceRule>;
type ProportionateRuleHandler = RuleHandlerFunction<ProportionateRule>;
type GrowthRateRuleHandler = RuleHandlerFunction<GrowthRateRule>;
type PercentageRuleHandler = RuleHandlerFunction<PercentageRule>;
type BalanceChangeRuleHandler = RuleHandlerFunction<BalanceChangeRule>;

/**
 * INPUTルールのハンドラー
 * パターン: 終端ノード作成（定数値）
 * 固定値を設定します
 */
export const handleInput: InputRuleHandler = (rule, context) => {
  // 使用するプロパティを分割代入で取得
  const { accountId, periodId, nodeRegistry } = context;
  // makeFFの型注釈は、(reg: NodeRegistry, value: number, label: string) => NodeId;
  return makeFF(
    nodeRegistry,
    rule.value,
    `${accountId}@${periodId}[Input=${rule.value}]`
  );
};

/**
 * CALCULATIONルールのハンドラー
 * パターン: 式構築（定義済み式の委譲）
 * 計算式を評価します
 */
export const handleCalculation: CalculationRuleHandler = (rule, context) => {
  const { buildFormula } = context;
  return buildFormula(rule.expression);
};

/**
 * FIXED_VALUEルールのハンドラー
 * パターン: 科目参照（buildNode）
 * 前期の値をそのまま使用します
 */
export const handleFixedValue: FixedValueRuleHandler = (_rule, context) => {
  const { accountId, resolvePeriodId, buildNode } = context;
  const prevPeriodId = resolvePeriodId({
    offset: -1,
  });
  return buildNode(prevPeriodId, accountId);
};

/**
 * REFERENCEルールのハンドラー
 * パターン: 科目参照（buildNode）
 * 他の科目を参照します
 */
export const handleReference: ReferenceRuleHandler = (rule, context) => {
  const { periodId, buildNode } = context;
  return buildNode(periodId, rule.ref);
};

/**
 * PROPORTIONATEルールのハンドラー
 * パターン: 式構築（複雑な式の構築）
 * ドライバー科目の変化率に応じて比例計算します
 * 計算式: 前期値 × (ドライバー当期値 / ドライバー前期値)
 */
export const handleProportionate: ProportionateRuleHandler = (
  rule,
  context
) => {
  const { accountId, buildFormula } = context;
  const driverAccount = rule.ref;

  // 前期値 × (ドライバー当期値 / ドライバー前期値)
  return buildFormula({
    type: "MUL",
    left: {
      type: "ACCOUNT",
      id: accountId,
      period: { offset: -1 },
    },
    right: {
      type: "DIV",
      left: {
        type: "ACCOUNT",
        id: driverAccount,
      },
      right: {
        type: "ACCOUNT",
        id: driverAccount,
        period: { offset: -1 },
      },
    },
  });
};

/**
 * GROWTH_RATEルールのハンドラー
 * パターン: 式構築（単一演算）
 * 前期値に成長率を掛けます
 * 計算式: 前期値 × (1 + 成長率)
 */
export const handleGrowthRate: GrowthRateRuleHandler = (rule, context) => {
  const { accountId, buildFormula } = context;
  return buildFormula({
    type: "MUL",
    left: { type: "ACCOUNT", id: accountId, period: { offset: -1 } },
    right: { type: "NUMBER", value: 1 + rule.rate },
  });
};

/**
 * PERCENTAGEルールのハンドラー
 * パターン: 式構築（単一演算）
 * 参照科目に割合を掛けます
 * 計算式: 参照科目 × 割合
 */
export const handlePercentage: PercentageRuleHandler = (rule, context) => {
  const { buildFormula } = context;
  return buildFormula({
    type: "MUL",
    left: { type: "ACCOUNT", id: rule.ref },
    right: { type: "NUMBER", value: rule.percentage },
  });
};

/**
 * BALANCE_CHANGEルールのハンドラー
 * パターン: 式構築（複雑な式の構築）
 * 前期末残高にフロー（増減）を加算します
 * 計算式: 前期末残高 + (フロー1 + フロー2 + ...)
 */
export const handleBalanceChange: BalanceChangeRuleHandler = (
  rule,
  context
) => {
  const { accountId, buildFormula } = context;

  // フロー（当期増減）の合計式を構築
  const flowsExpr = rule.flows.reduce<FormulaNode | null>((acc, flow) => {
    const baseNode: FormulaNode = {
      type: "ACCOUNT",
      id: flow.ref,
    };
    const signedNode: FormulaNode =
      flow.sign === "PLUS"
        ? baseNode
        : {
            type: "MUL",
            left: baseNode,
            right: { type: "NUMBER", value: -1 },
          };
    if (!acc) return signedNode;
    return {
      type: "ADD",
      left: acc,
      right: signedNode,
    };
  }, null);

  // 前期末残高 + フロー合計の式を構築
  return buildFormula({
    type: "ADD",
    left: {
      type: "ACCOUNT",
      id: accountId,
      period: { offset: -1 },
    },
    right: flowsExpr ?? { type: "NUMBER", value: 0 },
  });
};

/**
 * ルールタイプからハンドラーへのマッピング
 * 新しいルールタイプを追加する場合は、ここにエントリを追加するだけです
 */
export const ruleHandlers: {
  INPUT: InputRuleHandler;
  CALCULATION: CalculationRuleHandler;
  FIXED_VALUE: FixedValueRuleHandler;
  REFERENCE: ReferenceRuleHandler;
  PROPORTIONATE: ProportionateRuleHandler;
  GROWTH_RATE: GrowthRateRuleHandler;
  PERCENTAGE: PercentageRuleHandler;
  BALANCE_CHANGE: BalanceChangeRuleHandler;
} = {
  INPUT: handleInput,
  CALCULATION: handleCalculation,
  FIXED_VALUE: handleFixedValue,
  REFERENCE: handleReference,
  PROPORTIONATE: handleProportionate,
  GROWTH_RATE: handleGrowthRate,
  PERCENTAGE: handlePercentage,
  BALANCE_CHANGE: handleBalanceChange,
};
