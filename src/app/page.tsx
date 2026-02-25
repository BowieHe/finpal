'use client';

import { useState } from 'react';
import ChatInput from '@/components/ChatInput';
import MessageList from '@/components/MessageList';

interface Message {
  id: string;
  question: string;
  optimisticAnswer: string;
  pessimisticAnswer: string;
  timestamp: number;
}

export default function Home() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const handleSend = async (question: string) => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ question }),
      });

      if (!response.ok) {
        throw new Error('Failed to get response');
      }

      const data = await response.json();

      const newMessage: Message = {
        id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        question: data.question,
        optimisticAnswer: data.optimisticAnswer,
        pessimisticAnswer: data.pessimisticAnswer,
        timestamp: Date.now(),
      };

      setMessages((prev) => [...prev, newMessage]);
    } catch (error) {
      console.error('Error:', error);
      alert('获取回答失败，请重试');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col min-h-screen">
      <header className="bg-slate-800/50 backdrop-blur-sm border-b border-slate-700 p-4">
        <h1 className="text-2xl font-bold text-white text-center">FinPal</h1>
        <p className="text-slate-400 text-center text-sm mt-1">乐观与悲观的双人格 AI 对话</p>
      </header>

      <MessageList messages={messages} />

      <ChatInput onSend={handleSend} disabled={isLoading} />
    </div>
  );
}
