# FinPal — AI 智能投资助手

> 基于 **Next.js** + **LangGraph** + **DeepAgents** 的智能基金投资分析应用。FinPal 使用自主代理（DeepAgent）实时分析持仓、搜索市场情报、进行多空辩论，最终输出结构化投资建议。

![FinPal](finpal-homepage.png)

[English](README.md)

---

## ✨ 核心特性

- **深度代理架构 (DeepAgent)** — 单一自主代理，能够规划研究策略、执行技能、自我纠错，通过多步推理完成任务
- **多空对抗辩论** — 内置多头/空头分析，生成综合结论和期望值(EV)计算
- **实时流式界面** — 基于 SSE 的时间线，实时展示代理推理过程和辩论结果
- **双搜索策略** — MCP 网页搜索 + DuckDuckGo 自动回退，确保信息获取可靠
- **持仓管理** — 跟踪基金持仓成本、实时净值更新和风险指标

---

## 🏗️ 系统架构

```
用户提问
   │
   ▼
┌────────────────────────────────────────────────────────┐
│                    DeepAgent 节点                       │
│  ┌────────────────────────────────────────────────┐    │
│  │                自主推理循环                     │    │
│  │                                                 │    │
│  │   ┌─────────┐    ┌─────────┐    ┌─────────┐    │    │
│  │   │  规划   │───→│  执行   │───→│  观察   │    │    │
│  │   └────┬────┘    └────┬────┘    └────┬────┘    │    │
│  │        └────────────────┴────────────────┘      │    │
│  │                     │                           │    │
│  │                     ▼ (置信度 < 阈值)            │    │
│  │                ┌─────────┐                      │    │
│  │                │ 反思修正 │──────────────────────┘    │
│  │                └─────────┘  (迭代直至完成)              │
│  └────────────────────────────────────────────────┘    │
│                                                         │
│  使用的技能:                                             │
│  • fund-deep-search — 多查询网页研究                     │
│  • fund-debate      — 多头/空头分析 + EV计算             │
└────────────────────┬────────────────────────────────────┘
                     │
                     ▼
┌────────────────────────────────────────────────────────┐
│                  最终裁决节点                           │
│              格式化结构化投资报告                        │
│    (推荐操作、置信度、多空观点、风险提示)                  │
└────────────────────┬────────────────────────────────────┘
                     │
                     ▼
              结构化响应
                     │
    ┌────────────────┼────────────────┐
    ▼                ▼                ▼
   多头观点         空头观点         综合结论
   Optimistic    Pessimistic     Synthesis
```

### Agent 角色

| 组件 | 角色 | 说明 |
|------|------|------|
| **DeepAgent** 🧠 | 自主分析师 | 规划研究策略、执行搜索技能、执行多空辩论、综合最终结论 |
| **搜索技能** 🔍 | 信息检索 | 多查询网页搜索，使用 MCP + DuckDuckGo 回退 |
| **辩论技能** ⚔️ | 对抗分析 | 生成多头案例、空头案例和期望值计算 |
| **最终裁决** 📋 | 报告格式化 | 结构化输出：推荐操作、置信度、风险提示 |

---

## 🚀 快速开始

### 环境要求

- **Node.js** ≥ 18，**pnpm** ≥ 8
- **PostgreSQL** 14+（Docker 或本地安装）
- **OpenAI 兼容 API Key**（DeepSeek / OpenAI / 阿里云等）

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
| `OPENAI_BASE_URL` | API 地址（默认: `https://api.deepseek.com`） |
| `OPENAI_MODEL` | 模型名称（默认: `deepseek-chat`） |
| `MCP_BAILIAN_API_KEY` | 阿里云百炼搜索 API Key（可选） |

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
│   │   ├── MessageList.tsx      # 消息列表（含辩论卡片）
│   │   ├── PersonaCard.tsx      # 多头/空头观点卡片
│   │   ├── DeciderResult.tsx    # 最终裁决展示
│   │   ├── ResearchResults.tsx  # 搜索结果面板
│   │   ├── Sidebar.tsx          # 对话历史侧边栏
│   │   └── ChatInput.tsx        # 输入框（Shift+Enter 换行）
│   ├── lib/
│   │   ├── deepagent/          # 🆕 DeepAgent 实现
│   │   │   ├── index.ts         # Agent 工厂 + 核心类型
│   │   │   ├── agent.ts         # Agent 循环（规划→执行→观察）
│   │   │   ├── skills/          # 技能实现
│   │   │   │   ├── fund-deep-search.ts   # 多查询研究
│   │   │   │   └── fund-debate.ts        # 多头/空头分析
│   │   │   └── types.ts         # 技能接口定义
│   │   ├── graph/              # LangGraph 编排（简化版）
│   │   │   ├── graph.ts         # 2节点图: deepAgent → finalVerdict
│   │   │   ├── state.ts         # 图状态注解
│   │   │   └── nodes/           # 节点实现
│   │   │       ├── deep-agent-node.ts    # DeepAgent 包装器
│   │   │       └── final-verdict-node.ts # 报告格式化
│   │   ├── search/             # 搜索工具
│   │   │   ├── duckduckgo.ts    # DuckDuckGo 搜索回退
│   │   │   └── query-classifier.ts # 查询类型检测
│   │   ├── mcp/                # MCP 客户端管理
│   │   │   ├── manager.ts       # MCP 客户端生命周期
│   │   │   └── unified-search.ts # 统一搜索接口
│   │   └── llm/                # LLM 客户端
│   │       └── client.ts        # OpenAI 兼容客户端
│   └── types/                  # TypeScript 类型定义
├── scheduler/                  # Python 数据同步服务（可选）
│   └── src/                    # 基金净值抓取 + 定时任务
└── docker-compose.yml          # PostgreSQL + 服务编排
```

---

## 🔧 常用命令

```bash
# 开发
pnpm dev                        # 启动开发服务器（含 Postgres）

# 测试
pnpm test                       # 运行单元测试（vitest）
pnpm typecheck                  # TypeScript 类型检查

# 构建
pnpm build                      # 生产构建
```

---

## ⚙️ 配置与使用注意事项

### 1. 环境变量 (`.env.local`)

FinPal 需要以下配置：

- **LLM 设置**（必需）:
  - `OPENAI_API_KEY`: 大模型 API 密钥
  - `OPENAI_BASE_URL`: API 端点（默认: `https://api.deepseek.com`）
  - `OPENAI_MODEL`: 模型名称（默认: `deepseek-chat`）

- **搜索设置**（可选）:
  - `MCP_BAILIAN_API_KEY`: 阿里云百炼 API Key，用于增强搜索
  - 未配置时自动回退到 DuckDuckGo

- **数据库**（必需）:
  - `DATABASE_URL`: `postgresql://finpal:finpal@localhost:5432/finpal`

### 2. DeepAgent 工作原理

1. **规划**: 分析用户问题，制定研究计划
2. **执行**: 按顺序运行技能:
   - `fund-deep-search`: 通过网页搜索收集信息
   - `fund-debate`: 生成多头案例、空头案例和 EV 计算
3. **观察**: 评估结果，决定继续或结束
4. **反思**: 如果置信度低，修订计划重新执行
5. **完成**: 返回结构化分析结果给最终裁决节点

### 3. 重要提示

- **搜索引擎**: 系统优先尝试 MCP 百炼，自动回退到 DuckDuckGo
- **网络代理**: 如处于受限网络，可设置 `HTTP_PROXY` 和 `HTTPS_PROXY`
- **推理能力**: 推荐使用 DeepSeek 模型（`deepseek-chat`、`deepseek-reasoner`）获得最佳推理效果

---

## 🛠️ 技术栈

| 层级 | 技术 |
|------|------|
| **前端** | Next.js 16、React 19、TypeScript、Tailwind CSS 4 |
| **AI 编排** | LangGraph + DeepAgents（自主推理） |
| **搜索** | MCP（Model Context Protocol）+ DuckDuckGo 回退 |
| **数据库** | PostgreSQL + 原生 SQL |
| **数据同步** | Python + FastAPI + akshare（可选调度器） |
| **可视化** | React 组件 + Tailwind |
| **部署** | Docker Compose |

---

## 📜 License

MIT
