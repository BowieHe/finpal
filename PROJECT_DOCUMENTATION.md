# FinPal 项目完整文档

## 项目概述

**FinPal** 是一个基于 **Next.js + LangGraph** 实现的 AI 双人格对话助手。它通过网页搜索获取信息，然后由两个不同视角的 LLM（多头/乐观派 和 空头/悲观派）对信息进行多角度解析，最后由一个裁决者总结并生成最终报告。

### 核心特色
- **双人格辩论**：用户提问 → 智能搜索 → 多头分析 → 空头分析 → 双方反驳 → 裁决者总结
- **实时流式输出**：所有 LLM 输出都支持流式显示，提升用户体验
- **多源搜索**：支持 DuckDuckGo、MCP WebSearch 等多种搜索源
- **查询智能分类**：自动识别财经新闻、财经数据、百科、学术、政府、社区等查询类型
- **并行执行**：多头和空头初始分析并行执行，减少 30-50% 响应时间
- **重试机制**：LLM 调用失败时自动重试
- **速率限制**：API 端点有请求频率限制（每分钟 10 次）
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
| React Markdown | 10.1.0 | Markdown 渲染 |
| Vitest | 4.x | 单元测试框架 |

---

## 项目结构

```
finpal/
├── src/
│   ├── app/                          # Next.js App Router
│   │   ├── api/chat/route.ts         # 核心 API 端点，调用 LangGraph
│   │   ├── page.tsx                  # 主页面（聊天界面）
│   │   ├── layout.tsx                # 全局布局
│   │   └── globals.css               # 全局样式
│   │
│   ├── components/                   # React 组件
│   │   ├── ChatInput.tsx             # 输入框组件
│   │   ├── MessageList.tsx           # 消息列表（展示搜索结果 + 双人格回答）
│   │   ├── TimelineDebate.tsx        # 时间轴辩论展示
│   │   ├── PersonaCard.tsx           # 人格卡片（多头/空头）
│   │   ├── DeciderResult.tsx         # 裁决结果展示
│   │   ├── ResearchResults.tsx       # 搜索结果展示
│   │   ├── DebateBubble.tsx          # 对话气泡组件
│   │   ├── Sidebar.tsx               # 侧边栏（对话历史）
│   │   ├── ConversationList.tsx      # 对话列表
│   │   ├── ConversationItem.tsx      # 对话项
│   │   ├── SettingsModal.tsx         # 设置弹窗
│   │   ├── SettingsForm.tsx          # 设置表单
│   │   ├── ThemeToggle.tsx           # 主题切换
│   │   ├── LoadingDots.tsx           # 加载动画
│   │   └── MessageBubble.tsx         # 消息气泡
│   │
│   ├── lib/                          # 核心逻辑
│   │   ├── graph/                    # LangGraph 相关
│   │   │   ├── graph.ts              # 图定义（6 个节点的编排）
│   │   │   ├── nodes.ts              # 9 个节点的实现
│   │   │   ├── state.ts              # 图状态定义
│   │   │   └── index.ts              # 导出
│   │   │
│   │   ├── search/                   # 搜索相关
│   │   │   ├── duckduckgo.ts         # DuckDuckGo 搜索实现
│   │   │   ├── query-classifier.ts   # 查询分类器（LLM + 规则）
│   │   │   └── specialized-sources.ts # 专业数据源配置
│   │   │
│   │   ├── mcp/                      # MCP 相关
│   │   │   ├── manager.ts            # MCP 客户端管理器
│   │   │   ├── unified-search.ts     # 统一搜索接口
│   │   │   ├── search-router.ts      # 搜索路由
│   │   │   └── index.ts              # 导出
│   │   │
│   │   ├── llm/                      # LLM 相关
│   │   │   └── client.ts             # LLM 客户端（OpenAI/DeepSeek）
│   │   │
│   │   ├── conversation.ts           # 对话历史管理（localStorage）
│   │   ├── config.ts                 # 配置管理
│   │   ├── prompts.ts                # 人格 Prompts
│   │   ├── logger.ts                 # 日志工具
│   │   └── rate-limit.ts             # 速率限制
│   │
│   ├── types/                        # TypeScript 类型定义
│   │   ├── conversation.ts           # 对话相关类型
│   │   ├── mcp.ts                    # MCP/搜索相关类型
│   │   └── config.ts                 # 配置类型
│   │
│   └── utils/                        # 工具函数
│       └── format.ts                 # 格式化工具
│
├── docs/
│   └── PRD-UI-Refactor.md            # UI 重构 PRD
│
├── package.json                      # 项目依赖
├── next.config.ts                    # Next.js 配置
├── tailwind.config.ts                # Tailwind CSS 配置
├── tsconfig.json                     # TypeScript 配置
├── vitest.config.ts                  # Vitest 测试配置
├── README.md                         # 项目说明
├── CLAUDE.md                         # 详细架构文档
└── PRD.md                            # 产品需求文档
```

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
[Optimistic] 多头初始观点 ──┐
    ├─→ 基于搜索结果从乐观角度分析    │ 并行执行
    └─→ 输出：thinking + answer      │
    ↓                                │
[Pessimistic] 空头初始观点 ────┘
    ├─→ 基于搜索结果从悲观角度分析
    └─→ 输出：thinking + answer
    ↓
[OptimisticRebuttal] 多头反驳
    ├─→ 针对空头观点进行反驳
    └─→ 输出：rebuttal
    ↓
[PessimisticRebuttal] 空头反驳
    ├─→ 针对多头观点（含反驳）进行反驳
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

## 关键文件详解

### 1. 图定义 (`src/lib/graph/graph.ts`)

定义了 6 个主要节点的流程，其中多头和空头节点**并行执行**：

```typescript
START → researcher → [optimistic || pessimistic] → optimisticRebuttalNode
  → pessimisticRebuttalNode → decider → END
```

**优化点**：多头和空头初始分析并行执行，减少 30-50% 响应时间。

### 2. 节点实现 (`src/lib/graph/nodes.ts`)

包含 9 个节点的实现：

| 节点 | 职责 | 输出字段 | 流式输出 |
|------|------|----------|----------|
| `researcherNode` | 分析用户问题，生成搜索查询，执行搜索，总结结果 | `searchResults`, `researchSummary`, `engineUsage` | ✅ 关键事实流式 |
| `optimisticInitialNode` | 多头初始分析 | `optimisticThinking`, `optimisticAnswer` | ✅ |
| `pessimisticInitialNode` | 空头初始分析 | `pessimisticThinking`, `pessimisticAnswer` | ✅ |
| `optimisticRebuttalNode` | 多头反驳 | `optimisticRebuttal` | ✅ |
| `pessimisticRebuttalNode` | 空头反驳 | `pessimisticRebuttal` | ✅ |
| `deciderNode` | 裁决胜负并总结 | `debateWinner`, `debateSummary`, `shouldContinue` | ✅ |
| `plannerNode` | Deep Research 规划 | `subTasks`, `researchPlan` | ❌ |
| `parallelResearchNode` | 并行研究 | `allFindings`, `researchSummary` | ✅ 关键事实流式 |
| `deepCheckNode` | 深度检查 | `shouldContinue` | ❌ |

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
- progressCallback: function // 进度回调函数
```

### 4. 智能搜索 (`src/lib/mcp/unified-search.ts`)

**搜索策略**：

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

### 6. LLM 客户端 (`src/lib/llm/client.ts`)

支持多种 LLM 供应商：
- OpenAI (gpt-4o-mini, gpt-4o, ...)
- DeepSeek (deepseek-chat)
- 任何 OpenAI 兼容的 API

**特性**：
- 流式输出支持 (`streamWithCallback`)
- 自动重试机制 (`withRetry`)
- 60 秒超时设置

---

## UI 组件详解

### 主页面 (`src/app/page.tsx`)

**职责**：
- 管理对话状态（当前对话、对话列表）
- 处理用户输入和消息发送
- 管理 SSE 流式响应
- 协调各组件之间的数据流

**关键状态**：
```typescript
- conversations: Conversation[]           // 所有对话
- currentConversation: Conversation | null // 当前对话
- isLoading: boolean                      // 加载状态
- llmConfig: LLMConfig                    // LLM 配置
- theme: Theme                            // 主题（dark/light）
```

### 消息列表 (`src/components/MessageList.tsx`)

**职责**：
- 显示用户问题和 AI 回答
- 管理搜索进度显示（闪烁动画只在 searching 状态）
- 显示分析中状态（静态，无闪烁）
- 展示搜索结果、关键事实、双人格回答

**关键逻辑**：
```typescript
const showRealtimeSearch = message.status === 'searching';  // 只有搜索时闪烁
const isAnalyzing = message.status === 'analyzing';         // 分析时静态显示
```

### 时间轴辩论 (`src/components/TimelineDebate.tsx`)

**职责**：
- 以时间轴形式展示多头和空头的辩论过程
- 多头在右侧，空头在左侧
- 中轴线连接各轮次的观点
- 支持 Markdown 渲染（粗体使用主题色）

**布局特点**：
- 多头卡片：右侧，绿色主题 (#879A39)
- 空头卡片：左侧，红色主题 (#D14D41)
- 中轴线：从第一个点到最后一个点
- 连接线：从点中心到卡片边缘，不超出点

### 裁决结果 (`src/components/DeciderResult.tsx`)

**职责**：
- 显示辩论胜者（多头/空头/平局）
- 展示裁决总结
- 支持流式输出时的闪烁指示器
- 支持 Markdown 渲染

### 搜索结果 (`src/components/ResearchResults.tsx`)

**职责**：
- 显示搜索查询和结果摘要
- 展示关键事实（流式更新）
- 显示搜索引擎使用统计

### 输入框 (`src/components/ChatInput.tsx`)

**职责**：
- 用户问题输入
- Deep Research 开关
- 发送按钮

### 侧边栏 (`src/components/Sidebar.tsx`)

**职责**：
- 对话历史列表
- 新建对话按钮
- 切换/删除对话

---

## API 端点

### POST `/api/chat`

**请求体**：
```json
{
  "question": "用户问题",
  "config": {
    "apiUrl": "https://api.deepseek.com",
    "modelName": "deepseek-chat",
    "apiKey": "sk-..."
  },
  "deepResearch": false
}
```

**响应**：SSE 流式响应

**事件类型**：
- `planning` - 开始规划
- `searching` - 搜索中
- `search_result` - 搜索结果
- `search_complete` - 搜索完成
- `analyzing` - 分析中
- `research_summary_stream` - 流式关键事实
- `research_summary` - 完整研究总结
- `optimistic_output` - 多头输出
- `pessimistic_output` - 空头输出
- `optimistic_rebuttal` - 多头反驳
- `pessimistic_rebuttal` - 空头反驳
- `stream_chunk` - 流式内容块
- `complete` - 完成
- `error` - 错误

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
│  │Researcher│→│Optimistic│→│Pessimistic│→│Rebuttals │       │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘       │
│       ↓                                                │
│  ┌──────────────────────────────────────────────────┐  │
│  │  Search: DuckDuckGo / MCP                        │  │
│  └──────────────────────────────────────────────────┘  │
│       ↓                                                │
│  ┌──────────────────────────────────────────────────┐  │
│  │  LLM: OpenAI / DeepSeek (via LangChain)          │  │
│  └──────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

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

---

## 扩展建议

1. **添加更多人格**: 在 `nodes.ts` 中新增节点（如 `realistNode`），并在 `graph.ts` 中编排
2. **多轮辩论**: 修改 `deciderNode` 的 `shouldContinue` 逻辑，支持更多轮次
3. **更多数据源**: 在 `specialized-sources.ts` 中添加新的专业数据源
4. **持久化存储**: 当前使用 localStorage，可改为数据库存储对话历史
5. **用户认证**: 添加用户系统，支持多用户对话隔离

---

## 调试技巧

1. 查看控制台日志：每个节点都有 `[Graph]` 开头的日志输出
2. 检查搜索过程：`[Smart Search]`、`[DuckDuckGo Search]`、`[Open-Websearch]` 等日志
3. 监控 LLM 调用：所有节点都有耗时统计
4. 使用 vitest 测试：`src/lib/graph/nodes.test.ts` 包含节点单元测试

---

## 最近改进记录

### 2026-03-09 流式输出优化

1. **所有 LLM 节点支持流式输出**
   - researcherNode、optimisticInitialNode、pessimisticInitialNode
   - optimisticRebuttalNode、pessimisticRebuttalNode、deciderNode
   
2. **搜索状态优化**
   - 搜索阶段显示闪烁动画
   - 分析阶段显示静态"分析中"状态
   
3. **时间轴 UI 优化**
   - 连接线从点中心开始
   - 不超出点的边界
   
4. **Markdown 渲染增强**
   - 粗体使用主题色（多头绿色、空头红色）
   - 支持列表、标题等格式

---

*文档生成时间: 2026-03-09*
*项目版本: 0.1.0*
