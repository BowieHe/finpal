'use client';

interface MessageListProps {
  messages: Array<{
    id: string;
    question: string;
    optimisticAnswer: string;
    pessimisticAnswer: string;
    timestamp: number;
  }>;
}

export default function MessageList({ messages }: MessageListProps) {
  if (messages.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="text-center text-slate-400">
          <div className="text-6xl mb-4">💭</div>
          <p className="text-xl">提出一个问题，看看两种人格的不同回答</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto space-y-6 p-4">
      {messages.map((message) => (
        <div key={message.id}>
          <div className="bg-slate-800/50 backdrop-blur-sm rounded-xl p-4 mb-4">
            <div className="text-slate-400 text-sm mb-2">
              {new Date(message.timestamp).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}
            </div>
            <div className="text-white text-lg font-semibold">{message.question}</div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-gradient-to-br from-green-900/30 to-green-800/20 backdrop-blur-sm rounded-xl p-6 border border-green-700/30">
              <div className="flex items-center gap-2 mb-4">
                <span className="text-2xl">😊</span>
                <h3 className="text-green-400 font-bold text-lg">乐观派</h3>
              </div>
              <p className="text-green-100 whitespace-pre-wrap leading-relaxed">{message.optimisticAnswer}</p>
            </div>

            <div className="bg-gradient-to-br from-red-900/30 to-red-800/20 backdrop-blur-sm rounded-xl p-6 border border-red-700/30">
              <div className="flex items-center gap-2 mb-4">
                <span className="text-2xl">😟</span>
                <h3 className="text-red-400 font-bold text-lg">悲观派</h3>
              </div>
              <p className="text-red-100 whitespace-pre-wrap leading-relaxed">{message.pessimisticAnswer}</p>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
