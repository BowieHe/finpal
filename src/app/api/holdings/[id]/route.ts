import { NextResponse } from 'next/server';
import { query, getClient } from '@/lib/db';
import { UserHoldingSchema, HoldingTransactionSchema } from '@/lib/db-schema';
import { getHoldingDetail, calculateWeightedCost } from '@/lib/tools/portfolio';

type Params = { params: Promise<{ id: string }> };

// GET /api/holdings/:id - 单只持仓详情
export async function GET(_req: Request, { params }: Params) {
    const { id } = await params;
    try {
        const result = await query('SELECT * FROM user_holdings WHERE id = $1', [id]);
        if (result.rows.length === 0) {
            return NextResponse.json({ error: '持仓不存在' }, { status: 404 });
        }
        const holding = UserHoldingSchema.parse(result.rows[0]);
        const detail = await getHoldingDetail(holding.fund_code);
        return NextResponse.json(detail);
    } catch (error) {
        return NextResponse.json({ error: String(error) }, { status: 500 });
    }
}

// PUT /api/holdings/:id - 更新持仓（追加买入/卖出，修正份额）
export async function PUT(req: Request, { params }: Params) {
    const { id } = await params;
    const client = await getClient();
    try {
        const body = await req.json();
        const { type, shares, price, date } = body;

        if (!type || !shares || !price) {
            return NextResponse.json(
                { error: '缺少必要参数：type(buy|sell), shares, price' },
                { status: 400 }
            );
        }

        const holdingResult = await client.query('SELECT * FROM user_holdings WHERE id = $1', [id]);
        if (holdingResult.rows.length === 0) {
            return NextResponse.json({ error: '持仓不存在' }, { status: 404 });
        }
        const holding = UserHoldingSchema.parse(holdingResult.rows[0]);

        const sharesNum = Number(shares);
        const priceNum = Number(price);
        const currentShares = holding.shares;

        if (type === 'sell' && sharesNum > currentShares) {
            return NextResponse.json(
                { error: `卖出份额 ${sharesNum} 超出持仓份额 ${currentShares}` },
                { status: 400 }
            );
        }

        const newCostPrice = calculateWeightedCost(
            currentShares,
            holding.cost_price,
            sharesNum,
            priceNum,
            type as 'buy' | 'sell'
        );

        const newShares = type === 'buy' ? currentShares + sharesNum : currentShares - sharesNum;
        const tradeDate = date ? new Date(date) : new Date();
        const amount = sharesNum * priceNum;

        await client.query('BEGIN');
        
        const updateSql = `
            UPDATE user_holdings 
            SET shares = $1, cost_price = $2, updated_at = NOW() 
            WHERE id = $3 
            RETURNING *
        `;
        const updatedRes = await client.query(updateSql, [newShares, newCostPrice, id]);
        
        const insertTransSql = `
            INSERT INTO holding_transactions (holding_id, type, date, shares, price, amount, created_at)
            VALUES ($1, $2, $3, $4, $5, $6, NOW())
            RETURNING *
        `;
        const transRes = await client.query(insertTransSql, [id, type, tradeDate, sharesNum, priceNum, amount]);

        await client.query('COMMIT');

        return NextResponse.json({ 
            holding: UserHoldingSchema.parse(updatedRes.rows[0]), 
            transaction: HoldingTransactionSchema.parse(transRes.rows[0]) 
        });
    } catch (error) {
        await client.query('ROLLBACK');
        return NextResponse.json({ error: String(error) }, { status: 500 });
    } finally {
        client.release();
    }
}

// DELETE /api/holdings/:id - 删除持仓（Cascade 删除交易记录）
export async function DELETE(_req: Request, { params }: Params) {
    const { id } = await params;
    try {
        await query('DELETE FROM user_holdings WHERE id = $1', [id]);
        return NextResponse.json({ success: true });
    } catch (error) {
        return NextResponse.json({ error: String(error) }, { status: 500 });
    }
}
