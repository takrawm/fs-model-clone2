// src/fam/simpleFam.ts

import { evalTopo, makeFF, makeTT } from "../engine/ast.ts";
import { NodeRegistry } from "../model/registry.ts";
import type { ExpressionNode, Op } from "../model/types.ts";

/**
 * 簡素版FAM（Financial Analysis Model）
 *
 * このクラスは、財務モデリングの核心である「依存関係を持つ計算式の評価」に
 * 焦点を絞った学習用の実装です。複雑な機能を削ぎ落とし、ASTエンジンの
 * 動作原理を明確に理解できるように設計されています。
 *
 * 主な機能：
 * 1. 実績データの読み込み
 * 2. 計算ルールに基づくASTの構築
 * 3. トポロジカルソートによる依存関係の解決
 * 4. 予測値の計算と取得
 *
 * 削除された機能：
 * - 貸借対照表やキャッシュフロー計算書の処理
 * - 複数年度の予測
 * - 親子関係の自動再計算
 * - GAIDマッピング
 * - Balance & Change処理
 */
export class SimpleFAM {
  // ASTノードを管理するレジストリ
  private registry: NodeRegistry = new NodeRegistry();

  // 実績データ（前期の数値）を保持
  private actuals: Record<string, number> = {};

  // 計算ルールを保持
  private rules: Record<string, Rule> = {};

  // 各科目に対応するASTノードのIDを保持
  private accountNodes: Map<string, string> = new Map();

  // 循環参照を検出するための訪問済み集合
  private visiting: Set<string> = new Set();

  /**
   * 実績データを読み込みます
   *
   * actualsは、前期の実際の数値を格納したオブジェクトです。
   * 例: { revenue: 500000, cogs: 300000, ... }
   *
   * これらの値は、前期参照が必要な計算式の基礎となります。
   */
  loadActuals(actuals: Record<string, number>) {
    this.actuals = { ...actuals };
    console.log(
      "実績データを読み込みました:",
      Object.keys(actuals).length,
      "件"
    );
  }

  /**
   * 計算ルールを設定します
   *
   * rulesは、各科目をどのように計算するかを定義したオブジェクトです。
   * ルールには以下の種類があります：
   *
   * - INPUT: 固定値を設定（例：次期の単価を1050円に設定）
   * - CALCULATION: 計算式を定義（例：売上 = 単価 × 数量）
   */
  setRules(rules: Record<string, Rule>) {
    this.rules = { ...rules };
    console.log("計算ルールを設定しました:", Object.keys(rules).length, "件");
  }

  /**
   * 予測計算を実行します
   *
   * このメソッドは、設定されたルールに基づいて次期の数値を計算します。
   * 内部的には、以下の手順で処理が行われます：
   *
   * 1. 各科目のASTノードを構築（buildNodeメソッド）
   * 2. 依存関係を解決してトポロジカルソート
   * 3. ソートされた順序で各ノードを評価
   * 4. 結果を返す
   *
   * @returns 計算結果のオブジェクト（科目ID → 予測値）
   */
  compute(): Record<string, number> {
    console.log("\n予測計算を開始します...");

    // すべてのルールに対してASTノードを構築
    const rootNodes: string[] = [];
    for (const accountId of Object.keys(this.rules)) {
      const nodeId = this.buildNode(accountId);
      rootNodes.push(nodeId);
    }

    console.log("ASTノードを構築しました:", rootNodes.length, "個");

    // トポロジカルソートで依存関係を解決し、評価
    const results = evalTopo(this.registry, rootNodes);
    console.log("計算を完了しました");

    // 結果を科目ID → 値のマップに変換
    const forecast: Record<string, number> = {};
    for (const accountId of Object.keys(this.rules)) {
      const nodeId = this.accountNodes.get(accountId);
      if (nodeId) {
        const value = results.get(nodeId);
        if (value !== undefined) {
          forecast[accountId] = Math.round(value); // 整数に丸める
        }
      }
    }

    return forecast;
  }

  /**
   * 指定された科目のASTノードを構築します
   *
   * このメソッドは再帰的に動作します。ある科目が他の科目に依存している場合、
   * まず依存先のノードを構築してから、自身のノードを構築します。
   *
   * 例えば、売上総利益が売上高と原価に依存している場合：
   * 1. 売上高のノードを構築（さらに単価と数量のノードを構築）
   * 2. 原価のノードを構築
   * 3. 売上総利益のノードを構築（売上高 - 原価）
   *
   * 循環参照が検出された場合はエラーを投げます。
   *
   * @param accountId - 構築する科目のID
   * @returns 構築されたASTノードのID
   */
  private buildNode(accountId: string): string {
    // 既に構築済みの場合は、そのノードIDを返す
    if (this.accountNodes.has(accountId)) {
      return this.accountNodes.get(accountId)!;
    }

    // 循環参照のチェック
    if (this.visiting.has(accountId)) {
      throw new Error(`循環参照が検出されました: ${accountId}`);
    }
    this.visiting.add(accountId);

    // ルールを取得
    const rule = this.rules[accountId];
    if (!rule) {
      throw new Error(`ルールが見つかりません: ${accountId}`);
    }

    let nodeId: string;

    switch (rule.type) {
      case "INPUT": {
        // 固定値を設定
        // これは最もシンプルなルールで、指定された値をそのまま使います。
        nodeId = makeFF(
          this.registry,
          rule.value,
          `${accountId}(INPUT:${rule.value})`
        );
        console.log(`  ${accountId}: INPUT=${rule.value}`);
        break;
      }

      case "CALCULATION": {
        // 計算式を評価
        // expressionを再帰的に処理して、ASTノードツリーを構築します。
        nodeId = this.buildExpression(accountId, rule.expression);
        console.log(`  ${accountId}: CALCULATION`);
        break;
      }

      default: {
        throw new Error(`未対応のルールタイプ: ${(rule as any).type}`);
      }
    }

    // 構築したノードを記録
    this.accountNodes.set(accountId, nodeId);
    this.visiting.delete(accountId);

    return nodeId;
  }

  /**
   * 計算式のノードツリーを構築します
   *
   * ExpressionNodeは再帰的な構造を持っています。この構造をたどりながら、
   * 対応するASTノードを構築していきます。
   *
   * 例えば「単価 × 数量 + 手数料」という式の場合：
   *
   * {
   *   type: 'ADD',
   *   left: {
   *     type: 'MUL',
   *     left: { type: 'ACCOUNT', id: 'unit_price' },
   *     right: { type: 'ACCOUNT', id: 'quantity' }
   *   },
   *   right: { type: 'ACCOUNT', id: 'commission' }
   * }
   *
   * この構造から、以下のASTノードツリーが構築されます：
   *
   *        ADD
   *       /   \
   *     MUL   commission
   *    /   \
   * price  qty
   *
   * @param contextId - 現在構築中の科目のID（エラーメッセージ用）
   * @param expr - 計算式のノード
   * @returns 構築されたASTノードのID
   */
  private buildExpression(contextId: string, expr: ExpressionNode): string {
    switch (expr.type) {
      case "NUMBER": {
        // 定数値
        // 例：税率0.35、回転日数360など
        return makeFF(this.registry, expr.value, `定数(${expr.value})`);
      }

      case "ACCOUNT": {
        // 他の科目への参照
        const targetId = expr.id;

        if (expr.period === "PREV") {
          // 前期参照の場合は、実績データから値を取得
          const prevValue = this.actuals[targetId];
          if (prevValue === undefined) {
            throw new Error(
              `前期実績が見つかりません: ${targetId} ` +
                `(参照元: ${contextId})`
            );
          }
          return makeFF(
            this.registry,
            prevValue,
            `${targetId}(前期:${prevValue})`
          );
        } else {
          // 当期参照の場合は、依存先のノードを再帰的に構築
          return this.buildNode(targetId);
        }
      }

      case "ADD":
      case "SUB":
      case "MUL":
      case "DIV": {
        // 二項演算
        // 左右の部分式を再帰的に構築してから、演算ノードで結合します。
        const leftNode = this.buildExpression(contextId, expr.left);
        const rightNode = this.buildExpression(contextId, expr.right);

        const opSymbol = {
          ADD: "+",
          SUB: "-",
          MUL: "×",
          DIV: "÷",
        }[expr.type];

        return makeTT(
          this.registry,
          leftNode,
          rightNode,
          expr.type as Op,
          `${contextId}(${opSymbol})`
        );
      }

      default: {
        const _exhaustive: never = expr;
        throw new Error(`未対応の式タイプ: ${(expr as any).type}`);
      }
    }
  }

  /**
   * デバッグ用：ASTの構造を表示します
   *
   * このメソッドは、構築されたASTノードツリーの状態を確認するためのものです。
   * 開発やデバッグの際に、依存関係が正しく構築されているかを視覚的に
   * 確認できます。
   */
  printAST() {
    console.log("\n=== AST構造 ===");
    for (const node of this.registry.all()) {
      if (node.value !== undefined) {
        console.log(`${node.id}: FF(${node.value}) - ${node.label}`);
      } else {
        console.log(
          `${node.id}: TT(${node.operator}) - ${node.label} ` +
            `[左:${node.ref1}, 右:${node.ref2}]`
        );
      }
    }
  }
}

/**
 * ルールの型定義
 *
 * 簡素版では、INPUT と CALCULATION の2種類のみをサポートします。
 * これだけでも、ほとんどの財務計算を表現できます。
 */
type Rule =
  | { type: "INPUT"; value: number }
  | { type: "CALCULATION"; expression: ExpressionNode };
