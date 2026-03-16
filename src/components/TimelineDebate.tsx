"use client";

import { MessageCard, MessageCardProps } from "./MessageCard";
import RoundDecisionCard, { RoundDecision } from "./RoundDecisionCard";
import { DebateRound } from "@/types/conversation";

export interface TimelineMessage extends MessageCardProps {
    id?: string;
}

interface TimelineDebateProps {
    messages: TimelineMessage[];
    decisions?: RoundDecision[];
    debateHistory?: DebateRound[];
}

export function TimelineDebate({
    messages,
    decisions = [],
    debateHistory = [],
}: TimelineDebateProps) {
    // If we have debateHistory, use it as the source of truth for rounds
    const hasHistory = debateHistory && debateHistory.length > 0;
    
    // Separate user messages
    const userMessages = messages.filter((m) => m.role === "user");
    const debateMessages = messages.filter((m) => m.role !== "user");

    // Group debate messages into rounds (legacy or fallback)
    const legacyRounds: Array<{
        optimistic?: TimelineMessage;
        pessimistic?: TimelineMessage;
    }> = [];
    
    if (!hasHistory) {
        let currentRound: {
            optimistic?: TimelineMessage;
            pessimistic?: TimelineMessage;
        } = {};

        debateMessages.forEach((msg) => {
            if (msg.role === "optimistic") {
                if (currentRound.optimistic) {
                    legacyRounds.push(currentRound);
                    currentRound = { optimistic: msg };
                } else {
                    currentRound.optimistic = msg;
                }
            } else if (msg.role === "pessimistic") {
                if (currentRound.pessimistic) {
                    legacyRounds.push(currentRound);
                    currentRound = { pessimistic: msg };
                } else {
                    currentRound.pessimistic = msg;
                }
            }
        });

        if (currentRound.optimistic || currentRound.pessimistic) {
            legacyRounds.push(currentRound);
        }
    }

    // Modern rounds from history
    const modernRounds = debateHistory.map(round => ({
        optimistic: round.optimisticAnswer ? {
            role: "optimistic" as const,
            content: round.optimisticAnswer,
            thinking: round.optimisticThinking,
            timestamp: undefined, // Add missing optional property
        } : undefined,
        pessimistic: round.pessimisticAnswer ? {
            role: "pessimistic" as const,
            content: round.pessimisticAnswer,
            thinking: round.pessimisticThinking,
            timestamp: undefined, // Add missing optional property
        } : undefined,
    }));

    const rounds = hasHistory ? modernRounds : legacyRounds;
    
    if (rounds.length === 0 && userMessages.length === 0) return null;

    return (
        <div className="relative py-4">
            {/* Render user messages at top */}
            {userMessages.map((msg, idx) => (
                <MessageCard
                    key={msg.id || `user-${idx}`}
                    role={msg.role}
                    content={msg.content}
                    thinking={msg.thinking}
                    timestamp={msg.timestamp}
                />
            ))}

            {/* Timeline container */}
            {rounds.length > 0 && (
                <div className="relative mt-8">
                    {/* Central vertical axis - removed per user request */}

                    {/* Rounds container */}
                    <div className="relative space-y-5">
                        {rounds.map((round, roundIdx) => {
                            const hasOptimistic = !!round.optimistic;
                            const hasPessimistic = !!round.pessimistic;
                            // 查找当前轮次的裁决（如果有）
                            const roundDecision = decisions.find(
                                (d) => d.round === roundIdx + 1,
                            );

                            return (
                                <div
                                    key={`round-${roundIdx}`}
                                    className="relative"
                                >
                                    {hasOptimistic && hasPessimistic ? (
                                        /* Overlapping layout - both cards in same grid cell */
                                        <div className="grid grid-cols-1">
                                            {/* Short vertical line connecting the two dots of this round only */}
                                            <div className="absolute left-1/2 -translate-x-1/2 top-5 h-10 w-px bg-linear-to-b from-[#879A39] to-[#D14D41] z-10" />

                                            {/* Optimistic (多头) - Right side */}
                                            <div className="col-start-1 row-start-1 flex justify-end pr-8">
                                                {/* Timeline dot - green */}
                                                <div className="absolute left-1/2 -translate-x-1/2 top-5 w-3 h-3 rounded-full border-2 border-[#100F0F] z-20 bg-[#879A39]" />

                                                {/* Connecting line - extends right only */}
                                                <div className="absolute left-1/2 top-6.5 w-8 h-px bg-[#879A39]/50" />

                                                <MessageCard
                                                    role={
                                                        round.optimistic!.role
                                                    }
                                                    content={
                                                        round.optimistic!
                                                            .content
                                                    }
                                                    thinking={
                                                        round.optimistic!
                                                            .thinking
                                                    }
                                                    timestamp={
                                                        round.optimistic!
                                                            .timestamp
                                                    }
                                                />
                                            </div>

                                            {/* Pessimistic (空头) - Left side, offset down 40px */}
                                            <div className="col-start-1 row-start-1 flex justify-start pl-8 mt-10">
                                                {/* Timeline dot - red */}
                                                <div className="absolute left-1/2 -translate-x-1/2 top-15 w-3 h-3 rounded-full border-2 border-[#100F0F] z-20 bg-[#D14D41]" />

                                                {/* Connecting line - extends left only */}
                                                <div className="absolute right-1/2 top-16.5 w-8 h-px bg-[#D14D41]/50" />

                                                <MessageCard
                                                    role={
                                                        round.pessimistic!.role
                                                    }
                                                    content={
                                                        round.pessimistic!
                                                            .content
                                                    }
                                                    thinking={
                                                        round.pessimistic!
                                                            .thinking
                                                    }
                                                    timestamp={
                                                        round.pessimistic!
                                                            .timestamp
                                                    }
                                                />
                                            </div>
                                        </div>
                                    ) : (
                                        /* Single message layout */
                                        <div className="relative">
                                            {hasOptimistic && (
                                                <div className="flex justify-end pr-8">
                                                    <div className="absolute left-1/2 -translate-x-1/2 top-5 w-3 h-3 rounded-full border-2 border-[#100F0F] z-20 bg-[#879A39]" />
                                                    <div className="absolute left-1/2 top-6.5 w-8 h-px bg-[#879A39]/50" />
                                                    <MessageCard
                                                        role={
                                                            round.optimistic!
                                                                .role
                                                        }
                                                        content={
                                                            round.optimistic!
                                                                .content
                                                        }
                                                        thinking={
                                                            round.optimistic!
                                                                .thinking
                                                        }
                                                        timestamp={
                                                            round.optimistic!
                                                                .timestamp
                                                        }
                                                    />
                                                </div>
                                            )}
                                            {hasPessimistic && (
                                                <div className="flex justify-start pl-8">
                                                    <div className="absolute left-1/2 -translate-x-1/2 top-5 w-3 h-3 rounded-full border-2 border-[#100F0F] z-20 bg-[#D14D41]" />
                                                    <div className="absolute right-1/2 top-6.5 w-8 h-px bg-[#D14D41]/50" />
                                                    <MessageCard
                                                        role={
                                                            round.pessimistic!
                                                                .role
                                                        }
                                                        content={
                                                            round.pessimistic!
                                                                .content
                                                        }
                                                        thinking={
                                                            round.pessimistic!
                                                                .thinking
                                                        }
                                                        timestamp={
                                                            round.pessimistic!
                                                                .timestamp
                                                        }
                                                    />
                                                </div>
                                            )}
                                        </div>
                                    )}
                                    {/* 显示当前轮次的裁决（在轮次内容之后） */}
                                    {roundDecision && (
                                        <div className="relative z-10">
                                            <RoundDecisionCard
                                                decision={roundDecision}
                                            />
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}
        </div>
    );
}
