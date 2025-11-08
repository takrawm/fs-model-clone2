// src/fam/simpleFam.ts

import { evalTopo, makeFF, makeTT } from "../engine/ast.ts";
import { NodeRegistry } from "../model/registry.ts";
import type {
  Account,
  AccountId,
  ExpressionNode,
  NodeId,
  Op,
  PeriodId,
  PeriodReference,
  Rule,
  TimelinePeriod,
  Value,
} from "../model/types.ts";

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

  // アカウントマスタ
  private accounts: Map<AccountId, Account> = new Map();

  // 期間の定義とインデックス
  private periods: TimelinePeriod[] = [];
  private periodIndexById: Map<PeriodId, number> = new Map();

  // 実績値と予測値
  private actualValues: Map<string, number> = new Map();
  private forecastValues: Map<string, number> = new Map();

  // 計算ルールを保持
  private rules: Record<AccountId, Rule> = {};

  // 各科目×期間に対応するASTノードID
  private accountNodes: Map<string, NodeId> = new Map();

  // 循環参照検出用
  private visiting: Set<string> = new Set();

  /**
   * アカウントマスタを設定します
   */
  setAccounts(accounts: Account[]) {
    // 既存のエントリを全て削除
    this.accounts.clear();
    for (const account of accounts) {
      this.accounts.set(account.id, account);
    }
    console.log("アカウントを設定しました:", this.accounts);
  }

  /**
   * 期間情報を設定します
   */
  setPeriods(periods: TimelinePeriod[]) {
    this.periods = periods.slice();
    this.periodIndexById.clear();
    for (let i = 0; i < this.periods.length; i += 1) {
      const period = this.periods[i];
      this.periodIndexById.set(period.id, i);
    }
    console.log("期間を設定しました:", periods.length, "件");
  }

  /**
   * 実績データを読み込みます
   *
   * values は、(accountId, periodId) と値の組を持つ配列です。
   * source が未指定の場合は ACTUAL とみなします。
   */
  loadActuals(values: Value[]) {
    for (const item of values) {
      this.ensureAccountById(item.accountId);
      this.ensurePeriodById(item.periodId);
      // `${periodId}::${accountId}`返す
      const key = this.valueKey(item.periodId, item.accountId);
      this.actualValues.set(key, item.value);
    }
    console.log("実績データを読み込みました:", values.length, "件");
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
  setRules(rules: Record<AccountId, Rule>) {
    this.rules = { ...rules };
    console.log("計算ルールを設定しました:", Object.keys(rules).length, "件");
  }

  /**
   * 予測計算を実行します
   *
   * 現在登録されている期間のうち最も新しい期間の翌年度を自動生成し、
   * その期間の値をルールに従って計算します。
   *
   * 新たに生成された期間IDをキーに持つ結果オブジェクトを返します。
   */
  compute(): Record<PeriodId, Record<AccountId, number>> {
    if (!this.periods.length) throw new Error("期間が設定されていません");
    if (!Object.keys(this.rules).length)
      throw new Error("ルールが設定されていません");

    const latestPeriod = this.periods[this.periods.length - 1];
    const nextPeriod = this.createNextPeriod(latestPeriod);
    this.periods.push(nextPeriod);
    this.periodIndexById.set(nextPeriod.id, this.periods.length - 1);

    this.registry = new NodeRegistry();
    this.accountNodes.clear();
    this.visiting.clear();

    console.log("\n予測計算を開始します...");

    const output: Record<PeriodId, Record<AccountId, number>> = {
      [nextPeriod.id]: {},
    };

    console.log(
      `  - 期間 ${nextPeriod.id} の計算を開始 (${nextPeriod.label ?? ""})`
    );

    for (const accountId of Object.keys(this.rules) as AccountId[]) {
      const nodeId = this.buildNode(nextPeriod.id, accountId);
      const result = evalTopo(this.registry, [nodeId]);
      const value = result.get(nodeId) ?? 0;
      this.setForecastValue(nextPeriod.id, accountId, value);
      output[nextPeriod.id][accountId] = Math.round(value);
      console.log(`    > ${accountId}@${nextPeriod.id} = ${value.toFixed(2)}`);
    }

    console.log("予測計算を完了しました");
    return output;
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
  private buildNode(periodId: PeriodId, accountId: AccountId): NodeId {
    const key = this.valueKey(periodId, accountId);
    if (this.accountNodes.has(key)) return this.accountNodes.get(key)!;
    if (this.visiting.has(key))
      throw new Error(`循環参照が検出されました: ${accountId}@${periodId}`);
    this.visiting.add(key);

    const account = this.ensureAccountById(accountId);
    const timelinePeriod = this.ensurePeriodById(periodId);
    const accountLabel = account.AccountName ?? account.id;
    const periodLabel = timelinePeriod.label ?? periodId;

    const actualValue = this.actualValues.get(key);
    if (actualValue != null) {
      const nodeId = makeFF(
        this.registry,
        actualValue,
        `${accountLabel}@${periodLabel}[Actual]`
      );
      this.accountNodes.set(key, nodeId);
      this.visiting.delete(key);
      return nodeId;
    }

    const cachedForecast = this.forecastValues.get(key);
    if (cachedForecast != null) {
      const nodeId = makeFF(
        this.registry,
        cachedForecast,
        `${accountLabel}@${periodLabel}[Forecast~cached]`
      );
      this.accountNodes.set(key, nodeId);
      this.visiting.delete(key);
      return nodeId;
    }

    const rule = this.rules[accountId];
    if (!rule) {
      this.visiting.delete(key);
      throw new Error(`ルールが見つかりません: ${accountId}`);
    }

    const context = {
      periodId,
      accountId,
      accountLabel,
    };

    let nodeId: NodeId;

    switch (rule.type) {
      case "INPUT": {
        nodeId = makeFF(
          this.registry,
          rule.value,
          `${accountLabel}@${periodLabel}[Input=${rule.value}]`
        );
        break;
      }

      case "CALCULATION": {
        nodeId = this.buildExpression(rule.expression, context);
        break;
      }

      case "REFERENCE": {
        nodeId = this.buildExpression(
          {
            type: "ACCOUNT",
            id: rule.ref,
          },
          context
        );
        break;
      }

      case "GROWTH_RATE": {
        nodeId = this.buildExpression(
          {
            type: "MUL",
            left: { type: "ACCOUNT", id: rule.ref, period: "PREV" },
            right: { type: "NUMBER", value: 1 + rule.rate },
          },
          context
        );
        break;
      }

      case "PERCENTAGE": {
        nodeId = this.buildExpression(
          {
            type: "MUL",
            left: { type: "ACCOUNT", id: rule.ref },
            right: { type: "NUMBER", value: rule.percentage },
          },
          context
        );
        break;
      }

      case "BALANCE_CHANGE": {
        const expr = rule.flows.reduce<ExpressionNode | null>((acc, flow) => {
          const baseNode: ExpressionNode = {
            type: "ACCOUNT",
            id: flow.ref,
          };
          const signedNode =
            flow.sign === "PLUS"
              ? baseNode
              : ({
                  type: "MUL",
                  left: baseNode,
                  right: { type: "NUMBER", value: -1 },
                } as ExpressionNode);
          if (!acc) return signedNode;
          return {
            type: "ADD",
            left: acc,
            right: signedNode,
          };
        }, null);

        nodeId = this.buildExpression(
          expr ?? { type: "NUMBER", value: 0 },
          context
        );
        break;
      }

      default: {
        this.visiting.delete(key);
        return assertNever(
          rule as never,
          `未対応のルールタイプ: ${(rule as any).type}`
        );
      }
    }

    this.accountNodes.set(key, nodeId);
    this.visiting.delete(key);
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
  private buildExpression(
    expr: ExpressionNode,
    ctx: {
      periodId: PeriodId;
      accountId: AccountId;
      accountLabel: string;
    }
  ): NodeId {
    const labelPrefix = `${ctx.accountLabel}@${ctx.periodId}`;
    switch (expr.type) {
      case "NUMBER": {
        return makeFF(
          this.registry,
          expr.value,
          `${labelPrefix}:const(${expr.value})`
        );
      }

      case "ACCOUNT": {
        const targetPeriodId = this.resolvePeriodId(ctx.periodId, expr.period);
        return this.buildNode(targetPeriodId, expr.id);
      }

      case "ADD":
      case "SUB":
      case "MUL":
      case "DIV": {
        const leftNode = this.buildExpression(expr.left, ctx);
        const rightNode = this.buildExpression(expr.right, ctx);
        const operator = expr.type as Op;
        return makeTT(
          this.registry,
          leftNode,
          rightNode,
          operator,
          `${labelPrefix}:${operator}`
        );
      }

      default: {
        return assertNever(
          expr as never,
          `未対応の式タイプ: ${(expr as any).type} (context: ${labelPrefix})`
        );
      }
    }
  }

  private resolvePeriodId(
    basePeriodId: PeriodId,
    reference?: PeriodReference
  ): PeriodId {
    if (!reference || reference === "CURRENT") return basePeriodId;
    if (reference === "PREV") return this.findPeriodByOffset(basePeriodId, -1);
    if (typeof reference === "string")
      return this.ensurePeriodById(reference).id;
    return this.findPeriodByOffset(basePeriodId, reference.offset ?? 0);
  }

  private findPeriodByOffset(basePeriodId: PeriodId, offset: number): PeriodId {
    const baseIndex = this.getPeriodIndex(basePeriodId);
    const targetIndex = baseIndex + offset;
    const target = this.periods[targetIndex];
    if (!target)
      throw new Error(
        `指定したオフセットに期間が存在しません: ${basePeriodId} (offset ${offset})`
      );
    return target.id;
  }

  private ensureAccountById(accountId: AccountId): Account {
    const account = this.accounts.get(accountId);
    if (!account) throw new Error(`アカウントが見つかりません: ${accountId}`);
    return account;
  }

  private ensurePeriodById(periodId: PeriodId): TimelinePeriod {
    const index = this.getPeriodIndex(periodId);
    return this.periods[index];
  }

  private getPeriodIndex(periodId: PeriodId): number {
    const index = this.periodIndexById.get(periodId);
    if (index == null) throw new Error(`期間が見つかりません: ${periodId}`);
    return index;
  }

  private valueKey(periodId: PeriodId, accountId: AccountId): string {
    return `${periodId}::${accountId}`;
  }

  private setForecastValue(
    periodId: PeriodId,
    accountId: AccountId,
    value: number
  ) {
    this.forecastValues.set(this.valueKey(periodId, accountId), value);
  }

  private createNextPeriod(latest: TimelinePeriod): TimelinePeriod {
    const nextId = this.incrementPeriodId(latest.id);
    const baseOffset = latest.offset ?? this.getPeriodIndex(latest.id);
    return {
      id: nextId,
      label: nextId,
      offset: baseOffset + 1,
    };
  }

  private incrementPeriodId(currentId: PeriodId): PeriodId {
    const match = currentId.match(/^(.*?)(\d+)$/);
    if (!match) return `${currentId}_next`;
    const [, prefix, numberPart] = match;
    const nextNumber = String(Number(numberPart) + 1);
    return `${prefix}${nextNumber}`;
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

function assertNever(_value: never, message: string): never {
  throw new Error(message);
}
