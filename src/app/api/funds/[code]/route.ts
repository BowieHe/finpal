import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'

interface Params {
  params: Promise<{
    code: string
  }>
}

// 获取单只基金详情
export async function GET(request: Request, { params }: Params) {
  try {
    const { code } = await params
    
    const fund = await prisma.fundBasic.findUnique({
      where: { code },
      include: {
        navs: {
          orderBy: { navDate: 'desc' },
          take: 30, // 最近 30 天净值
        },
      },
    })
    
    if (!fund) {
      return NextResponse.json(
        { success: false, error: '基金不存在' },
        { status: 404 }
      )
    }
    
    return NextResponse.json({
      success: true,
      data: fund,
    })
  } catch (error) {
    console.error('获取基金详情失败:', error)
    return NextResponse.json(
      { success: false, error: '获取基金详情失败' },
      { status: 500 }
    )
  }
}
