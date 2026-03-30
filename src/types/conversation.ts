export interface Conversation {
  id: string;
  title: string;
  messages: Message[];
  createdAt: number;
  updatedAt: number;
}

export interface RoundDecision {
  round: number;
  winner: 'optimistic' | 'pessimistic' | 'draw';
  shouldContinue: boolean;
  reason: string;
  isFinal?: boolean;
  pending?: boolean; // true while decider is still streaming
}

export interface DebateRound {
  round: number;
  optimisticAnswer?: string;
  pessimisticAnswer?: string;
  optimisticThinking?: string;
  pessimisticThinking?: string;
}

// ==================== 时间线事件类型 ====================

export type TimelineEventType =
  | 'read'        // 读取文件/数据
  | 'search'      // 网络搜索
  | 'db_query'    // 数据库查询
  | 'thinking'    // AI 思考/决策
  | 'analyze'     // 数据分析
  | 'skill_call'  // Skill 调用
  | 'complete';   // 完成

export interface EventLogEntry {
  id: string;
  label: string;
  detail?: string;
  status?: 'running' | 'success' | 'error';
  timestamp: number;
  source?: string;

  // 新增：事件类型（用于图标和样式）
  type?: TimelineEventType;

  // 新增：可展开的内容
  expandable?: boolean;
  expandedContent?: any;

  // 新增：元数据
  metadata?: {
    durationMs?: number;
    resultCount?: number;
    query?: string;
    tool?: string;
    gaps?: string[];
    step?: number;
  };
}

export interface Message {
  id: string;
  question: string;
  optimisticAnswer: string;
  pessimisticAnswer: string;
  optimisticThinking?: string;
  pessimisticThinking?: string;
  optimisticRebuttal?: string;
  pessimisticRebuttal?: string;
  debateWinner?: string;
  debateSummary?: string;
  searchResults?: any[];
  researchSummary?: any;
  engineUsage?: Record<string, number>;
  round?: number;
  timestamp: number;
  // Real-time search status
  status?: 'searching' | 'analyzing' | 'complete' | 'error';
  currentQuery?: string;
  findingsCount?: number;
  totalQueries?: number;
  dbResults?: any[]; // For storing database fetch results
  // Decider decisions per round
  decisions?: RoundDecision[];
  // Phase 4: Dynamic Agent Rendering Pipeline
  cioPlanning?: boolean;
  agentTasks?: Record<string, AgentTask>;
  finalVerdict?: FinalVerdict;
  // Deep Search logic reflections (depth -> reasoning)
  reflections?: Record<number, string>;
  // NEW: Multi-round debate support
  debateHistory?: DebateRound[];
  // NEW: Comprehensive search findings
  allFindings?: any[];
  // NEW: Event timeline for live activity updates
  eventHistory?: EventLogEntry[];
  // NEW: Flag for ability-bound direct answers
  isDirectAnswer?: boolean;
}

export interface AgentTask {
  id: string;
  name: string;
  description: string;
  status: 'pending' | 'running' | 'done' | 'error';
  progressMessage?: string;
  progressLogs?: string[];
  rawResult?: any;
  resultSummary?: string;
  error?: string;
}

export interface FinalVerdict {
  summary: string;
  recommendation: 'strong_buy' | 'hold' | 'reduce' | 'avoid' | 'info_only';
  confidence: number;
  bullPoints: string[];
  bearPoints: string[];
  comparisonTable?: {
    fundCode: string;
    sharpe: number;
    mdd: number;
    recommendation: string;
  }[];
  riskWarnings: string[];
  sources: string[];
}
