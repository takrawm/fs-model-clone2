// src/model/types.ts

export type NodeId = string;

export type Op = "ADD" | "SUB" | "MUL" | "DIV";

export type FsType = "PL" | "BS" | "CF" | "PP&E" | "OTHER";

export type Node = FFNode | TTNode;

/**
 * FFノード（終端ノード）
 *
 * 値を直接持つノードです。計算のツリー構造における「葉」に相当し、
 * それ以上分解できない最小単位です。
 */
export interface FFNode {
  id: NodeId;
  type: "FF";
  value: number;
  label?: string;
}

/**
 * TTノード（二項演算ノード）
 *
 * 2つの子ノードを演算で結合するノードです。計算のツリー構造における
 * 「枝」に相当し、下位の計算結果を組み合わせて新しい値を生成します。
 */
export interface TTNode {
  id: NodeId;
  type: "TT";
  ref1: NodeId;
  ref2: NodeId;
  operator: Op;
  label?: string;
}

export type FormulaNode = NumberNode | AccountNode | BinaryOpNode;

/**
 * 定数値ノード
 *
 * 計算式の中で使用される固定の数値を表現します。財務計算では、
 * 以下のような定数がよく使用されます。
 *
 * - 税率: 0.35（法人税率35%）、0.1（消費税率10%）
 * - 回転日数: 30（売掛金回転期間）、60（買掛金回転期間）
 * - 日数換算: 360（年間日数の簡略計算）、365（正確な年間日数）
 * - 比率: 0.6（原価率60%）、0.2（販管費率20%）
 *
 * これらの定数は、計算式の中に直接埋め込まれ、ASTではFFノードとして
 * 終端ノードになります。
 */
export interface NumberNode {
  type: "NUMBER";
  value: number;
}

export interface AccountNode {
  type: "ACCOUNT";
  id: AccountId;
  period?: RelativePeriodReference;
}

export interface BinaryOpNode {
  type: "BINARY_OP";
  op: "ADD" | "SUB" | "MUL" | "DIV";
  left: FormulaNode;
  right: FormulaNode;
}

export type AccountId = string;

export interface Account {
  id: AccountId;
  accountName: string;
  globalAccountId?: string | null;
  fs_type?: FsType | null;
  parent_id?: AccountId | null;
  isCredit?: boolean | null;
  ignoredForCf?: boolean | null; // CF計算のときに除外する項目（現預金、「流動資産合計」などの合計科目）
  isCfBaseProfit?: boolean | null; // 1. CF計算の起点となる利益（例: net_income）
  isCashAccount?: boolean | null; // 3. 現預金科目（例: cash）
}

export type PeriodId = string;

export type PeriodType = "ANNUAL" | "MONTHLY";

export interface Period {
  id: PeriodId;
  year: number; // 暦年（2023, 2024など）
  month: number; // 月（1-12）
  label?: string;
  isFiscalYearEnd: boolean; // この期間が会計年度末かどうか
  fiscalYear: number; // 会計年度（例：2023年3月期なら2023）
  periodType: PeriodType;
}

/**
 * 相対参照（現在使用中）
 * 現在の期間からのオフセットで期間を指定
 */
export type RelativePeriodReference = { offset: number };

/**
 * 絶対参照（将来用）
 * 特定期間IDを直接指定
 */
export type AbsolutePeriodReference = PeriodId;

export type ValueKeyString = `${PeriodId}::${AccountId}`;

export interface Value {
  accountId: AccountId;
  periodId: PeriodId;
  value: number;
  isInput: boolean;
}

export type Rule =
  | { type: "INPUT"; value: number }
  | { type: "CALCULATION"; formulaNode: FormulaNode }
  | { type: "GROWTH_RATE"; rate: number }
  | { type: "PERCENTAGE"; percentage: number; ref: AccountId }
  | { type: "REFERENCE"; ref: AccountId }
  | { type: "FIXED_VALUE" }
  | { type: "PROPORTIONATE"; ref: AccountId }
  | {
      type: "BALANCE_CHANGE";
      flowAccounts: Array<{
        ref: AccountId;
        sign: "PLUS" | "MINUS";
      }>;
    };

/**
 * 比率計算の設定
 * キー: 基準となる科目ID、値: 比率を計算したい科目IDの配列
 * 例: { revenue: ["gross_profit", "operating_profit"], cogs: ["other_opex"] }
 */
export type RatioConfig = Record<AccountId, AccountId[]>;

/**
 * 前期比計算の設定
 * 前期比を計算したい科目IDの配列
 */
export type YearOverYearConfig = AccountId[];
