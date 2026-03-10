import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'

interface Params {
  params: {
    code: string
  }
}

// 获取基金净值历史
export async function GET(request: Request, { params }: Params) {
  try {
    const { code } = params
    const { searchParams } = new URL(request.url)
    const days = parseInt(searchParams.get('days') || '30')
    
    // 计算起始日期
    const startDate = new Date()
    startDate.setDate(startDate.getDate() - days)
    
    const navs = await prisma.fundNav.findMany({
      where: {
        fundCode: code,
        navDate: {
          gte: startDate,
        },
      },
      orderBy: { navDate: 'desc' },
    })
    
    return NextResponse.json({
      success: true,
      data: navs,
      fundCode: code,
    })
  } catch (error) {
    console.error('获取净值历史失败:', error)
    return NextResponse.json(
      { success: false, error: '获取净值历史失败' },
      { status: 500 }
    )
  }
}
