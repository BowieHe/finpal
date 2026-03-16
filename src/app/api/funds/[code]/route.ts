import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { FundBasicSchema, FundNavSchema } from '@/lib/db-schema';

interface Params {
  params: Promise<{
    code: string
  }>
}

// 获取单只基金详情
export async function GET(request: Request, { params }: Params) {
  try {
    const { code } = await params;
    
    const fundResult = await query('SELECT * FROM fund_basic WHERE code = $1', [code]);
    
    if (fundResult.rows.length === 0) {
      return NextResponse.json(
        { success: false, error: '基金不存在' },
        { status: 404 }
      )
    }
    
    const fund = FundBasicSchema.parse(fundResult.rows[0]);
    
    // 获取最近 30 天净值
    const navResult = await query(
      'SELECT * FROM fund_nav WHERE fund_code = $1 ORDER BY nav_date DESC LIMIT 30',
      [code]
    );
    const navs = navResult.rows.map(row => FundNavSchema.parse(row));
    
    return NextResponse.json({
      success: true,
      data: {
        ...fund,
        navs,
      },
    })
  } catch (error) {
    console.error('获取基金详情失败:', error)
    return NextResponse.json(
      { success: false, error: '获取基金详情失败' },
      { status: 500 }
    )
  }
}
