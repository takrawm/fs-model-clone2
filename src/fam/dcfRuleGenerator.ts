// src/fam/dcfRuleGenerator.ts

import type { Account, AccountId, FormulaNode, Rule } from "../model/types.ts";
import { TAX_RATE } from "../config/financialModelConfig.ts";
import { sumFormulaNodes } from "./cfRuleBuilders.ts";

/**
 * DCF（FCF）の計算ルールを動的に生成し、rules に注入する
 * AST計算の実行前に呼び出す必要がある
 *
 * @param accounts - アカウントマスタ（変更される）
 * @param rules - 計算ルール（変更される）
 */
export function generateDcfRules(
  accounts: Map<AccountId, Account>,
  rules: Record<AccountId, Rule>
): void {
  console.log("  - DCF計算ルールを動的に生成中...");

  // 1. PLの営業利益を参照
  const operatingProfitAccountId: AccountId = "operating_profit";
  const operatingProfitAccount = accounts.get(operatingProfitAccountId);
  if (!operatingProfitAccount) {
    throw new Error("営業利益科目が見つかりません: operating_profit");
  }

  // 2. NOPLATを計算（営業利益 × (1 - 税率)）
  const noplatAccountId: AccountId = "noplat_dcf";
  if (!accounts.has(noplatAccountId)) {
    accounts.set(noplatAccountId, {
      id: noplatAccountId,
      accountName: "NOPLAT",
      sheetType: "FCF",
    });
  }

  rules[noplatAccountId] = {
    type: "CALCULATION",
    formulaNode: {
      type: "BINARY_OP",
      op: "MUL",
      left: { type: "ACCOUNT", id: operatingProfitAccountId },
      right: { type: "NUMBER", value: 1 - TAX_RATE },
    },
  };

  // 3. CF科目を参照してDCF調整科目を生成
  // generateNonCashAddBacks、generateCapexOutflows、generateWorkingCapitalChangesで
  // 生成されたCF科目のIDを取得し、それらを参照するDCF科目を作成

  // 既に生成されたCF科目のIDを取得（CFルール生成後に呼び出すことを想定）
  // CF科目は末尾が"_cf_adj"（non-cash, capex）または"_cf_wc"（working capital）で識別可能
  const cfNonCashIds: AccountId[] = [];
  const cfCapexIds: AccountId[] = [];
  const cfWorkingCapitalIds: AccountId[] = [];

  // 既に生成されたCF科目を分類
  for (const account of accounts.values()) {
    if (account.sheetType === "CF") {
      if (account.id.endsWith("_cf_adj")) {
        // non-cashまたはcapexの判定
        // CF科目のIDから元の科目IDを取得（例: "depreciation_cf_adj" -> "depreciation"）
        const sourceAccountId = account.id.replace("_cf_adj", "") as AccountId;
        // 元の科目がどのBALANCE_CHANGEルールのflowAccountsに含まれているかを確認
        for (const [accountId, rule] of Object.entries(rules)) {
          if (rule.type === "BALANCE_CHANGE") {
            const flow = rule.flowAccounts.find(
              (f) => f.ref === sourceAccountId
            );
            if (flow) {
              if (flow.sign === "MINUS") {
                cfNonCashIds.push(account.id);
              } else if (flow.sign === "PLUS") {
                cfCapexIds.push(account.id);
              }
              break;
            }
          }
        }
      } else if (account.id.endsWith("_cf_wc")) {
        cfWorkingCapitalIds.push(account.id);
      }
    }
  }

  const dcfRuleItems: FormulaNode[] = [];

  // non-cash項目のDCF科目を生成
  for (const cfAccountId of cfNonCashIds) {
    const dcfAccountId = `${cfAccountId}_dcf` as AccountId;
    if (!accounts.has(dcfAccountId)) {
      const cfAccount = accounts.get(cfAccountId);
      accounts.set(dcfAccountId, {
        id: dcfAccountId,
        accountName: `${cfAccount?.accountName ?? cfAccountId}（DCF）`,
        sheetType: "FCF",
      });
    }

    // CF科目を参照するルール
    rules[dcfAccountId] = {
      type: "REFERENCE",
      ref: cfAccountId,
    };

    dcfRuleItems.push({ type: "ACCOUNT", id: dcfAccountId });
  }

  // capex項目のDCF科目を生成
  for (const cfAccountId of cfCapexIds) {
    const dcfAccountId = `${cfAccountId}_dcf` as AccountId;
    if (!accounts.has(dcfAccountId)) {
      const cfAccount = accounts.get(cfAccountId);
      accounts.set(dcfAccountId, {
        id: dcfAccountId,
        accountName: `${cfAccount?.accountName ?? cfAccountId}（DCF）`,
        sheetType: "FCF",
      });
    }

    // CF科目を参照するルール
    rules[dcfAccountId] = {
      type: "REFERENCE",
      ref: cfAccountId,
    };

    dcfRuleItems.push({ type: "ACCOUNT", id: dcfAccountId });
  }

  // working capital項目のDCF科目を生成
  for (const cfAccountId of cfWorkingCapitalIds) {
    const dcfAccountId = `${cfAccountId}_dcf` as AccountId;
    if (!accounts.has(dcfAccountId)) {
      const cfAccount = accounts.get(cfAccountId);
      accounts.set(dcfAccountId, {
        id: dcfAccountId,
        accountName: `${cfAccount?.accountName ?? cfAccountId}（DCF）`,
        sheetType: "FCF",
      });
    }

    // CF科目を参照するルール
    rules[dcfAccountId] = {
      type: "REFERENCE",
      ref: cfAccountId,
    };

    dcfRuleItems.push({ type: "ACCOUNT", id: dcfAccountId });
  }

  // 4. FCFを計算（NOPLAT + 調整項目の合計）
  const fcfAccountId: AccountId = "fcf_dcf";
  if (!accounts.has(fcfAccountId)) {
    accounts.set(fcfAccountId, {
      id: fcfAccountId,
      accountName: "フリーキャッシュフロー",
      sheetType: "FCF",
    });
  }

  const fcfFormulaNode = sumFormulaNodes(
    dcfRuleItems,
    { type: "ACCOUNT", id: noplatAccountId } // 起点
  );

  rules[fcfAccountId] = {
    type: "CALCULATION",
    formulaNode: fcfFormulaNode,
  };

  console.log("  - DCF計算ルール生成完了。");
}
