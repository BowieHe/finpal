/**
 * /api/holdings/[id]/transactions - 交易记录 GET / POST
 */

import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

type Params = { params: Promise<{ id: string }> };

// GET /api/holdings/:id/transactions
export async function GET(_req: Request, { params }: Params) {
    const { id } = await params;
    try {
        const transactions = await prisma.holdingTransaction.findMany({
            where: { holdingId: id },
            orderBy: { date: 'desc' },
        });
        return NextResponse.json(transactions);
    } catch (error) {
        return NextResponse.json({ error: String(error) }, { status: 500 });
    }
}
