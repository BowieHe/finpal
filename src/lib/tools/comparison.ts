/**
 * 基金对比 Tool
 * 支持多只基金收益率和风险指标的横向对比
 */

import prisma from '@/lib/prisma';

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

    const pastNav = await prisma.fundNav.findFirst({
        where: {
            fundCode,
            navDate: { lte: targetDate },
        },
        orderBy: { navDate: 'desc' },
    });

    if (!pastNav) return null;

    const past = Number(pastNav.unitNav);
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
    const holdingCodes = await prisma.userHolding
        .findMany({ select: { fundCode: true } })
        .then(rows => new Set(rows.map(r => r.fundCode)));

    const results: FundComparisonItem[] = [];

    for (const fundCode of uniqueCodes) {
        // 基金基础信息
        const fundBasic = await prisma.fundBasic.findUnique({
            where: { code: fundCode },
        });

        // 最新净值
        const latestNavRecord = await prisma.fundNav.findFirst({
            where: { fundCode },
            orderBy: { navDate: 'desc' },
        });

        if (!latestNavRecord) {
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

        const latestNav = Number(latestNavRecord.unitNav);
        const latestDate = latestNavRecord.navDate;

        // 并行计算各时段收益率
        const [return1m, return3m, return6m, return1y] = await Promise.all([
            calculatePeriodReturn(fundCode, 30, latestNav, latestDate),
            calculatePeriodReturn(fundCode, 90, latestNav, latestDate),
            calculatePeriodReturn(fundCode, 180, latestNav, latestDate),
            calculatePeriodReturn(fundCode, 365, latestNav, latestDate),
        ]);

        // 计算近1年波动率和最大回撤（最近252个交易日）
        const yearNavs = await prisma.fundNav.findMany({
            where: {
                fundCode,
                navDate: { gte: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000) },
            },
            orderBy: { navDate: 'asc' },
            select: { unitNav: true, navDate: true, dailyReturn: true },
        });

        let volatility: number | null = null;
        let maxDrawdown: number | null = null;

        if (yearNavs.length >= 20) {
            // 年化波动率（基于 daily_return 字段）
            const returns = yearNavs
                .map(n => (n.dailyReturn !== null ? Number(n.dailyReturn) : null))
                .filter((r): r is number => r !== null);

            if (returns.length >= 20) {
                const mean = returns.reduce((s, r) => s + r, 0) / returns.length;
                const variance = returns.reduce((s, r) => s + (r - mean) ** 2, 0) / returns.length;
                const dailyStdDev = Math.sqrt(variance);
                volatility = Math.round(dailyStdDev * Math.sqrt(252) * 100) / 100;
            }

            // 最大回撤（时序感知：峰值必须在谷值之前）
            const navValues = yearNavs.map(n => Number(n.unitNav));
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
            maxDrawdown = Math.round(maxDD * 10000) / 100; // 转为百分比
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
