/**
 * /api/holdings/[id] - 单条持仓 PUT / DELETE / GET 详情
 */

import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getHoldingDetail, calculateWeightedCost } from '@/lib/tools/portfolio';

type Params = { params: Promise<{ id: string }> };

// GET /api/holdings/:id - 单只持仓详情
export async function GET(_req: Request, { params }: Params) {
    const { id } = await params;
    try {
        const holding = await prisma.userHolding.findUnique({ where: { id } });
        if (!holding) {
            return NextResponse.json({ error: '持仓不存在' }, { status: 404 });
        }
        const detail = await getHoldingDetail(holding.fundCode);
        return NextResponse.json(detail);
    } catch (error) {
        return NextResponse.json({ error: String(error) }, { status: 500 });
    }
}

// PUT /api/holdings/:id - 更新持仓（追加买入/卖出，修正份额）
export async function PUT(req: Request, { params }: Params) {
    const { id } = await params;
    try {
        const body = await req.json();
        const { type, shares, price, date } = body;

        if (!type || !shares || !price) {
            return NextResponse.json(
                { error: '缺少必要参数：type(buy|sell), shares, price' },
                { status: 400 }
            );
        }

        const holding = await prisma.userHolding.findUnique({ where: { id } });
        if (!holding) {
            return NextResponse.json({ error: '持仓不存在' }, { status: 404 });
        }

        const sharesNum = Number(shares);
        const priceNum = Number(price);
        const currentShares = Number(holding.shares);

        if (type === 'sell' && sharesNum > currentShares) {
            return NextResponse.json(
                { error: `卖出份额 ${sharesNum} 超出持仓份额 ${currentShares}` },
                { status: 400 }
            );
        }

        const newCostPrice = calculateWeightedCost(
            currentShares,
            Number(holding.costPrice),
            sharesNum,
            priceNum,
            type as 'buy' | 'sell'
        );

        const newShares = type === 'buy' ? currentShares + sharesNum : currentShares - sharesNum;
        const tradeDate = date ? new Date(date) : new Date();
        const amount = sharesNum * priceNum;

        const [updatedHolding, transaction] = await prisma.$transaction([
            prisma.userHolding.update({
                where: { id },
                data: {
                    shares: newShares,
                    costPrice: newCostPrice,
                },
            }),
            prisma.holdingTransaction.create({
                data: {
                    holdingId: id,
                    type,
                    date: tradeDate,
                    shares: sharesNum,
                    price: priceNum,
                    amount,
                },
            }),
        ]);

        return NextResponse.json({ holding: updatedHolding, transaction });
    } catch (error) {
        return NextResponse.json({ error: String(error) }, { status: 500 });
    }
}

// DELETE /api/holdings/:id - 删除持仓（Cascade 删除交易记录）
export async function DELETE(_req: Request, { params }: Params) {
    const { id } = await params;
    try {
        await prisma.userHolding.delete({ where: { id } });
        return NextResponse.json({ success: true });
    } catch (error) {
        return NextResponse.json({ error: String(error) }, { status: 500 });
    }
}
