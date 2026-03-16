import { query } from '@/lib/db';
import { FundBasicSchema, FundNavSchema } from '@/lib/db-schema';
import { calcAnnualizedVolatility, calcMaxDrawdown, calcSharpeRatio, calcAnnualReturn } from '@/lib/agents/quant-agent';

// ==================== 类型定义 ====================

export type RiskLevel = 'low' | 'medium' | 'high';
export type AnalysisPeriod = 'ytd' | '1y' | '3y';

export interface RiskMetrics {
    fundCode: string;
    fundName: string;
    period: AnalysisPeriod;
    dataPoints: number;         // 实际使用的数据点数量
    annualReturn: number | null;   // 年化收益率（%）
    volatility: number | null;     // 年化波动率（%）
    maxDrawdown: number | null;    // 最大回撤（%）
    sharpeRatio: number | null;    // 夏普比率
    riskLevel: RiskLevel | null;
    riskReason: string;
    insufficientData: boolean;     // 数据不足标记
}

// ==================== 配置 ====================

// 无风险利率（年化），可按市场情况调整
const RISK_FREE_RATE_ANNUAL = 0.025; // 2.5%

// 风险评级阈值
const RISK_THRESHOLDS = {
    low: { maxVolatility: 8, maxDrawdown: 15 },
    high: { minVolatility: 20, minDrawdown: 30 },
};

// 各时段对应天数
const PERIOD_DAYS: Record<AnalysisPeriod, number> = {
    ytd: getDaysFromYearStart(),
    '1y': 365,
    '3y': 365 * 3,
};

function getDaysFromYearStart(): number {
    const now = new Date();
    const yearStart = new Date(now.getFullYear(), 0, 1);
    return Math.floor((now.getTime() - yearStart.getTime()) / (1000 * 60 * 60 * 24));
}

// ==================== Tool 实现 ====================

/**
 * Tool: get_fund_risk_metrics
 * 计算单只基金的详细风险指标
 */
export async function getFundRiskMetrics(
    fundCode: string,
    period: AnalysisPeriod = '1y'
): Promise<RiskMetrics> {
    const fundBasicResult = await query('SELECT * FROM fund_basic WHERE code = $1', [fundCode]);
    const fundBasic = fundBasicResult.rows.length > 0 ? FundBasicSchema.parse(fundBasicResult.rows[0]) : null;

    const fundName = fundBasic?.name ?? fundCode;
    const days = period === 'ytd' ? getDaysFromYearStart() : PERIOD_DAYS[period];
    const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    // 查询时段内的净值数据
    const navResult = await query(
        'SELECT nav_date, unit_nav, daily_return FROM fund_nav WHERE fund_code = $1 AND nav_date >= $2 ORDER BY nav_date ASC',
        [fundCode, startDate]
    );
    const navRecords = navResult.rows.map(row => FundNavSchema.partial().parse(row));

    const insufficient = navRecords.length < 20;

    if (insufficient || navRecords.length === 0) {
        return {
            fundCode,
            fundName,
            period,
            dataPoints: navRecords.length,
            annualReturn: null,
            volatility: null,
            maxDrawdown: null,
            sharpeRatio: null,
            riskLevel: null,
            riskReason: `数据不足（仅有 ${navRecords.length} 个交易日数据，至少需要 20 个）`,
            insufficientData: true,
        };
    }

    const navValues = navRecords.map(n => n.unit_nav as number);
    const dailyReturns = navRecords
        .map(n => n.daily_return)
        .filter((r): r is number => r !== null && r !== undefined);

    // 年化收益率
    const firstNav = navValues[0];
    const lastNav = navValues[navValues.length - 1];
    const actualDays = Math.floor(
        ((navRecords[navRecords.length - 1].nav_date as Date).getTime() - (navRecords[0].nav_date as Date).getTime()) /
        (1000 * 60 * 60 * 24)
    );
    const annualReturn = calcAnnualReturn(firstNav, lastNav, actualDays);

    // 年化波动率
    const volatility = calcAnnualizedVolatility(dailyReturns);

    // 最大回撤
    const maxDrawdown = calcMaxDrawdown(navValues);

    // 夏普比率
    const sharpeRatio =
        annualReturn !== null && volatility !== null
            ? calcSharpeRatio(annualReturn, volatility, RISK_FREE_RATE_ANNUAL)
            : null;

    // ---- 风险评级 ----
    const { riskLevel, riskReason } = evaluateRiskLevel(volatility, maxDrawdown);

    return {
        fundCode,
        fundName,
        period,
        dataPoints: navRecords.length,
        annualReturn,
        volatility,
        maxDrawdown,
        sharpeRatio,
        riskLevel,
        riskReason,
        insufficientData: false,
    };
}

function evaluateRiskLevel(
    volatility: number | null,
    maxDrawdown: number | null
): { riskLevel: RiskLevel; riskReason: string } {
    if (volatility === null || maxDrawdown === null) {
        return { riskLevel: 'medium', riskReason: '数据不完整，默认中等风险' };
    }

    const isHighRisk =
        volatility >= RISK_THRESHOLDS.high.minVolatility ||
        maxDrawdown >= RISK_THRESHOLDS.high.minDrawdown;

    const isLowRisk =
        volatility < RISK_THRESHOLDS.low.maxVolatility &&
        maxDrawdown < RISK_THRESHOLDS.low.maxDrawdown;

    if (isHighRisk) {
        const reasons: string[] = [];
        if (volatility >= RISK_THRESHOLDS.high.minVolatility)
            reasons.push(`年化波动率 ${volatility}% ≥ ${RISK_THRESHOLDS.high.minVolatility}%`);
        if (maxDrawdown >= RISK_THRESHOLDS.high.minDrawdown)
            reasons.push(`最大回撤 ${maxDrawdown}% ≥ ${RISK_THRESHOLDS.high.minDrawdown}%`);
        return { riskLevel: 'high', riskReason: `高风险：${reasons.join('；')}` };
    }

    if (isLowRisk) {
        return {
            riskLevel: 'low',
            riskReason: `低风险：年化波动率 ${volatility}%，最大回撤 ${maxDrawdown}%，均在安全阈值内`,
        };
    }

    return {
        riskLevel: 'medium',
        riskReason: `中等风险：年化波动率 ${volatility}%，最大回撤 ${maxDrawdown}%`,
    };
}
