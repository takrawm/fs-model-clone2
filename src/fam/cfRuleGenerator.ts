// src/fam/cfRuleGenerator.ts

import type { Account, AccountId, FormulaNode, Rule } from "../model/types.ts";
import { BASE_PROFIT_CF_ACCOUNT_ID } from "../config/financialModelConfig.ts";
import {
  getPreviousPeriodDifferenceForAccount,
  multiplyAccountBySign,
  multiplyFormulaNodeBySign,
  sumFormulaNodes,
} from "./cfRuleBuilders.ts";

/**
 * non-cash項目の足し戻し（depreciationなど）を生成
 * BALANCE_CHANGEのflowのうち、MINUSフロー（例: depreciation）を処理
 * @param accounts - アカウントマスタ（変更される）
 * @param rules - 計算ルール（変更される）
 * @returns 生成されたAccountIdの配列
 */
export function generateNonCashAddBacks(
  accounts: Map<AccountId, Account>,
  rules: Record<AccountId, Rule>
): AccountId[] {
  const result: AccountId[] = [];

  for (const account of accounts.values()) {
    const rule = rules[account.id];
    if (rule?.type === "BALANCE_CHANGE") {
      for (const flow of rule.flowAccounts) {
        const flowAccount = accounts.get(flow.ref);
        if (!flowAccount) continue;

        // BSとCF以外の科目からのフローをCF調整項目とする
        if (
          flowAccount.sheetType !== "BS" &&
          flowAccount.sheetType !== "CF" &&
          flowAccount.sheetType != null
        ) {
          // MINUSフローのみ処理（例: depreciation）
          if (flow.sign === "MINUS") {
            // CFの起点（net_income）自体は除外
            if (flowAccount.isCfBaseProfit) continue;

            const cfAccountId = `${flow.ref}_cf_adj`;
            if (!accounts.has(cfAccountId)) {
              accounts.set(cfAccountId, {
                id: cfAccountId,
                accountName: `${flowAccount.accountName}調整(CF)`,
                sheetType: "CF",
                ignoredForCf: true,
              });
            }

            // 符号： 資産(isCredit: false)へのMINUS(例:dep)はCF増(+)
            //       負債(isCredit: true) へのMINUSはCF減(-)
            const sign = account.isCredit ?? false ? 1 : -1;
            const flowSign = -1; // MINUS
            const cfSign = sign * flowSign;

            rules[cfAccountId] = {
              type: "CALCULATION",
              formulaNode: multiplyAccountBySign(flow.ref, cfSign),
            };
            result.push(cfAccountId);
          }
        }
      }
    }
  }

  return result;
}

/**
 * 設備投資などの減少項目（capexなど）を生成
 * BALANCE_CHANGEのflowのうち、PLUSフロー（例: capex）を処理
 * @param accounts - アカウントマスタ（変更される）
 * @param rules - 計算ルール（変更される）
 * @returns 生成されたAccountIdの配列
 */
export function generateCapexOutflows(
  accounts: Map<AccountId, Account>,
  rules: Record<AccountId, Rule>
): AccountId[] {
  const result: AccountId[] = [];

  for (const account of accounts.values()) {
    const rule = rules[account.id];
    if (rule?.type === "BALANCE_CHANGE") {
      for (const flow of rule.flowAccounts) {
        const flowAccount = accounts.get(flow.ref);
        if (!flowAccount) continue;

        // BSとCF以外の科目からのフローをCF調整項目とする
        if (
          flowAccount.sheetType !== "BS" &&
          flowAccount.sheetType !== "CF" &&
          flowAccount.sheetType != null
        ) {
          // PLUSフローのみ処理（例: capex）
          if (flow.sign === "PLUS") {
            // CFの起点（net_income）自体は除外
            if (flowAccount.isCfBaseProfit) continue;

            const cfAccountId = `${flow.ref}_cf_adj`;
            if (!accounts.has(cfAccountId)) {
              accounts.set(cfAccountId, {
                id: cfAccountId,
                accountName: `${flowAccount.accountName}調整(CF)`,
                sheetType: "CF",
                ignoredForCf: true,
              });
            }

            // 符号： 資産(isCredit: false)へのPLUS(例:capex)はCF減(-)
            //       負債(isCredit: true) へのPLUSはCF増(+)
            const sign = account.isCredit ?? false ? 1 : -1;
            const flowSign = 1; // PLUS
            const cfSign = sign * flowSign;

            rules[cfAccountId] = {
              type: "CALCULATION",
              formulaNode: multiplyAccountBySign(flow.ref, cfSign),
            };
            result.push(cfAccountId);
          }
        }
      }
    }
  }

  return result;
}

/**
 * BS科目の増減（運転資本）を生成
 * @param accounts - アカウントマスタ（変更される）
 * @param rules - 計算ルール（変更される）
 * @returns 生成されたAccountIdの配列
 */
export function generateWorkingCapitalChanges(
  accounts: Map<AccountId, Account>,
  rules: Record<AccountId, Rule>
): AccountId[] {
  const result: AccountId[] = [];

  for (const account of accounts.values()) {
    const rule = rules[account.id];
    if (
      account.sheetType === "BS" &&
      !account.isCashAccount &&
      !account.ignoredForCf &&
      rule?.type !== "BALANCE_CHANGE" // BALANCE_CHANGE は別で処理
    ) {
      const cfAccountId = `${account.id}_cf_wc`;
      // CF科目マスタになければ追加
      if (!accounts.has(cfAccountId)) {
        accounts.set(cfAccountId, {
          id: cfAccountId,
          accountName: `${account.accountName}増減(CF)`,
          sheetType: "CF",
          ignoredForCf: true,
        });
      }

      // 符号： 資産(isCredit: false)の増加(Diff=+)はCF減(-)
      //       負債(isCredit: true) の増加(Diff=+)はCF増(+)
      const sign = account.isCredit ?? false ? 1 : -1;
      const diffFormulaNode = getPreviousPeriodDifferenceForAccount(account.id);

      rules[cfAccountId] = {
        type: "CALCULATION",
        formulaNode: multiplyFormulaNodeBySign(diffFormulaNode, sign),
      };
      result.push(cfAccountId);
    }
  }

  return result;
}

/**
 * 間接法CFの計算ルールを動的に生成し、rules に注入する
 * AST計算の実行前に呼び出す必要がある
 *
 * @param accounts - アカウントマスタ（変更される）
 * @param rules - 計算ルール（変更される）
 */
export function generateCashFlowRules(
  accounts: Map<AccountId, Account>,
  rules: Record<AccountId, Rule>
): void {
  console.log("  - CF計算ルールを動的に生成中...");

  const cfRuleItems: FormulaNode[] = [];
  let baseProfitAccountId: AccountId | null = null;

  // baseProfitのCF科目IDは固定値を使用
  const baseProfitCfAccountId: AccountId = BASE_PROFIT_CF_ACCOUNT_ID;

  // 1. CF計算の起点となる利益を特定
  for (const account of accounts.values()) {
    if (account.isCfBaseProfit) {
      baseProfitAccountId = account.id;

      // baseProfitからCF科目を生成（表示用）
      if (!accounts.has(baseProfitCfAccountId)) {
        accounts.set(baseProfitCfAccountId, {
          id: baseProfitCfAccountId,
          accountName: `${account.accountName}（CF）`,
          sheetType: "CF",
          ignoredForCf: true,
        });
      }

      // baseProfitのCF科目は、元のbaseProfitを参照するだけ
      rules[baseProfitCfAccountId] = {
        type: "REFERENCE",
        ref: baseProfitAccountId,
      };

      // baseProfitCfAccountIdはcfRuleItemsには含めず、
      // sumFormulaNodesのbaseNodeとして使用する（二重カウントを避ける）
      break;
    }
  }

  // 2. non-cash項目の足し戻しを生成
  const nonCashIds = generateNonCashAddBacks(accounts, rules);

  // 3. BS科目の増減（運転資本など）を生成
  const workingCapitalIds = generateWorkingCapitalChanges(accounts, rules);

  // 4. 設備投資などの減少項目を生成
  const investmentIds = generateCapexOutflows(accounts, rules);

  // 生成されたAccountIdをFormulaNodeに変換
  // 順序は重要: non-cash → working capital → investment
  // （元のコードの処理順序を維持）
  cfRuleItems.push(
    ...nonCashIds.map((id) => ({ type: "ACCOUNT" as const, id })),
    ...workingCapitalIds.map((id) => ({ type: "ACCOUNT" as const, id })),
    ...investmentIds.map((id) => ({ type: "ACCOUNT" as const, id }))
  );

  // 5. CF集計科目 (cash_change_cf) のルールを生成
  if (!baseProfitAccountId) {
    throw new Error(
      "CFの起点となる利益科目 (isCfBaseProfit: true) が見つかりません。"
    );
  }

  // `net_income_cf + (cf_item1 + cf_item2 + ...)` の式を構築
  // baseProfitCfAccountIdを起点として使用（二重カウントを避ける）
  // cfRuleItemsにはbaseProfitCfAccountIdは含まれていない
  const cfSummaryFormulaNode = sumFormulaNodes(
    cfRuleItems,
    { type: "ACCOUNT", id: baseProfitCfAccountId } // 起点
  );

  rules["cash_change_cf"] = {
    type: "CALCULATION",
    formulaNode: cfSummaryFormulaNode,
  };

  // 6. cashのルールをcash_change_cfを含むように更新
  rules["cash"] = {
    type: "BALANCE_CHANGE",
    flowAccounts: [{ ref: "cash_change_cf", sign: "PLUS" }],
  };

  console.log("  - CF計算ルール生成完了。");
}
