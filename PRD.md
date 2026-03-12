# FinPal Agent Teams Architecture — PRD v3.1

> **策略**：自底向上（Bottom-Up）— 先完善 Sub-Agents → 再建 CIO 调度层 → 最后接入辩论团队

---

## 背景与目标

### 核心产品理念：建立“个人理财副脑” (Amala Architecture)
本系统旨在打造一个超越情绪与市场噪音的“个人理财副脑”。

传统金融工具停留在“信息展示”与“二元对立（看多 vs 看空）”阶段，容易放大人类的焦虑。本系统引入唯识学中“智（Amala-vijnana / 无垢识）”的理念，其核心运作逻辑为：**剥离情绪噪音，通过双轨制记忆库比对，最终以数学期望值（EV）和概率输出绝对理性的操作建议。**

```
[用户行为与前端] (Next.js)
      │
      ▼
[噪音剥离器 / Filter Agent] ──(丢弃无效情绪/水军新闻)──> [高信噪比事实流]
      │                                                │
      ├────────────────────────────────────────┐       │
      ▼                                        ▼       ▼
【业力库 / Karma Collection】         【真如库 / Principia Collection】
(Qdrant 动态读写：用户日记/历史情绪)      (Qdrant 静态只读：投资常识/风控铁律)
      │                                        │
      └─────────────────┬──────────────────────┘
                        ▼
【LangGraph 信息收集层 / Scouts】
(提取客观做多触发条件)         (提取客观做空触发条件)
                        │
                        ▼
【LangGraph 智者节点 / Wisdom Node】
(不带立场的数学引擎：综合胜率与赔率，计算期望值 EV)
                        │
                        ▼
【输出：附带概率的执行方案，触发前端“纪律拦截器”】
```
           否（简单查询）  是（复杂分析）
                │              │  Send API 动态孵化
                │         ┌────┴──────────────────┐
                │         ▼                       ▼
                │    [DB-Agent]           [Web-Agent × N]
                │    持仓数据查询          每只基金独立采集
                │         └────────┬──────────────┘
                │                  ▼ Fan-in 数据汇总
                │          [Quant-Agent] 风险指标计算
                │                  │
                │         ┌────────▼─────────┐
                │         │  Gate Keeper      │
                │         │  数据质量检验      │
                │         └────────┬─────────┘
                │                  ▼
                │    ┌─────────────────────────┐
                │    │       辩论分析团队         │
                │    │  乐观分析师 ⚔️ 悲观分析师  │
                │    │      → Judge 裁决          │
                │    └─────────────┬───────────┘
                └──────────────────┘
                                   ▼
                             最终回答给用户
```

---

## 核心模块与技术实现详解

### 模块一：数据源注入层 —— 建立“第一性原理”清洗器 (The Epistemic Filter)
现在的系统（阿赖耶识）往往是“照单全收”，把每天的新闻、财报都塞进 Qdrant。但市场里 90% 的新闻都是噪音和情绪。

**重构方案**：增加一个预处理 Agent（噪音剥离器）。

**执行逻辑**：在 Python 调用 AkShare 或爬虫获取新闻后，让一个大模型（Filter Agent）执行“降噪 Prompt”：“这则新闻是否改变了该资产的自由现金流预期？是否改变了宏观利率基准？如果只是情绪宣泄或无来源的小道消息，丢弃它。”

**最终结果**：你的 Qdrant 数据库将不再是一个庞杂的垃圾堆，而是一个纯粹的、只包含核心变量的**“高信噪比知识库”**。

---

### 模块二：向量数据库 (Qdrant) 重构 —— 双轨制记忆结构
为了实现“智”，我们需要把你的 Qdrant 拆分成两个 Collection（集合），彻底分开“客观规律”与“主观情绪”。

**Collection A：真如库 (The Principia Collection)**
- **存什么**：经典的投资常识（如万物皆周期、均值回归法则）、经过验证的数学模型（如凯利公式、夏普比率计算逻辑）、你设定的绝对风控底线（如“单只基金仓位绝不超过 20%”）。
- **特性**：这是只读的（Read-Only），代表了不可动摇的“智”与纪律。

**Collection B：业力库 (The Karma Collection)**
- **存什么**：你的历史交易日记、“我今天很恐慌想割肉”的情绪记录。
- **特性**：这是动态读写的。

**实际应用**：当你问“我要不要清仓”时，系统同时检索这两个库。它会发现你的业力库里充满了恐慌，但真如库告诉你“当前估值处于历史 5% 极低分位，不符合清仓纪律”。

---

### 模块三：LangGraph 逻辑流重组 —— 打破“二元对立”
引入“期望值 (EV) 决策节点”，超越单纯的多空辩论。

**重构方案**：
1. **取消平级的多空对决**：将多空 Agent 降级为“信息收集者（Scouts）”。它们只负责列出做多和做空的触发条件。
2. **设立最高智者节点 (The Wisdom Node)**：这个节点不带任何立场，它只算一笔数学账——计算数学期望 (Expected Value)。它会审视多空双方的论点，给出概率分配。

**演算示例**：“做多逻辑成立的概率是 40%，潜在收益 30%；做空逻辑成立的概率是 60%，潜在损失 15%。期望值 EV = (40% * 30%) - (60% * 15%) = 12% - 9% = 3%。”

**最终输出**（行动建议）：智者节点不会告诉你绝对的“买”或“卖”，而是告诉你：“虽然看空声音很大，但根据期望值模型，这是一次值得承担的风险，建议动用 5% 的仓位进行左侧建仓。”

---

### 模块四：Next.js 前端呈现 —— 从“信息面板”到“认知之镜”
构建“认知偏差监控大屏”，不仅展示财富，更展示认知。

**重构方案**：
1. **情绪心率图**：前端不仅展示基金的 K 线，叠加一条**“情绪线”**（根据历史日记提取的恐慌/贪婪指数）。让用户直观看到，亏损是否常发生在情绪极点。
2. **纪律拦截器 (The Stoic Interceptor)**：当用户尝试冲动操作（如“全仓买入”）时，弹窗拦截并调用 Wisdom Node 质问：“该操作违背了真如库中的风控纪律，与你过去某次巨亏操作相似度高达 88%。你确定要被情绪控制吗？”

---

## 核心设计原则

### 1. 数据采集 vs 比较分析的分层
**数据采集阶段**（Phase 1/2）和**比较分析阶段**（Phase 3）的职责截然不同：

- **采集阶段**：给每只基金独立孵化一个 Web-Agent，是因为**抓数据本身互不依赖**。000001 去搜它的信息，110011 去搜它的信息——这是纯 I/O 并行操作，谁先完成谁先写回 State，类似"并行采购食材"。
- **分析阶段**：当所有数据汇聚到辩论团队时，分析师拿到的是**两只基金的完整数据合集**，做的才是真正的横向对比（如"000001 的夏普率 0.8 vs 110011 的 1.2..."）。

> **理解：先并行采购食材，再一起下锅烹饪。**

### 2. CIO 智能短路路由（不是每次都全链路执行）

CIO 的核心价值是**按需派发，而非固定全链路**。Gate Keeper 的判断逻辑：

```
用户问："今天市场怎么样？"
└─ CIO：不涉及持仓，无需数据库
   └─ 只派发 Web-Agent → 直接输出新闻摘要（跳过 Quant + 辩论全流程）

用户问："我的持仓总体盈亏？"
└─ CIO：只需数据库，无需联网
   └─ 只派发 DB-Agent → Judge 直接输出（无需辩论）

用户问："分析持仓，对比 000001 和 110011"
└─ CIO：复杂意图，需要最完整链路
   └─ 并行 DB-Agent + Web-Agent × 2 → Quant-Agent → 完整辩论 → Judge
```

### 3. Quant-Agent 的实现策略

**不需要沙盒，使用纯 TypeScript 计算函数即可**，分阶段演进：

| 阶段 | 实现方式 | 说明 |
|------|---------|------|
| 当前（Phase 1） | 纯 TypeScript 函数 | 夏普率、MDD、年化波动率，直接数学公式，无外部依赖 |
| 未来（如有需要） | Python 微服务 | 期权定价、蒙特卡洛回测等高级模型，Node.js 通过 HTTP 调用 |

> 对于当前需求，纯 TypeScript 完全够用，成熟后再考虑是否引入 Python 微服务。

---

## Phase 1：Sub-Agent 专业化分工

> **目标**：把现有的"杂货铺 Researcher"拆分成三位**专职专员**，每位都可独立调用和测试。

### 1.1 DB-Agent（数据库持仓专员）

**职责**：唯一负责所有与数据库相关的查询。不联网，不分析，只返回结构化数据。

**标准 Input：**
```typescript
interface DBAgentInput {
  task: "portfolio_summary" | "holding_detail" | "compare_funds" | "risk_metrics";
  params: { userId: string; fundCodes?: string[] };
}
```

**标准 Output：**
```typescript
interface DBAgentOutput {
  agentId: "db-agent";
  status: "success" | "error";
  data: PortfolioData | HoldingData | ComparisonData | RiskData;
}
```

**工具集（与现有 `portfolio.ts` 对应）：**
| Tool | 触发条件 |
|------|---------|
| `getPortfolioSummary` | 用户问"总体持仓如何" |
| `getHoldingDetail` | 用户问具体某只基金的持有情况 |
| `compareFunds` | 用户需要对比两只以上基金（注意：这里拿的是数据库中的持仓记录，不是外部行情） |
| `getFundRiskMetrics` | 用户问风险、回撤、夏普率 |

**验收标准：**
- [ ] 传入 `portfolio_summary` task，能正确返回总持仓数据
- [ ] 传入不存在的基金代码，能返回 `status: error` 而非 crash
- [ ] 不联网，响应时间 < 500ms

---

### 1.2 Web-Agent（联网信息侦察专员）

**职责**：唯一负责所有外部信息获取（基金经理动态、市场新闻、最新净值行情等）。不访问数据库。

**标准 Input：**
```typescript
interface WebAgentInput {
  task: "fund_info" | "market_news" | "manager_info";
  params: {
    query: string;
    fundCode?: string;
    // 当需要对比分析时，CIO 会为每只基金单独派发一个 WebAgentInput
    // 最终对比逻辑由 Phase 3 辩论团队完成
  };
}
```

**标准 Output：**
```typescript
interface WebAgentOutput {
  agentId: "web-agent";
  fundCode?: string;          // 归属哪只基金（便于辩论团队做对比）
  status: "success" | "partial" | "error";
  sources: string[];          // 信息来源 URL（可溯源）
  summary: string;            // 结构化摘要
  rawSnippets: string[];      // 原始搜索片段
}
```

**工具集：**
| Tool | 说明 |
|------|------|
| `tavilySearch` | 通用金融搜索 |
| `fetchFundPage` | 抓取天天基金/晨星等平台的基金详情页 |

**验收标准：**
- [ ] 搜索 "000001 最新净值"，返回结构化 summary 含数字
- [ ] 网络超时时，优雅降级返回 `status: partial`，不阻塞整个图
- [ ] 每次搜索结果中包含 `sources` 可溯源

---

### 1.3 Quant-Agent（量化风险计算专员）

**职责**：纯计算节点，**不调用大模型**，直接对数字做数学运算。速度最快、结果最确定。

**标准 Input：**
```typescript
interface QuantAgentInput {
  fundCode: string;
  priceHistory: number[];    // 历史净值序列（由 Web-Agent 或 DB-Agent 提供）
  riskFreeRate: number;      // 无风险利率（通常用 3% 年化）
}
```

**标准 Output：**
```typescript
interface QuantAgentOutput {
  agentId: "quant-agent";
  fundCode: string;
  sharpeRatio: number;
  maxDrawdown: number;               // 最大回撤（百分比）
  annualizedVolatility: number;
  calmarRatio: number;               // 年化收益 / 最大回撤
}
```

**实现方式**：纯 TypeScript 数学公式，无外部依赖，无 LLM 调用。

**验收标准：**
- [ ] 给定已知净值序列，计算结果与 Excel 手算结果误差 < 0.01%
- [ ] 纯函数，无副作用，unit test 100% 覆盖
- [ ] 响应时间 < 50ms（纯计算，无网络 I/O）

---

## Phase 2：CIO 调度层（核心路由逻辑）

> **目标**：构建顶层的意图拆解器和动态任务派发器。**依赖 Phase 1 全部完成并通过测试**。

### 2.1 Intent Planner（意图规划师）

小型 LLM 调用节点，专门做**意图拆解**，不做任何分析，不调用任何数据工具。

**输入**：用户的 raw query
**输出**：一个任务计划，包含路由决策

```typescript
interface Plan {
  requiresDebate: boolean;    // 是否需要进入 Phase 3 辩论团队
  tasks: Array<{
    agent: "db-agent" | "web-agent" | "quant-agent";
    task: string;
    params: Record<string, any>;
    priority: number;         // 用于 UI 展示顺序
    canSkip: boolean;         // 若结果缺失，是否允许降级而非失败
  }>;
}
```

**示例**（"分析持仓，同时对比 000001 和 110011"）：
```json
{
  "requiresDebate": true,
  "tasks": [
    { "agent": "db-agent",  "task": "portfolio_summary", "params": { "userId": "user_01" },       "priority": 1, "canSkip": false },
    { "agent": "web-agent", "task": "fund_info",         "params": { "fundCode": "000001" },      "priority": 2, "canSkip": true  },
    { "agent": "web-agent", "task": "fund_info",         "params": { "fundCode": "110011" },      "priority": 2, "canSkip": true  },
    { "agent": "quant-agent","task": "risk_metrics",     "params": { "fundCode": "000001" },      "priority": 3, "canSkip": true  },
    { "agent": "quant-agent","task": "risk_metrics",     "params": { "fundCode": "110011" },      "priority": 3, "canSkip": true  }
  ]
}
```

**示例**（"今天市场怎么样"）：
```json
{
  "requiresDebate": false,
  "tasks": [
    { "agent": "web-agent", "task": "market_news", "params": { "query": "今日 A股 市场行情" }, "priority": 1, "canSkip": false }
  ]
}
```

### 2.2 Dynamic Dispatcher（动态派发器）

将 Intent Planner 的任务列表转换为 LangGraph `Send` 调用，动态孵化对应的 Agent 实例。

```typescript
// LangGraph 配置（TypeScript 伪代码）
const dispatchNode = (state: GlobalState): Send[] => {
  return state.plan.tasks.map(task =>
    new Send(`${task.agent}`, { ...task.params, taskMeta: task })
  );
};

graph.addConditionalEdges("cio-dispatcher", dispatchNode);
```

**关键特性：**
- 任务数量完全动态（1 只基金 → 1 个 Web-Agent；5 只 → 5 个，自动孵化）
- 所有同优先级实例**并行执行**（Fan-out）
- 结果自动汇总进入 `GlobalState.collectedData`（Fan-in）

### 2.3 Gate Keeper（结果质量检验 + 路由决策）

所有 Sub-Agent 完成后的汇总节点，同时决定接下来走哪条路：

```
Gate Keeper 决策树：

requiresDebate = false?
  └─ 是 → 直接由 Judge 输出简洁回答（跳过辩论）
  └─ 否 → 继续检查数据质量

关键数据（canSkip=false）有缺失？
  └─ 是 → 直接返回错误给用户
  └─ 否 → 继续

部分数据（canSkip=true）有缺失？
  └─ 是 → 添加 warning 标记，降级进入辩论
  └─ 否 → 数据完整，进入完整辩论流程
```

**验收标准（Phase 2）：**
- [ ] 用户简单提问时（如"今天市场怎么样"），后端日志确认没有触发辩论流程
- [ ] 用户含 3 只基金的问题，后端日志确认 3 个并行 Web-Agent 被触发
- [ ] 某个 Web-Agent 超时，Gate Keeper 能识别并降级，不阻塞整个流程
- [ ] `Send` API 并行派发后，总时间 ≤ 最慢单个 Agent 的耗时（真正并行）

---

## Phase 3：辩论分析团队（深度输出）

> **目标**：在高质量汇总数据的基础上，产生深度、平衡、有洞察力的投资建议。**只在 requiresDebate=true 时触发**。

### 3.1 辩论团队的输入 State

```typescript
interface DebateTeamInput {
  portfolioSummary?: DBAgentOutput;     // 用户持仓（若涉及）
  fundResearch: WebAgentOutput[];       // 每只基金一个，agentId 区分
  quantMetrics: QuantAgentOutput[];     // 各基金风险指标，fundCode 区分
  userQuery: string;                    // 原始问题（供分析师理解上下文）
  warnings: string[];                   // Gate Keeper 传入的降级警告
}
```

### 3.2 辩论节点

| 角色 | 职责 | 数据引用 |
|------|------|---------|
| **乐观分析师** | 找机会、谈增长、找对比优势 | 引用 Web-Agent 的近期正向信号 / 基金经理亮点 |
| **悲观分析师** | 找风险、谈回撤、找对比劣势 | 引用 Quant-Agent 的 MDD、波动率数字作为论据 |
| **裁决 Judge** | 综合两方，输出结构化结论 | 综合所有数据，必要时标注数据来源 |

> **注意**：比较两只基金是在分析师层面完成的，他们拿到两只基金的完整数据后，**自然进行横向对比**，而不是在数据采集阶段做比较。

### 3.3 Judge 标准化输出结构

```typescript
interface FinalVerdict {
  summary: string;             // 一句话结论
  recommendation: "strong_buy" | "hold" | "reduce" | "avoid" | "info_only";
  confidence: number;          // 0-100，数据越完整置信度越高
  bullPoints: string[];        // 乐观观点（≤3条）
  bearPoints: string[];        // 悲观观点（≤3条）
  comparisonTable?: {          // 若涉及多只基金对比，输出结构化对比表
    fundCode: string;
    sharpe: number;
    mdd: number;
    recommendation: string;
  }[];
  riskWarnings: string[];      // 风险提示（含 Gate Keeper 传入的 warning）
  sources: string[];           // 数据来源 URL
}
```

---

## Phase 4：前端动态 UI 重构

> **目标**：让 UI 从「写死步骤的假进度条」升级为「实时反映后端 Agent 团队真实工作状态」。

### 4.1 SSE 事件协议（后端推送给前端）

```typescript
type SSEEvent =
  | { type: "agent_start";     agentId: string; taskDescription: string }
  | { type: "agent_progress";  agentId: string; message: string }
  | { type: "agent_done";      agentId: string; summary: string }
  | { type: "agent_error";     agentId: string; error: string; canSkip: boolean }
  | { type: "final_verdict";   data: FinalVerdict };
```

### 4.2 前端 `ResearchResults.tsx` 重构目标

UI 根据 SSE 事件动态构建 Timeline，而非写死步骤：

```
⚙️ CIO 主管      正在拆解您的问题，识别出 5 项调查任务...      ✅ 完成
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
[并行执行中]
🏦 持仓专员       正在读取您的持仓快照                           ✅ 完成
🌐 侦察专员-000001 正在抓取最新净值和基金经理信息...             ✅ 完成
🌐 侦察专员-110011 正在搜索近期持仓调整...                       ✅ 完成
📐 量化计算-000001 夏普率 0.82 / 最大回撤 -18.3%               ✅ 完成
📐 量化计算-110011 夏普率 1.24 / 最大回撤 -11.7%               ✅ 完成
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📈 乐观分析师     正在寻找两只基金的增长亮点和比较优势...         ✅ 完成
📉 悲观分析师     正在评估回撤风险和经理稳定性...                 ✅ 完成
⚖️  Judge         综合两方观点，正在生成投资建议...               🔄 进行中
```

---

## 技术风险与缓解策略

| 风险 | 缓解策略 |
|------|---------|
| LangGraph `Send` API 在 TypeScript/LangChain.js 中成熟度 | Phase 2 前先做最小 POC 验证 Fan-out/Fan-in |
| 多 Web-Agent 并行可能触发搜索 API 频率限制 | 加 rate-limit 中间件；将 `canSkip=true` 的任务加延迟 |
| 辩论两方 Token 消耗翻倍 | Judge 使用轻量模型（GPT-4o mini）；Optimist/Pessimist 使用完整模型 |
| 前端 SSE 连接超时 | 加 heartbeat ping；超时后 UI 展示已收到的 partial result |
| Quant-Agent 没有历史净值数据来源 | Phase 1 先用 DB 中已有数据；Phase 2 后从 Web-Agent 抓取历史净值序列 |

---

## 开发里程碑

| 阶段 | 核心产出 | 依赖 |
|------|---------|------|
| **Phase 1** | DB-Agent / Web-Agent / Quant-Agent 各自独立可测试 | 无 |
| **Phase 2** | CIO Intent Planner + `Send` API 动态派发 + Gate Keeper 短路路由 | Phase 1 ✅ |
| **Phase 3** | 辩论团队升级（接入真实对比数据 + 结构化输出） | Phase 2 ✅ |
| **Phase 4** | 前端 SSE 动态 Timeline UI（与 Phase 3 并行开发） | Phase 1 ✅ |

---

*文档版本：v3.1 | 最后更新：2026-03-11*
