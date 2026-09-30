"use client";

import { forwardRef, useEffect, useState, type ReactNode } from "react";
import { AnimatePresence, m } from "motion/react";
import { SPRING } from "@/components/motion/presets";
import { isSpeechSupported, stopSpeech, toggleSpeak, useSpeakingId } from "@/lib/ui/speech";

export interface FeedMessage {
  id: string;
  text: string;
  kind: "mine" | "narrator" | "other";
  author?: string;
}

export function TypingIndicator({ label = "El narrador escribe..." }: { label?: string }) {
  return (
    <m.div
      className="bubble bubble-narrator flex items-center gap-2 text-ink-dim italic"
      data-testid="typing-indicator"
      initial={{ opacity: 0, y: 8, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={SPRING.soft}
    >
      <span className="flex gap-1" aria-hidden>
        <span className="typing-dot" />
        <span className="typing-dot" />
        <span className="typing-dot" />
      </span>
      {label}
    </m.div>
  );
}

const GLOW = ["0 0 0 0 rgba(212,169,74,0)", "0 0 26px -4px rgba(212,169,74,0.55)", "0 0 0 0 rgba(212,169,74,0)"];

// Only messages that arrive after the feed mounted animate in (AnimatePresence initial={false}): opening a scene
// with sixty old messages costs nothing.
function enterFor(kind: FeedMessage["kind"]) {
  if (kind === "mine") return { initial: { opacity: 0, x: 24, y: 6, scale: 0.97 }, animate: { opacity: 1, x: 0, y: 0, scale: 1 }, transition: SPRING.soft };
  if (kind === "narrator")
    return {
      initial: { opacity: 0, x: -18, y: 10 },
      animate: { opacity: 1, x: 0, y: 0, boxShadow: GLOW },
      transition: { ...SPRING.soft, boxShadow: { duration: 1.6, times: [0, 0.3, 1] } },
    };
  return { initial: { opacity: 0, x: -18, y: 6 }, animate: { opacity: 1, x: 0, y: 0 }, transition: SPRING.soft };
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

function SpeakButton({ id, text }: { id: string; text: string }) {
  const speakingId = useSpeakingId();
  if (!isSpeechSupported()) return null;
  const speaking = speakingId === id;
  return (
    <button
      type="button"
      data-testid="speak-message"
      aria-label={speaking ? "Detener lectura" : "Escuchar mensaje"}
      title={speaking ? "Detener lectura" : "Escuchar mensaje"}
      onClick={() => toggleSpeak(id, text)}
      className={`block text-[10px] uppercase tracking-wider transition-colors ${speaking ? "text-gold" : "text-ink-dim/70 hover:text-gold"}`}
    >
      {speaking ? "Detener ⏸" : "Escuchar 🔊"}
    </button>
  );
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
      className="block text-[10px] uppercase tracking-wider text-ink-dim/70 hover:text-gold transition-colors"
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
  // Leaving a scene (panel close, page navigation) shouldn't leave a voice reading over whatever comes next.
  useEffect(() => stopSpeech, []);
  return (
    <div ref={ref} className={`flex flex-col gap-2.5 overflow-y-auto scrollbar-thin pr-1 ${className}`} data-testid={testId}>
      {messages.length === 0 && empty}
      <AnimatePresence initial={false}>
        {messages.map((msg) => (
          <m.div key={msg.id} className={`bubble ${msg.kind === "mine" ? "bubble-mine" : msg.kind === "narrator" ? "bubble-narrator" : "bubble-other"}`} {...enterFor(msg.kind)}>
            {msg.kind !== "mine" && msg.author && <div className="text-[10px] uppercase tracking-wider text-gold/80 mb-0.5 font-display">{msg.author}</div>}
            {msg.text}
            <div className="mt-1 flex items-center justify-end gap-3">
              {msg.kind === "narrator" && <SpeakButton id={msg.id} text={msg.text} />}
              <CopyButton text={msg.text} />
            </div>
          </m.div>
        ))}
      </AnimatePresence>
      {typing && <TypingIndicator label={typing} />}
      {children}
    </div>
  );
});

export default ChatFeed;
