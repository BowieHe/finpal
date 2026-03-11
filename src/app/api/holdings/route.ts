/**
 * /api/holdings - 持仓列表 GET / 新增持仓 POST
 */

import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getPortfolioSummary, calculateWeightedCost } from '@/lib/tools/portfolio';

// GET /api/holdings - 获取所有持仓（含实时收益计算）
export async function GET() {
    try {
        const summary = await getPortfolioSummary();
        return NextResponse.json(summary);
    } catch (error) {
        console.error('GET /api/holdings error:', error);
        return NextResponse.json(
            { error: '获取持仓失败', details: String(error) },
            { status: 500 }
        );
    }
}

// POST /api/holdings - 新增持仓
export async function POST(req: Request) {
    try {
        const body = await req.json();
        const { fundCode, shares, price, date } = body;

        if (!fundCode || !shares || !price) {
            return NextResponse.json(
                { error: '缺少必要参数：fundCode, shares, price' },
                { status: 400 }
            );
        }

        const sharesNum = Number(shares);
        const priceNum = Number(price);

        if (isNaN(sharesNum) || sharesNum <= 0) {
            return NextResponse.json({ error: '份额必须为正数' }, { status: 400 });
        }
        if (isNaN(priceNum) || priceNum <= 0) {
            return NextResponse.json({ error: '成本价必须为正数' }, { status: 400 });
        }

        // 获取基金名称（从 fund_basic 查，如果没有就用 fundCode 代替）
        const fundBasic = await prisma.fundBasic.findUnique({
            where: { code: fundCode },
        });
        const fundName = fundBasic?.name ?? fundCode;

        const buyDate = date ? new Date(date) : new Date();
        const amount = sharesNum * priceNum;

        // 判断是否已有该基金的持仓（分批买入）
        const existing = await prisma.userHolding.findFirst({
            where: { fundCode },
        });

        if (existing) {
            // 追加买入：加权平均成本
            const newCostPrice = calculateWeightedCost(
                Number(existing.shares),
                Number(existing.costPrice),
                sharesNum,
                priceNum,
                'buy'
            );

            const updated = await prisma.$transaction([
                prisma.userHolding.update({
                    where: { id: existing.id },
                    data: {
                        shares: Number(existing.shares) + sharesNum,
                        costPrice: newCostPrice,
                    },
                }),
                prisma.holdingTransaction.create({
                    data: {
                        holdingId: existing.id,
                        type: 'buy',
                        date: buyDate,
                        shares: sharesNum,
                        price: priceNum,
                        amount,
                    },
                }),
            ]);

            return NextResponse.json({ holding: updated[0], transaction: updated[1] });
        } else {
            // 新建持仓
            const holding = await prisma.userHolding.create({
                data: {
                    fundCode,
                    fundName,
                    shares: sharesNum,
                    costPrice: priceNum,
                    buyDate,
                    transactions: {
                        create: {
                            type: 'buy',
                            date: buyDate,
                            shares: sharesNum,
                            price: priceNum,
                            amount,
                        },
                    },
                },
                include: { transactions: true },
            });

            return NextResponse.json({ holding }, { status: 201 });
        }
    } catch (error) {
        console.error('POST /api/holdings error:', error);
        return NextResponse.json(
            { error: '新增持仓失败', details: String(error) },
            { status: 500 }
        );
    }
}
