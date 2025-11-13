// 元のparameter情報からrulesオブジェクトを生成するスクリプト
// 以前のseed.jsonの構造を基に作成

const originalAccountParams = {
  "pl-1": {
    parameter: "CALCULATION",
    dependencies: ["商品単価", "商品数量"],
    calculationFormula: "商品単価 * 商品数量 + 商品手数料",
  },
  "pl-2": {
    parameter: "GROWTH_RATE",
    parameterValue: 0.05,
  },
  "pl-3": {
    parameter: "GROWTH_RATE",
    parameterValue: 0.1,
  },
  "pl-4": {
    parameter: "FIXED_VALUE",
  },
  "pl-5": {
    parameter: "GROWTH_RATE",
    parameterValue: 0.05,
  },
  "pl-6": {
    parameter: "CHILDREN_SUM",
    dependencies: ["商品売上", "サービス売上"],
  },
  "pl-7": {
    parameter: "PERCENTAGE",
    parameterValue: 0.6,
    dependencies: ["売上高合計"],
  },
  "pl-8": {
    parameter: "CALCULATION",
    dependencies: ["売上高合計", "売上原価"],
    calculationFormula: "売上高合計 - 売上原価合計",
  },
  "pl-9": {
    parameter: "PROPORTIONATE",
    dependencies: ["売上高合計"],
  },
  "pl-10": {
    parameter: "PERCENTAGE",
    parameterValue: 0.01,
    dependencies: ["売上原価合計"],
  },
  "pl-11": {
    parameter: "PROPORTIONATE",
    dependencies: ["設備投資"],
  },
  "pl-12": {
    parameter: "PROPORTIONATE",
    dependencies: ["無形資産投資"],
  },
  "pl-13": {
    parameter: "FIXED_VALUE",
  },
  "pl-14": {
    parameter: "CHILDREN_SUM",
    dependencies: [
      "人件費",
      "物流費",
      "減価償却費",
      "のれん償却費",
      "その他販管費",
    ],
  },
  "pl-15": {
    parameter: "CALCULATION",
    dependencies: ["売上総利益", "販管費合計"],
    calculationFormula: "売上総利益 - 販管費合計",
  },
  "pl-16": {
    parameter: "PROPORTIONATE",
    dependencies: ["売上高合計"],
  },
  "pl-17": {
    parameter: "PROPORTIONATE",
    dependencies: ["売上高合計"],
  },
  "pl-18": {
    parameter: "CALCULATION",
    dependencies: ["営業利益", "営業外収益", "営業外費用"],
    calculationFormula: "営業利益 + 営業外収益 - 営業外費用",
  },
  "pl-19": {
    parameter: "FIXED_VALUE",
  },
  "pl-20": {
    parameter: "FIXED_VALUE",
  },
  "pl-21": {
    parameter: "CALCULATION",
    dependencies: ["経常利益", "特別利益", "特別損失"],
    calculationFormula: "経常利益 + 特別利益 - 特別損失",
  },
  "pl-22": {
    parameter: "CALCULATION",
    dependencies: ["税引前当期利益", "のれん償却費"],
    calculationFormula: "税引前当期利益 + のれん償却費（損金不算入科目）",
  },
  "pl-23": {
    parameter: "CALCULATION",
    dependencies: ["課税所得"],
    calculationFormula: "課税所得 * 0.35",
  },
  "pl-24": {
    parameter: "CALCULATION",
    dependencies: ["税引前当期利益", "法人税等"],
    calculationFormula: "税引前当期利益 - 法人税等",
  },
  "bs-1": {
    parameter: "CALCULATION",
    dependencies: ["前期末残高", "当期現預金増減"],
    calculationFormula: "前期末残高 + 当期現預金増減",
  },
  "bs-2": {
    parameter: "REVOLVING",
    parameterValue: 30,
    dependencies: ["売上高合計"],
  },
  "bs-3": {
    parameter: "REVOLVING",
    parameterValue: 60,
    dependencies: ["売上原価合計"],
  },
  "bs-4": {
    parameter: "CHILDREN_SUM",
    dependencies: ["現預金合計", "売掛金", "棚卸資産"],
  },
  "bs-5": {
    parameter: "BALANCE_AND_CHANGE",
    dependencies: ["前期末残高", "設備投資", "減価償却費"],
  },
  "bs-6": {
    parameter: "BALANCE_AND_CHANGE",
    dependencies: ["前期末残高", "無形資産投資", "のれん償却費"],
  },
  "bs-7": {
    parameter: "CHILDREN_SUM",
    dependencies: ["有形固定資産", "のれん"],
  },
  "bs-8": {
    parameter: "CHILDREN_SUM",
    dependencies: ["流動資産合計", "固定資産合計"],
  },
  "bs-9": {
    parameter: "REVOLVING",
    parameterValue: 60,
    dependencies: ["売上原価合計"],
  },
  "bs-10": {
    parameter: "REVOLVING",
    parameterValue: 40,
    dependencies: ["売上原価合計"],
  },
  "bs-11": {
    parameter: "CHILDREN_SUM",
    dependencies: ["買掛金", "未払金"],
  },
  "bs-12": {
    parameter: "BALANCE_AND_CHANGE",
    dependencies: ["前期末残高", "新規借入", "借入金返済"],
  },
  "bs-13": {
    parameter: "FIXED_VALUE",
  },
  "bs-14": {
    parameter: "CHILDREN_SUM",
    dependencies: ["長期借入金", "社債"],
  },
  "bs-15": {
    parameter: "CHILDREN_SUM",
    dependencies: ["流動負債合計", "固定負債合計"],
  },
  "bs-16": {
    parameter: "FIXED_VALUE",
  },
  "bs-17": {
    parameter: "BALANCE_AND_CHANGE",
    dependencies: ["前期末残高", "営業利益"],
  },
  "bs-18": {
    parameter: "CHILDREN_SUM",
    dependencies: ["資本金", "利益剰余金"],
  },
  "bs-19": {
    parameter: "CHILDREN_SUM",
    dependencies: ["負債合計", "純資産合計"],
  },
  "pp-1": {
    parameter: "GROWTH_RATE",
    parameterValue: 0.05,
  },
  "pp-2": {
    parameter: "PROPORTIONATE",
    dependencies: ["売上高"],
  },
  "fn-1": {
    parameter: "INPUT",
  },
  "fn-2": {
    parameter: "INPUT",
  },
};

// Account名からIDへのマッピング
const accountNameToId = {
  商品売上: "pl-1",
  商品単価: "pl-2",
  商品数量: "pl-3",
  商品手数料: "pl-4",
  サービス売上: "pl-5",
  売上高合計: "pl-6",
  売上原価合計: "pl-7",
  売上原価: "pl-7",
  売上総利益: "pl-8",
  人件費: "pl-9",
  物流費: "pl-10",
  減価償却費: "pl-11",
  のれん償却費: "pl-12",
  その他販管費: "pl-13",
  販管費合計: "pl-14",
  営業利益: "pl-15",
  営業外収益: "pl-16",
  営業外費用: "pl-17",
  経常利益: "pl-18",
  特別利益: "pl-19",
  特別損失: "pl-20",
  税引前当期利益: "pl-21",
  課税所得: "pl-22",
  法人税等: "pl-23",
  税引後当期利益: "pl-24",
  現預金合計: "bs-1",
  売掛金: "bs-2",
  棚卸資産: "bs-3",
  流動資産合計: "bs-4",
  有形固定資産: "bs-5",
  のれん: "bs-6",
  固定資産合計: "bs-7",
  資産合計: "bs-8",
  買掛金: "bs-9",
  未払金: "bs-10",
  流動負債合計: "bs-11",
  長期借入金: "bs-12",
  社債: "bs-13",
  固定負債合計: "bs-14",
  負債合計: "bs-15",
  資本金: "bs-16",
  利益剰余金: "bs-17",
  純資産合計: "bs-18",
  負債及び純資産合計: "bs-19",
  設備投資: "pp-1",
  無形資産投資: "pp-2",
  新規借入: "fn-1",
  借入金返済: "fn-2",
  売上高: "pl-6",
};

// 標準のPeriodオブジェクト
const samePeriod = {
  Period_type: "Yearly",
  AF_type: "Actual",
  Period_val: "SAME",
};

const prevPeriod = {
  Period_type: "Yearly",
  AF_type: "Actual",
  Period_val: "PREV",
};

function generateRules(accountsMaster) {
  const rules = {};
  const accountById = new Map();
  accountsMaster.forEach((acc) => {
    accountById.set(acc.id, acc);
    accountNameToId[acc.accountName] = acc.id;
  });

  for (const [accountId, paramInfo] of Object.entries(originalAccountParams)) {
    const account = accountById.get(accountId);
    if (!account) continue;

    // BALANCE_AND_CHANGEは除外（balanceChangeで処理）
    if (paramInfo.parameter === "BALANCE_AND_CHANGE") {
      continue;
    }

    switch (paramInfo.parameter) {
      case "INPUT":
        // INPUTは値が設定されるまでルールなし（または空のルール）
        break;

      case "FIXED_VALUE":
        // FIXED_VALUEは値がparameterValueに含まれていない場合、0と仮定
        // 実際にはPREVSから初期値を取得するか、別途設定が必要
        if (paramInfo.parameterValue !== undefined) {
          rules[accountId] = {
            type: "FIXED_VALUE",
            value: paramInfo.parameterValue,
          };
        }
        break;

      case "GROWTH_RATE":
        if (paramInfo.parameterValue !== undefined) {
          rules[accountId] = {
            type: "GROWTH_RATE",
            value: paramInfo.parameterValue,
            refs: [
              {
                period: prevPeriod,
                account: account,
              },
            ],
          };
        }
        break;

      case "CALCULATION":
        if (paramInfo.dependencies && paramInfo.calculationFormula) {
          const refs = [];
          const formula = paramInfo.calculationFormula;

          // 依存関係を抽出（簡易版：dependenciesから直接取得）
          for (const depName of paramInfo.dependencies) {
            const depId = accountNameToId[depName];
            if (depId) {
              const depAccount = accountById.get(depId);
              if (depAccount) {
                // 符号の判定（簡易版：formulaに"-"とdepNameが含まれる場合は-1）
                let sign = 1;
                // " - depName" または "depName -" のパターンを検出
                const beforePattern = new RegExp(
                  `[\\s\\-]${depName.replace(
                    /[.*+?^${}()|[\]\\]/g,
                    "\\$&"
                  )}[\\s\\-]`
                );
                if (
                  beforePattern.test(formula) ||
                  formula.includes(`- ${depName}`)
                ) {
                  sign = -1;
                }

                refs.push({
                  period: samePeriod,
                  account: depAccount,
                  sign,
                });
              }
            }
          }

          if (refs.length > 0) {
            rules[accountId] = {
              type: "CALCULATION",
              refs,
            };
          }
        }
        break;

      case "CHILDREN_SUM":
        rules[accountId] = {
          type: "CHILDREN_SUM",
        };
        break;

      case "PERCENTAGE":
        if (
          paramInfo.parameterValue !== undefined &&
          paramInfo.dependencies?.[0]
        ) {
          const depName = paramInfo.dependencies[0];
          const depId = accountNameToId[depName];
          if (depId) {
            const depAccount = accountById.get(depId);
            if (depAccount) {
              rules[accountId] = {
                type: "PERCENTAGE",
                value: paramInfo.parameterValue,
                ref: {
                  period: samePeriod,
                  account: depAccount,
                },
              };
            }
          }
        }
        break;

      case "PROPORTIONATE":
        if (paramInfo.dependencies?.[0]) {
          const depName = paramInfo.dependencies[0];
          const depId = accountNameToId[depName];
          if (depId) {
            const depAccount = accountById.get(depId);
            if (depAccount) {
              rules[accountId] = {
                type: "PROPORTIONATE",
                driverCurr: {
                  period: samePeriod,
                  account: depAccount,
                },
                driverPrev: {
                  period: prevPeriod,
                  account: depAccount,
                },
              };
            }
          }
        }
        break;

      case "REVOLVING":
        // REVOLVINGはfs-modelのRuleInputに直接対応しないため、
        // PROPORTIONATEとして近似するか、別の処理が必要
        // ここでは簡易的にPERCENTAGEとして処理
        if (
          paramInfo.parameterValue !== undefined &&
          paramInfo.dependencies?.[0]
        ) {
          const depName = paramInfo.dependencies[0];
          const depId = accountNameToId[depName];
          if (depId) {
            const depAccount = accountById.get(depId);
            if (depAccount) {
              // REVOLVINGは回転日数ベースの計算なので、PERCENTAGEとして近似
              // parameterValueは日数なので、これを年換算（365で割る）
              const dayRatio = paramInfo.parameterValue / 365;
              rules[accountId] = {
                type: "PERCENTAGE",
                value: dayRatio,
                ref: {
                  period: samePeriod,
                  account: depAccount,
                },
              };
            }
          }
        }
        break;
    }
  }

  return rules;
}

// 実行（Node.js環境で実行する場合）
if (typeof module !== "undefined" && module.exports) {
  module.exports = { generateRules, originalAccountParams, accountNameToId };
}
