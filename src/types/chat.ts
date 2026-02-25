export interface ChatMessage {
  id: string;
  question: string;
  optimisticAnswer: string;
  pessimisticAnswer: string;
  timestamp: number;
}

export interface ChatRequest {
  question: string;
}

export interface ChatResponse {
  question: string;
  optimisticAnswer: string;
  pessimisticAnswer: string;
}
