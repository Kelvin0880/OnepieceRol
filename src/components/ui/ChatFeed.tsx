"use client";

import { forwardRef, type ReactNode } from "react";

export interface FeedMessage {
  id: string;
  text: string;
  kind: "mine" | "narrator" | "other";
  author?: string;
}

export function TypingIndicator({ label = "El narrador escribe..." }: { label?: string }) {
  return (
    <div className="bubble bubble-narrator flex items-center gap-2 text-ink-dim italic" data-testid="typing-indicator">
      <span className="flex gap-1" aria-hidden>
        <span className="typing-dot" />
        <span className="typing-dot" />
        <span className="typing-dot" />
      </span>
      {label}
    </div>
  );
}

// The one transcript renderer for scenes, party scenes, duels and joint fights.
const ChatFeed = forwardRef<
  HTMLDivElement,
  { messages: FeedMessage[]; empty?: ReactNode; typing?: string | null; className?: string; testId?: string; children?: ReactNode }
>(function ChatFeed({ messages, empty, typing, className = "", testId, children }, ref) {
  return (
    <div ref={ref} className={`flex flex-col gap-2.5 overflow-y-auto scrollbar-thin pr-1 ${className}`} data-testid={testId}>
      {messages.length === 0 && empty}
      {messages.map((m) => (
        <div key={m.id} className={`bubble ${m.kind === "mine" ? "bubble-mine" : m.kind === "narrator" ? "bubble-narrator" : "bubble-other"}`}>
          {m.kind !== "mine" && m.author && <div className="text-[10px] uppercase tracking-wider text-gold/80 mb-0.5 font-display">{m.author}</div>}
          {m.text}
        </div>
      ))}
      {typing && <TypingIndicator label={typing} />}
      {children}
    </div>
  );
});

export default ChatFeed;
