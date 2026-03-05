export interface Conversation {
  id: string;
  title: string;
  messages: Message[];
  createdAt: number;
  updatedAt: number;
}

export interface Message {
  id: string;
  question: string;
  optimisticAnswer: string;
  pessimisticAnswer: string;
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
}
