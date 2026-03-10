# FinPal - 基金投资助手

基于 Next.js + Python Scheduler + PostgreSQL 的基金数据分析应用。

## 🏗️ 架构

```
┌─────────────────────────────────────────┐
│           Docker Compose                 │
│                                          │
│  ┌──────────────┐      ┌─────────────┐  │
│  │   Next.js    │      │  PostgreSQL │  │
│  │   (Web)      │◄────►│   :5432     │  │
│  │   Prisma     │  读   │             │  │
│  │   :3000      │      │   数据      │  │
│  └──────────────┘      └──────▲──────┘  │
│                               │          │
│  ┌──────────────┐             │  写     │
│  │   Python     │─────────────┘          │
│  │  Scheduler   │  定时 + HTTP触发       │
│  │  (Cron+API)  │  :8000 (映射到 8001)  │
│  └──────────────┘                       │
│                                          │
└─────────────────────────────────────────┘
```

**通信方式：**

- Next.js ↔ PostgreSQL：Prisma ORM 直接查询
- Python Scheduler → PostgreSQL：原始 SQL 写入
- 用户 → Scheduler：HTTP 触发（端口 8001）

## 🚀 快速开始

### 1. 环境准备

```bash
# 安装前端依赖
pnpm install

# 安装 Python 依赖（开发时用）
cd apps/scheduler
pip install -e ".[dev]"
```

### 2. 启动数据库

```bash
# 启动 PostgreSQL（华为云镜像）
pnpm up

# 或
docker compose up -d postgres
```

> 注意：使用华为云镜像 `swr.cn-north-4.myhuaweicloud.com/ddn-k8s/docker.io/postgres:18-alpine`

### 3. 初始化数据库（Prisma Migration）

```bash
# 生成 Prisma Client
pnpm db:generate

# 创建迁移（首次）
cd apps/web
npx prisma migrate dev --name init
```

### 4. 启动 Scheduler

```bash
# Docker 方式（推荐）
pnpm up

# 或本地开发
cd apps/scheduler
python -m src.main
```

### 5. 启动前端

```bash
pnpm dev:web
```

访问：

- 前端：http://localhost:3000
- Scheduler HTTP：http://localhost:8001
- Prisma Studio：http://localhost:5555（运行 `pnpm db:studio`）

## 📚 常用命令

```bash
# Docker 操作
pnpm up              # 启动所有服务
pnpm down            # 停止所有服务
pnpm logs            # 查看日志

# 数据库
pnpm db:migrate      # 创建迁移
pnpm db:generate     # 生成 Prisma Client
pnpm db:studio       # 打开 Prisma Studio

# Scheduler 手动触发
pnpm scheduler:trigger   # POST /trigger
pnpm scheduler:stats     # GET /stats

# 开发
pnpm dev:web         # 前端开发
pnpm dev:scheduler   # Scheduler 本地开发
```

## 📊 API 接口

### Next.js (http://localhost:3000)

| 接口                               | 描述                                 |
| ---------------------------------- | ------------------------------------ |
| `GET /api/funds`                   | 基金列表（支持 `?keyword=xxx` 搜索） |
| `GET /api/funds/:code`             | 基金详情（含最近净值）               |
| `GET /api/funds/:code/nav?days=30` | 净值历史                             |

### Scheduler (http://localhost:8001)

| 接口            | 描述         |
| --------------- | ------------ |
| `POST /trigger` | 手动触发同步 |
| `GET /stats`    | 数据库统计   |
| `GET /health`   | 健康检查     |

## 📁 项目结构

```
finpal/
├── apps/
│   ├── web/                    # Next.js + Prisma
│   │   ├── src/
│   │   │   ├── app/api/funds/  # 基金 API 路由
│   │   │   └── lib/prisma.ts   # Prisma Client
│   │   ├── prisma/
│   │   │   └── schema.prisma   # 数据库 Schema
│   │   └── package.json
│   │
│   └── scheduler/              # Python 定时任务
│       ├── src/
│       │   ├── main.py         # 入口
│       │   ├── cron.py         # 定时任务
│       │   ├── api.py          # HTTP 触发
│       │   ├── database.py     # 原始 SQL
│       │   └── fetcher.py      # akshare 拉取
│       └── Dockerfile
│
├── docker-compose.yml          # 三件套：web + scheduler + postgres
└── README.md
```

## 🔄 数据流

1. **Scheduler** 每天 18:00 自动从 akshare 拉取基金数据
2. **Scheduler** 用原始 SQL 写入 PostgreSQL
3. **Next.js** 通过 Prisma 读取 PostgreSQL 展示给用户
4. **手动触发**：用户可调用 `POST http://localhost:8001/trigger`

## 🛠️ 技术栈

- **前端**：Next.js 14 + React + TypeScript + Tailwind CSS
- **ORM**：Prisma
- **数据库**：PostgreSQL 18 (华为云镜像)
- **数据同步**：Python + akshare + APScheduler
- **部署**：Docker Compose

## 📝 License

MIT
