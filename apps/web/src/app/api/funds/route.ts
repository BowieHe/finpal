import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const keyword = searchParams.get('keyword') || ''
    const limit = parseInt(searchParams.get('limit') || '100')
    
    let funds
    
    if (keyword) {
      // 搜索模式
      funds = await prisma.fundBasic.findMany({
        where: {
          OR: [
            { code: { contains: keyword } },
            { name: { contains: keyword } },
          ],
        },
        take: limit,
        orderBy: { code: 'asc' },
      })
    } else {
      // 列表模式
      funds = await prisma.fundBasic.findMany({
        take: limit,
        orderBy: { code: 'asc' },
      })
    }
    
    return NextResponse.json({
      success: true,
      data: funds,
      total: funds.length,
    })
  } catch (error) {
    console.error('获取基金列表失败:', error)
    return NextResponse.json(
      { success: false, error: '获取基金列表失败' },
      { status: 500 }
    )
  }
}
