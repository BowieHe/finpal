import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { FundNavSchema } from '@/lib/db-schema';

interface Params {
  params: Promise<{
    code: string
  }>
}

// 获取基金净值历史
export async function GET(request: Request, { params }: Params) {
  try {
    const { code } = await params;
    const { searchParams } = new URL(request.url);
    const days = parseInt(searchParams.get('days') || '30');
    
    // 计算起始日期
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    
    const result = await query(
      'SELECT * FROM fund_nav WHERE fund_code = $1 AND nav_date >= $2 ORDER BY nav_date DESC',
      [code, startDate]
    );
    
    const navs = result.rows.map(row => FundNavSchema.parse(row));
    
    return NextResponse.json({
      success: true,
      data: navs,
      fundCode: code,
    });
  } catch (error) {
    console.error('获取净值历史失败:', error)
    return NextResponse.json(
      { success: false, error: '获取净值历史失败' },
      { status: 500 }
    )
  }
}
