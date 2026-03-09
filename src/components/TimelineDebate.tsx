"use client";

import { MessageCard, MessageCardProps } from "./MessageCard";

export interface TimelineMessage extends MessageCardProps {
  id?: string;
}

interface TimelineDebateProps {
  messages: TimelineMessage[];
}

export function TimelineDebate({ messages }: TimelineDebateProps) {
  if (messages.length === 0) return null;

  // Separate user messages and debate messages
  const userMessages = messages.filter((m) => m.role === "user");
  const debateMessages = messages.filter((m) => m.role !== "user");

  // Group debate messages into rounds
  const rounds: Array<{ optimistic?: TimelineMessage; pessimistic?: TimelineMessage }> = [];
  let currentRound: { optimistic?: TimelineMessage; pessimistic?: TimelineMessage } = {};
  
  debateMessages.forEach((msg) => {
    if (msg.role === "optimistic") {
      if (currentRound.optimistic) {
        rounds.push(currentRound);
        currentRound = { optimistic: msg };
      } else {
        currentRound.optimistic = msg;
      }
    } else if (msg.role === "pessimistic") {
      if (currentRound.pessimistic) {
        rounds.push(currentRound);
        currentRound = { pessimistic: msg };
      } else {
        currentRound.pessimistic = msg;
      }
    }
  });
  
  if (currentRound.optimistic || currentRound.pessimistic) {
    rounds.push(currentRound);
  }

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
          {/* Central vertical axis - behind the cards */}
          <div className="absolute left-1/2 -translate-x-1/2 top-5 bottom-5 w-px bg-gradient-to-b from-[#879A39] via-[#575653] to-[#D14D41]" />
          
          {/* Rounds container */}
          <div className="relative space-y-5">
            {rounds.map((round, roundIdx) => {
              const hasOptimistic = !!round.optimistic;
              const hasPessimistic = !!round.pessimistic;
              
              return (
                <div key={`round-${roundIdx}`} className="relative">
                  {hasOptimistic && hasPessimistic ? (
                    /* Overlapping layout - both cards in same grid cell */
                    <div className="grid grid-cols-1">
                      {/* Optimistic (多头) - Right side */}
                      <div className="col-start-1 row-start-1 flex justify-end pr-8">
                        {/* Timeline dot - green */}
                        <div className="absolute left-1/2 -translate-x-1/2 top-5 w-3 h-3 rounded-full border-2 border-[#100F0F] z-20 bg-[#879A39]" />
                        
                        {/* Connecting line - extends right only */}
                        <div className="absolute left-1/2 top-[26px] w-8 h-px bg-[#879A39]/50" />

                        <MessageCard
                          role={round.optimistic!.role}
                          content={round.optimistic!.content}
                          thinking={round.optimistic!.thinking}
                          timestamp={round.optimistic!.timestamp}
                        />
                      </div>

                      {/* Pessimistic (空头) - Left side, offset down 40px */}
                      <div className="col-start-1 row-start-1 flex justify-start pl-8 mt-10">
                        {/* Timeline dot - red */}
                        <div className="absolute left-1/2 -translate-x-1/2 top-[60px] w-3 h-3 rounded-full border-2 border-[#100F0F] z-20 bg-[#D14D41]" />
                        
                        {/* Connecting line - extends left only */}
                        <div className="absolute right-1/2 top-[66px] w-8 h-px bg-[#D14D41]/50" />

                        <MessageCard
                          role={round.pessimistic!.role}
                          content={round.pessimistic!.content}
                          thinking={round.pessimistic!.thinking}
                          timestamp={round.pessimistic!.timestamp}
                        />
                      </div>
                    </div>
                  ) : (
                    /* Single message layout */
                    <div className="relative">
                      {hasOptimistic && (
                        <div className="flex justify-end pr-8">
                          <div className="absolute left-1/2 -translate-x-1/2 top-5 w-3 h-3 rounded-full border-2 border-[#100F0F] z-20 bg-[#879A39]" />
                          <div className="absolute left-1/2 top-[26px] w-8 h-px bg-[#879A39]/50" />
                          <MessageCard
                            role={round.optimistic!.role}
                            content={round.optimistic!.content}
                            thinking={round.optimistic!.thinking}
                            timestamp={round.optimistic!.timestamp}
                          />
                        </div>
                      )}
                      {hasPessimistic && (
                        <div className="flex justify-start pl-8">
                          <div className="absolute left-1/2 -translate-x-1/2 top-5 w-3 h-3 rounded-full border-2 border-[#100F0F] z-20 bg-[#D14D41]" />
                          <div className="absolute right-1/2 top-[26px] w-8 h-px bg-[#D14D41]/50" />
                          <MessageCard
                            role={round.pessimistic!.role}
                            content={round.pessimistic!.content}
                            thinking={round.pessimistic!.thinking}
                            timestamp={round.pessimistic!.timestamp}
                          />
                        </div>
                      )}
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
