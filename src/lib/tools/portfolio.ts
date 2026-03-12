/**
 * 持仓分析 Tools
 * 供 LangGraph researcherNode 调用，从数据库获取持仓和净值数据
 */

import prisma from '@/lib/prisma';

// ==================== 类型定义 ====================

export interface HoldingItem {
    fundCode: string;
    fundName: string;
    shares: number;
    costPrice: number;
    totalCost: number;
    currentNav: number | null;
    currentValue: number | null;
    totalProfit: number | null;
    profitRate: number | null;
    dailyProfit: number | null;
    isProfit: boolean | null;
    navDate: string;
}

export interface PortfolioSummary {
    holdings: HoldingItem[];
    totalCost: number;
    totalValue: number;
    totalProfit: number;
    totalProfitRate: number;
    dailyProfit: number;
    profitCount: number;
    lossCount: number;
    navDate: string;
    hasData: boolean;
    message?: string;
}

export interface NavHistory {
    date: string;
    nav: number;
    dailyReturn: number | null;
}

export interface TransactionRecord {
    date: string;
    type: string;
    shares: number;
    price: number;
    amount: number;
}

export interface HoldingDetail {
    fundCode: string;
    fundName: string;
    category: string | null;
    manager: string | null;
    company: string | null;
    shares: number;
    costPrice: number;
    totalCost: number;
    buyDate: string;
    holdingDays: number;
    currentNav: number;
    currentValue: number;
    totalProfit: number;
    profitRate: number;
    navHistory: NavHistory[];
    transactions: TransactionRecord[];
}

// ==================== Tool 实现 ====================

/**
 * Tool: get_portfolio_summary
 * 获取所有持仓的汇总收益情况
 */
export async function getPortfolioSummary(): Promise<PortfolioSummary> {
    // 获取所有持仓
    const holdings = await prisma.userHolding.findMany({
        orderBy: { createdAt: 'asc' },
    });

    if (holdings.length === 0) {
        return {
            holdings: [],
            totalCost: 0,
            totalValue: 0,
            totalProfit: 0,
            totalProfitRate: 0,
            dailyProfit: 0,
            profitCount: 0,
            lossCount: 0,
            navDate: '',
            hasData: false,
            message: '暂无持仓记录',
        };
    }

    // 批量获取每只基金的最新两个交易日净值
    const fundCodes = holdings.map(h => h.fundCode);
    const holdingItems: HoldingItem[] = [];
    let latestNavDate = '';

    for (const holding of holdings) {
        const navRecords = await prisma.fundNav.findMany({
            where: { fundCode: holding.fundCode },
            orderBy: { navDate: 'desc' },
            take: 2,
        });

        const shares = Number(holding.shares);
        const costPrice = Number(holding.costPrice);

        if (navRecords.length === 0) {
            // 净值数据不存在，仍然保留持仓，但净值相关字段为空
            holdingItems.push({
                fundCode: holding.fundCode,
                fundName: holding.fundName,
                shares,
                costPrice,
                totalCost: Math.round(shares * costPrice * 100) / 100,
                currentNav: null as any,  // 未获取
                currentValue: null as any,  // 未获取
                totalProfit: null as any,  // 未获取
                profitRate: null as any,  // 未获取
                dailyProfit: null as any,  // 未获取
                isProfit: null as any,  // 未获取
                navDate: '未获取',
            });
            continue;
        }

        const latestNav = navRecords[0];
        const prevNav = navRecords[1];

        const currentNav = Number(latestNav.unitNav);

        const totalCost = shares * costPrice;
        const currentValue = shares * currentNav;
        const totalProfit = currentValue - totalCost;
        const profitRate = totalCost > 0 ? (totalProfit / totalCost) * 100 : 0;
        const dailyProfit = prevNav
            ? shares * (currentNav - Number(prevNav.unitNav))
            : 0;

        const navDateStr = latestNav.navDate.toISOString().split('T')[0];
        if (!latestNavDate || navDateStr > latestNavDate) {
            latestNavDate = navDateStr;
        }

        holdingItems.push({
            fundCode: holding.fundCode,
            fundName: holding.fundName,
            shares,
            costPrice,
            totalCost: Math.round(totalCost * 100) / 100,
            currentNav,
            currentValue: Math.round(currentValue * 100) / 100,
            totalProfit: Math.round(totalProfit * 100) / 100,
            profitRate: Math.round(profitRate * 100) / 100,
            dailyProfit: Math.round(dailyProfit * 100) / 100,
            isProfit: totalProfit >= 0,
            navDate: navDateStr,
        });
    }

    const totalCost = holdingItems.reduce((s, h) => s + h.totalCost, 0);
    const totalValue = holdingItems.reduce((s, h) => s + (h.currentValue || 0), 0);
    const totalProfit = totalValue - totalCost;
    const totalProfitRate = totalCost > 0 ? (totalProfit / totalCost) * 100 : 0;
    const dailyProfit = holdingItems.reduce((s, h) => s + (h.dailyProfit || 0), 0);

    return {
        holdings: holdingItems,
        totalCost: Math.round(totalCost * 100) / 100,
        totalValue: Math.round(totalValue * 100) / 100,
        totalProfit: Math.round(totalProfit * 100) / 100,
        totalProfitRate: Math.round(totalProfitRate * 100) / 100,
        dailyProfit: Math.round(dailyProfit * 100) / 100,
        profitCount: holdingItems.filter(h => h.isProfit === true).length,
        lossCount: holdingItems.filter(h => !h.isProfit).length,
        navDate: latestNavDate,
        hasData: holdingItems.length > 0,
    };
}

/**
 * Tool: get_holding_detail
 * 获取单只基金的详细持仓信息
 */
export async function getHoldingDetail(fundCode: string): Promise<HoldingDetail | null> {
    const holding = await prisma.userHolding.findFirst({
        where: { fundCode },
        include: { transactions: { orderBy: { date: 'asc' } } },
    });

    if (!holding) return null;

    // 获取基金基础信息
    const fundBasic = await prisma.fundBasic.findUnique({
        where: { code: fundCode },
    });

    // 获取最新净值
    const latestNav = await prisma.fundNav.findFirst({
        where: { fundCode },
        orderBy: { navDate: 'desc' },
    });

    if (!latestNav) return null;

    // 获取近 30 个交易日净值走势
    const navHistory = await prisma.fundNav.findMany({
        where: { fundCode },
        orderBy: { navDate: 'desc' },
        take: 30,
    });

    const shares = Number(holding.shares);
    const costPrice = Number(holding.costPrice);
    const currentNav = Number(latestNav.unitNav);
    const totalCost = shares * costPrice;
    const currentValue = shares * currentNav;
    const totalProfit = currentValue - totalCost;
    const profitRate = totalCost > 0 ? (totalProfit / totalCost) * 100 : 0;

    const buyDate = holding.buyDate.toISOString().split('T')[0];
    const holdingDays = Math.floor(
        (Date.now() - holding.buyDate.getTime()) / (1000 * 60 * 60 * 24)
    );

    return {
        fundCode: holding.fundCode,
        fundName: holding.fundName,
        category: fundBasic?.category ?? null,
        manager: fundBasic?.manager ?? null,
        company: fundBasic?.company ?? null,
        shares,
        costPrice,
        totalCost: Math.round(totalCost * 100) / 100,
        buyDate,
        holdingDays,
        currentNav,
        currentValue: Math.round(currentValue * 100) / 100,
        totalProfit: Math.round(totalProfit * 100) / 100,
        profitRate: Math.round(profitRate * 100) / 100,
        navHistory: navHistory
            .reverse()
            .map(n => ({
                date: n.navDate.toISOString().split('T')[0],
                nav: Number(n.unitNav),
                dailyReturn: n.dailyReturn !== null ? Number(n.dailyReturn) : null,
            })),
        transactions: holding.transactions.map(t => ({
            date: t.date.toISOString().split('T')[0],
            type: t.type,
            shares: Number(t.shares),
            price: Number(t.price),
            amount: Number(t.amount),
        })),
    };
}

/**
 * 计算加权平均成本价
 * 买入时用加权平均，卖出时成本价不变
 */
export function calculateWeightedCost(
    currentShares: number,
    currentCostPrice: number,
    tradeShares: number,
    tradePrice: number,
    type: 'buy' | 'sell'
): number {
    if (type === 'sell') {
        return currentCostPrice; // 卖出不改变成本价
    }
    const totalCost = currentShares * currentCostPrice + tradeShares * tradePrice;
    const totalShares = currentShares + tradeShares;
    return totalShares > 0 ? totalCost / totalShares : tradePrice;
}
