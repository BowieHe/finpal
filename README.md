# FinPal - 基金投资助手

基于 Next.js + Python Scheduler + PostgreSQL 的基金数据分析应用。

## 🏗️ 架构

```
finpal/                        ← Next.js 项目（根目录）
├── src/                       ← Next.js 源码
│   ├── app/                   ← App Router
│   ├── components/            ← React 组件
│   └── lib/                   ← 工具库
├── prisma/                    ← Prisma Schema
├── package.json               ← Next.js 依赖
└── ...                        ← 其他 Next.js 文件

├── scheduler/                 ← Python 定时任务
│   ├── src/                   ← Python 源码
│   │   ├── main.py           ← FastAPI + Cron 入口
│   │   ├── api.py            ← HTTP 触发接口
│   │   ├── cron.py           ← 定时任务
│   │   ├── fetcher.py        ← akshare 数据拉取
│   │   └── database.py       ← PostgreSQL 写入
│   ├── pyproject.toml        ← Python 依赖
│   └── Dockerfile            ← 容器配置

└── docker-compose.yml         ← 一起启动所有服务
```

**架构说明**：
- **Next.js**（根目录）：前端展示、用户交互、数据查询（Prisma）
- **Python Scheduler**（scheduler/）：定时任务、数据拉取、HTTP 触发
- **PostgreSQL**：共享数据库，Next.js 读，Python 写

## 🚀 快速开始

### 1. 环境准备

```bash
# 安装前端依赖
pnpm install

# 安装 Python 依赖（开发时用）
cd scheduler
pip install -e ".[dev]"
# 或 uv sync
```

### 2. 启动 PostgreSQL

```bash
# 在项目根目录
docker compose up -d postgres
```

### 3. 初始化数据库（Prisma）

```bash
# 生成 Prisma Client
npx prisma generate

# 创建迁移（首次）
npx prisma migrate dev --name init
```

### 4. 启动 Scheduler

```bash
# Docker 方式（推荐）
docker compose up -d scheduler

# 或本地开发
cd scheduler
python -m src.main
```

### 5. 启动前端

```bash
# 项目根目录
pnpm dev
```

访问：
- 前端：http://localhost:3000
- Scheduler HTTP：http://localhost:8001

## 📚 常用命令

```bash
# Docker 操作
docker compose up -d          # 启动所有服务
docker compose logs -f        # 查看日志

# 数据库
npx prisma migrate dev        # 创建迁移
npx prisma generate           # 生成 Prisma Client
npx prisma studio             # 打开 Prisma Studio

# Scheduler 手动触发
curl -X POST http://localhost:8001/trigger
curl http://localhost:8001/stats

# 开发
pnpm dev                      # 前端开发
cd scheduler && python -m src.main  # Scheduler 本地开发
```

## 📊 API 接口

### Next.js (http://localhost:3000)

| 接口 | 描述 |
|------|------|
| `GET /api/funds` | 基金列表 |
| `GET /api/funds/:code` | 基金详情 |
| `GET /api/funds/:code/nav` | 净值历史 |

### Scheduler (http://localhost:8001)

| 接口 | 描述 |
|------|------|
| `POST /trigger` | 手动触发同步 |
| `GET /stats` | 数据库统计 |
| `GET /health` | 健康检查 |

## 🛠️ 技术栈

- **前端**：Next.js 14 + React + TypeScript + Tailwind CSS + Prisma
- **数据同步**：Python + FastAPI + akshare + APScheduler
- **数据库**：PostgreSQL
- **部署**：Docker Compose

## 📝 License

MIT
