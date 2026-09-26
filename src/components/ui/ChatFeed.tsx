"use client";

import { forwardRef, useState, type ReactNode } from "react";

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

async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    try {
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      const ok = document.execCommand("copy");
      document.body.removeChild(ta);
      return ok;
    } catch {
      return false;
    }
  }
}

function CopyButton({ text }: { text: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      data-testid="copy-message"
      aria-label="Copiar mensaje"
      title="Copiar mensaje"
      onClick={async () => {
        if (await copyText(text)) {
          setDone(true);
          setTimeout(() => setDone(false), 1500);
        }
      }}
      className="mt-1 ml-auto block text-[10px] uppercase tracking-wider text-ink-dim/70 hover:text-gold transition-colors"
    >
      {done ? "Copiado ✓" : "Copiar"}
    </button>
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
          <CopyButton text={m.text} />
        </div>
      ))}
      {typing && <TypingIndicator label={typing} />}
      {children}
    </div>
  );
});

export default ChatFeed;
