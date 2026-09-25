"use client";

import Modal from "@/components/ui/Modal";
import { useCallback, useEffect, useRef, useState } from "react";

interface Message {
  id: string;
  authorName: string;
  mine: boolean;
  text: string;
  at: string;
}

export default function DenDenPanel({ characterId, onClose }: { characterId: string; onClose: () => void }) {
  const [channel, setChannel] = useState("");
  const [scope, setScope] = useState<"faction" | "crew">("faction");
  const [hasCrew, setHasCrew] = useState(false);
  const [factionLabel, setFactionLabel] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);

  const refresh = useCallback(async () => {
    const res = await fetch(`/api/characters/${characterId}/denden?scope=${scope}`);
    if (!res.ok) {
      if (scope === "crew") setScope("faction");
      return;
    }
    const data = await res.json();
    setChannel(data.channel);
    setHasCrew(!!data.hasCrew);
    setFactionLabel(data.factionLabel ?? "");
    setMessages(data.messages);
  }, [characterId, scope]);

  useEffect(() => {
    refresh();
    const t = setInterval(refresh, 6000);
    return () => clearInterval(t);
  }, [refresh]);

  useEffect(() => {
    const box = boxRef.current;
    if (box) box.scrollTop = box.scrollHeight;
  }, [messages.length]);

  async function send() {
    const body = text.trim();
    if (!body || busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/characters/${characterId}/denden`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text: body, scope }) });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) setError(data.error ?? "No se pudo enviar.");
      else {
        setText("");
        await refresh();
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal onClose={onClose} testId="denden-panel" size="md" label="Den Den Mushi">
        <div className="flex items-start justify-between gap-3 p-4 border-b border-line">
          <div className="min-w-0">
            <h2 className="font-display text-xl text-gold">Den Den Mushi</h2>
            <p className="text-xs text-ink-dim">
              Canal de <strong className="text-ink" data-testid="denden-channel">{channel || "…"}</strong>: {scope === "crew" ? "solo lo oyen los miembros de tu tripulación." : "solo lo oyen los de tu facción."}
            </p>
            {hasCrew && (
              <div className="flex gap-2 mt-2">
                <button className={`px-3 py-1 text-xs rounded border ${scope === "faction" ? "border-gold text-gold" : "border-line text-ink-dim"}`} onClick={() => { setMessages([]); setScope("faction"); }} data-testid="denden-tab-faction">
                  {factionLabel || "Facción"}
                </button>
                <button className={`px-3 py-1 text-xs rounded border ${scope === "crew" ? "border-gold text-gold" : "border-line text-ink-dim"}`} onClick={() => { setMessages([]); setScope("crew"); }} data-testid="denden-tab-crew">
                  Tripulación
                </button>
              </div>
            )}
          </div>
          <button className="btn-ghost px-3 py-1.5 text-sm" onClick={onClose}>
            Cerrar
          </button>
        </div>
        <div ref={boxRef} className="flex flex-col gap-2 p-4 overflow-y-auto h-72 sm:h-80 !shrink" data-testid="denden-messages">
          {messages.length === 0 && <p className="text-sm text-ink-dim">Silencio en la línea. Sé el primero en hablar.</p>}
          {messages.map((m) => (
            <div key={m.id} className={`max-w-[85%] rounded px-3 py-2 text-sm whitespace-pre-line break-words ${m.mine ? "self-end bg-gold/20 border border-gold/40" : "self-start border border-line"}`} data-testid="denden-message">
              {!m.mine && <div className="text-[11px] text-gold mb-0.5">{m.authorName}</div>}
              {m.text}
            </div>
          ))}
        </div>
        <div className="p-4 border-t border-line flex flex-col gap-2">
          {error && <p className="text-xs text-blood" data-testid="denden-error">{error}</p>}
          <textarea className="w-full text-sm bg-transparent border border-line rounded px-3 py-2 min-h-16" maxLength={400} placeholder="Habla por el caracol…" value={text} onChange={(e) => setText(e.target.value)} data-testid="denden-input" />
          <button className="btn-gold px-4 py-2 text-sm self-end" disabled={busy || !text.trim()} onClick={send} data-testid="denden-send">
            Enviar
          </button>
        </div>
    </Modal>
  );
}
