/**
 * Quant-Agent — 量化风险计算专员
 *
 * 纯函数节点，不调用 LLM，不访问数据库，不联网。
 * 输入历史净值序列，输出标准化的风险指标。
 *
 * 这是 comparison.ts 和 risk.ts 中重复计算逻辑的统一来源。
 */

import { QuantAgentInput, QuantAgentOutput } from './types';

// ==================== 默认配置 ====================

const DEFAULT_RISK_FREE_RATE = 0.025; // 2.5% 年化
const MIN_DATA_POINTS = 20;           // 至少需要 20 个数据点

// ==================== 核心数学函数（可单独导出复用）====================

/**
 * 计算年化波动率（基于日收益率序列）
 * @param dailyReturns 日收益率序列（百分比，如 1.5 表示 1.5%）
 * @returns 年化波动率（%），数据不足时返回 null
 */
export function calcAnnualizedVolatility(dailyReturns: number[]): number | null {
  if (dailyReturns.length < MIN_DATA_POINTS) return null;
  const mean = dailyReturns.reduce((s, r) => s + r, 0) / dailyReturns.length;
  const variance = dailyReturns.reduce((s, r) => s + (r - mean) ** 2, 0) / dailyReturns.length;
  const dailyStdDev = Math.sqrt(variance);
  return Math.round(dailyStdDev * Math.sqrt(252) * 100) / 100;
}

/**
 * 计算最大回撤（时序感知：峰值必须早于谷值）
 * @param navValues 净值序列（升序，最旧在前）
 * @returns 最大回撤（%），如 18.5 表示 18.5%
 */
export function calcMaxDrawdown(navValues: number[]): number | null {
  if (navValues.length < 2) return null;
  let peak = navValues[0];
  let maxDD = 0;
  for (const nav of navValues) {
    if (nav > peak) {
      peak = nav;
    } else if (peak > 0) {
      const drawdown = (peak - nav) / peak;
      if (drawdown > maxDD) maxDD = drawdown;
    }
  }
  return Math.round(maxDD * 10000) / 100; // 转为百分比，保留 2 位小数
}

/**
 * 计算年化收益率（复利）
 * @param firstNav 起始净值
 * @param lastNav 末期净值
 * @param actualDays 实际持有天数
 * @returns 年化收益率（%）
 */
export function calcAnnualReturn(
  firstNav: number,
  lastNav: number,
  actualDays: number
): number | null {
  if (firstNav <= 0 || actualDays <= 0) return null;
  return Math.round((Math.pow(lastNav / firstNav, 365 / actualDays) - 1) * 10000) / 100;
}

/**
 * 计算夏普比率
 * @param annualReturn 年化收益率（%）
 * @param annualizedVolatility 年化波动率（%）
 * @param riskFreeRate 年化无风险利率（小数，如 0.025）
 */
export function calcSharpeRatio(
  annualReturn: number,
  annualizedVolatility: number,
  riskFreeRate: number = DEFAULT_RISK_FREE_RATE
): number | null {
  if (annualizedVolatility <= 0) return null;
  return Math.round(
    ((annualReturn / 100 - riskFreeRate) / (annualizedVolatility / 100)) * 100
  ) / 100;
}

/**
 * 计算卡玛比率（Calmar Ratio）
 * @param annualReturn 年化收益率（%）
 * @param maxDrawdown 最大回撤（%）
 */
export function calcCalmarRatio(
  annualReturn: number,
  maxDrawdown: number
): number | null {
  if (maxDrawdown <= 0) return null;
  return Math.round((annualReturn / maxDrawdown) * 100) / 100;
}

// ==================== Agent 节点函数 ====================

/**
 * Quant-Agent 主函数
 *
 * 接受历史净值序列，返回完整的风险指标集合。
 * 无副作用，100% 可单元测试。
 */
export async function quantAgent(input: QuantAgentInput): Promise<QuantAgentOutput> {
  const startTime = Date.now();
  const { fundCode, priceHistory, dailyReturns: precomputedReturns, riskFreeRate = DEFAULT_RISK_FREE_RATE } = input;

  const insufficientData = priceHistory.length < MIN_DATA_POINTS;

  if (insufficientData) {
    return {
      agentId: 'quant-agent',
      fundCode,
      annualReturn: null,
      annualizedVolatility: null,
      maxDrawdown: null,
      sharpeRatio: null,
      calmarRatio: null,
      dataPoints: priceHistory.length,
      insufficientData: true,
      durationMs: Date.now() - startTime,
    };
  }

  // 年化收益率（用首尾净值 + 天数）
  const firstNav = priceHistory[0];
  const lastNav = priceHistory[priceHistory.length - 1];
  // 假设日度数据，每个数据点代表 1 个交易日
  const actualDays = Math.round(priceHistory.length * (365 / 252));
  const annualReturn = calcAnnualReturn(firstNav, lastNav, actualDays);

  // 最大回撤
  const maxDrawdown = calcMaxDrawdown(priceHistory);

  // 年化波动率（优先使用预计算的日收益率，否则从净值序列推导）
  let dailyReturns = precomputedReturns;
  if (!dailyReturns || dailyReturns.length < MIN_DATA_POINTS) {
    dailyReturns = priceHistory.slice(1).map((nav, i) => {
      const prev = priceHistory[i];
      return prev > 0 ? ((nav - prev) / prev) * 100 : 0;
    });
  }
  const annualizedVolatility = calcAnnualizedVolatility(dailyReturns);

  // 夏普比率
  const sharpeRatio =
    annualReturn !== null && annualizedVolatility !== null
      ? calcSharpeRatio(annualReturn, annualizedVolatility, riskFreeRate)
      : null;

  // 卡玛比率
  const calmarRatio =
    annualReturn !== null && maxDrawdown !== null && maxDrawdown > 0
      ? calcCalmarRatio(annualReturn, maxDrawdown)
      : null;

  return {
    agentId: 'quant-agent',
    fundCode,
    annualReturn,
    annualizedVolatility,
    maxDrawdown,
    sharpeRatio,
    calmarRatio,
    dataPoints: priceHistory.length,
    insufficientData: false,
    durationMs: Date.now() - startTime,
  };
}
