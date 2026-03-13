'use client';

import { PlusCircle } from 'lucide-react';
import ConversationList from './ConversationList';
import { Conversation } from '@/types/conversation';

interface SidebarProps {
  conversations: Conversation[];
  currentConversationId: string | null;
  onSwitchConversation: (id: string) => void;
  onDeleteConversation: (id: string) => void;
  onNewConversation: () => void;
  onAddHolding?: () => void;
  onTogglePersona?: () => void;
}

export default function Sidebar({
  conversations,
  currentConversationId,
  onSwitchConversation,
  onDeleteConversation,
  onNewConversation,
  onAddHolding,
  onTogglePersona,
}: SidebarProps) {
  return (
    <aside className="w-72 shrink-0 border-r border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex flex-col">
      <div className="px-4 py-4 border-b border-slate-200 dark:border-slate-800">
        <div className="text-sm font-semibold text-slate-900 dark:text-slate-100">会话列表</div>
        <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">按主题管理你的对话</div>
      </div>

      <div className="p-3 space-y-2">
        <button
          onClick={onNewConversation}
          className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-sm px-4 py-2.5 transition-colors"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          新建会话
        </button>
        
        {onAddHolding && (
          <button
            onClick={onAddHolding}
            className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-medium text-sm px-4 py-2.5 transition-colors"
          >
            <PlusCircle className="w-4 h-4" />
            添加持仓
          </button>
        )}
      </div>

       <div className="flex-1 overflow-y-auto px-2 pb-3">
        <ConversationList
          conversations={conversations}
          currentConversationId={currentConversationId}
          onSwitchConversation={onSwitchConversation}
          onDeleteConversation={onDeleteConversation}
        />
      </div>

      {onTogglePersona && (
        <div className="p-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50">
          <button
            onClick={onTogglePersona}
            className="w-full flex items-center gap-3 p-3 rounded-2xl hover:bg-white dark:hover:bg-slate-800 border border-transparent hover:border-slate-200 dark:hover:border-slate-700 transition-all group"
          >
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-500/20 group-hover:scale-105 transition-transform">
              <span className="text-white font-black text-xs italic">DNA</span>
            </div>
            <div className="text-left">
              <p className="text-sm font-bold text-slate-800 dark:text-slate-200">我的投资画像</p>
              <p className="text-[10px] text-slate-500 font-semibold tracking-wider">PERSONA EVOLUTION</p>
            </div>
          </button>
        </div>
      )}
    </aside>
  );
}
