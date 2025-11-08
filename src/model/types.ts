// src/model/types.ts

/**
 * 型定義ファイル
 *
 * このファイルは、財務モデリングシステムで使用されるすべてのデータ構造を定義します。
 * TypeScriptの型システムを活用することで、コンパイル時に多くのエラーを検出でき、
 * 実行時の予期しない動作を防ぐことができます。
 *
 * 特に重要なのは、ExpressionNode型です。これは計算式を構造化して表現するための
 * 型で、再帰的な構造を持っています。この型により、任意の複雑さの数式を
 * 型安全に扱うことができます。
 */

/**
 * ノードID
 *
 * ASTノードを一意に識別するための文字列です。レジストリ内でノードを検索する際の
 * キーとして使用されます。通常は連番（"1", "2", "3", ...）で管理されますが、
 * 文字列型にすることで将来的な拡張性を確保しています。
 */
export type NodeId = string;

/**
 * 演算子
 *
 * 四則演算を表現する型です。これらの演算子は、TTノード（二項演算ノード）で
 * 使用され、評価時にどの計算を行うべきかを決定します。
 *
 * - ADD: 加算（+）
 * - SUB: 減算（-）
 * - MUL: 乗算（×）
 * - DIV: 除算（÷）
 */
export type Op = "ADD" | "SUB" | "MUL" | "DIV";

export type FsType = "PL" | "BS" | "CF" | "PP&E" | "OTHER";

/**
 * ASTノード
 *
 * 抽象構文木（Abstract Syntax Tree）を構成する個々のノードです。
 * すべてのノードは一意のIDを持ち、以下の2種類に分類されます。
 *
 * 1. FFノード（終端ノード）: 値を直接持つノード
 *    - value プロパティに数値が格納されています
 *    - 他のノードへの参照を持ちません
 *    - 例: 定数（0.35、360）や実績値（500000）
 *
 * 2. TTノード（二項演算ノード）: 2つの子ノードを演算で結合するノード
 *    - ref1、ref2 プロパティで左右の子ノードを参照します
 *    - operator プロパティで演算の種類を指定します
 *    - 例: revenue = unit_price × quantity
 *
 * label プロパティは、デバッグやログ出力の際にノードの内容を
 * 人間が理解できる形で表示するために使用されます。
 */
export interface Node {
  id: NodeId;

  // FFノードの場合のみ設定される
  value?: number;

  // TTノードの場合のみ設定される
  ref1?: NodeId;
  ref2?: NodeId;
  operator?: Op;

  // デバッグ用のラベル（例: "revenue(単価×数量)"）
  label?: string;
}

/**
 * 計算式を構造化して表現するための型
 *
 * これは、財務計算の核心となる型定義です。計算式をツリー構造として表現することで、
 * 演算の優先順位を明確にし、複雑な計算を正確に実行できます。
 *
 * ExpressionNodeは3つの基本的な要素から構成されます。
 *
 * 1. NUMBER: 定数値
 *    税率、回転日数、成長率など、計算式の中で使用される固定の数値です。
 *    例: { type: 'NUMBER', value: 0.35 }
 *
 * 2. ACCOUNT: 科目参照
 *    他の科目の計算結果を参照します。この参照により、科目間の依存関係が
 *    形成されます。periodプロパティで、当期の値を参照するか、前期の実績値を
 *    参照するかを指定できます。
 *    例: { type: 'ACCOUNT', id: 'revenue' }
 *    例: { type: 'ACCOUNT', id: 'revenue', period: 'PREV' }
 *
 * 3. 二項演算: 2つの式を演算子で結合
 *    左右の部分式（これも ExpressionNode）を演算で結合します。
 *    部分式自体がさらに複雑な構造を持つことができるため、
 *    任意の深さのツリーを構築できます。
 *    例: { type: 'ADD', left: {...}, right: {...} }
 *
 * この型の再帰的な性質により、以下のような複雑な式も表現できます。
 *
 * 「(売上高 - 売上原価) × (1 - 税率)」という式は：
 * {
 *   type: 'MUL',
 *   left: {
 *     type: 'SUB',
 *     left: { type: 'ACCOUNT', id: 'revenue' },
 *     right: { type: 'ACCOUNT', id: 'cogs' }
 *   },
 *   right: {
 *     type: 'SUB',
 *     left: { type: 'NUMBER', value: 1 },
 *     right: { type: 'NUMBER', value: 0.35 }
 *   }
 * }
 *
 * このように表現されます。
 */
export type ExpressionNode = NumberNode | AccountNode | BinaryOpNode;

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
 * - 'CURRENT' または省略: 当期の値を参照
 *   参照先の科目が今回の計算で求める値を使用します。
 *   これにより、科目間の依存関係の連鎖が形成されます。
 *   例: 売上総利益が売上高を参照する場合、売上高が先に計算される必要があります。
 *
 * - 'PREV': 前期の実績値を参照
 *   シードデータのactualsに格納されている前期の実績値を使用します。
 *   これは計算の起点となり、それ以上依存先を辿る必要がありません。
 *   例: 「前期比110%」という成長率を適用する場合、前期の値が必要です。
 *
 * 前期参照の具体例：
 *
 * 「今期の売上 = 前期の売上 × 1.1」という計算の場合：
 * {
 *   type: 'MUL',
 *   left: { type: 'ACCOUNT', id: 'revenue', period: 'PREV' },
 *   right: { type: 'NUMBER', value: 1.1 }
 * }
 */
export type PeriodReference =
  | "CURRENT"
  | "PREV"
  | PeriodId
  | { offset: number };

export interface AccountNode {
  type: "ACCOUNT";
  id: AccountId;
  period?: PeriodReference;
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
 *   type: 'ADD',
 *   left: { type: 'ACCOUNT', id: 'A' },
 *   right: {
 *     type: 'MUL',
 *     left: { type: 'ACCOUNT', id: 'B' },
 *     right: { type: 'ACCOUNT', id: 'C' }
 *   }
 * }
 *
 * この構造により、MULノードがADDノードの子として配置されるため、
 * 自動的に先に評価されます。
 */
export interface BinaryOpNode {
  type: "ADD" | "SUB" | "MUL" | "DIV";
  left: ExpressionNode;
  right: ExpressionNode;
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
}

export type PeriodId = string;

export interface TimelinePeriod {
  id: PeriodId;
  label?: string;
  offset?: number;
}

export interface ComputeOptions {
  periodsToGenerate?: number;
}

export type ValueSource = "ACTUAL" | "FORECAST";

export interface Value {
  accountId: AccountId;
  periodId: PeriodId;
  value: number;
  source?: ValueSource;
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
  | { type: "CALCULATION"; expression: ExpressionNode }
  | { type: "GROWTH_RATE"; rate: number; ref: AccountId }
  | { type: "PERCENTAGE"; percentage: number; ref: AccountId }
  | { type: "REFERENCE"; ref: AccountId }
  | {
      type: "BALANCE_CHANGE";
      flows: Array<{
        ref: AccountId;
        sign: "PLUS" | "MINUS";
      }>;
    };
