'use client';

interface ConversationItemProps {
  title: string;
  isActive: boolean;
  onClick: () => void;
  onDelete: () => void;
}

export default function ConversationItem({ title, isActive, onClick, onDelete }: ConversationItemProps) {
  return (
    <div
      className={
        `group relative cursor-pointer rounded-xl px-3 py-2.5 border transition-colors ` +
        (isActive
          ? 'bg-indigo-50 border-indigo-200 text-indigo-900 dark:bg-indigo-500/10 dark:border-indigo-400/20 dark:text-indigo-200'
          : 'bg-transparent border-transparent hover:bg-slate-100 dark:hover:bg-slate-800/50 text-slate-700 dark:text-slate-200')
      }
      onClick={onClick}
    >
      <div className="flex items-center justify-between">
        <div className="flex-1 min-w-0 mr-2">
          <div
            className={
              'text-sm font-medium truncate ' +
              (isActive ? 'text-indigo-700 dark:text-indigo-200' : 'text-slate-900 dark:text-slate-100')
            }
          >
            {title}
          </div>
        </div>

        <button
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
          }}
          className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg hover:bg-red-500/10 dark:hover:bg-red-500/15 transition-opacity"
          title="删除会话"
        >
          <svg className="w-4 h-4 text-slate-400 hover:text-red-600 dark:text-slate-500 dark:hover:text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
        </button>
      </div>
    </div>
  );
}
