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
}
