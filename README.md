# FinPal — AI-Powered Portfolio Intelligence

> An agentic investment assistant built with **Next.js**, **LangGraph**, and **DeepAgents**. FinPal uses autonomous DeepAgents to analyze your portfolio, search the web, and debate investment strategies — all in real-time.

![FinPal](finpal-homepage.png)

[中文文档](README_CN.md)

---

## ✨ Key Features

- **🧠 DeepAgent Architecture** — A single autonomous agent that plans, executes skills, and self-corrects through multi-step reasoning.
- **⚔️ Adversarial Debate** — Built-in Bull vs Bear analysis with synthesized final verdict and expected value calculation.
- **📊 Real-time Streaming UI** — SSE-powered timeline showing agent reasoning progress and debate results in real-time.
- **🔍 Dual Search Strategy** — MCP web search with automatic fallback to DuckDuckGo for reliable information retrieval.
- **💼 Portfolio Management** — Track fund holdings with cost basis, real-time NAV updates, and risk metrics.

---

## 🏗️ Architecture

```
User Query
   │
   ▼
┌────────────────────────────────────────────────────────┐
│                    DeepAgent Node                      │
│  ┌────────────────────────────────────────────────┐    │
│  │              Autonomous Reasoning Loop          │    │
│  │                                                 │    │
│  │   ┌─────────┐    ┌─────────┐    ┌─────────┐    │    │
│  │   │  Plan   │───→│ Execute │───→│ Observe │    │    │
│  │   └────┬────┘    └────┬────┘    └────┬────┘    │    │
│  │        └────────────────┴────────────────┘      │    │
│  │                     │                           │    │
│  │                     ▼ (confidence < threshold)  │    │
│  │                ┌─────────┐                      │    │
│  │                │ Reflect │──────────────────────┘    │
│  │                └─────────┘  (iterate until done)      │
│  └────────────────────────────────────────────────┘    │
│                                                         │
│  Skills Used:                                           │
│  • fund-deep-search — Multi-query web research          │
│  • fund-debate      — Bull/Bear analysis + EV calc      │
└────────────────────┬────────────────────────────────────┘
                     │
                     ▼
┌────────────────────────────────────────────────────────┐
│                  Final Verdict Node                    │
│         Format structured investment report            │
│    (recommendation, confidence, bull/bear points)      │
└────────────────────┬────────────────────────────────────┘
                     │
                     ▼
              Structured Response
                     │
    ┌────────────────┼────────────────┐
    ▼                ▼                ▼
 Optimistic      Pessimistic      Synthesis
   View            View           & Verdict
```

### Agent Roles

| Component | Role | Description |
|-----------|------|-------------|
| **DeepAgent** 🧠 | Autonomous analyst | Plans research strategy, executes search skills, performs bull/bear debate, and synthesizes final verdict |
| **Search Skill** 🔍 | Information retrieval | Multi-query web search using MCP + DuckDuckGo fallback |
| **Debate Skill** ⚔️ | Adversarial analysis | Generates bull case, bear case, and expected value calculation |
| **Final Verdict** 📋 | Report formatter | Structures output with recommendation, confidence, risk warnings |

---

## 🚀 Getting Started

### Prerequisites

- **Node.js** ≥ 18, **pnpm** ≥ 8
- **PostgreSQL** 14+ (via Docker or local)
- **OpenAI-compatible API key** (e.g., DeepSeek / OpenAI / Alibaba Cloud)

### 1. Install Dependencies

```bash
pnpm install
```

### 2. Configure Environment

```bash
cp .env.local.example .env.local
# Edit .env.local with your API keys and database URL
```

Key variables:

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | PostgreSQL connection string |
| `OPENAI_API_KEY` | LLM API key |
| `OPENAI_BASE_URL` | API base URL (default: `https://api.deepseek.com`) |
| `OPENAI_MODEL` | Model name (default: `deepseek-chat`) |
| `MCP_BAILIAN_API_KEY` | Alibaba Cloud Bailian search API key (optional) |

### 3. Start Database

```bash
docker compose up -d postgres
# Schema is managed via native SQL / migrations
```

### 4. Run Development Server

```bash
pnpm dev
```

Visit **http://localhost:3000**

---

## 📁 Project Structure

```
finpal/
├── src/
│   ├── app/                    # Next.js App Router
│   │   ├── page.tsx            # Main chat page + SSE handler
│   │   └── api/chat/route.ts   # Chat API endpoint (SSE streaming)
│   ├── components/             # React UI components
│   │   ├── MessageList.tsx      # Chat message list with debate cards
│   │   ├── PersonaCard.tsx      # Bull/Bear view cards
│   │   ├── DeciderResult.tsx    # Final verdict display
│   │   ├── ResearchResults.tsx  # Search results panel
│   │   ├── Sidebar.tsx          # Conversation history sidebar
│   │   └── ChatInput.tsx        # Input with Shift+Enter support
│   ├── lib/
│   │   ├── deepagent/          # 🆕 DeepAgent implementation
│   │   │   ├── index.ts         # Agent factory + core types
│   │   │   ├── agent.ts         # Agent loop (plan → execute → observe)
│   │   │   ├── skills/          # Skill implementations
│   │   │   │   ├── fund-deep-search.ts   # Multi-query research
│   │   │   │   └── fund-debate.ts        # Bull/Bear analysis
│   │   │   └── types.ts         # Skill interfaces
│   │   ├── graph/              # LangGraph orchestration (simplified)
│   │   │   ├── graph.ts         # 2-node graph: deepAgent → finalVerdict
│   │   │   ├── state.ts         # Graph state annotations
│   │   │   └── nodes/           # Node implementations
│   │   │       ├── deep-agent-node.ts    # DeepAgent wrapper
│   │   │       └── final-verdict-node.ts # Report formatter
│   │   ├── search/             # Search utilities
│   │   │   ├── duckduckgo.ts    # DuckDuckGo search fallback
│   │   │   └── query-classifier.ts # Query type detection
│   │   ├── mcp/                # MCP client management
│   │   │   ├── manager.ts       # MCP client lifecycle
│   │   │   └── unified-search.ts # Unified search interface
│   │   └── llm/                # LLM client
│   │       └── client.ts        # OpenAI-compatible client
│   └── types/                  # TypeScript type definitions
├── scheduler/                  # Python data sync service (optional)
│   └── src/                    # Fund NAV fetcher + cron jobs
└── docker-compose.yml          # PostgreSQL + services
```

---

## 🔧 Common Commands

```bash
# Development
pnpm dev                        # Start Next.js dev server (+ Postgres)

# Testing
pnpm test                       # Run unit tests (vitest)
pnpm typecheck                  # TypeScript type check

# Build
pnpm build                      # Production build
```

---

## ⚙️ Configuration & Usage Notes

### 1. Environment Variables (`.env.local`)

FinPal requires the following configuration:

- **LLM Settings** (Required):
  - `OPENAI_API_KEY`: Your model provider API key
  - `OPENAI_BASE_URL`: The endpoint (default: `https://api.deepseek.com`)
  - `OPENAI_MODEL`: The model name (default: `deepseek-chat`)

- **Search Settings** (Optional):
  - `MCP_BAILIAN_API_KEY`: Alibaba Cloud Bailian API key for enhanced search
  - Without this, system falls back to DuckDuckGo

- **Database** (Required):
  - `DATABASE_URL`: `postgresql://finpal:finpal@localhost:5432/finpal`

### 2. How DeepAgent Works

1. **Planning**: Analyzes user query and creates a research plan
2. **Execution**: Runs skills in sequence:
   - `fund-deep-search`: Gathers information via web search
   - `fund-debate`: Generates bull case, bear case, and EV calculation
3. **Observation**: Evaluates results and decides whether to continue or finish
4. **Reflection**: If confidence is low, revises plan and re-executes
5. **Completion**: Returns structured analysis to Final Verdict node

### 3. Critical Notes

- **Search Engine**: System tries MCP Bailian first, falls back to DuckDuckGo automatically
- **Proxy**: Set `HTTP_PROXY` and `HTTPS_PROXY` if behind a restricted network
- **Thinking Process**: DeepSeek models (`deepseek-chat`, `deepseek-reasoner`) are recommended for best reasoning quality

---

## 🛠️ Tech Stack

| Layer | Technology |
|-------|-----------|
| **Frontend** | Next.js 16, React 19, TypeScript, Tailwind CSS 4 |
| **AI Orchestration** | LangGraph + DeepAgents (autonomous reasoning) |
| **Search** | MCP (Model Context Protocol) + DuckDuckGo fallback |
| **Database** | PostgreSQL + Native SQL |
| **Data Sync** | Python + FastAPI + akshare (optional scheduler) |
| **Visualization** | React components with Tailwind |
| **Deployment** | Docker Compose |

---

## 📜 License

MIT
