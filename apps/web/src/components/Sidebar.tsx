'use client';

import ConversationList from './ConversationList';
import { Conversation } from '@/types/conversation';

interface SidebarProps {
  conversations: Conversation[];
  currentConversationId: string | null;
  onSwitchConversation: (id: string) => void;
  onDeleteConversation: (id: string) => void;
  onNewConversation: () => void;
}

export default function Sidebar({
  conversations,
  currentConversationId,
  onSwitchConversation,
  onDeleteConversation,
  onNewConversation,
}: SidebarProps) {
  return (
    <aside className="w-72 shrink-0 border-r border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex flex-col">
      <div className="px-4 py-4 border-b border-slate-200 dark:border-slate-800">
        <div className="text-sm font-semibold text-slate-900 dark:text-slate-100">会话列表</div>
        <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">按主题管理你的对话</div>
      </div>

      <div className="p-3">
        <button
          onClick={onNewConversation}
          className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-sm px-4 py-2.5"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          新建会话
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-2 pb-3">
        <ConversationList
          conversations={conversations}
          currentConversationId={currentConversationId}
          onSwitchConversation={onSwitchConversation}
          onDeleteConversation={onDeleteConversation}
        />
      </div>
    </aside>
  );
}
