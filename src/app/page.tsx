'use client';

import { useState, useEffect } from 'react';
import ChatInput from '@/components/ChatInput';
import MessageList from '@/components/MessageList';
import Sidebar from '@/components/Sidebar';
import SettingsModal from '@/components/SettingsModal';
import ThemeToggle from '@/components/ThemeToggle';
import { Conversation, Message } from '@/types/conversation';
import { LLMConfig, Theme } from '@/types/config';
import {
  getConversations,
  getCurrentConversation,
  createNewConversation,
  setCurrentConversationId,
  deleteConversation,
  addMessageToConversation,
  updateConversationTitle,
} from '@/lib/conversation';
import { getLLMConfig, setLLMConfig as persistLLMConfig } from '@/lib/config';
import { generateId } from '@/utils/format';

export default function Home() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [currentConversation, setCurrentConversation] = useState<Conversation | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [llmConfig, setLlmConfig] = useState<LLMConfig>(() => getLLMConfig());
  const [theme, setTheme] = useState<Theme>('dark');

  useEffect(() => {
    setConversations(getConversations());
    setCurrentConversation(getCurrentConversation());

    const savedTheme = (localStorage.getItem('finpal_theme') as Theme) || 'dark';
    setTheme(savedTheme);
    document.documentElement.classList.toggle('dark', savedTheme === 'dark');
  }, []);

  const handleSwitchConversation = (id: string) => {
    const conversation = conversations.find(c => c.id === id);
    if (conversation) {
      setCurrentConversation(conversation);
      setCurrentConversationId(id);
    }
  };

  const handleDeleteConversation = (id: string) => {
    deleteConversation(id);
    setConversations(getConversations());
    
    if (currentConversation?.id === id) {
      const updated = getCurrentConversation();
      setCurrentConversation(updated);
    }
  };

  const handleNewConversation = () => {
    const newId = createNewConversation();
    const nextConversations = getConversations();
    setConversations(nextConversations);
    const newConversation = nextConversations.find(c => c.id === newId);
    if (newConversation) {
      setCurrentConversation(newConversation);
    }
  };

  const ensureConversation = (): Conversation | null => {
    if (currentConversation) {
      return currentConversation;
    }

    const newId = createNewConversation();
    const nextConversations = getConversations();
    setConversations(nextConversations);
    const created = nextConversations.find(c => c.id === newId) || null;
    setCurrentConversation(created);
    return created;
  };

  const handleSend = async (question: string) => {
    const activeConversation = ensureConversation();
    if (!activeConversation) {
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ question, config: llmConfig }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.details || data.error || 'Failed to get response');
      }

      const newMessage: Message = {
        id: generateId(),
        question: data.question,
        optimisticAnswer: data.optimisticAnswer,
        pessimisticAnswer: data.pessimisticAnswer,
        optimisticRebuttal: data.optimisticRebuttal,
        pessimisticRebuttal: data.pessimisticRebuttal,
        debateWinner: data.debateWinner,
        debateSummary: data.debateSummary,
        searchResults: data.searchResults,
        researchSummary: data.researchSummary,
        engineUsage: data.engineUsage,
        round: data.round,
        timestamp: Date.now(),
      };

      addMessageToConversation(activeConversation.id, newMessage);
      
      if (activeConversation.messages.length === 0) {
        updateConversationTitle(activeConversation.id, question);
      }

      setConversations(getConversations());
      setCurrentConversation(getCurrentConversation());
    } catch (error) {
      console.error('Error:', error);
      const errorMsg = error instanceof Error ? error.message : '获取回答失败，请重试';
      alert(errorMsg);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaveSettings = (config: LLMConfig) => {
    setLlmConfig(config);
    persistLLMConfig(config);
    setIsSettingsOpen(false);
  };

  const handleToggleTheme = () => {
    const newTheme: Theme = theme === 'dark' ? 'light' : 'dark';
    setTheme(newTheme);
    document.documentElement.classList.toggle('dark', newTheme === 'dark');
    localStorage.setItem('finpal_theme', newTheme);
  };

  const messages = currentConversation?.messages || [];
  const activeTitle = currentConversation?.title || '新对话';

  return (
    <div className="h-[100dvh] bg-slate-100 dark:bg-slate-950">
      <div className="h-full grid grid-cols-[288px_1fr]">
        <Sidebar
          conversations={conversations}
          currentConversationId={currentConversation?.id || null}
          onSwitchConversation={handleSwitchConversation}
          onDeleteConversation={handleDeleteConversation}
          onNewConversation={handleNewConversation}
        />

        <main className="min-w-0 h-full flex flex-col bg-slate-50 dark:bg-slate-950">
          <header className="h-16 px-6 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex items-center justify-between">
            <div className="min-w-0">
              <h1 className="text-base font-semibold text-slate-900 dark:text-slate-100 truncate">{activeTitle}</h1>
              <p className="text-xs text-slate-500 dark:text-slate-400">双人格并行回答</p>
            </div>

            <div className="flex items-center gap-2">
              <ThemeToggle theme={theme} onToggle={handleToggleTheme} />
              <button
                onClick={() => setIsSettingsOpen(true)}
                className="inline-flex items-center justify-center w-10 h-10 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200"
                title="设置"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </button>
            </div>
          </header>

          <MessageList messages={messages} isLoading={isLoading} />
          <ChatInput onSend={handleSend} disabled={isLoading} />
        </main>
      </div>

      <SettingsModal
        isOpen={isSettingsOpen}
        config={llmConfig}
        onSave={handleSaveSettings}
        onClose={() => setIsSettingsOpen(false)}
      />
    </div>
  );
}
