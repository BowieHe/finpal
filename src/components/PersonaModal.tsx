"use client";

import { X } from 'lucide-react';
import PersonaCard from './PersonaCard';

interface PersonaModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function PersonaModal({ isOpen, onClose }: PersonaModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      />
      
      {/* Modal */}
      <div className="relative w-full max-w-2xl bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
        <div className="flex justify-between items-center p-6 border-b border-slate-100 dark:border-slate-800">
          <h2 className="text-xl font-bold text-slate-900 dark:text-white">投资基因与行为分析</h2>
          <button 
            onClick={onClose}
            className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors"
          >
            <X className="w-5 h-5 text-slate-500" />
          </button>
        </div>
        
        <div className="p-6 max-h-[80vh] overflow-y-auto">
          <PersonaCard />
          
          <div className="mt-6 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-2xl border border-blue-100 dark:border-blue-900/30">
            <h4 className="text-sm font-bold text-blue-900 dark:text-blue-300 mb-1">💡 如何演化我的画像？</h4>
            <p className="text-xs text-blue-700 dark:text-blue-400 leading-relaxed">
              FinPal 会持续观察你的各种行为（如：上传持仓截图时的交易时点、在对话中表现出的情绪倾向、对投资建议的采纳情况等）。
              每产生 5 条新记录，系统将自动进行一次“递归合成”，使画像更贴合你的真实投资性格。
            </p>
          </div>
        </div>
        
        <div className="p-6 bg-slate-50 dark:bg-slate-900/50 border-t border-slate-100 dark:border-slate-800 flex justify-end">
          <button 
            onClick={onClose}
            className="px-6 py-2.5 bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-xl font-bold text-sm tracking-tight hover:opacity-90 transition-opacity"
          >
            完成
          </button>
        </div>
      </div>
    </div>
  );
}
