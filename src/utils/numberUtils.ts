// src/utils/numberUtils.ts

/**
 * 小数点第2位まで丸める（より厳密な方法）
 * toFixedとparseFloatの組み合わせを使用して、浮動小数点数の丸め誤差を防ぐ
 */
export function roundTo2Decimals(value: number): number {
  return parseFloat(value.toFixed(2));
}

/**
 * 整数に丸める
 * parseIntを使用して、小数点以下を切り捨て
 */
export function roundToInteger(value: number): number {
  return parseInt(value.toFixed(0), 10);
}
