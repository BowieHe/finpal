# FinPal - 乐观与悲观的双人格 AI 对话

基于 Next.js + LangGraph 实现的双人格 AI 对话助手，同时展示乐观派和悲观派的不同观点。

## 技术栈

- **Next.js** 16.1.6 - React 全栈框架
- **React** 19.2.4 - UI 库
- **TypeScript** 5.9.3 - 类型系统
- **Tailwind CSS** 4.2.0 - 样式框架
- **LangGraph** 1.1.5 - LLM 应用编排框架
- **LangChain** - OpenAI 集成

## 项目结构

```
finpal/
├── src/
│   ├── app/                    # Next.js App Router
│   │   ├── page.tsx            # 主页面
│   │   ├── layout.tsx          # 全局布局
│   │   ├── api/chat/route.ts   # API 端点
│   │   └── globals.css         # 全局样式
│   ├── components/             # React 组件
│   │   ├── ChatInput.tsx       # 输入框
│   │   ├── MessageList.tsx     # 消息列表
│   │   └── Loading.tsx         # 加载状态
│   ├── lib/                    # 核心逻辑
│   │   ├── graph/              # LangGraph 相关
│   │   │   ├── graph.ts        # 图定义
│   │   │   ├── nodes.ts        # 节点（乐观/悲观）
│   │   │   └── state.ts        # 状态定义
│   │   ├── llm/                # LLM 客户端
│   │   │   └── client.ts
│   │   └── prompts.ts          # 人格 Prompts
│   ├── types/                  # 类型定义
│   └── utils/                  # 工具函数
├── package.json
├── tsconfig.json
├── next.config.mjs             # Next.js 配置
├── tailwind.config.ts
└── .env.local.example
```

## 快速开始

### 1. 安装依赖

```bash
pnpm install
```

### 2. 配置环境变量

复制 `.env.local.example` 为 `.env.local`：

```bash
cp .env.local.example .env.local
```

编辑 `.env.local`，填入你的 OpenAI API Key：

```
OPENAI_API_KEY=your_api_key_here
OPENAI_BASE_URL=https://api.openai.com/v1
OPENAI_MODEL=gpt-4o-mini
```

**环境变量说明：**
- `OPENAI_API_KEY` - 你的 API 密钥（必需）
- `OPENAI_BASE_URL` - API 地址（可选，默认为 OpenAI 官方地址）
- `OPENAI_MODEL` - 使用的模型名称（可选，默认为 gpt-4o-mini）

**常用模型选项：**
- `gpt-4o-mini` - 最快、最便宜（推荐）
- `gpt-4o` - 更强的推理能力
- `gpt-3.5-turbo` - 经典模型
- `deepseek-chat` - DeepSeek 模型
- 其他 OpenAI 兼容的模型名称

### 3. 启动开发服务器

```bash
pnpm dev
```

### 4. 访问应用

打开浏览器访问 [http://localhost:3000](http://localhost:3000)

## 使用说明

1. 在输入框中输入你的问题
2. 点击"发送"按钮
3. 同时看到乐观派和悲观派的回答
4. 两个人格的观点会在左右并排展示

## 自定义人格

修改 `src/lib/prompts.ts` 文件可以自定义两个人格的设定：

- `OPTIMISTIC_PROMPT` - 乐观派人格描述
- `PESSIMISTIC_PROMPT` - 悲观派人格描述

## OpenAI 兼容接口

项目支持任何 OpenAI 兼容的 API，如：

- OpenAI 官方 API
- Azure OpenAI
- DeepSeek
- Ollama
- 其他兼容接口

只需在 `.env.local` 中配置正确的 `OPENAI_BASE_URL` 即可。

## 后续扩展

- 添加更多人格类型
- 实现对话历史记录
- 支持流式响应
- 添加人格对比分析
- 打包成桌面应用（Electron/Tauri）
## 后续扩展

- 添加更多人格类型
- 实现对话历史记录
- 支持流式响应
- 添加人格对比分析
- 打包成桌面应用（Electron/Tauri）
- 打包成移动应用（Capacitor）

## 架构说明

### 核心流程

FinPal 使用 LangGraph 实现了一个 **2 轮辩论流程**：

```
用户提问
    ↓
researcher (搜索信息) → DuckDuckGo/Tavily
    ↓
optimistic (乐观派初始观点)
    ↓
pessimistic (悲观派初始观点)
    ↓
optimisticRebuttal (乐观派反驳)
    ↓
pessimisticRebuttal (悲观派反驳)
    ↓
decider (裁决胜者)
    ↓
展示结果
```

### 关键文件

- `src/lib/graph/graph.ts` - 流程图定义
- `src/lib/graph/nodes.ts` - 6 个节点实现
- `src/lib/graph/state.ts` - 状态管理
- `src/lib/search/duckduckgo.ts` - DuckDuckGo 搜索
- `src/lib/mcp/unified-search.ts` - 统一搜索接口

### 搜索策略

优先使用 **DuckDuckGo**（免费），失败时回退到 **Tavily**（需要 API Key）。
