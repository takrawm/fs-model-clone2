// src/fam/simpleFam.ts

import { evalTopo, makeFF, makeTT } from "../engine/ast.ts";
import { NodeRegistry } from "../model/registry.ts";
import type {
  Account,
  AccountId,
  FormulaNode,
  NodeId,
  Period,
  PeriodId,
  RelativePeriodReference,
  Rule,
  Value,
  ValueKeyString,
} from "../model/types.ts";
import { createPeriod } from "../utils/periodUtils.ts";
import { roundTo2Decimals, roundToInteger } from "../utils/numberUtils.ts";
import {
  getPreviousPeriodDifferenceForAccount,
  multiplyAccountBySign,
  multiplyFormulaNodeBySign,
  sumFormulaNodes,
} from "./cfRuleBuilders.ts";
import { ruleHandlers } from "./ruleHandlers.ts";
import type { RuleHandlerContext } from "./ruleHandlers.ts";

export class SimpleFAM {
  // ASTノードを管理するレジストリ
  private nodeRegistry: NodeRegistry = new NodeRegistry();

  // アカウントマスタ
  private accounts: Map<AccountId, Account> = new Map();

  // 期間の定義とインデックス
  private periods: Period[] = [];
  private periodIndexById: Map<PeriodId, number> = new Map();

  // 登録済みの値（入力データと計算結果の両方を含む）
  // キーは "${periodId}::${accountId}" の形式（例: "FY2025::unit_price"）
  private values: Map<ValueKeyString, number> = new Map();

  // 計算ルールを保持
  private rules: Record<AccountId, Rule> = {};

  // 各科目×期間に対応するASTノードIDのキャッシュ
  // ValueKeyString（"${periodId}::${accountId}"）からNodeIdへのマッピング
  private valueKeyToNodeId: Map<ValueKeyString, NodeId> = new Map();

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
  }

  /**
   * 全てのアカウント（動的に追加されたものも含む）を取得します
   */
  getAllAccounts(): Account[] {
    return Array.from(this.accounts.values());
  }

  /**
   * 全ての期間を取得します
   */
  getAllPeriods(): Period[] {
    return this.periods.slice();
  }

  /**
   * 期間情報を設定します
   */
  setPeriods(periods: Period[]) {
    this.periods = periods.slice();
    this.periodIndexById.clear();
    for (let i = 0; i < this.periods.length; i += 1) {
      const period = this.periods[i];
      this.periodIndexById.set(period.id, i);
    }
    console.log("期間を設定しました:", periods.length, "件");
  }

  /**
   * 入力データを読み込みます
   *
   * values は、(accountId, periodId) と値の組を持つ配列です。
   * シードデータや外部から取り込んだデータを登録します。
   */
  loadInputData(values: Value[]) {
    for (const item of values) {
      this.ensureAccountById(item.accountId);
      this.ensurePeriodById(item.periodId);
      const key = this.createValueKeyString(item.periodId, item.accountId);
      this.values.set(key, item.value);
    }
    console.log("入力データを読み込みました:", values.length, "件");
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
    const latestPeriod = this.periods[this.periods.length - 1];
    const nextPeriod = this.createNextPeriod(latestPeriod);
    this.periods.push(nextPeriod);
    this.periodIndexById.set(nextPeriod.id, this.periods.length - 1);
    // NodeRegistryのインスタンス化
    this.nodeRegistry = new NodeRegistry();
    this.valueKeyToNodeId.clear();
    this.visiting.clear();

    // ▼▼▼ ここから追加 ▼▼▼
    // AST計算の前に、CF関連のルールを動的に生成して this.rules に注入する
    this.generateCashFlowRules();
    // ▲▲▲ ここまで追加 ▲▲▲

    console.log("\n予測計算を開始します...");

    const output: Record<PeriodId, Record<AccountId, number>> = {
      [nextPeriod.id]: {},
    };

    console.log(
      `  - 期間 ${nextPeriod.id} の計算を開始 (${nextPeriod.label ?? ""})`
    );

    for (const accountId of Object.keys(this.rules) as AccountId[]) {
      const nodeId = this.buildNodeForAccount(nextPeriod.id, accountId);
      const result = evalTopo(this.nodeRegistry, [nodeId]);
      // Mapオブジェクトのgetメソッド
      const value = result.get(nodeId) ?? 0;

      // 資産合計と負債・純資産合計のみ整数に丸める
      // その他の科目は小数点第2位まで丸める
      let roundedValue: number;
      if (
        accountId === "assets_total" ||
        accountId === "equity_and_liabilities_total"
      ) {
        roundedValue = roundToInteger(value);
      } else {
        roundedValue = roundTo2Decimals(value);
      }

      this.setValue(nextPeriod.id, accountId, roundedValue);
      output[nextPeriod.id][accountId] = roundedValue; // UI用にも丸めた値を渡す
      console.log(`    > ${accountId}@${nextPeriod.id} = ${value.toFixed(2)}`);
    }

    console.log("予測計算を完了しました");
    return output;
  }

  /**
   * 指定された科目のASTノードを構築します（内部実装）
   *
   * このメソッドは、RuleHandlerContextのbuildNodeから呼び出されます。
   * 再帰的に動作し、ある科目が他の科目に依存している場合、
   * まず依存先のノードを構築してから、自身のノードを構築します。
   *
   * 例えば、売上総利益が売上高と原価に依存している場合：
   * 1. 売上高のノードを構築（さらに単価と数量のノードを構築）
   * 2. 原価のノードを構築
   * 3. 売上総利益のノードを構築（売上高 - 原価）
   *
   * 循環参照が検出された場合はエラーを投げます。
   *
   * @param periodId - 期間ID
   * @param accountId - 構築する科目のID
   * @returns 構築されたASTノードのID
   */
  private buildNodeForAccount(
    periodId: PeriodId,
    accountId: AccountId
  ): NodeId {
    const valueKey = this.createValueKeyString(periodId, accountId);
    if (this.valueKeyToNodeId.has(valueKey))
      return this.valueKeyToNodeId.get(valueKey)!;
    if (this.visiting.has(valueKey))
      throw new Error(`循環参照が検出されました: ${accountId}@${periodId}`);
    this.visiting.add(valueKey);

    // 登録済みの値を確認
    const registeredValue = this.values.get(valueKey);
    if (registeredValue != null) {
      // 既存の値も小数点第2位に丸める（誤差の伝播を防ぐため）
      const roundedValue = roundTo2Decimals(registeredValue);
      const nodeId = makeFF(
        this.nodeRegistry,
        roundedValue,
        `${accountId}@${periodId}[Registered]`
      );
      this.valueKeyToNodeId.set(valueKey, nodeId);
      this.visiting.delete(valueKey);
      return nodeId;
    }

    // 対応する勘定科目のRuleを取得
    // 期間ごとにルールが変わる場合は、rulesのキーをAccountIdからValueKeyStringに変更する必要がある
    const rule = this.rules[accountId];
    if (!rule) {
      this.visiting.delete(valueKey);
      throw new Error(`ルールが見つかりません: ${accountId}`);
    }

    const handlerContext: RuleHandlerContext = {
      periodId,
      accountId,
      // buildNodeForAccountメソッドはインスタンスメソッドなので、
      // このメソッドが実行されている間、thisはSimpleFAMのインスタンスを指す。
      // アロー関数はこのthisをキャプチャして保持する。
      nodeRegistry: this.nodeRegistry,
      buildNode: (pId, aId) => this.buildNodeForAccount(pId, aId),
      buildFormula: (formulaNode) =>
        this.buildFormulaNode(formulaNode, {
          periodId,
          accountId,
        }),
      resolvePeriodId: (ref) => this.resolvePeriodIdWithBase(periodId, ref),
    };

    //ruleHandlerFnはruleHandlers[rule.type]から取得したハンドラー関数
    const ruleHandlerFn = ruleHandlers[rule.type];
    if (!ruleHandlerFn) {
      this.visiting.delete(valueKey);
      throw new Error(`未対応のルールタイプ: ${(rule as any).type}`);
    }
    const nodeId = (
      ruleHandlerFn as (rule: Rule, context: RuleHandlerContext) => NodeId
    )(rule, handlerContext);

    this.valueKeyToNodeId.set(valueKey, nodeId);
    this.visiting.delete(valueKey);
    return nodeId;
  }

  /**
   * FormulaNodeをASTノードに変換します（内部実装）
   *
   * このメソッドは、RuleHandlerContextのbuildFormulaから呼び出されます。
   * ctxパラメータが必要なため、内部実装メソッドとして分離しています。
   *
   * @param formulaNode - 計算式のノード
   * @param ctx - 期間と科目のコンテキスト情報
   * @returns 構築されたASTノードのID
   */
  private buildFormulaNode(
    formulaNode: FormulaNode,
    ctx: {
      periodId: PeriodId;
      accountId: AccountId;
    }
  ): NodeId {
    const labelPrefix = `${ctx.accountId}@${ctx.periodId}`;
    switch (formulaNode.type) {
      case "NUMBER": {
        // makeFF()もNodeIdを返す
        return makeFF(
          this.nodeRegistry,
          formulaNode.value,
          `${labelPrefix}:const(${formulaNode.value})`
        );
      }

      case "ACCOUNT": {
        const targetPeriodId = this.resolvePeriodIdWithBase(
          ctx.periodId,
          formulaNode.period
        );
        // this.buildNodeForAccount(targetPeriodId, formulaNode.id)もNodeIdを返す
        return this.buildNodeForAccount(targetPeriodId, formulaNode.id);
      }

      case "BINARY_OP": {
        const leftNode = this.buildFormulaNode(formulaNode.left, ctx);
        const rightNode = this.buildFormulaNode(formulaNode.right, ctx);
        const operator = formulaNode.op;
        // makeTT()もNodeIdを返す
        return makeTT(
          this.nodeRegistry,
          leftNode,
          rightNode,
          operator,
          `${labelPrefix}:${operator}`
        );
      }

      default: {
        return assertNever(
          formulaNode as never,
          `未対応の式タイプ: ${
            (formulaNode as any).type
          } (context: ${labelPrefix})`
        );
      }
    }
  }

  /**
   * 基準期間と相対参照から期間IDを解決します（内部実装）
   *
   * このメソッドは、RuleHandlerContextのresolvePeriodIdから呼び出されます。
   * basePeriodIdパラメータが必要なため、内部実装メソッドとして分離しています。
   *
   * @param basePeriodId - 基準となる期間ID
   * @param reference - 相対期間参照（オフセット）
   * @returns 解決された期間ID
   */
  private resolvePeriodIdWithBase(
    basePeriodId: PeriodId,
    reference?: RelativePeriodReference
  ): PeriodId {
    if (!reference) return basePeriodId;
    return this.findPeriodByOffset(basePeriodId, reference.offset);
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

  private ensurePeriodById(periodId: PeriodId): Period {
    const index = this.getPeriodIndex(periodId);
    return this.periods[index];
  }

  private getPeriodIndex(periodId: PeriodId): number {
    const index = this.periodIndexById.get(periodId);
    if (index == null) throw new Error(`期間が見つかりません: ${periodId}`);
    return index;
  }

  private createValueKeyString(
    periodId: PeriodId,
    accountId: AccountId
  ): ValueKeyString {
    return `${periodId}::${accountId}` as ValueKeyString;
  }

  private setValue(periodId: PeriodId, accountId: AccountId, value: number) {
    this.values.set(this.createValueKeyString(periodId, accountId), value);
  }

  /**
   * 指定された期間と科目の値を取得します
   */
  getValue(periodId: PeriodId, accountId: AccountId): number | undefined {
    const key = this.createValueKeyString(periodId, accountId);
    return this.values.get(key);
  }

  /**
   * 指定された期間の全ての値を取得します
   */
  getPeriodValues(periodId: PeriodId): Record<AccountId, number> {
    const result: Record<AccountId, number> = {} as Record<AccountId, number>;
    for (const [key, value] of this.values.entries()) {
      if (key.startsWith(`${periodId}::`)) {
        const accountId = key.split("::")[1] as AccountId;
        result[accountId] = value;
      }
    }
    return result;
  }

  private createNextPeriod(latest: Period): Period {
    let nextYear = latest.year;
    let nextMonth = latest.month;

    switch (latest.periodType) {
      case "ANNUAL":
        // 年次の場合は年を1つ進める
        nextYear = latest.year + 1;
        // monthはFISCAL_YEAR_ENDのまま（createPeriodが自動設定）
        break;

      case "MONTHLY":
        // 月次の場合は月を1つ進める
        nextMonth = latest.month + 1;
        if (nextMonth > 12) {
          nextMonth = 1;
          nextYear = latest.year + 1;
        }
        break;
      default:
        throw new Error(`未対応のperiodType: ${latest.periodType}`);
    }

    return createPeriod(nextYear, nextMonth, latest.periodType);
  }

  // src/fam/simpleFam.ts (class SimpleFAM 内に追加)

  /**
   * 間接法CFの計算ルールを動的に生成し、this.rules に注入する
   * AST計算の実行前に呼び出す必要がある
   */
  private generateCashFlowRules() {
    console.log("  - CF計算ルールを動的に生成中...");

    const cfRuleItems: FormulaNode[] = [];
    let baseProfitAccountId: AccountId | null = null;
    // values()はJavaScriptのMapの組み込みメソッドです。
    for (const account of this.accounts.values()) {
      // 1. CF計算の起点となる利益を特定
      if (account.isCfBaseProfit) {
        baseProfitAccountId = account.id;
        continue;
      }

      // 3. BS科目の増減（運転資本など）をCFに反映
      //    (isCashAccount や ignoredForCf ではないBS科目)
      const rule = this.rules[account.id];
      if (
        account.fs_type === "BS" &&
        !account.isCashAccount &&
        !account.ignoredForCf &&
        rule?.type !== "BALANCE_CHANGE" // BALANCE_CHANGE は 2. で処理
      ) {
        const cfAccountId = `${account.id}_cf_wc`;
        // CF科目マスタになければ追加
        if (!this.accounts.has(cfAccountId)) {
          this.accounts.set(cfAccountId, {
            id: cfAccountId,
            accountName: `${account.accountName}増減(CF)`,
            fs_type: "CF",
            ignoredForCf: true,
          });
        }

        // 符号： 資産(isCredit: false)の増加(Diff=+)はCF減(-)
        //       負債(isCredit: true) の増加(Diff=+)はCF増(+)
        const sign = account.isCredit ?? false ? 1 : -1;
        const diffFormulaNode = getPreviousPeriodDifferenceForAccount(
          account.id
        );

        this.rules[cfAccountId] = {
          type: "CALCULATION",
          formulaNode: multiplyFormulaNodeBySign(diffFormulaNode, sign),
        };
        cfRuleItems.push({ type: "ACCOUNT", id: cfAccountId });
      }

      // 2. non-cash項目 (depreciationなど) や 投資CF (capexなど) をCFに反映
      //    (BALANCE_CHANGE の flow のうち、PL科目またはPP&E科目を調整)
      if (rule?.type === "BALANCE_CHANGE") {
        for (const flow of rule.flowAccounts) {
          const flowAccount = this.accounts.get(flow.ref);
          if (!flowAccount) continue;

          // PL科目またはPP&E科目からのフローをCF調整項目とする
          if (flowAccount.fs_type === "PL" || flowAccount.fs_type === "PP&E") {
            // CFの起点（net_income）自体は除外
            if (flowAccount.isCfBaseProfit) continue;

            const cfAccountId = `${flow.ref}_cf_adj`;
            if (!this.accounts.has(cfAccountId)) {
              this.accounts.set(cfAccountId, {
                id: cfAccountId,
                accountName: `${flowAccount.accountName}調整(CF)`,
                fs_type: "CF",
                ignoredForCf: true,
              });
            }

            // 符号： 資産(isCredit: false)へのPLUS(例:capex)はCF減(-)
            //       資産(isCredit: false)へのMINUS(例:dep)はCF増(+)
            //       負債(isCredit: true) へのPLUS(例:net_income)はCF増(+)
            const sign = account.isCredit ?? false ? 1 : -1;
            const flowSign = flow.sign === "PLUS" ? 1 : -1;
            const cfSign = sign * flowSign;

            this.rules[cfAccountId] = {
              type: "CALCULATION",
              formulaNode: multiplyAccountBySign(flow.ref, cfSign),
            };
            cfRuleItems.push({ type: "ACCOUNT", id: cfAccountId });
          }
        }
      }
    }

    // 4. CF集計科目 (cash_change_cf) のルールを生成
    if (!baseProfitAccountId) {
      throw new Error(
        "CFの起点となる利益科目 (isCfBaseProfit: true) が見つかりません。"
      );
    }

    // `net_income + (cf_item1 + cf_item2 + ...)` の式を構築
    const cfSummaryFormulaNode = sumFormulaNodes(
      cfRuleItems,
      { type: "ACCOUNT", id: baseProfitAccountId } // 起点
    );

    this.rules["cash_change_cf"] = {
      type: "CALCULATION",
      formulaNode: cfSummaryFormulaNode,
    };

    // 5. cashのルールをcash_change_cfを含むように更新
    this.rules["cash"] = {
      type: "BALANCE_CHANGE",
      flowAccounts: [{ ref: "cash_change_cf", sign: "PLUS" }],
    };

    console.log("  - CF計算ルール生成完了。");
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
    for (const node of this.nodeRegistry.all()) {
      if (node.type === "FF") {
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
