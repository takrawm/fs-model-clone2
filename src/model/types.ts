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

/**
 * 科目参照ノード
 *
 * 他の科目の値を参照する際に使用します。参照先の科目は、この科目より先に
 * 計算される必要があるため、依存関係が形成されます。
 *
 * periodプロパティにより、参照のタイミングを制御できます。
 *
 * - 省略または { offset: 0 }: 当期の値を参照
 *   参照先の科目が今回の計算で求める値を使用します。
 *   これにより、科目間の依存関係の連鎖が形成されます。
 *   例: 売上総利益が売上高を参照する場合、売上高が先に計算される必要があります。
 *
 * - { offset: -1 }: 前期の実績値を参照
 *   シードデータのactualsに格納されている前期の実績値を使用します。
 *   これは計算の起点となり、それ以上依存先を辿る必要がありません。
 *   例: 「前期比110%」という成長率を適用する場合、前期の値が必要です。
 *
 * 前期参照の具体例：
 *
 * 「今期の売上 = 前期の売上 × 1.1」という計算の場合：
 * {
 *   type: 'MUL',
 *   left: { type: 'ACCOUNT', id: 'revenue', period: { offset: -1 } },
 *   right: { type: 'NUMBER', value: 1.1 }
 * }
 */

export interface AccountNode {
  type: "ACCOUNT";
  id: AccountId;
  period?: RelativePeriodReference;
}

/**
 * 二項演算ノード
 *
 * 2つの式を演算子で結合します。leftとrightはそれぞれ独立した式であり、
 * それ自体が複雑な構造を持つことができます。
 *
 * 演算の種類：
 *
 * - ADD（加算）: left + right
 *   用途: 複数の収益源の合計、費用の合算など
 *   例: 総売上 = 商品売上 + サービス売上
 *
 * - SUB（減算）: left - right
 *   用途: 利益の計算、変動の算出など
 *   例: 売上総利益 = 売上高 - 売上原価
 *
 * - MUL（乗算）: left × right
 *   用途: 単価×数量、比率の適用、成長率の適用など
 *   例: 売上 = 単価 × 数量
 *   例: 原価 = 売上 × 0.6
 *
 * - DIV（除算）: left ÷ right
 *   用途: 平均の計算、回転率の算出など
 *   例: 平均単価 = 売上高 ÷ 販売数量
 *   例: 売掛金 = 売上高 × 回転日数 ÷ 360
 *
 * 演算の優先順位は、ツリーの構造によって表現されます。
 * 例えば「A + B × C」という式は、まず B×C を計算してから A に加算する
 * 必要がありますが、これは以下の構造で表現されます。
 *
 * {
 *   type: 'BINARY_OP',
 *   op: 'ADD',
 *   left: { type: 'ACCOUNT', id: 'A' },
 *   right: {
 *     type: 'BINARY_OP',
 *     op: 'MUL',
 *     left: { type: 'ACCOUNT', id: 'B' },
 *     right: { type: 'ACCOUNT', id: 'C' }
 *   }
 * }
 *
 * この構造により、MULノードがADDノードの子として配置されるため、
 * 自動的に先に評価されます。
 */
export interface BinaryOpNode {
  type: "BINARY_OP";
  op: "ADD" | "SUB" | "MUL" | "DIV";
  left: FormulaNode;
  right: FormulaNode;
}

/**
 * 科目ID
 *
 * 勘定科目を一意に識別するためのIDです。
 * 例: "revenue", "cogs", "gross_profit"
 *
 * NodeIdと区別するために型エイリアスを使用しています。
 * NodeIdはASTノードの内部管理用ID、AccountIdは
 * ユーザーが扱う財務科目のIDです。
 */
export type AccountId = string;

export interface Account {
  id: AccountId;
  AccountName: string;
  GlobalAccountID?: string | null;
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

/**
 * 値のキー文字列
 *
 * 期間と科目の組み合わせを一意に識別するためのキー文字列です。
 * 形式: "${periodId}::${accountId}"
 * 例: "FY2025::unit_price", "FY2026::revenue"
 *
 * テンプレートリテラル型により、この形式であることが型レベルで保証されます。
 */
export type ValueKeyString = `${PeriodId}::${AccountId}`;

/**
 * 入力データ
 *
 * シードデータや外部から取り込んだデータを表現します。
 * isInputがtrueの場合、この値は入力値として扱われます。
 */
export interface Value {
  accountId: AccountId;
  periodId: PeriodId;
  value: number;
  isInput: boolean;
}

/**
 * FAMルールの定義
 *
 * 財務モデルで各科目をどのように計算するかを表す設定です。
 * - INPUT: 固定値を使う
 * - CALCULATION: 構造化された式を評価する
 * - GROWTH_RATE: 前期値に成長率を掛ける
 * - PERCENTAGE: 参照科目に割合を掛ける
 * - REFERENCE: 単純参照（当期/前期は式側で指定）
 * - BALANCE_CHANGE: 複数科目の増減を合算する
 */
export type Rule =
  | { type: "INPUT"; value: number }
  | { type: "CALCULATION"; expression: FormulaNode }
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
