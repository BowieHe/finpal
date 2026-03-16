# FinPal — AI-Powered Portfolio Intelligence

> An agentic investment assistant built with **Next.js**, **LangGraph**, and **PostgreSQL**. FinPal orchestrates a team of specialized AI agents to analyze your portfolio, search the web, and debate investment strategies — all in real-time.

![FinPal](finpal-homepage.png)

[中文文档](README_CN.md)

---

## ✨ Key Features

- **🏢 Agent Teams Architecture** — A "micro investment firm" dynamically orchestrated by a CIO (Chief Investment Officer).
- **⚔️ Adversarial Debate** — Bull vs Bear analysts debate with multi-round argumentation and neutral judge arbitration.
- **📊 Real-time Streaming UI** — SSE-powered timeline showing agent collaboration and debate progress in real-time.
- **🧠 Dynamic Persona (Karma Collection)** — Tracks behaviors and intent via KarmaLogs to build an evolving investment profile using recursive synthesis.
- **🔍 Dual Data Sources** — Portfolio data (PostgreSQL + Native SQL) + live web intelligence (Alibaba Cloud Bailian).

---

## 🏗️ Architecture

```
User Query
   │
   ▼
┌────────────────────────────────────────────────────────┐
│               CIO (Intent Planner)                     │
│     Query analysis → Dynamic task decomposition        │
└────────────────────┬───────────────────────────────────┘
                     │ Send API (Fan-out)
          ┌──────────┼──────────────┐
          ▼          ▼              ▼
    [DB-Agent]  [Web-Agent ×N]  [Quant-Agent]
    Portfolio    Web search      Risk metrics
    queries     per fund        (Sharpe, MDD)
          └──────────┼──────────────┘
                     ▼ Fan-in
              [Gate Keeper]
              Data quality check + routing
                     │
         ┌───────────┴───────────┐
    Simple query           Complex analysis
         │                       │
    Direct Summary        ┌──────▼──────┐
         │                │ Debate Loop  │
         │                │  Bull  ⚔️  Bear
         │                │    ↓         │
         │                │ Round Judge  │ ← continues or stops
         │                │    ↓ (loop)  │
         │                └──────┬──────┘
         │                       ▼
         │               Final Verdict
         └───────────────────────┘
                     ▼
              Structured Response
```

### Agent Roles

| Agent | Role | Tools |
|-------|------|-------|
| **DB-Agent** 🏦 | Portfolio data queries | `getPortfolioSummary`, `getHoldingDetail`, `compareFunds`, `getFundRiskMetrics` |
| **Web-Agent** 🌐 | Live web intelligence | Bailian MCP web search (fund info, market news, manager profiles) |
| **Quant-Agent** 📐 | Risk calculations | Pure TypeScript math — Sharpe ratio, Max Drawdown, Volatility (no LLM) |
| **Round Judge** ⚖️ | Per-round debate arbiter | Decides winner + whether to continue (max 3 rounds) |
| **Final Verdict** 📋 | Structured investment report | Generates `FinalVerdict` with recommendation, confidence, bull/bear points |

---

## 🚀 Getting Started

### Prerequisites

- **Node.js** ≥ 18, **pnpm** ≥ 8
- **PostgreSQL** 14+ (via Docker or local)
- **Python** 3.11+ with [uv](https://docs.astral.sh/uv/) (for scheduler only)
- **OpenAI-compatible API key** (e.g., Alibaba Cloud Bailian / OpenAI / DeepSeek)

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
| `OPENAI_BASE_URL` | API base URL (for non-OpenAI providers) |
| `OPENAI_MODEL` | Model name (default: `qwen-plus`) |
| `MCP_BAILIAN_API_KEY` | Alibaba Cloud Bailian search API key |

### 3. Start Database

```bash
docker compose up -d postgres
# Schema is managed via native SQL / migrations (manual or tool-based)
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
│   │   ├── TimelineDebate.tsx   # Bull vs Bear debate timeline
│   │   ├── DeciderResult.tsx    # Final verdict card
│   │   ├── ResearchResults.tsx  # Agent collaboration panel
│   │   ├── RoundDecisionCard.tsx# Per-round judge decision
│   │   ├── MessageCard.tsx      # Chat message bubble
│   │   └── ChatInput.tsx        # Input with Shift+Enter support
│   ├── lib/
│   │   ├── agents/             # Sub-agent implementations
│   │   │   ├── db-agent.ts      # Database portfolio agent
│   │   │   ├── web-agent.ts     # Web search agent
│   │   │   └── quant-agent.ts   # Quantitative risk agent
│   │   ├── graph/              # LangGraph orchestration
│   │   │   ├── graph.ts         # Graph wiring (debate loop)
│   │   │   ├── state.ts         # Graph state annotations
│   │   │   ├── nodes.ts         # Debate + judge + verdict nodes
│   │   │   ├── nodes/agent-adapters.ts  # Agent → graph adapters
│   │   │   └── cio/            # CIO layer
│   │   │       ├── intent-planner.ts  # Query decomposition
│   │   │       ├── gate-keeper.ts     # Quality check + routing
│   │   │       └── direct-summary.ts  # Simple query shortcut
│   │   ├── tools/              # Database tool functions
│   │   ├── mcp/                # MCP search integration
│   │   └── llm/                # LLM client + streaming
│   └── types/                  # TypeScript type definitions
├── scheduler/                  # Python data sync service
│   └── src/                    # Fund NAV fetcher + cron jobs
├── src/                    # Application source code
└── docker-compose.yml          # PostgreSQL + services
```

---

## 🔧 Common Commands

```bash
# Development
pnpm dev                        # Start Next.js dev server (+ Postgres)
pnpm dev:web                    # Start Next.js only

# Database
# Use your preferred SQL tool or scripts

# Testing
pnpm test                       # Run unit tests (vitest)
pnpm typecheck                  # TypeScript type check

# Docker
pnpm up                         # Start all services
pnpm down                       # Stop all services
pnpm logs                       # View service logs
```

---

## ⚙️ Configuration & Usage Notes

### 1. Environment Variables (`.env.local`)

FinPal requires several API keys to function correctly. Copy `.env.local.example` to `.env.local` and fill in:

- **LLM Settings**: Controls the brain of the assistant.
  - `OPENAI_API_KEY`: Your model provider API key.
  - `OPENAI_BASE_URL`: The endpoint (e.g., `https://dashscope.aliyuncs.com/compatible-mode/v1` for Bailian or `https://api.deepseek.com`).
  - `OPENAI_MODEL`: The model name (e.g., `qwen-plus`, `deepseek-chat`).
- **Search Settings**:
  - `DASHSCOPE_API_KEY`: **Required** for the `Web-Agent` to perform searches via Alibaba Cloud Bailian.
- **Database**:
  - `DATABASE_URL`: `postgresql://finpal:finpal@localhost:5432/finpal` (standard for the included Docker setup).

### 2. Manual Setup Sequence

If `pnpm dev` fails or you are setting up for the first time:
```bash
# 1. Start Database
docker compose up -d postgres

# 2. Sync Schema
# (Use SQL scripts or tool-based migration)

# 3. (Optional) Run Scheduler for data sync
cd scheduler && uv sync && uv run -m src.main
```

### 3. Critical Notes

- **Proxy**: If you are in a restricted network, set `HTTP_PROXY` and `HTTPS_PROXY` in your `.env.local`.
- **Search Engine**: The system defaults to `bailian-websearch` via MCP. Ensure your `DASHSCOPE_API_KEY` has search permissions enabled in the Bailian console.
- **Port Conflicts**: Next.js runs on `3000`, Postgres on `5432`, and the Python Scheduler on `8001`. Ensure these ports are available.
- **Thinking Process**: The `deepseek-reasoner` (R1) model is highly recommended for the debate nodes for better reasoning quality.

---

## 🛠️ Tech Stack

| Layer | Technology |
|-------|-----------|
| **Frontend** | Next.js 16, React 19, TypeScript, Tailwind CSS 4 |
| **AI Orchestration** | LangGraph (LangChain.js), OpenAI-compatible LLMs |
| **Search** | Alibaba Cloud Bailian MCP (Model Context Protocol) |
| **Database** | PostgreSQL + Native SQL (pg) + Zod |
| **Data Sync** | Python + FastAPI + akshare + APScheduler |
| **Visualization** | Mermaid.js charts, ReactMarkdown |
| **Deployment** | Docker Compose |

---

## 📜 License

MIT
