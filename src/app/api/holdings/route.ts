import { NextResponse } from 'next/server';
import { query, getClient } from '@/lib/db';
import { UserHoldingSchema, FundBasicSchema, HoldingTransactionSchema } from '@/lib/db-schema';
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
    const client = await getClient();
    try {
        const body = await req.json();
        const { fundCode, fundName: providedFundName, shares, price, date } = body;

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

        let fundName = providedFundName;
        if (!fundName) {
            const fundResult = await query('SELECT name FROM fund_basic WHERE code = $1', [fundCode]);
            fundName = fundResult.rows[0]?.name ?? fundCode;
        }

        const buyDate = date ? new Date(date) : new Date();
        const amount = sharesNum * priceNum;

        const existingResult = await query('SELECT * FROM user_holdings WHERE fund_code = $1', [fundCode]);
        const existing = existingResult.rows.length > 0 ? UserHoldingSchema.parse(existingResult.rows[0]) : null;

        let result;
        await client.query('BEGIN');

        if (existing) {
            const newCostPrice = calculateWeightedCost(
                existing.shares,
                existing.cost_price,
                sharesNum,
                priceNum,
                'buy'
            );

            const updateHoldingSql = `
                UPDATE user_holdings 
                SET shares = shares + $1, cost_price = $2, updated_at = NOW() 
                WHERE id = $3 
                RETURNING *
            `;
            const updatedHoldingRes = await client.query(updateHoldingSql, [sharesNum, newCostPrice, existing.id]);
            
            const insertTransSql = `
                INSERT INTO holding_transactions (holding_id, type, date, shares, price, amount, created_at)
                VALUES ($1, $2, $3, $4, $5, $6, NOW())
                RETURNING *
            `;
            const newTransRes = await client.query(insertTransSql, [existing.id, 'buy', buyDate, sharesNum, priceNum, amount]);

            await client.query('COMMIT');
            result = { 
                holding: UserHoldingSchema.parse(updatedHoldingRes.rows[0]), 
                transaction: HoldingTransactionSchema.parse(newTransRes.rows[0]) 
            };
        } else {
            const insertHoldingSql = `
                INSERT INTO user_holdings (fund_code, fund_name, shares, cost_price, buy_date, created_at, updated_at)
                VALUES ($1, $2, $3, $4, $5, NOW(), NOW())
                RETURNING *
            `;
            const newHoldingRes = await client.query(insertHoldingSql, [fundCode, fundName, sharesNum, priceNum, buyDate]);
            const newHolding = UserHoldingSchema.parse(newHoldingRes.rows[0]);

            const insertTransSql = `
                INSERT INTO holding_transactions (holding_id, type, date, shares, price, amount, created_at)
                VALUES ($1, $2, $3, $4, $5, $6, NOW())
                RETURNING *
            `;
            const newTransRes = await client.query(insertTransSql, [newHolding.id, 'buy', buyDate, sharesNum, priceNum, amount]);

            await client.query('COMMIT');
            result = { 
                holding: newHolding, 
                transaction: HoldingTransactionSchema.parse(newTransRes.rows[0]) 
            };
        }

        const schedulerUrl = process.env.SCHEDULER_URL || 'http://localhost:8000';
        fetch(`${schedulerUrl}/sync_one`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ fund_code: fundCode }),
        }).catch(err => console.error('触发 Scheduler 同步失败:', err));

        return NextResponse.json(result, { status: existing ? 200 : 201 });
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('POST /api/holdings error:', error);
        return NextResponse.json(
            { error: '新增持仓失败', details: String(error) },
            { status: 500 }
        );
    } finally {
        client.release();
    }
}
