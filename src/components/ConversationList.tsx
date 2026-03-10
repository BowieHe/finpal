'use client';

import ConversationItem from './ConversationItem';
import { Conversation } from '@/types/conversation';

interface ConversationListProps {
  conversations: Conversation[];
  currentConversationId: string | null;
  onSwitchConversation: (id: string) => void;
  onDeleteConversation: (id: string) => void;
}

export default function ConversationList({
  conversations,
  currentConversationId,
  onSwitchConversation,
  onDeleteConversation,
}: ConversationListProps) {
  if (conversations.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-10 px-4 text-center">
        <div className="w-14 h-14 rounded-2xl bg-slate-100 dark:bg-slate-800/60 flex items-center justify-center mb-4">
          <svg className="w-7 h-7 text-slate-400 dark:text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
          </svg>
        </div>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          暂无会话
        </p>
        <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">
          点击“新建会话”开始
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-1.5">
      {conversations.map((conversation) => (
        <ConversationItem
          key={conversation.id}
          title={conversation.title}
          isActive={conversation.id === currentConversationId}
          onClick={() => onSwitchConversation(conversation.id)}
          onDelete={() => onDeleteConversation(conversation.id)}
        />
      ))}
    </div>
  );
}
