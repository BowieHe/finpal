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
  timestamp: number;
}
