"use client";

import { useEffect, useRef, useState } from "react";
import { BedDouble, Dumbbell, Feather, Send, Swords } from "lucide-react";
import ChatFeed, { type FeedMessage } from "@/components/ui/ChatFeed";
import { ASSESSMENT_LABEL } from "./labels";
import type { Character, JointFightState, PartyState } from "./types";

function placeholderFor(character: Character, jointFight: JointFightState | null, duelActive: boolean, partyBlocksInput: boolean): string {
  if (jointFight?.status === "ACTIVE") return jointFight.me?.status === "DOWN" ? "Estás caído: espera el desenlace." : "Ej: Cubro a mis nakamas con mi guardia y contraataco a su costado.";
  if (duelActive) return "Ej: Giro sobre mi pie y intento un tajo ascendente a su guardia, rodeando su flanco.";
  if (character.pendingEncounter?.phase === "threat") return "Ej: Desenfundo mi espada y cargo contra él sin dudar.";
  if (character.pendingEncounter?.phase === "victory") return "Ej: Le perdono la vida y le advierto que no vuelva.";
  if (partyBlocksInput) return "Espera tu turno...";
  return "Ej: Entro al bar y me fijo si alguien interesante anda por ahí.";
}

// The heart of the game: the transcript and the box you write in live together, like a chat, so the answer to
// what you just wrote appears right above where you wrote it.
export default function ScenePanel({
  character,
  party,
  jointFight,
  duelActive,
  busy,
  freeText,
  setFreeText,
  onSubmit,
  doAction,
  onOoc,
  showLeaveConfirm,
  setShowLeaveConfirm,
  partyBlocksInput,
  partyTurnLabel,
  isMyTurnNow,
}: {
  character: Character;
  party: PartyState | null;
  jointFight: JointFightState | null;
  duelActive: boolean;
  busy: boolean;
  freeText: string;
  setFreeText: (s: string) => void;
  onSubmit: () => void;
  doAction: (body: Record<string, unknown>) => Promise<boolean>;
  onOoc: (starter: string) => void;
  showLeaveConfirm: boolean;
  setShowLeaveConfirm: (v: boolean) => void;
  partyBlocksInput: boolean;
  partyTurnLabel: string | null;
  isMyTurnNow: boolean;
}) {
  const [closeFightOpen, setCloseFightOpen] = useState(false);
  const [closeFightNote, setCloseFightNote] = useState("");
  const feedRef = useRef<HTMLDivElement>(null);
  const isDead = character.status === "DEAD";
  const isImprisoned = character.status === "IMPRISONED";
  const jointActive = jointFight?.status === "ACTIVE";
  const enc = character.pendingEncounter;

  const messages: FeedMessage[] = party
    ? party.messages.map((m) => ({ id: m.id, text: m.text, author: m.authorName, kind: m.authorCharacterId === character.id ? "mine" : m.authorCharacterId === null ? "narrator" : "other" }))
    : character.sceneMessages.map((m) => ({ id: m.id, text: m.text, kind: m.role === "player" ? "mine" : "narrator" }));

  useEffect(() => {
    const box = feedRef.current;
    if (box) box.scrollTo({ top: box.scrollHeight, behavior: "smooth" });
  }, [messages.length, busy]);

  const canWrite = !isDead && !isImprisoned;
  const inputDisabled = busy || partyBlocksInput || (!!jointActive && (jointFight?.me?.status !== "FIGHTING" || !!jointFight?.me?.submitted));

  return (
    <section className="panel p-4 flex flex-col gap-3 animate-rise" data-testid="scene-panel">
      <div className="flex items-center justify-between gap-2">
        <h3 className="font-display text-sm text-ink-dim flex items-center gap-2">
          <Feather className="w-4 h-4 text-gold" />
          {party ? "Escena compartida" : "Escena"}
        </h3>
        <button className="btn-ghost px-2 py-1 text-[11px]" onClick={() => onOoc(party ? "Somos varios en la escena y queremos pactar algo: " : "El narrador se equivocó en esto: ")} data-testid="ooc-scene">
          Fuera de rol
        </button>
      </div>

      <ChatFeed
        ref={feedRef}
        className="max-h-[60vh] sm:max-h-[520px] min-h-24"
        messages={messages}
        typing={busy ? "narrando..." : null}
        empty={<p className="text-sm text-ink-dim italic">{party ? "La escena del grupo empieza aquí." : "Escribe qué haces abajo para empezar a rolear."}</p>}
      />

      {canWrite && enc && (enc.phase === "threat" || enc.phase === "fighting") && (
        <div className="rounded-md border border-blood/70 bg-blood/10 p-3 animate-rise" data-testid="encounter-box">
          <p className="text-sm mb-1 flex items-center gap-1.5">
            <Swords className="w-4 h-4 text-blood shrink-0" />
            <span>
              {enc.phase === "threat" ? "Te enfrentas a" : "Sigues luchando contra"} <span className="text-gold-bright">{enc.enemyName}</span>.
            </span>
          </p>
          <p className={`text-xs ${ASSESSMENT_LABEL[enc.assessment].color}`}>{ASSESSMENT_LABEL[enc.assessment].text}</p>
          {enc.phase === "fighting" && (
            <div className="mt-2">
              {!closeFightOpen ? (
                <button data-testid="close-fight-open" className="text-xs underline text-ink-dim hover:text-gold" onClick={() => setCloseFightOpen(true)}>
                  ¿La pelea se atascó o ya terminó? Finalizarla
                </button>
              ) : (
                <div className="rounded border border-line p-2 animate-rise" data-testid="close-fight-panel">
                  <p className="text-xs mb-1">La IA leerá toda la pelea y decidirá cómo terminó de verdad (quién ganó, quién perdió o si nadie). Si quieres, cuéntale qué pasó:</p>
                  <textarea className="field w-full text-sm mb-2 px-2 py-1" rows={2} maxLength={500} placeholder="Opcional: por ejemplo, «ya lo derroté en el mensaje anterior»" value={closeFightNote} onChange={(e) => setCloseFightNote(e.target.value)} />
                  <div className="flex items-center gap-3">
                    <button
                      data-testid="close-fight-confirm"
                      className="btn-gold px-3 py-1.5 text-xs"
                      disabled={busy}
                      onClick={async () => {
                        const ok = await doAction({ action: "close_fight", note: closeFightNote.trim() || undefined });
                        if (ok) {
                          setCloseFightOpen(false);
                          setCloseFightNote("");
                        }
                      }}
                    >
                      {busy ? "Juzgando..." : "Sí, finalizar la pelea"}
                    </button>
                    <button className="text-xs underline text-ink-dim" onClick={() => setCloseFightOpen(false)}>
                      Cancelar
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {canWrite && enc?.phase === "victory" && (
        <div className="rounded-md border border-gold/60 bg-gold/5 p-3 animate-pop">
          <p className="text-sm">
            <span className="text-gold-bright">{enc.enemyName}</span> está derrotado y a tu merced. ¿Qué haces?
          </p>
        </div>
      )}

      {canWrite && (
        <div className="border-t border-line pt-3" data-testid="composer">
          <div className="flex items-center justify-between mb-1 gap-2">
            <label className="text-xs text-ink-dim" htmlFor="free-text">
              ¿Qué haces?
            </label>
            {partyTurnLabel && <span className={`text-xs ${isMyTurnNow ? "text-gold chip border-gold/60" : "text-ink-dim italic"}`}>{partyTurnLabel}</span>}
          </div>
          {showLeaveConfirm && (
            <div className="rounded-md border border-gold/60 p-3 mb-2 animate-rise">
              <p className="text-sm mb-2">¿Quieres separarte de tus nakamas?</p>
              <div className="flex gap-2">
                <button
                  className="btn-gold px-3 py-1.5 text-xs"
                  onClick={async () => {
                    setShowLeaveConfirm(false);
                    await doAction({ action: "confirm_leave_party" });
                  }}
                >
                  Sí, separarme
                </button>
                <button className="btn-ghost px-3 py-1.5 text-xs" onClick={() => setShowLeaveConfirm(false)}>
                  No, seguir con ellos
                </button>
              </div>
            </div>
          )}
          <textarea
            id="free-text"
            className="field w-full px-3 py-2 text-[15px] leading-relaxed resize-y min-h-24"
            rows={3}
            placeholder={placeholderFor(character, jointFight, duelActive, partyBlocksInput)}
            value={freeText}
            disabled={inputDisabled}
            onChange={(e) => setFreeText(e.target.value)}
            maxLength={6000}
            onKeyDown={(e) => {
              // Plain Enter is a line break (needed on mobile to separate what you say from what you do); sending is
              // the button or Ctrl/Cmd+Enter.
              if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
                e.preventDefault();
                onSubmit();
              }
            }}
          />
          <p className="text-[11px] text-ink-dim mt-1">
            Enter = salto de línea. Escribe lo que <em>dices</em> entre comillas y lo que <em>haces</em> aparte; lo que escribes es tu intención — el resultado lo decide el juego. Envía con el botón o Ctrl+Enter.
          </p>
          <div className="flex flex-wrap items-center gap-2 mt-2">
            <button className="btn-gold px-5 py-2 text-sm inline-flex items-center gap-1.5" disabled={busy || partyBlocksInput || !freeText.trim()} onClick={onSubmit}>
              <Send className="w-4 h-4" />
              Actuar
            </button>
            {party && (
              <button className="btn-ghost px-3 py-1.5 text-xs" disabled={busy} onClick={() => setShowLeaveConfirm(true)}>
                Separarte del grupo
              </button>
            )}
            {busy && (
              <span className="flex items-center gap-1.5 text-xs text-ink-dim">
                <span className="inline-block w-3.5 h-3.5 rounded-full border-2 border-gold/30 border-t-gold animate-spin" />
                Pensando...
              </span>
            )}
            <span className="ml-auto text-[10px] text-ink-dim tabular-nums">{freeText.length > 0 ? `${freeText.length}/6000` : ""}</span>
          </div>
          {!enc && (
            <div className="flex flex-wrap items-center gap-2 mt-3">
              <span className="text-xs text-ink-dim">O, para lo simple:</span>
              <button
                className="btn-ghost px-3 py-1.5 text-xs inline-flex items-center gap-1.5"
                disabled={busy || partyBlocksInput}
                onClick={() => (party ? doAction({ freeText: "Me pongo a entrenar un rato." }) : doAction({ action: "train" }))}
              >
                <Dumbbell className="w-3.5 h-3.5" />
                Entrenar
              </button>
              <button
                className="btn-ghost px-3 py-1.5 text-xs inline-flex items-center gap-1.5"
                disabled={busy || partyBlocksInput}
                onClick={() => (party ? doAction({ freeText: "Me tomo un momento para descansar." }) : doAction({ action: "rest" }))}
              >
                <BedDouble className="w-3.5 h-3.5" />
                Descansar
              </button>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
