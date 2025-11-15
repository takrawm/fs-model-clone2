// src/fam/dcfRuleGenerator.ts

import type {
  Account,
  AccountId,
  FormulaNode,
  Period,
  Rule,
} from "../model/types.ts";
import { TAX_RATE } from "../config/financialModelConfig.ts";
import { dcfConfig } from "../config/dcfConfig.ts";
import {
  buildFcfFormulaNode,
  buildNoplatFormulaNode,
  buildTaxOnOperatingProfitFormulaNode,
  calculatePresentValueFactor,
} from "./dcfRuleBuilder.ts";

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

  // 2. 営業利益（DCF）科目を生成（PLの営業利益を参照）
  const operatingProfitDcfAccountId: AccountId = "operating_profit_dcf";
  if (!accounts.has(operatingProfitDcfAccountId)) {
    accounts.set(operatingProfitDcfAccountId, {
      id: operatingProfitDcfAccountId,
      accountName: `${operatingProfitAccount.accountName}（DCF）`,
      sheetType: "FCF",
    });
  }

  rules[operatingProfitDcfAccountId] = {
    type: "REFERENCE",
    ref: operatingProfitAccountId,
  };

  // 3. 税金（対営業利益）科目を生成
  const taxOnOperatingProfitAccountId: AccountId =
    "tax_on_operating_profit_dcf";
  if (!accounts.has(taxOnOperatingProfitAccountId)) {
    accounts.set(taxOnOperatingProfitAccountId, {
      id: taxOnOperatingProfitAccountId,
      accountName: "税金（対営業利益）",
      sheetType: "FCF",
    });
  }

  rules[taxOnOperatingProfitAccountId] = {
    type: "CALCULATION",
    formulaNode: buildTaxOnOperatingProfitFormulaNode(
      operatingProfitDcfAccountId,
      TAX_RATE
    ),
  };

  // 4. NOPLATを計算（営業利益（DCF）- 税金（対営業利益））
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
    formulaNode: buildNoplatFormulaNode(
      operatingProfitDcfAccountId,
      taxOnOperatingProfitAccountId
    ),
  };

  // 5. CF科目を参照してDCF調整科目を生成
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

  const fcfFormulaNode = buildFcfFormulaNode(noplatAccountId, dcfRuleItems);

  rules[fcfAccountId] = {
    type: "CALCULATION",
    formulaNode: fcfFormulaNode,
  };

  console.log("  - DCF計算ルール生成完了。");
}

/**
 * PV（現在価値）シートの計算ルールを動的に生成し、rules に注入する
 * AST計算の実行前に呼び出す必要がある
 *
 * @param accounts - アカウントマスタ（変更される）
 * @param rules - 計算ルール（変更される）
 * @param periods - 期間の配列
 */
export function generatePvRules(
  accounts: Map<AccountId, Account>,
  rules: Record<AccountId, Rule>,
  periods: Period[]
): void {
  console.log("  - PV計算ルールを動的に生成中...");

  const { baseYear, wacc } = dcfConfig;

  // 各periodに対して現在価値係数の科目を生成
  for (const period of periods) {
    // 基準年度からの年数を計算（fiscalYearを使用）
    const yearsFromBase = period.fiscalYear - baseYear;

    // 基準年度以前のperiodはスキップ
    if (yearsFromBase <= 0) {
      continue;
    }

    // 現在価値係数のAccountIdを生成（例: "pv_factor_2026"）
    const pvFactorAccountId = `pv_factor_${period.fiscalYear}` as AccountId;

    // 現在価値係数の値を計算
    const pvFactorValue = calculatePresentValueFactor(yearsFromBase, wacc);

    // Accountを作成
    if (!accounts.has(pvFactorAccountId)) {
      accounts.set(pvFactorAccountId, {
        id: pvFactorAccountId,
        accountName: "現在価値係数",
        sheetType: "PV",
      });
    }

    // Ruleを作成（INPUTタイプで固定値として設定）
    rules[pvFactorAccountId] = {
      type: "INPUT",
      value: pvFactorValue,
    };
  }

  console.log("  - PV計算ルール生成完了。");
}
