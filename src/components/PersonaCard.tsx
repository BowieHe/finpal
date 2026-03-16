"use client";

import { useEffect, useState } from 'react';
import { Sparkles, History, TrendingUp, AlertTriangle, RefreshCcw } from 'lucide-react';

export default function PersonaCard() {
  const [data, setData] = useState<{ profile: any; recentLogs: any[] } | null>(null);
  const [loading, setLoading] = useState(true);
  const [isSynthesizing, setIsSynthesizing] = useState(false);

  const fetchProfile = async () => {
    try {
      const res = await fetch('/api/user-profile');
      const json = await res.json();
      if (json.success) {
        setData(json.data);
      }
    } catch (err) {
      console.error('Failed to fetch profile', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSynthesize = async () => {
    setIsSynthesizing(true);
    try {
      const res = await fetch('/api/user-profile', {
        method: 'POST',
        body: JSON.stringify({ force: true })
      });
      const json = await res.json();
      if (json.success) {
        await fetchProfile();
      }
    } catch (err) {
      console.error('Synthesis failed', err);
    } finally {
      setIsSynthesizing(false);
    }
  };

  useEffect(() => {
    fetchProfile();
  }, []);

  if (loading) return <div className="p-4 animate-pulse">加载画像中...</div>;

  const profile = data?.profile;
  const logs = data?.recentLogs || [];

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-sm">
      <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50/50 dark:bg-slate-900/50">
        <div className="flex items-center gap-2">
          <div className="p-2 bg-indigo-100 dark:bg-indigo-900/40 rounded-lg">
            <Sparkles className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
          </div>
          <div>
            <h3 className="font-bold text-slate-800 dark:text-slate-100 italic">投资性格 (Investment Persona)</h3>
            <p className="text-[10px] text-slate-500 uppercase tracking-widest font-semibold flex items-center gap-1">
              Dynamic Evolution <span className="w-1 h-1 bg-green-500 rounded-full animate-pulse"></span>
            </p>
          </div>
        </div>
        <button 
          onClick={handleSynthesize}
          disabled={isSynthesizing}
          className="p-1.5 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-lg transition-colors group"
          title="重新合成画像"
        >
          <RefreshCcw className={`w-4 h-4 text-slate-400 group-hover:text-indigo-500 ${isSynthesizing ? 'animate-spin' : ''}`} />
        </button>
      </div>

      <div className="p-5 space-y-6">
        {profile ? (
          <>
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-indigo-600 dark:text-indigo-400">
                <TrendingUp className="w-4 h-4" />
                <span className="text-sm font-bold tracking-tight">核心特质</span>
              </div>
              <p className="text-2xl font-black text-slate-900 dark:text-white leading-tight">
                {profile.persona}
              </p>
              <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                {profile.summary}
              </p>
            </div>

            <div className="grid grid-cols-3 gap-3">
              {Object.entries(profile.styles || {}).map(([key, val]: [string, any]) => (
                <div key={key} className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-100 dark:border-slate-800">
                  <p className="text-[10px] text-slate-500 uppercase font-bold mb-1">{key}</p>
                  <div className="flex items-end gap-1">
                    <span className="text-xl font-black text-slate-900 dark:text-white">{val}</span>
                    <span className="text-[10px] text-slate-400 mb-1">/100</span>
                  </div>
                  <div className="mt-2 h-1 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-indigo-500 rounded-full" 
                      style={{ width: `${val}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>

            <div className="space-y-3">
              <div className="flex items-center gap-2 text-amber-500">
                <AlertTriangle className="w-3 h-3" />
                <span className="text-[10px] font-bold uppercase tracking-wider">识别出的心理偏差 (Biases)</span>
              </div>
              <div className="flex flex-wrap gap-2">
                {profile.biases.map((bias: string) => (
                  <span key={bias} className="px-2 py-1 bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-500 rounded-md text-[10px] font-bold border border-amber-100/50 dark:border-amber-900/30">
                    # {bias}
                  </span>
                ))}
              </div>
            </div>

            <div className="pt-4 border-t border-slate-100 dark:border-slate-800 space-y-3">
              <div className="flex items-center gap-2 text-slate-500">
                <History className="w-3 h-3" />
                <span className="text-[10px] font-bold uppercase tracking-wider">近期演进日志</span>
              </div>
              <div className="p-3 bg-indigo-50/50 dark:bg-indigo-900/10 border border-indigo-100/50 dark:border-indigo-900/20 rounded-lg">
                <p className="text-xs text-indigo-900/70 dark:text-indigo-300 leading-snug font-medium italic">
                  "{profile.evolutionaryLog}"
                </p>
              </div>
            </div>
          </>
        ) : (
          <div className="py-8 text-center space-y-4">
            <div className="inline-flex p-4 bg-slate-50 dark:bg-slate-800 rounded-2xl">
              <History className="w-8 h-8 text-slate-300 dark:text-slate-600" />
            </div>
            <div className="space-y-1">
              <p className="text-sm font-bold text-slate-800 dark:text-slate-200">暂无画像数据</p>
              <p className="text-xs text-slate-500">上传截图或进行对话以积累证据</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
