'use client';

interface PersonaPanelProps {
  question: string;
  optimisticAnswer: string;
  pessimisticAnswer: string;
  timestamp: number;
}

export default function PersonaPanel({ question, optimisticAnswer, pessimisticAnswer, timestamp }: PersonaPanelProps) {
  const { formatTimestamp } = require('@/utils/format');

  return (
    <div className="max-w-6xl mx-auto p-4 space-y-4">
      <div className="bg-slate-800/50 backdrop-blur-sm rounded-xl p-4">
        <div className="text-slate-400 text-sm mb-2">{formatTimestamp(timestamp)}</div>
        <div className="text-white text-lg font-semibold">{question}</div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-gradient-to-br from-green-900/30 to-green-800/20 backdrop-blur-sm rounded-xl p-6 border border-green-700/30">
          <div className="flex items-center gap-2 mb-4">
            <span className="text-2xl">😊</span>
            <h3 className="text-green-400 font-bold text-lg">乐观派</h3>
          </div>
          <p className="text-green-100 whitespace-pre-wrap leading-relaxed">{optimisticAnswer}</p>
        </div>

        <div className="bg-gradient-to-br from-red-900/30 to-red-800/20 backdrop-blur-sm rounded-xl p-6 border border-red-700/30">
          <div className="flex items-center gap-2 mb-4">
            <span className="text-2xl">😟</span>
            <h3 className="text-red-400 font-bold text-lg">悲观派</h3>
          </div>
          <p className="text-red-100 whitespace-pre-wrap leading-relaxed">{pessimisticAnswer}</p>
        </div>
      </div>
    </div>
  );
}
