import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { HoldingTransactionSchema } from '@/lib/db-schema';

type Params = { params: Promise<{ id: string }> };

// GET /api/holdings/:id/transactions
export async function GET(_req: Request, { params }: Params) {
    const { id } = await params;
    try {
        const result = await query(
            'SELECT * FROM holding_transactions WHERE holding_id = $1 ORDER BY date DESC',
            [id]
        );
        const transactions = result.rows.map(row => HoldingTransactionSchema.parse(row));
        return NextResponse.json(transactions);
    } catch (error) {
        return NextResponse.json({ error: String(error) }, { status: 500 });
    }
}
