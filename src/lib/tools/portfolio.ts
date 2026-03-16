import { query } from '@/lib/db';
import { UserHoldingSchema, FundNavSchema, FundBasicSchema, HoldingTransactionSchema } from '@/lib/db-schema';

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
    const holdingsResult = await query('SELECT * FROM user_holdings ORDER BY created_at ASC');
    const holdings = holdingsResult.rows.map(row => UserHoldingSchema.parse(row));

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

    const holdingItems: HoldingItem[] = [];
    let latestNavDateStr = '';

    for (const holding of holdings) {
        // 获取最近两个交易日的净值
        const navResult = await query(
            'SELECT * FROM fund_nav WHERE fund_code = $1 ORDER BY nav_date DESC LIMIT 2',
            [holding.fund_code]
        );
        const navRecords = navResult.rows.map(row => FundNavSchema.parse(row));

        const shares = holding.shares;
        const costPrice = holding.cost_price;

        if (navRecords.length === 0) {
            holdingItems.push({
                fundCode: holding.fund_code,
                fundName: holding.fund_name,
                shares,
                costPrice,
                totalCost: Math.round(shares * costPrice * 100) / 100,
                currentNav: null,
                currentValue: null,
                totalProfit: null,
                profitRate: null,
                dailyProfit: null,
                isProfit: null,
                navDate: '未获取',
            });
            continue;
        }

        const latestNav = navRecords[0];
        const prevNav = navRecords[1];

        const currentNav = latestNav.unit_nav;
        const totalCost = shares * costPrice;
        const currentValue = shares * currentNav;
        const totalProfit = currentValue - totalCost;
        const profitRate = totalCost > 0 ? (totalProfit / totalCost) * 100 : 0;
        const dailyProfit = prevNav
            ? shares * (currentNav - prevNav.unit_nav)
            : 0;

        const navDateStr = latestNav.nav_date.toISOString().split('T')[0];
        if (!latestNavDateStr || navDateStr > latestNavDateStr) {
            latestNavDateStr = navDateStr;
        }

        holdingItems.push({
            fundCode: holding.fund_code,
            fundName: holding.fund_name,
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
        lossCount: holdingItems.filter(h => h.isProfit === false).length,
        navDate: latestNavDateStr,
        hasData: holdingItems.length > 0,
    };
}

/**
 * Tool: get_holding_detail
 * 获取单只基金的详细持仓信息
 */
export async function getHoldingDetail(fundCode: string): Promise<HoldingDetail | null> {
    const holdingResult = await query('SELECT * FROM user_holdings WHERE fund_code = $1', [fundCode]);
    if (holdingResult.rows.length === 0) return null;
    const holding = UserHoldingSchema.parse(holdingResult.rows[0]);

    // 获取交易记录
    const transResult = await query(
        'SELECT * FROM holding_transactions WHERE holding_id = $1 ORDER BY date ASC',
        [holding.id]
    );
    const transactions = transResult.rows.map(row => HoldingTransactionSchema.parse(row));

    // 获取基金基础信息
    const fundBasicResult = await query('SELECT * FROM fund_basic WHERE code = $1', [fundCode]);
    const fundBasic = fundBasicResult.rows.length > 0 ? FundBasicSchema.parse(fundBasicResult.rows[0]) : null;

    // 获取最新净值
    const latestNavResult = await query(
        'SELECT * FROM fund_nav WHERE fund_code = $1 ORDER BY nav_date DESC LIMIT 1',
        [fundCode]
    );
    if (latestNavResult.rows.length === 0) return null;
    const latestNav = FundNavSchema.parse(latestNavResult.rows[0]);

    // 获取近 30 个交易日净值走势
    const historyResult = await query(
        'SELECT * FROM fund_nav WHERE fund_code = $1 ORDER BY nav_date DESC LIMIT 30',
        [fundCode]
    );
    const navHistory = historyResult.rows.map(row => FundNavSchema.parse(row));

    const shares = holding.shares;
    const costPrice = holding.cost_price;
    const currentNav = latestNav.unit_nav;
    const totalCost = shares * costPrice;
    const currentValue = shares * currentNav;
    const totalProfit = currentValue - totalCost;
    const profitRate = totalCost > 0 ? (totalProfit / totalCost) * 100 : 0;

    const buyDate = holding.buy_date.toISOString().split('T')[0];
    const holdingDays = Math.floor(
        (Date.now() - holding.buy_date.getTime()) / (1000 * 60 * 60 * 24)
    );

    return {
        fundCode: holding.fund_code,
        fundName: holding.fund_name,
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
                date: n.nav_date.toISOString().split('T')[0],
                nav: n.unit_nav,
                dailyReturn: n.daily_return,
            })),
        transactions: transactions.map(t => ({
            date: t.date.toISOString().split('T')[0],
            type: t.type,
            shares: t.shares,
            price: t.price,
            amount: t.amount,
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
