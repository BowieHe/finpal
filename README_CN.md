# FinPal — AI 智能投资助手

> 基于 **Next.js** + **LangGraph** + **PostgreSQL** 的智能基金投资分析应用。FinPal 编排一组专业化 AI Agent 团队，实时分析持仓、搜索市场情报、进行多轮多空辩论，最终输出结构化投资建议。

![FinPal](finpal-homepage.png)

[English](README.md)

---

## ✨ 核心特性

- **智能分析决策 (Scouts & Wisdom Node)**：双分析师（乐观 vs 悲观）辩论模型，通过 CIO 调度层实现高效的数据采集与数学期望 (EV) 裁决。
- **动态投资画像 (Karma Collection)**：基于业力记录 (KarmaLog) 的叠加态分析，利用递归合成技术生成不断进化的个人投资性格。
- **截图分析 (Vision Analysis)**：支持上传基金持仓截图，自动提取资产数据并分析交易时机与风格细节。

---

## 🏗️ 系统架构

```
用户提问
   │
   ▼
┌────────────────────────────────────────────────────────┐
│                CIO 首席投资官 Agent                      │
│      意图识别 → 动态任务拆解 → 按需派发                   │
└────────────────────┬───────────────────────────────────┘
                     │ Send API (Fan-out 并行)
          ┌──────────┼──────────────┐
          ▼          ▼              ▼
    [持仓专员]   [侦察专员 ×N]   [量化专员]
    DB-Agent    Web-Agent       Quant-Agent
    数据库查询   每只基金独立搜索  风险指标计算
          └──────────┼──────────────┘
                     ▼ Fan-in 数据汇总
              [Gate Keeper]
              数据质量检验 + 路由决策
                     │
         ┌───────────┴───────────┐
      简单查询              复杂分析
         │                       │
    直接摘要输出           ┌──────▼──────┐
         │                │  辩论循环     │
         │                │ 🐂多头 ⚔️ 🐻空头
         │                │    ↓         │
         │                │ 轮次裁判      │ ← 继续/终止
         │                │    ↓ (循环)   │
         │                └──────┬──────┘
         │                       ▼
         │               最终裁决报告
         └───────────────────────┘
                     ▼
              结构化投资建议
```

### Agent 角色

| Agent | 职责 | 工具集 |
|-------|------|--------|
| **持仓专员** 🏦 | 数据库持仓查询 | `getPortfolioSummary`、`getHoldingDetail`、`compareFunds`、`getFundRiskMetrics` |
| **侦察专员** 🌐 | 网络情报搜索 | 百炼 MCP 搜索（基金信息、市场新闻、基金经理动态） |
| **量化专员** 📐 | 风险指标计算 | 纯 TypeScript 数学计算 — 夏普比率、最大回撤、波动率（无 LLM） |
| **轮次裁判** ⚖️ | 每轮辩论裁决 | 判断本轮胜负 + 是否继续辩论（最多 3 轮） |
| **最终裁决** 📋 | 生成结构化报告 | 输出 `FinalVerdict`：推荐操作、置信度、多空要点 |

---

## 🚀 快速开始

### 环境要求

- **Node.js** ≥ 18，**pnpm** ≥ 8
- **PostgreSQL** 14+（Docker 或本地安装）
- **Python** 3.11+ + [uv](https://docs.astral.sh/uv/)（仅 scheduler 需要）
- **OpenAI 兼容 API Key**（阿里云百炼 / OpenAI / DeepSeek 等）

### 1. 安装依赖

```bash
pnpm install
```

### 2. 配置环境变量

```bash
cp .env.local.example .env.local
# 编辑 .env.local，填入 API Key 和数据库连接
```

关键配置：

| 变量 | 说明 |
|------|------|
| `DATABASE_URL` | PostgreSQL 连接字符串 |
| `OPENAI_API_KEY` | LLM API Key |
| `OPENAI_BASE_URL` | API 地址（非 OpenAI 服务商时需配置） |
| `OPENAI_MODEL` | 模型名称（默认 `qwen-plus`） |
| `MCP_BAILIAN_API_KEY` | 阿里云百炼搜索 API Key |

### 3. 启动数据库

```bash
docker compose up -d postgres
# 数据库结构通过原生 SQL 管理
```

### 4. 启动开发服务器

```bash
pnpm dev
```

访问 **http://localhost:3000**

---

## 📁 项目结构

```
finpal/
├── src/
│   ├── app/                    # Next.js App Router
│   │   ├── page.tsx            # 主聊天页 + SSE 事件处理
│   │   └── api/chat/route.ts   # Chat API（SSE 流式推送）
│   ├── components/             # React UI 组件
│   │   ├── TimelineDebate.tsx   # 多空辩论时间线
│   │   ├── DeciderResult.tsx    # 最终裁决卡片
│   │   ├── ResearchResults.tsx  # Agent 协作面板
│   │   ├── RoundDecisionCard.tsx# 每轮裁决卡片
│   │   ├── MessageCard.tsx      # 聊天消息气泡
│   │   └── ChatInput.tsx        # 输入框（Shift+Enter 换行）
│   ├── lib/
│   │   ├── agents/             # Sub-Agent 实现
│   │   │   ├── db-agent.ts      # 持仓专员
│   │   │   ├── web-agent.ts     # 侦察专员
│   │   │   └── quant-agent.ts   # 量化专员
│   │   ├── graph/              # LangGraph 编排
│   │   │   ├── graph.ts         # 图定义（辩论循环）
│   │   │   ├── state.ts         # 状态注解
│   │   │   ├── nodes.ts         # 辩论 + 裁判 + 最终裁决节点
│   │   │   ├── nodes/agent-adapters.ts  # Agent 适配器
│   │   │   └── cio/            # CIO 调度层
│   │   │       ├── intent-planner.ts  # 意图拆解
│   │   │       ├── gate-keeper.ts     # 质量检验 + 路由
│   │   │       └── direct-summary.ts  # 简单查询直出
│   │   ├── tools/              # 数据库工具
│   │   ├── mcp/                # MCP 搜索集成
│   │   └── llm/                # LLM 客户端 + 流式输出
│   └── types/                  # TypeScript 类型定义
├── scheduler/                  # Python 数据同步服务
│   └── src/                    # 基金净值抓取 + 定时任务
├── src/                    # 应用源码
└── docker-compose.yml          # PostgreSQL + 服务编排
```

---

## 🔧 常用命令

```bash
# 开发
pnpm dev                        # 启动开发服务器（含 Postgres）
pnpm dev:web                    # 仅启动 Next.js

# 数据库
# 使用你喜欢的 SQL 工具或脚本

# 测试
pnpm test                       # 运行单元测试（vitest）
pnpm typecheck                  # TypeScript 类型检查

# Docker
pnpm up                         # 启动所有服务
pnpm down                       # 停止所有服务
pnpm logs                       # 查看服务日志
```

---

## ⚙️ 配置与使用注意事项

### 1. 环境变量 (`.env.local`)

FinPal 需要配置以下关键变量才能正常运行。请将 `.env.local.example` 复制为 `.env.local` 并填写：

- **LLM 设置**: 控制助手的大脑。
  - `OPENAI_API_KEY`: 你的大模型 API 密钥。
  - `OPENAI_BASE_URL`: API 端点（例如：阿里云百炼 `https://dashscope.aliyuncs.com/compatible-mode/v1` 或 DeepSeek `https://api.deepseek.com`）。
  - `OPENAI_MODEL`: 模型名称（例如：`qwen-plus`、`deepseek-reasoner`）。
- **搜索设置**:
  - `DASHSCOPE_API_KEY`: **必须配置**，用于 `侦察专员` 通过阿里云百炼执行搜索。
- **数据库**:
  - `DATABASE_URL`: `postgresql://finpal:finpal@localhost:5432/finpal`（与默认 Docker 配置一致）。

### 2. 手动启动步骤

如果 `pnpm dev` 自动启动失败，请按顺序执行：
```bash
# 1. 启动数据库
docker compose up -d postgres

# 2. 同步数据库结构
# (使用 SQL 脚本或迁移工具)

# 3. (可选) 启动数据同步服务
cd scheduler && uv sync && uv run -m src.main
```

### 3. 重要提示

- **网络代理**: 如果在国内环境访问 OpenAI/DeepSeek 慢，请在 `.env.local` 中配置 `HTTP_PROXY` 和 `HTTPS_PROXY`。
- **搜索引擎**: 系统默认使用通过 MCP 接入的 `bailian-websearch`。请确保你的 `DASHSCOPE_API_KEY` 在百炼控制台已开通搜索增强能力。
- **端口冲突**: Next.js 占用 `3000`，Postgres 占用 `5432`，Python Scheduler 占用 `8001`。请确保这些端口未被占用。
- **推理能力**: 强烈建议在辩论节点使用 `deepseek-reasoner` (R1) 或 `qwen-max` 等具备强推理能力的模型以获得更好的分析效果。

---

## 🛠️ 技术栈

| 层级 | 技术 |
|------|------|
| **前端** | Next.js 16、React 19、TypeScript、Tailwind CSS 4 |
| **AI 编排** | LangGraph (LangChain.js)、OpenAI 兼容 LLM |
| **搜索** | 阿里云百炼 MCP（Model Context Protocol） |
| **数据库** | PostgreSQL + 原生 SQL (pg) + Zod |
| **数据同步** | Python + FastAPI + akshare + APScheduler |
| **可视化** | Mermaid.js 图表、ReactMarkdown |
| **部署** | Docker Compose |

---

## 📜 License

MIT
