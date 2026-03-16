import { query } from '@/lib/db';
import { FundNavSchema, FundBasicSchema, UserHoldingSchema } from '@/lib/db-schema';
import { calcAnnualizedVolatility, calcMaxDrawdown } from '@/lib/agents/quant-agent';

// ==================== 类型定义 ====================

export interface FundComparisonItem {
    fundCode: string;
    fundName: string;
    category: string | null;
    // 收益率
    return1m: number | null;
    return3m: number | null;
    return6m: number | null;
    return1y: number | null;
    // 风险指标（简化版，完整版在 risk.ts）
    volatility: number | null;
    maxDrawdown: number | null;
    // 是否在持仓中
    isHolding: boolean;
    currentNav: number | null;
    navDate: string | null;
}

export interface FundComparisonResult {
    funds: FundComparisonItem[];
    comparedAt: string;
}

// ==================== Tool 实现 ====================

/**
 * 计算 N 天前净值的收益率
 * 返回百分比，如 5.23 表示 5.23%
 */
async function calculatePeriodReturn(
    fundCode: string,
    days: number,
    latestNav: number,
    latestDate: Date
): Promise<number | null> {
    // 找 N 天前最近的净值
    const targetDate = new Date(latestDate);
    targetDate.setDate(targetDate.getDate() - days);

    const pastNavResult = await query(
        'SELECT * FROM fund_nav WHERE fund_code = $1 AND nav_date <= $2 ORDER BY nav_date DESC LIMIT 1',
        [fundCode, targetDate]
    );

    if (pastNavResult.rows.length === 0) return null;
    const pastNav = FundNavSchema.parse(pastNavResult.rows[0]);

    const past = pastNav.unit_nav;
    if (past === 0) return null;

    return Math.round(((latestNav - past) / past) * 10000) / 100; // 保留2位小数
}

/**
 * Tool: compare_funds
 * 对比多只基金的收益和风险表现
 */
export async function compareFunds(fundCodes: string[]): Promise<FundComparisonResult> {
    if (fundCodes.length === 0) {
        return { funds: [], comparedAt: new Date().toISOString() };
    }

    // 去重
    const uniqueCodes = [...new Set(fundCodes)];

    // 获取当前持仓中的基金代码
    const holdingResult = await query('SELECT fund_code FROM user_holdings');
    const holdingCodes = new Set(holdingResult.rows.map(r => r.fund_code));

    const results: FundComparisonItem[] = [];

    for (const fundCode of uniqueCodes) {
        // 基金基础信息
        const fundBasicResult = await query('SELECT * FROM fund_basic WHERE code = $1', [fundCode]);
        const fundBasic = fundBasicResult.rows.length > 0 ? FundBasicSchema.parse(fundBasicResult.rows[0]) : null;

        // 最新净值
        const latestNavResult = await query(
            'SELECT * FROM fund_nav WHERE fund_code = $1 ORDER BY nav_date DESC LIMIT 1',
            [fundCode]
        );

        if (latestNavResult.rows.length === 0) {
            results.push({
                fundCode,
                fundName: fundBasic?.name ?? fundCode,
                category: fundBasic?.category ?? null,
                return1m: null,
                return3m: null,
                return6m: null,
                return1y: null,
                volatility: null,
                maxDrawdown: null,
                isHolding: holdingCodes.has(fundCode),
                currentNav: null,
                navDate: null,
            });
            continue;
        }

        const latestNavRecord = FundNavSchema.parse(latestNavResult.rows[0]);
        const latestNav = latestNavRecord.unit_nav;
        const latestDate = latestNavRecord.nav_date;

        // 并行计算各时段收益率
        const [return1m, return3m, return6m, return1y] = await Promise.all([
            calculatePeriodReturn(fundCode, 30, latestNav, latestDate),
            calculatePeriodReturn(fundCode, 90, latestNav, latestDate),
            calculatePeriodReturn(fundCode, 180, latestNav, latestDate),
            calculatePeriodReturn(fundCode, 365, latestNav, latestDate),
        ]);

        // 计算近1年波动率和最大回撤（最近252个交易日）
        const yearNavResult = await query(
            'SELECT unit_nav, nav_date, daily_return FROM fund_nav WHERE fund_code = $1 AND nav_date >= $2 ORDER BY nav_date ASC',
            [fundCode, new Date(Date.now() - 365 * 24 * 60 * 60 * 1000)]
        );
        const yearNavs = yearNavResult.rows.map(row => FundNavSchema.partial().parse(row));

        let volatility: number | null = null;
        let maxDrawdown: number | null = null;

        if (yearNavs.length >= 20) {
            const returns = yearNavs
                .map(n => n.daily_return)
                .filter((r): r is number => r !== null && r !== undefined);
            const navValues = yearNavs.map(n => n.unit_nav as number);

            volatility = calcAnnualizedVolatility(returns);
            maxDrawdown = calcMaxDrawdown(navValues);
        }

        results.push({
            fundCode,
            fundName: fundBasic?.name ?? fundCode,
            category: fundBasic?.category ?? null,
            return1m,
            return3m,
            return6m,
            return1y,
            volatility,
            maxDrawdown,
            isHolding: holdingCodes.has(fundCode),
            currentNav: latestNav,
            navDate: latestDate.toISOString().split('T')[0],
        });
    }

    return {
        funds: results,
        comparedAt: new Date().toISOString(),
    };
}
