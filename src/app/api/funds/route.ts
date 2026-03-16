import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { FundBasicSchema } from '@/lib/db-schema';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const keyword = searchParams.get('keyword') || '';
    const limit = parseInt(searchParams.get('limit') || '100');
    
    let result;
    if (keyword) {
      result = await query(
        'SELECT * FROM fund_basic WHERE code LIKE $1 OR name LIKE $1 ORDER BY code ASC LIMIT $2',
        [`%${keyword}%`, limit]
      );
    } else {
      result = await query('SELECT * FROM fund_basic ORDER BY code ASC LIMIT $1', [limit]);
    }
    
    const funds = result.rows.map(row => FundBasicSchema.parse(row));
    
    return NextResponse.json({
      success: true,
      data: funds,
      total: funds.length,
    });
  } catch (error) {
    console.error('获取基金列表失败:', error);
    return NextResponse.json(
      { success: false, error: '获取基金列表失败' },
      { status: 500 }
    );
  }
}
