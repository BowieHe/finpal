/**
 * Sub-Agent 标准类型定义
 *
 * Phase 1: 专业化分工
 * 每个 Agent 都有明确的 Input/Output 契约，可独立调用和测试。
 */

// ==================== DB-Agent ====================

export type DBAgentTask =
  | 'portfolio_summary'
  | 'holding_detail'
  | 'compare_funds'
  | 'risk_metrics';

export interface DBAgentInput {
  task: DBAgentTask;
  params: {
    userId?: string;
    fundCode?: string;    // 单只基金查询
    fundCodes?: string[]; // 多只基金对比
    period?: '1y' | '3y' | 'ytd';
  };
  onProgress?: (msg: string) => void;
}

export interface DBAgentOutput {
  agentId: 'db-agent';
  task: DBAgentTask;
  status: 'success' | 'error';
  data: unknown;           // 实际数据，由调用方按 task 类型断言
  error?: string;          // status === 'error' 时填充
  durationMs: number;
}

// ==================== Web-Agent ====================

export type WebAgentTask = 'fund_info' | 'market_news' | 'manager_info';

export interface WebAgentInput {
  task: WebAgentTask;
  params: {
    query: string;
    fundCode?: string;   // 归属基金代码，便于后续多基金数据聚合
  };
  onProgress?: (msg: string) => void;
}

export interface WebAgentOutput {
  agentId: 'web-agent';
  task: WebAgentTask;
  fundCode?: string;       // 对应哪只基金（若有）
  status: 'success' | 'partial' | 'error';
  sources: string[];       // 信息来源 URL（可溯源）
  summary: string;         // 结构化摘要
  rawSnippets: Array<{ title: string; url: string; content: string }>; // 结构化的搜索结果片段
  error?: string;
  durationMs: number;
}

// ==================== Quant-Agent ====================

export interface QuantAgentInput {
  fundCode: string;
  priceHistory: number[];   // 历史净值序列（升序，最旧在前）
  dailyReturns?: number[];  // 可选：预计算的日收益率序列（百分比）
  riskFreeRate?: number;    // 无风险年化利率（默认 0.025 = 2.5%）
}

export interface QuantAgentOutput {
  agentId: 'quant-agent';
  fundCode: string;
  annualReturn: number | null;         // 年化收益率（%）
  annualizedVolatility: number | null; // 年化波动率（%）
  maxDrawdown: number | null;          // 最大回撤（%）
  sharpeRatio: number | null;          // 夏普比率
  calmarRatio: number | null;          // 卡玛比率 = 年化收益 / 最大回撤
  dataPoints: number;                  // 实际使用的数据点数
  insufficientData: boolean;           // 数据不足标记（< 20 个数据点）
  durationMs: number;
}

// ==================== 通用辅助类型 ====================

/** CIO 派发给各 Agent 的任务描述 */
export interface AgentTask {
  agent: 'db-agent' | 'web-agent' | 'quant-agent';
  task: string;
  params: Record<string, unknown>;
  priority: number;     // 同优先级的任务并行执行
  canSkip: boolean;     // Gate Keeper：结果缺失时是否允许降级
}

/** CIO Intent Planner 的输出计划 */
export interface ExecutionPlan {
  requiresDebate: boolean;  // 是否需要进入辩论分析团队
  tasks: AgentTask[];
}
