# FinPal 项目架构文档

## 项目概述

FinPal 是一个基于 **Next.js + LangGraph** 实现的 AI 双人格对话助手。它通过网页搜索获取信息，然后由两个不同视角的 LLM（乐观派和悲观派）对信息进行多角度解析，最后由一个裁决者总结并生成最终报告。

核心特色：
- 用户提出问题 → 智能搜索 → 乐观派分析 → 悲观派分析 → 双方反驳 → 裁决者总结
- 支持多源搜索（DuckDuckGo、MCP WebSearch）
- 查询智能分类（财经新闻、财经数据、百科、学术、政府、社区等）
- **并行执行**：乐观派和悲观派初始分析并行执行，减少响应时间
- **重试机制**：LLM 调用失败时自动重试
- **速率限制**：API 端点有请求频率限制
- **完善的类型**：完整的 TypeScript 类型定义

---

## 技术栈

| 技术 | 版本 | 用途 |
|------|------|------|
| Next.js | 16.1.6 | React 全栈框架 |
| React | 19.2.4 | UI 库 |
| TypeScript | 5.9.3 | 类型系统 |
| Tailwind CSS | 4.2.0 | 样式框架 |
| LangGraph | 1.1.5 | LLM 应用编排框架 |
| LangChain | 1.1.26 | LLM 交互基础 |
| MCP SDK | 1.27.1 | Model Context Protocol |
| Vitest | 4.x | 单元测试框架 |

---

## 核心架构流程

```
用户提问
    ↓
[Researcher] 研究员节点
    ├─→ LLM 生成 2-3 个搜索查询
    ├─→ Smart Search 智能搜索
    │       ├─→ 查询分类（general/finance_news/finance_data/...）
    │       ├─→ open-websearch MCP / DuckDuckGo
    │       └─→ MCP 失败时回退到 DuckDuckGo
    └─→ LLM 总结搜索结果
    ↓
[Optimistic] 乐观派初始观点 ──┐
    ├─→ 基于搜索结果从乐观角度分析    │ 并行执行
    └─→ 输出：thinking + answer      │
    ↓                                │
[Pessimistic] 悲观派初始观点 ────┘
    ├─→ 基于搜索结果从悲观角度分析
    └─→ 输出：thinking + answer
    ↓
[OptimisticRebuttal] 乐观派反驳
    ├─→ 针对悲观派观点进行反驳
    └─→ 输出：rebuttal
    ↓
[PessimisticRebuttal] 悲观派反驳
    ├─→ 针对乐观派观点（含反驳）进行反驳
    └─→ 输出：rebuttal
    ↓
[Decider] 裁决者
    ├─→ 判断是否需要继续辩论
    ├─→ 判定胜者（optimistic/pessimistic/draw）
    └─→ 生成辩论总结
    ↓
展示结果（前端 UI）
```

---

## 文件结构

```
finpal/
├── src/
│   ├── app/
│   │   ├── api/chat/route.ts      # 核心 API 端点，调用 LangGraph
│   │   ├── page.tsx               # 主页面（聊天界面）
│   │   ├── layout.tsx             # 全局布局
│   │   └── globals.css            # 全局样式
│   │
│   ├── components/                # React 组件
│   │   ├── ChatInput.tsx          # 输入框
│   │   ├── MessageList.tsx        # 消息列表（展示搜索结果 + 双人格回答）
│   │   ├── PersonaCard.tsx        # 人格卡片（乐观/悲观）
│   │   ├── DeciderResult.tsx      # 裁决结果展示
│   │   ├── ResearchResults.tsx    # 搜索结果展示
│   │   ├── Sidebar.tsx            # 侧边栏（对话历史）
│   │   ├── SettingsModal.tsx      # 设置弹窗
│   │   └── ...
│   │
│   ├── lib/                       # 核心逻辑
│   │   ├── graph/
│   │   │   ├── graph.ts           # LangGraph 定义（6 个节点的编排）
│   │   │   ├── nodes.ts           # 6 个节点的实现
│   │   │   └── state.ts           # 图状态定义
│   │   │
│   │   ├── search/
│   │   │   ├── duckduckgo.ts      # DuckDuckGo 搜索实现
│   │   │   ├── query-classifier.ts # 查询分类器（LLM + 规则）
│   │   │   └── specialized-sources.ts # 专业数据源配置
│   │   │
│   │   ├── mcp/
│   │   │   ├── manager.ts         # MCP 客户端管理器
│   │   │   ├── unified-search.ts  # 统一搜索接口
│   │   │   └── search-router.ts   # 搜索路由
│   │   │
│   │   ├── llm/
│   │   │   └── client.ts          # LLM 客户端（OpenAI/DeepSeek）
│   │   │
│   │   ├── conversation.ts        # 对话历史管理（localStorage）
│   │   └── config.ts              # 配置管理
│   │
│   ├── types/                     # TypeScript 类型定义
│   │   ├── conversation.ts        # 对话相关类型
│   │   ├── mcp.ts                 # MCP/搜索相关类型
│   │   └── config.ts              # 配置类型
│   │
│   └── utils/                     # 工具函数
│       └── format.ts
│
├── package.json
├── next.config.mjs
├── tailwind.config.ts
├── tsconfig.json
└── vitest.config.ts
```

---

## 关键文件详解

### 1. 图定义 (`src/lib/graph/graph.ts`)

定义了 6 个节点的流程，其中乐观派和悲观派节点**并行执行**：

```typescript
START → researcher → [optimistic || pessimistic] → optimisticRebuttalNode
  → pessimisticRebuttalNode → decider → END
```

**优化点**：乐观派和悲观派初始分析并行执行，减少 30-50% 响应时间。

### 2. 节点实现 (`src/lib/graph/nodes.ts`)

| 节点 | 职责 | 输出字段 |
|------|------|----------|
| `researcherNode` | 分析用户问题，生成搜索查询，执行搜索，总结结果 | `searchResults`, `researchSummary`, `engineUsage` |
| `optimisticInitialNode` | 乐观派初始分析 | `optimisticThinking`, `optimisticAnswer` |
| `pessimisticInitialNode` | 悲观派初始分析 | `pessimisticThinking`, `pessimisticAnswer` |
| `optimisticRebuttalNode` | 乐观派反驳 | `optimisticRebuttal` |
| `pessimisticRebuttalNode` | 悲观派反驳 | `pessimisticRebuttal` |
| `deciderNode` | 裁决胜负并总结 | `debateWinner`, `debateSummary`, `shouldContinue` |

### 3. 状态定义 (`src/lib/graph/state.ts`)

使用 LangGraph 的 `Annotation` 定义状态：

```typescript
- question: string           // 用户问题
- searchResults: any[]      // 原始搜索结果
- researchSummary: object   // 研究总结（关键事实、数据点）
- engineUsage: object       // 搜索引擎使用统计
- optimisticThinking/Answer/Rebuttal: string
- pessimisticThinking/Answer/Rebuttal: string
- debateWinner: string      // optimistic/pessimistic/draw
- debateSummary: string     // 辩论总结
- round: number             // 当前轮次
- maxRounds: number         // 最大轮次（默认 2）
```

### 4. 智能搜索 (`src/lib/mcp/unified-search.ts`)

**简化后的搜索策略**：

```
smartSearch(query)
    ↓
查询分类（classifyQuery / quickClassify）
    ↓
├─→ open-websearch MCP
│   └─→ 失败时回退到 DuckDuckGo
```

**改进点**：
- 移除了 Playwright 依赖，简化架构
- MCP 失败时自动回退到 DuckDuckGo
- 分类结果用于日志和统计，不影响搜索策略

### 5. MCP 管理器 (`src/lib/mcp/manager.ts`)

配置了一个 MCP 服务器：
- **open-websearch**: 使用 `@zhsunlight/open-websearch-mcp` 进行网页搜索

### 6. 查询分类器 (`src/lib/search/query-classifier.ts`)

支持的查询类别：

| 类别 | 描述 | 数据源示例 |
|------|------|------------|
| `general` | 一般性问题 | DuckDuckGo / WebSearch MCP |
| `finance_news` | 财经新闻 | 路透社、彭博社、华尔街见闻 |
| `finance_data` | 股票/基金/行情 | 东方财富、雪球、同花顺 |
| `encyclopedia` | 百科知识 | 维基百科、百度百科 |
| `academic` | 学术研究 | Google Scholar、arXiv、知网 |
| `government` | 政府/国际组织 | World Bank、IMF、国家统计局 |
| `community` | 问答社区 | 知乎、Quora、Reddit |

---

## 环境变量配置

```bash
# 必需
OPENAI_API_KEY=your_api_key

# 可选（默认使用 DeepSeek）
OPENAI_BASE_URL=https://api.deepseek.com
OPENAI_MODEL=deepseek-chat

# MCP 代理（可选）
HTTP_PROXY=
HTTPS_PROXY=
```

支持的模型供应商：
- OpenAI (gpt-4o-mini, gpt-4o, ...)
- DeepSeek (deepseek-chat)
- 任何 OpenAI 兼容的 API

---

## API 端点

### POST `/api/chat`

请求体：
```json
{
  "question": "用户问题",
  "config": {
    "apiUrl": "https://api.deepseek.com",
    "modelName": "deepseek-chat",
    "apiKey": "sk-..."
  }
}
```

响应体（完整状态）：
```json
{
  "question": "...",
  "searchResults": [...],
  "researchSummary": {...},
  "optimisticAnswer": "...",
  "optimisticRebuttal": "...",
  "pessimisticAnswer": "...",
  "pessimisticRebuttal": "...",
  "debateWinner": "optimistic|pessimistic|draw",
  "debateSummary": "..."
}
```

---

## 数据流详解

```
┌─────────────────────────────────────────────────────────────┐
│                        用户界面                              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │   问题输入    │  │  双人格展示   │  │  裁决结果    │      │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘      │
└─────────┼─────────────────┼─────────────────┼──────────────┘
          │                 │                 │
          ▼                 ▼                 ▼
┌─────────────────────────────────────────────────────────────┐
│                     Next.js API Route                        │
│                    (src/app/api/chat)                        │
└─────────────────────────┬───────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────┐
│                     LangGraph 流程                           │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐       │
│  │Researcher│→│Optimistic│→│Pessimistic│→│Rebuttals │      │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘       │
│       ↓                                                │
│  ┌──────────────────────────────────────────────────┐  │
│  │  Search: DuckDuckGo / MCP / Playwright           │  │
│  └──────────────────────────────────────────────────┘  │
│       ↓                                                │
│  ┌──────────────────────────────────────────────────┐  │
│  │  LLM: OpenAI / DeepSeek (via LangChain)          │  │
│  └──────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

---

## 扩展建议

1. **添加更多人格**: 在 `nodes.ts` 中新增节点（如 `realistNode`），并在 `graph.ts` 中编排
2. **多轮辩论**: 修改 `deciderNode` 的 `shouldContinue` 逻辑，支持更多轮次
3. **流式响应**: 将 API 改为 Streaming 模式，逐步返回各节点结果
4. **更多数据源**: 在 `specialized-sources.ts` 中添加新的专业数据源
5. **持久化存储**: 当前使用 localStorage，可改为数据库存储对话历史

---

## 调试技巧

1. 查看控制台日志：每个节点都有 `[Graph]` 开头的日志输出
2. 检查搜索过程：`[Smart Search]`、`[DuckDuckGo Search]`、`[Open-Websearch]` 等日志
3. 监控 LLM 调用：所有节点都有耗时统计
4. 使用 vitest 测试：`src/lib/graph/nodes.test.ts` 包含节点单元测试

## 改进记录

### 2026-02-27 架构优化

1. **并行执行优化** (`src/lib/graph/graph.ts`)
   - 乐观派和悲观派初始节点现在并行执行
   - 预期减少 30-50% 响应时间

2. **重试机制** (`src/lib/llm/client.ts`)
   - 添加 `withRetry` 函数支持指数退避重试
   - LLM 客户端内置 3 次重试
   - 60 秒超时设置

3. **简化搜索层** (`src/lib/mcp/unified-search.ts`)
   - 移除 Playwright 依赖（减少复杂性和部署问题）
   - 搜索策略简化为：MCP → DuckDuckGo 回退
   - 代码从 396 行减少到约 180 行

4. **完善类型定义** (`src/lib/graph/state.ts`, `src/lib/graph/nodes.ts`)
   - 移除所有 `any` 类型
   - 添加完整的接口定义（ResearchSummary, PersonaOutput, DeciderOutput）
   - debateWinner 使用具体联合类型

5. **错误处理改进** (`src/lib/graph/nodes.ts`)
   - 每个节点都有统一的错误处理
   - 错误时返回友好的回退消息
   - 添加更详细的日志

6. **裁决者改进** (`src/lib/graph/nodes.ts`)
   - 使用完整论点（最多 3000 字符）进行裁决，而非仅前 300 字符
   - 添加 `formatArgument` 辅助函数

7. **API 速率限制** (`src/lib/rate-limit.ts`, `src/app/api/chat/route.ts`)
   - 每分钟最多 10 次请求
   - 基于 IP 地址的限制
   - 返回标准的 429 状态码和 Retry-After 头

8. **单元测试** (`src/lib/graph/nodes.test.ts`)
   - 26 个测试用例覆盖核心功能
   - 测试 JSON 提取、重试机制、查询分类

---

*文档生成时间: 2026-02-27*
*项目版本: 0.1.0*
