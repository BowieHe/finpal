"use client";

import { useState, useMemo } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import ReactMarkdown from "react-markdown";

export interface MessageCardProps {
    role: "user" | "optimistic" | "pessimistic";
    content: string;
    thinking?: string;
    timestamp?: number;
}

const roleConfig: Record<string, { side: "center" | "left" | "right"; emoji?: string; name: string; bg: string; border: string; text: string }> = {
    user: {
        side: "center",
        bg: "bg-slate-700",
        border: "border-slate-600",
        text: "text-white",
        name: "用户",
    },
    optimistic: {
        side: "right",
        emoji: "🐂",
        name: "多头",
        bg: "bg-[#1C1B1A]",
        border: "border-[#879A39]/30",
        text: "text-[#879A39]",
    },
    pessimistic: {
        side: "left",
        emoji: "🐻",
        name: "空头",
        bg: "bg-[#1C1B1A]",
        border: "border-[#D14D41]/30",
        text: "text-[#D14D41]",
    },
};

const createMarkdownComponents = (color: string) => ({
    p: ({ children }: { children?: React.ReactNode }) => (
        <p className="mb-2 last:mb-0 whitespace-pre-wrap">{children}</p>
    ),
    ul: ({ children }: { children?: React.ReactNode }) => (
        <ul className="list-disc list-inside mb-2 text-left">{children}</ul>
    ),
    ol: ({ children }: { children?: React.ReactNode }) => (
        <ol className="list-decimal list-inside mb-2 text-left">{children}</ol>
    ),
    li: ({ children }: { children?: React.ReactNode }) => (
        <li className="mb-1">{children}</li>
    ),
    strong: ({ children }: { children?: React.ReactNode }) => (
        <strong className="font-semibold" style={{ color }}>
            {children}
        </strong>
    ),
    code: ({ children }: { children?: React.ReactNode }) => (
        <code className="bg-[#282726] px-1 rounded text-xs">{children}</code>
    ),
    h1: ({ children }: { children?: React.ReactNode }) => (
        <h1 className="text-lg font-bold mb-2" style={{ color }}>
            {children}
        </h1>
    ),
    h2: ({ children }: { children?: React.ReactNode }) => (
        <h2 className="text-base font-bold mb-2" style={{ color }}>
            {children}
        </h2>
    ),
    h3: ({ children }: { children?: React.ReactNode }) => (
        <h3 className="text-sm font-bold mb-1" style={{ color }}>
            {children}
        </h3>
    ),
});

export function MessageCard({ role, content, thinking, timestamp }: MessageCardProps) {
    const [showThinking, setShowThinking] = useState(false);
    const config = roleConfig[role];
    const isUser = role === "user";
    const isRight = config.side === "right";
    const color = isUser ? "#94a3b8" : (role === "optimistic" ? "#879A39" : "#D14D41");

    const components = useMemo(() => createMarkdownComponents(color), [color]);

    if (isUser) {
        return (
            <div className="flex justify-center my-4">
                <div className={`${config.bg} border ${config.border} rounded-2xl px-6 py-3 max-w-[80%] shadow-lg`}>
                    <div className={`text-sm ${config.text} leading-relaxed`}>
                        <ReactMarkdown components={components}>
                            {content}
                        </ReactMarkdown>
                    </div>
                    {timestamp && (
                        <div className="mt-1 text-xs text-slate-400 text-right">
                            {new Date(timestamp).toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" })}
                        </div>
                    )}
                </div>
            </div>
        );
    }

    return (
        <div className={`w-[46%] ${isRight ? "ml-[54%]" : "mr-[54%]"} ${isRight ? "text-right" : "text-left"}`}>
            <div className={`${config.bg} ${config.border} border rounded-xl p-4 shadow-lg shadow-black/20 backdrop-blur-sm`}>
                {/* Header */}
                <div className={`flex items-center gap-2 mb-3 ${isRight ? "flex-row-reverse" : "flex-row"}`}>
                    <div className="w-8 h-8 rounded-full bg-[#282726] flex items-center justify-center text-lg">
                        {config.emoji}
                    </div>
                    <div className={isRight ? "text-right" : "text-left"}>
                        <div className={`text-sm font-medium ${config.text}`}>
                            {config.name}
                        </div>
                    </div>
                </div>

                {/* Thinking */}
                {thinking && (
                    <div className="mb-3">
                        <button
                            onClick={() => setShowThinking(!showThinking)}
                            className={`flex items-center gap-1 text-xs text-[#6F6E69] hover:text-[#CECDC3] transition-colors ${
                                isRight ? "flex-row-reverse ml-auto" : "flex-row"
                            }`}
                        >
                            {showThinking ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                            <span>思考过程</span>
                        </button>
                        {showThinking && (
                            <div
                                className={`mt-2 p-3 rounded-lg bg-[#100F0F]/50 text-xs text-[#9F9D96] leading-relaxed border border-[#343331]/50 ${
                                    isRight ? "text-right" : "text-left"
                                }`}
                            >
                                {thinking}
                            </div>
                        )}
                    </div>
                )}

                {/* Content */}
                <div className={`text-sm text-[#CECDC3] leading-relaxed ${isRight ? "text-right" : "text-left"}`}>
                    <ReactMarkdown components={components}>
                        {content}
                    </ReactMarkdown>
                </div>

                {/* Timestamp */}
                {timestamp && (
                    <div className={`mt-2 text-xs text-[#6F6E69] ${isRight ? "text-right" : "text-left"}`}>
                        {new Date(timestamp).toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" })}
                    </div>
                )}
            </div>
        </div>
    );
}
