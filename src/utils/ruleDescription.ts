import type { Account, AccountId, Rule } from "../model/types.ts";
import { forecastRules } from "../data/forecastRules.ts";

/**
 * 式ノードを文字列に変換する
 */
function parseExpression(
  formulaNode: any,
  getAccountName: (id: AccountId) => string
): string {
  if (!formulaNode) return "";

  if (formulaNode.type === "NUMBER") {
    return String(formulaNode.value);
  }

  if (formulaNode.type === "ACCOUNT") {
    let name = getAccountName(formulaNode.id);
    if (formulaNode.period && formulaNode.period.offset === -1) {
      name += "(前期)";
    }
    return name;
  }

  if (["ADD", "SUB", "MUL", "DIV"].includes(formulaNode.type)) {
    const op = {
      ADD: "+",
      SUB: "-",
      MUL: "*",
      DIV: "/",
    }[formulaNode.type];
    const left = parseExpression(formulaNode.left, getAccountName);
    const right = parseExpression(formulaNode.right, getAccountName);
    return `(${left} ${op} ${right})`;
  }

  if (formulaNode.type === "BINARY_OP") {
    const op = {
      ADD: "+",
      SUB: "-",
      MUL: "*",
      DIV: "/",
    }[formulaNode.op];
    const left = parseExpression(formulaNode.left, getAccountName);
    const right = parseExpression(formulaNode.right, getAccountName);
    return `(${left} ${op} ${right})`;
  }

  return "?";
}

/**
 * BALANCE_CHANGEルールの説明を生成
 */
function parseBalanceChange(
  rule: Extract<Rule, { type: "BALANCE_CHANGE" }>,
  getAccountName: (id: AccountId) => string
): string {
  let desc = "前期末残高";
  for (const flow of rule.flowAccounts) {
    desc += ` ${flow.sign === "PLUS" ? "+" : "-"} ${getAccountName(flow.ref)}`;
  }
  return desc;
}

/**
 * アカウントIDからアカウント名を取得するヘルパー
 */
function getAccountName(
  id: AccountId,
  accounts: Map<AccountId, Account>
): string {
  return accounts.get(id)?.accountName || id;
}

/**
 * ルールの説明を生成する
 */
export function getRuleDescription(
  accountId: AccountId,
  accounts: Map<AccountId, Account>,
  famInstance?: any
): string {
  const account = accounts.get(accountId);

  // CF派生科目の説明
  if (accountId.endsWith("_cf_wc")) {
    const sourceAccountId = accountId.replace("_cf_wc", "") as AccountId;
    const sourceName = getAccountName(sourceAccountId, accounts);
    const sourceAccount = accounts.get(sourceAccountId);
    // isCredit (負債) なら 今期 - 前期。 isCreditでない (資産) なら 前期 - 今期
    return sourceAccount?.isCredit
      ? `${sourceName} (今期 - 前期)`
      : `${sourceName} (前期 - 今期)`;
  }

  if (accountId.endsWith("_cf_adj")) {
    const sourceAccountId = accountId.replace("_cf_adj", "") as AccountId;
    const sourceName = getAccountName(sourceAccountId, accounts);
    const sourceAccount = accounts.get(sourceAccountId);
    const rule = forecastRules[sourceAccountId];
    if (rule?.type === "BALANCE_CHANGE") {
      // BALANCE_CHANGEの場合は符号を判定
      const account = accounts.get(
        accountId.replace("_cf_adj", "") as AccountId
      );
      const sign = account?.isCredit ?? false ? 1 : -1;
      // flowAccountsから符号を判定（簡易版）
      const flow = rule.flowAccounts.find((f) => f.ref === sourceAccountId);
      const flowSign = flow?.sign === "PLUS" ? 1 : -1;
      const cfSign = sign * flowSign;
      const signStr = cfSign === 1 ? "" : " * -1";
      return `${sourceName}(${sourceAccount?.sheetType})${signStr}`;
    }
    return `${sourceName}(${sourceAccount?.sheetType})`;
  }

  if (accountId === "cash_change_cf") {
    return "CF項目合計";
  }

  // 通常ルールの説明
  const rule = forecastRules[accountId];
  if (!rule) {
    return "前期値参照";
  }

  switch (rule.type) {
    case "GROWTH_RATE":
      return `前期値 * (1 + ${(rule.rate * 100).toFixed(0)}%)`;
    case "PERCENTAGE":
      return `${getAccountName(rule.ref, accounts)} × ${(
        rule.percentage * 100
      ).toFixed(0)}%`;
    case "PROPORTIONATE":
      return `${getAccountName(rule.ref, accounts)}比例 (前期比)`;
    case "CALCULATION":
      return parseExpression(rule.formulaNode, (id) =>
        getAccountName(id, accounts)
      );
    case "BALANCE_CHANGE":
      return parseBalanceChange(rule, (id) => getAccountName(id, accounts));
    case "INPUT":
      return `固定値 (${rule.value.toLocaleString()})`;
    case "FIXED_VALUE":
      return "前期値参照";
    default:
      return rule.type;
  }
}
