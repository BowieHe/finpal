"use client";

import { MessageCard } from "./MessageCard";
import RoundDecisionCard from "./RoundDecisionCard";
import { DebateRound } from "@/types/conversation";

interface TimelineDebateProps {
    debateRounds?: DebateRound[];
}

export function TimelineDebate({
    debateRounds = [],
}: TimelineDebateProps) {
    if (debateRounds.length === 0) return null;

    return (
        <div className="relative py-4">
            <div className="relative mt-8">
                <div className="relative space-y-5">
                    {debateRounds.map((round, roundIdx) => {
                        const hasOptimistic = Boolean(round.optimistic?.content);
                        const hasPessimistic = Boolean(round.pessimistic?.content);

                        return (
                            <div key={`round-${round.round}-${roundIdx}`} className="relative">
                                {hasOptimistic && hasPessimistic ? (
                                    <div className="grid grid-cols-1">
                                        <div className="absolute left-1/2 -translate-x-1/2 top-5 h-10 w-px bg-linear-to-b from-[#879A39] to-[#D14D41] z-10" />

                                        <div className="col-start-1 row-start-1 flex justify-end pr-8">
                                            <div className="absolute left-1/2 -translate-x-1/2 top-5 w-3 h-3 rounded-full border-2 border-[#100F0F] z-20 bg-[#879A39]" />
                                            <div className="absolute left-1/2 top-6.5 w-8 h-px bg-[#879A39]/50" />
                                            <MessageCard
                                                role="optimistic"
                                                content={round.optimistic?.content || ""}
                                                thinking={round.optimistic?.thinking}
                                            />
                                        </div>

                                        <div className="col-start-1 row-start-1 flex justify-start pl-8 mt-10">
                                            <div className="absolute left-1/2 -translate-x-1/2 top-15 w-3 h-3 rounded-full border-2 border-[#100F0F] z-20 bg-[#D14D41]" />
                                            <div className="absolute right-1/2 top-16.5 w-8 h-px bg-[#D14D41]/50" />
                                            <MessageCard
                                                role="pessimistic"
                                                content={round.pessimistic?.content || ""}
                                                thinking={round.pessimistic?.thinking}
                                            />
                                        </div>
                                    </div>
                                ) : (
                                    <div className="relative">
                                        {hasOptimistic && (
                                            <div className="flex justify-end pr-8">
                                                <div className="absolute left-1/2 -translate-x-1/2 top-5 w-3 h-3 rounded-full border-2 border-[#100F0F] z-20 bg-[#879A39]" />
                                                <div className="absolute left-1/2 top-6.5 w-8 h-px bg-[#879A39]/50" />
                                                <MessageCard
                                                    role="optimistic"
                                                    content={round.optimistic?.content || ""}
                                                    thinking={round.optimistic?.thinking}
                                                />
                                            </div>
                                        )}
                                        {hasPessimistic && (
                                            <div className="flex justify-start pl-8">
                                                <div className="absolute left-1/2 -translate-x-1/2 top-5 w-3 h-3 rounded-full border-2 border-[#100F0F] z-20 bg-[#D14D41]" />
                                                <div className="absolute right-1/2 top-6.5 w-8 h-px bg-[#D14D41]/50" />
                                                <MessageCard
                                                    role="pessimistic"
                                                    content={round.pessimistic?.content || ""}
                                                    thinking={round.pessimistic?.thinking}
                                                />
                                            </div>
                                        )}
                                    </div>
                                )}
                                {round.judge && (
                                    <div className="relative z-10">
                                        <RoundDecisionCard decision={round.judge} />
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}
