"use client";

import { useCallback, useEffect, useState } from "react";
import { Check, ChevronRight, MapPin, Shield, Swords, X } from "lucide-react";

interface Req {
  id: string;
  label: string;
  met: boolean;
  detail: string;
}

interface Holder {
  kind: "canon" | "player";
  id: string;
  name: string;
  location: string;
  here: boolean;
  isMe: boolean;
  block: string | null;
}

interface Tier {
  id: string;
  title: string;
  seats: number;
  taken: number;
  hq: string;
  atHq: boolean;
  requirements: { ok: boolean; checks: Req[] };
  holders: Holder[];
  vacant: boolean;
}

export interface SeatState {
  faction: string;
  applies: boolean;
  ladderName: string | null;
  mySeat: { id: string; title: string } | null;
  islandName: string;
  tiers: Tier[];
  incoming: { id: string; seatTitle: string; challengerName: string; challengerKind: string; expiresAt: string | null; islandName: string | null; mustTravel: boolean }[];
  outgoing: { id: string; seatTitle: string; defenderName: string; expiresAt: string | null }[];
  active: { id: string; seatTitle: string; via: "duel" | "fight"; rival: string } | null;
  history: string[];
}

const hoursLeft = (iso: string | null) => (iso ? Math.max(0, Math.ceil((new Date(iso).getTime() - Date.now()) / 3600_000)) : null);

const INTRO: Record<string, string> = {
  MARINE: "Hay 3 Almirantes y un único Almirante de Flota. No se llega por mérito: hay que desafiar a quien ocupa el puesto y vencerle. Si derrotas a un Almirante, tú pasas a ser Almirante y él baja a Vicealmirante. Para desafiar al Almirante de Flota tienes que ser Almirante: si ganas, os intercambiáis los puestos.",
  REVOLUTIONARY: "El Ejército Revolucionario tiene 5 Comandantes, un Jefe de Estado Mayor y un Líder. Cada escalón se gana desafiando a quien lo ocupa: si ganas, os intercambiáis los puestos (el Comandante derrotado vuelve a ser oficial). El Líder y el Jefe de Estado Mayor pueden declarar la guerra al Gobierno Mundial.",
  CP0: "Los Cinco Ancianos (Gorosei) son el poder visible más alto del Gobierno. Solo un agente con la confianza suficiente puede desafiar a uno de ellos en Mary Geoise (o donde lo encuentre). Si le vences, ocupas su asiento.",
};

function Checklist({ checks }: { checks: Req[] }) {
  return (
    <ul className="grid gap-1.5 sm:grid-cols-2" data-testid="seat-requirements">
      {checks.map((c) => (
        <li key={c.id} className={`flex items-start gap-2 rounded border px-2.5 py-1.5 text-xs ${c.met ? "border-jade/40 bg-jade/5" : "border-line bg-black/10"}`}>
          {c.met ? <Check className="w-4 h-4 text-jade shrink-0" /> : <X className="w-4 h-4 text-ink-dim shrink-0" />}
          <span>
            <span className={c.met ? "text-jade" : "text-ink"}>{c.label}</span>
            <span className="block text-ink-dim">{c.detail}</span>
          </span>
        </li>
      ))}
    </ul>
  );
}

export default function SeatsTab({ characterId, onChanged }: { characterId: string; onChanged: () => void }) {
  const [state, setState] = useState<SeatState | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const [confirmResign, setConfirmResign] = useState(false);
  const [confirmRefuse, setConfirmRefuse] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const res = await fetch(`/api/characters/${characterId}/seats`);
    const data = await res.json().catch(() => ({}));
    if (res.ok) {
      setState(data);
      // Open the tier that matters: the one you hold, or the next one up.
      setOpen((o) => o ?? (data.tiers.find((t: Tier) => !t.holders.some((h) => h.isMe))?.id ?? data.tiers[0]?.id ?? null));
    } else setError(data.error ?? "No se pudo cargar.");
  }, [characterId]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    refresh();
  }, [refresh]);

  async function op(body: Record<string, unknown>) {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const res = await fetch(`/api/characters/${characterId}/seats`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) setError(data.error ?? "No se pudo completar.");
      else {
        setNotice((data.log ?? []).join(" "));
        onChanged();
        await refresh();
      }
    } finally {
      setBusy(false);
    }
  }

  if (!state) return <p className="text-sm text-ink-dim">{error ?? "Consultando la cadena de mando…"}</p>;
  if (!state.applies) return <p className="text-sm text-ink-dim">Tu facción no tiene puestos de mando que disputar.</p>;

  return (
    <div className="flex flex-col gap-3 animate-fade" data-testid="sov-seats">
      <p className="text-sm text-ink-dim">{INTRO[state.faction]}</p>

      {error && <p className="text-blood text-sm" data-testid="seat-error">{error}</p>}
      {notice && <p className="text-jade text-sm animate-rise" data-testid="seat-notice">{notice}</p>}

      {state.incoming.map((i) => (
        <div key={i.id} className="rounded border border-blood/70 bg-blood/10 p-3 flex flex-col gap-2" data-testid="seat-incoming">
          <p className="text-sm text-gold-bright flex items-center gap-2">
            <Swords className="w-4 h-4" />
            {i.challengerName} te desafía por tu puesto de {i.seatTitle}
          </p>
          <p className="text-xs text-ink-dim">
            {i.challengerKind === "canon" ? `Si aceptas, ${i.challengerName} viene a tu isla y lucháis uno contra uno (a derrota, no a muerte).` : `El duelo es en ${i.islandName ?? "su isla"}, a derrota, no a muerte.`}{" "}
            Si lo rechazas o dejas pasar el tiempo, pierdes el puesto. {hoursLeft(i.expiresAt) !== null && <span className="text-orange-300">Quedan {hoursLeft(i.expiresAt)} h.</span>}
          </p>
          {i.mustTravel && <p className="text-xs text-orange-300">Para aceptar tienes que ir a {i.islandName}.</p>}
          <div className="flex flex-wrap gap-2">
            <button className="btn-gold px-3 py-1.5 text-xs" disabled={busy} onClick={() => op({ op: "respond", challengeId: i.id, accept: true })} data-testid="seat-accept">
              Aceptar el duelo
            </button>
            {confirmRefuse === i.id ? (
              <>
                <button className="btn-danger px-3 py-1.5 text-xs" disabled={busy} onClick={() => op({ op: "respond", challengeId: i.id, accept: false }).then(() => setConfirmRefuse(null))} data-testid="seat-refuse-confirm">
                  Sí, cedo el puesto
                </button>
                <button className="btn-ghost px-3 py-1.5 text-xs" onClick={() => setConfirmRefuse(null)}>
                  No
                </button>
              </>
            ) : (
              <button className="btn-ghost px-3 py-1.5 text-xs" disabled={busy} onClick={() => setConfirmRefuse(i.id)} data-testid="seat-refuse">
                Rechazar (pierdes el puesto)
              </button>
            )}
          </div>
        </div>
      ))}

      {state.active && (
        <p className="rounded border border-gold/60 bg-gold/5 p-3 text-sm text-gold-bright" data-testid="seat-active">
          Estás en pleno duelo contra {state.active.rival} por el puesto de {state.active.seatTitle}. {state.active.via === "duel" ? "Escribe tus movimientos en el panel del duelo." : "Escribe tus movimientos en el panel de la pelea."}
        </p>
      )}

      {state.outgoing.map((o) => (
        <div key={o.id} className="rounded border border-line bg-black/10 p-3 flex flex-wrap items-center justify-between gap-2 text-xs" data-testid="seat-outgoing">
          <span>
            Esperas la respuesta de {o.defenderName} (puesto de {o.seatTitle}). {hoursLeft(o.expiresAt) !== null && `Si no responde en ${hoursLeft(o.expiresAt)} h, el puesto es tuyo.`}
          </span>
          <button className="btn-ghost px-3 py-1 text-xs" disabled={busy} onClick={() => op({ op: "withdraw", challengeId: o.id })}>
            Retirar desafío
          </button>
        </div>
      ))}

      {state.mySeat && (
        <div className="rounded border border-gold/60 bg-gold/5 p-3 flex flex-wrap items-center justify-between gap-2" data-testid="seat-mine">
          <p className="text-sm text-gold-bright flex items-center gap-2">
            <Shield className="w-4 h-4" />
            Eres {state.mySeat.title}. Cualquiera que cumpla los requisitos puede desafiarte; el mundo también mandará aspirantes.
          </p>
          {!confirmResign ? (
            <button className="btn-ghost px-3 py-1 text-xs" disabled={busy} onClick={() => setConfirmResign(true)}>
              Renunciar
            </button>
          ) : (
            <span className="flex gap-2">
              <button className="btn-danger px-3 py-1 text-xs" disabled={busy} onClick={() => op({ op: "resign" }).then(() => setConfirmResign(false))}>
                Sí, renuncio
              </button>
              <button className="btn-ghost px-3 py-1 text-xs" onClick={() => setConfirmResign(false)}>
                No
              </button>
            </span>
          )}
        </div>
      )}

      <div className="flex flex-col gap-2">
        {[...state.tiers].reverse().map((t) => {
          const isOpen = open === t.id;
          const mine = t.holders.some((h) => h.isMe);
          return (
            <div key={t.id} className={`rounded border ${mine ? "border-gold/60" : "border-line"} bg-black/10`} data-testid="seat-tier">
              <button className="w-full flex items-center justify-between gap-2 px-3 py-2 text-left" onClick={() => setOpen(isOpen ? null : t.id)} data-testid={`seat-tier-${t.id}`}>
                <span className="font-display text-gold-bright">{t.title}</span>
                <span className="text-xs text-ink-dim flex items-center gap-1">
                  {t.taken}/{t.seats} ocupados
                  <ChevronRight className={`w-4 h-4 transition-transform ${isOpen ? "rotate-90" : ""}`} />
                </span>
              </button>
              {isOpen && (
                <div className="px-3 pb-3 flex flex-col gap-2">
                  {!mine && (
                    <>
                      <p className="text-xs text-ink-dim">{t.requirements.ok ? "Cumples todo: elige a quién desafiar." : "Para disputar este puesto te falta:"}</p>
                      <Checklist checks={t.requirements.checks} />
                    </>
                  )}
                  <div className="flex flex-col divide-y divide-line">
                    {t.holders.map((h) => (
                      <div key={h.id} className="flex flex-wrap items-center justify-between gap-2 py-2" data-testid="seat-holder">
                        <span className="text-sm">
                          <span className={h.isMe ? "text-jade font-display" : "text-gold-bright font-display"}>{h.isMe ? `${h.name} (tú)` : h.name}</span>
                          <span className="text-xs text-ink-dim inline-flex items-center gap-1 ml-2">
                            <MapPin className="w-3 h-3" />
                            {h.location}
                            {h.kind === "player" && !h.isMe && " · jugador"}
                          </span>
                        </span>
                        {!h.isMe && !mine && (
                          <span className="flex flex-col items-end gap-0.5">
                            <button className={h.block ? "btn-ghost px-3 py-1 text-xs" : "btn-gold px-3 py-1 text-xs"} disabled={busy || !!h.block} onClick={() => op({ op: "challenge", seat: t.id, targetKind: h.kind, targetId: h.id })} data-testid="seat-challenge">
                              Desafiar
                            </button>
                            {h.block && t.requirements.ok && <span className="text-[11px] text-ink-dim max-w-[16rem] text-right">{h.block}</span>}
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                  {t.vacant && !mine && (
                    <button className="btn-gold px-3 py-1.5 text-xs self-start" disabled={busy || !t.requirements.ok || !t.atHq} onClick={() => op({ op: "claim", seat: t.id })} data-testid="seat-claim">
                      {t.atHq ? "Reclamar el puesto vacante" : `Hay un puesto vacante: reclámalo en ${t.hq}`}
                    </button>
                  )}
                  {!mine && t.requirements.ok && <p className="text-[11px] text-ink-dim">Puedes desafiar en la misma isla que tu rival, o presentar el desafío en {t.hq} (tu rival acude allí). El duelo es uno contra uno y a derrota, nunca a muerte.</p>}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {state.history.length > 0 && (
        <div>
          <p className="text-xs text-ink-dim mb-1">Últimos cambios de mando</p>
          {state.history.map((h, i) => (
            <p key={i} className="text-xs">
              {h}
            </p>
          ))}
        </div>
      )}
    </div>
  );
}
