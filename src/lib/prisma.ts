import { PrismaClient } from '@prisma/client'

const globalForPrisma = global as unknown as { prisma: PrismaClient }

// 默认数据库连接（本地开发）
const defaultDatabaseUrl = 'postgresql://finpal:finpal@localhost:5432/finpal'

// 使用环境变量或默认值
const databaseUrl = process.env.DATABASE_URL || defaultDatabaseUrl

export const prisma = globalForPrisma.prisma || new PrismaClient({
  datasources: {
    db: {
      url: databaseUrl,
    },
  },
})

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma

export default prisma
