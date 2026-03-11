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
