"use client";

import { useCallback, useEffect, useState } from "react";
import { Anchor, Check, Crown, Flag, MapPin, ScrollText, Swords, X } from "lucide-react";
import Modal from "@/components/ui/Modal";
import SeatsTab from "./SeatsTab";
import { formatBerries } from "@/lib/ui/format";
import TabBar from "@/components/motion/TabBar";

interface Req {
  id: string;
  label: string;
  met: boolean;
  detail: string;
}

interface WarView {
  id: string;
  kind: "MARINE" | "EMPEROR" | "REVOLUTION" | "JUSTICE";
  status: string;
  iAmAttacker: boolean;
  attackerName: string;
  defenderName: string;
  attackerScore: number;
  defenderScore: number;
  outcome: string | null;
  endsAt: string;
  log: string[];
}

interface State {
  faction: string;
  isEmperor: boolean;
  isWarlord: boolean;
  figure: boolean;
  seatTitle: string | null;
  seatWar: "REVOLUTION" | "JUSTICE" | null;
  emperor: { ok: boolean; checks: Req[]; seatsTaken: number; canProclaim: boolean; thrones: { id: string; name: string; kind: "canon" | "player"; location: string; here: boolean; block: string | null }[] };
  warlord: { ok: boolean; checks: Req[]; seatsTaken: number; tribute: number | null; tributeDueAt: string | null; tributeState: "ok" | "due" | "overdue" };
  war: WarView | null;
  pastWars: WarView[];
  warTargets: { id: string; name: string }[];
  here: { islandName: string; isMarineBase: boolean; isRevolutionBase: boolean; territoryOwner: string | null; territoryOwnerName: string | null };
  canAssaultHere: boolean;
  worldWars: { id: string; label: string; attackerName: string; defenderName: string; attackerScore: number; defenderScore: number; endsAt: string; mySide: "attacker" | "defender" | null; canEnlist: ("attacker" | "defender")[]; governmentCall?: boolean; log: string[] }[];
}

type Tab = "yonko" | "warlord" | "seats" | "war";

const SEAT_TAB: Record<string, string> = { MARINE: "Almirantes", REVOLUTIONARY: "Mando revolucionario", CP0: "Gorosei" };

function Checklist({ checks }: { checks: Req[] }) {
  return (
    <ul className="grid gap-1.5 sm:grid-cols-2" data-testid="requirements">
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

export default function SovereigntyPanel({ characterId, onClose, onChanged }: { characterId: string; onClose: () => void; onChanged: () => void }) {
  const [state, setState] = useState<State | null>(null);
  const [tab, setTab] = useState<Tab>("yonko");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [fate, setFate] = useState<"spare" | "capture" | "kill">("spare");
  const [confirmResign, setConfirmResign] = useState(false);

  const refresh = useCallback(async () => {
    const res = await fetch(`/api/characters/${characterId}/sovereignty`);
    const data = await res.json().catch(() => ({}));
    if (res.ok) {
      setState(data);
      setTab((t) => (data.faction === "PIRATE" ? (t === "seats" ? "yonko" : t) : t === "yonko" ? (SEAT_TAB[data.faction] ? "seats" : "war") : t));
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
      const res = await fetch(`/api/characters/${characterId}/sovereignty`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
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

  const pirate = state?.faction === "PIRATE";
  const tabs: [Tab, string, typeof Crown][] = pirate
    ? [
        ["yonko", "Yonko", Crown],
        ["warlord", "Shichibukai", ScrollText],
        ["war", "Guerra", Swords],
      ]
    : state && SEAT_TAB[state.faction]
    ? [
        ["seats", SEAT_TAB[state.faction], Crown],
        ["war", "Guerra", Swords],
      ]
    : [["war", "Guerra", Swords]];

  return (
    <Modal onClose={onClose} testId="sovereignty-panel" size="lg" label="Poder" className="p-4 gap-3">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h3 className="font-display text-xl text-gold-bright flex items-center gap-2">
            <Crown className="w-5 h-5" />
            Poder en el mundo
          </h3>
          <p className="text-xs text-ink-dim">
            {state?.isEmperor ? "Eres uno de los Emperadores del mar." : state?.isWarlord ? "Tienes patente de Shichibukai." : state?.seatTitle ? `Eres ${state.seatTitle}.` : state && state.faction !== "PIRATE" ? "Puestos de mando y guerras abiertas." : "Tronos, patentes y guerras abiertas."}
            {state?.figure && <span className="text-gold"> · Figura mundial: los periódicos siguen cada uno de tus pasos.</span>}
          </p>
        </div>
        <button className="btn-ghost px-3 py-1.5 text-sm" onClick={onClose}>
          Cerrar
        </button>
      </div>

      <TabBar<Tab> value={tab} onChange={setTab} tabs={tabs.map(([id, label, Icon]) => ({ id, label, icon: Icon, testId: `sov-tab-${id}` }))} />

      {error && <p className="text-blood text-sm" data-testid="sov-error">{error}</p>}
      {notice && <p className="text-jade text-sm animate-rise" data-testid="sov-notice">{notice}</p>}
      {!state && !error && <p className="text-sm text-ink-dim">Consultando los despachos del Gobierno…</p>}

      {state && tab === "yonko" && pirate && (
        <div className="flex flex-col gap-3 animate-fade" data-testid="sov-yonko">
          <p className="text-sm text-ink-dim">
            Los Emperadores del mar son {state.emperor.seatsTaken}. Para ser uno de ellos hay que cumplirlo todo y, si no hay trono vacío, arrebatárselo a un Yonko en persona, allí donde esté. Si lo derrotas, su lugar (y sus dominios) son tuyos; su muerte o captura solo ocurre si el dueño del mundo lo aprueba.
          </p>
          {state.isEmperor ? (
            <p className="rounded border border-gold/60 bg-gold/5 p-3 text-sm text-gold-bright">Ya eres un Yonko. Los demás Emperadores y los almirantes te tienen en el punto de mira: cuida tus dominios.</p>
          ) : (
            <Checklist checks={state.emperor.checks} />
          )}
          {state.emperor.canProclaim && (
            <button className="btn-gold px-4 py-2 text-sm self-start" disabled={busy} onClick={() => op({ op: "proclaim" })} data-testid="sov-proclaim">
              Reclamar el trono vacío
            </button>
          )}
          {!state.isEmperor && (
            <>
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <span className="text-ink-dim">Si vences a un Emperador canon, ¿qué pides para él?</span>
                {(
                  [
                    ["spare", "Perdonarle"],
                    ["capture", "Capturarle"],
                    ["kill", "Acabar con él"],
                  ] as const
                ).map(([id, label]) => (
                  <button key={id} className={`chip ${fate === id ? "border-gold text-gold" : ""}`} onClick={() => setFate(id)} data-testid={`sov-fate-${id}`}>
                    {label}
                  </button>
                ))}
              </div>
              <p className="text-[11px] text-ink-dim">Capturar o matar a un personaje canon queda pendiente del veredicto del administrador; hasta entonces, solo pierde su trono.</p>
            </>
          )}
          <div className="flex flex-col divide-y divide-line">
            {state.emperor.thrones.map((t) => (
              <div key={t.id} className="flex flex-wrap items-center justify-between gap-2 py-2" data-testid="sov-throne">
                <span className="text-sm">
                  <span className="text-gold-bright font-display">{t.name}</span>
                  <span className="text-xs text-ink-dim inline-flex items-center gap-1 ml-2">
                    <MapPin className="w-3 h-3" />
                    {t.location}
                    {t.kind === "player" && " · jugador"}
                  </span>
                </span>
                {!state.isEmperor && t.kind === "canon" && (
                  <button className={t.block ? "btn-ghost px-3 py-1 text-xs" : "btn-gold px-3 py-1 text-xs"} disabled={busy || !!t.block} title={t.block ?? ""} onClick={() => op({ op: "challenge", actorId: t.id, fate })} data-testid="sov-challenge">
                    {t.here ? "Desafiar aquí" : "Desafiar"}
                  </button>
                )}
              </div>
            ))}
          </div>
          {!state.isEmperor && state.emperor.thrones.some((t) => t.kind === "canon" && !t.here) && <p className="text-[11px] text-ink-dim">Para desafiar a un Emperador tienes que estar en la misma isla que él. Su ubicación la ves aquí y en el Códice.</p>}
        </div>
      )}

      {state && tab === "seats" && !pirate && <SeatsTab characterId={characterId} onChanged={() => { onChanged(); refresh(); }} />}

      {state && tab === "warlord" && pirate && (
        <div className="flex flex-col gap-3 animate-fade" data-testid="sov-warlord">
          <p className="text-sm text-ink-dim">
            Los Siete Señores de la Guerra del Mar: piratas con patente del Gobierno ({state.warlord.seatsTaken}/7 asientos ocupados). La Marina no te caza ni te arresta y tu recompensa se congela, a cambio de un tributo semanal. Si dejas de pagar, matas a un agente del Gobierno o renuncias, pierdes la patente y tu recompensa sube.
          </p>
          {state.isWarlord ? (
            <div className="rounded border border-gold/60 bg-gold/5 p-3 flex flex-col gap-2">
              <p className="text-sm text-gold-bright">Eres un Shichibukai.</p>
              <p className="text-xs text-ink-dim">
                Tributo: {formatBerries(state.warlord.tribute ?? 0)} ·{" "}
                {state.warlord.tributeState === "ok" ? `al día hasta ${state.warlord.tributeDueAt ? new Date(state.warlord.tributeDueAt).toLocaleString("es-ES") : "—"}` : state.warlord.tributeState === "due" ? <span className="text-orange-300">vencido: tienes 24 h de gracia</span> : <span className="text-blood">impagado</span>}
              </p>
              <div className="flex flex-wrap gap-2">
                <button className="btn-gold px-3 py-1.5 text-xs" disabled={busy} onClick={() => op({ op: "warlord_tribute" })} data-testid="sov-tribute">
                  Pagar tributo
                </button>
                {!confirmResign ? (
                  <button className="btn-danger px-3 py-1.5 text-xs" disabled={busy} onClick={() => setConfirmResign(true)}>
                    Romper la patente
                  </button>
                ) : (
                  <>
                    <button className="btn-danger px-3 py-1.5 text-xs" disabled={busy} onClick={() => op({ op: "warlord_resign" }).then(() => setConfirmResign(false))} data-testid="sov-resign">
                      Sí, renuncio
                    </button>
                    <button className="btn-ghost px-3 py-1.5 text-xs" onClick={() => setConfirmResign(false)}>
                      No
                    </button>
                  </>
                )}
              </div>
            </div>
          ) : (
            <>
              <Checklist checks={state.warlord.checks} />
              <button className="btn-gold px-4 py-2 text-sm self-start" disabled={busy || !state.warlord.ok} onClick={() => op({ op: "warlord_apply" })} data-testid="sov-apply">
                Solicitar la patente
              </button>
            </>
          )}
        </div>
      )}

      {state && tab === "war" && (
        <div className="flex flex-col gap-3 animate-fade" data-testid="sov-war">
          {state.worldWars.length > 0 && (
            <div className="flex flex-col gap-2" data-testid="world-wars">
              <p className="text-xs uppercase tracking-wide text-orange-300">Guerras del mundo</p>
              {state.worldWars.map((w) => (
                <div key={w.id} className="rounded border border-orange-300/40 bg-orange-300/5 p-3 flex flex-col gap-1.5" data-testid="world-war">
                  <p className="text-xs text-ink-dim">{w.label}</p>
                  <p className="font-display text-gold-bright">
                    {w.attackerName} <span className="text-ink-dim text-sm">{w.attackerScore}–{w.defenderScore}</span> {w.defenderName}
                  </p>
                  <p className="text-[11px] text-ink-dim">Cada 12 h se libra un frente; gana quien llegue a 3 golpes (o el que más tenga el {new Date(w.endsAt).toLocaleDateString("es-ES")}). Nadie muere: se ganan y pierden islas.</p>
                  {w.log.length > 0 && <p className="text-xs">{w.log[w.log.length - 1]}</p>}
                  {w.mySide ? (
                    <p className="text-xs text-jade">Luchas en el bando de {w.mySide === "attacker" ? w.attackerName : w.defenderName}. Tus victorias en asaltos suman golpes y refuerzan a vuestros campeones en los frentes.</p>
                  ) : w.canEnlist.length > 0 ? (
                    <div className="flex flex-wrap gap-2 items-center">
                      {w.governmentCall && <p className="text-xs text-gold-bright basis-full" data-testid="war-government-call">El Gobierno Mundial reclama a sus Shichibukai en esta guerra. Quien lo desafíe perdería su patente.</p>}
                      {w.canEnlist.map((side) => (
                        <button key={side} className="btn-gold px-3 py-1 text-xs" disabled={busy} onClick={() => op({ op: "enlist", warId: w.id, side })} data-testid="war-enlist">
                          {w.governmentCall ? "Acudir a la llamada del Gobierno: " : "Alistarse con "}
                          {side === "attacker" ? w.attackerName : w.defenderName}
                        </button>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-ink-dim">Tu facción no participa en esta guerra.</p>
                  )}
                </div>
              ))}
            </div>
          )}
          {state.war ? (
            <div className="rounded border border-blood/60 bg-blood/10 p-3 flex flex-col gap-2" data-testid="sov-war-active">
              <p className="font-display text-gold-bright flex items-center gap-2">
                <Flag className="w-4 h-4" />
                {state.war.attackerName} contra {state.war.defenderName}
              </p>
              <div className="flex items-center gap-3 font-display text-2xl">
                <span className="text-gold-bright">{state.war.attackerScore}</span>
                <span className="text-ink-dim text-sm">a</span>
                <span className="text-[#f0907a]">{state.war.defenderScore}</span>
                <span className="text-xs text-ink-dim font-body">(gana quien llegue a 3 · termina el {new Date(state.war.endsAt).toLocaleDateString("es-ES")})</span>
              </div>
              <ul className="text-xs text-ink-dim list-disc pl-4">
                {state.war.log.map((l, i) => (
                  <li key={i}>{l}</li>
                ))}
              </ul>
              <p className="text-xs text-ink-dim">
                {state.war.kind === "MARINE"
                  ? state.war.iAmAttacker
                    ? "Golpea en una base de la Marina (Cuartel G-5, G-8 Navarone, Marineford, Nuevo Marineford...). Si hay un almirante en la isla, te enfrentas a él."
                    : "Como marine, contraataca los dominios del Yonko: cada isla recuperada es un punto."
                  : state.war.kind === "REVOLUTION"
                  ? state.war.iAmAttacker
                    ? "Golpea en cualquier base de la Marina o del Gobierno (Cuartel G-5, Loguetown, G-8 Navarone, Nuevo Marineford, Enies Lobby...). Cada victoria es un punto para la revolución."
                    : "Defiende al Gobierno: contraataca en las bases revolucionarias (Isla Baltigo, Reino Kamabakka). Cada victoria es un punto."
                  : state.war.kind === "JUSTICE"
                  ? state.war.iAmAttacker
                    ? `Guerra de justicia: asalta los dominios del Yonko ${state.war.defenderName}. Cada isla tomada es un punto.`
                    : "Te han declarado una guerra de justicia: golpea bases de la Marina para sumar puntos."
                  : "Asalta los dominios de tu rival: cada isla que tomes es un punto y pasa a tu bandera."}
              </p>
              <button className="btn-gold px-4 py-2 text-sm self-start" disabled={busy || !state.canAssaultHere} onClick={() => op({ op: "war_assault" })} data-testid="sov-assault">
                {state.canAssaultHere ? `Asaltar ${state.here.islandName}` : "Aquí no hay objetivo"}
              </button>
            </div>
          ) : state.isEmperor ? (
            <div className="flex flex-col gap-2">
              <p className="text-sm text-ink-dim">Como Yonko puedes declarar una guerra abierta. Dura hasta 7 días; gana quien sume 3 golpes decisivos.</p>
              <button className="btn-danger px-4 py-2 text-sm self-start inline-flex items-center gap-1.5" disabled={busy} onClick={() => op({ op: "declare_war", kind: "MARINE" })} data-testid="sov-war-marine">
                <Anchor className="w-4 h-4" />
                Declarar la guerra a la Marina
              </button>
              {state.warTargets.map((t) => (
                <button key={t.id} className="btn-ghost px-4 py-2 text-sm self-start" disabled={busy} onClick={() => op({ op: "declare_war", kind: "EMPEROR", targetId: t.id })}>
                  Declarar la guerra al Yonko {t.name}
                </button>
              ))}
            </div>
          ) : state.seatWar === "REVOLUTION" ? (
            <div className="flex flex-col gap-2">
              <p className="text-sm text-ink-dim">Como {state.seatTitle} puedes lanzar al Ejército Revolucionario contra el Gobierno Mundial. Todo revolucionario podrá golpear bases del Gobierno y todo marine o agente del CP-0 podrá contraatacar vuestras bases. Dura hasta 7 días; gana quien sume 3 golpes decisivos.</p>
              <button className="btn-danger px-4 py-2 text-sm self-start" disabled={busy} onClick={() => op({ op: "declare_war", kind: "REVOLUTION" })} data-testid="sov-war-revolution">
                Declarar la guerra al Gobierno Mundial
              </button>
            </div>
          ) : state.seatWar === "JUSTICE" ? (
            <div className="flex flex-col gap-2">
              <p className="text-sm text-ink-dim">Como Almirante de Flota puedes declarar una guerra de justicia contra un Yonko jugador: toda la Marina y el CP-0 podrán asaltar sus dominios.</p>
              {state.warTargets.length === 0 && <p className="text-xs text-ink-dim">Ahora mismo no hay ningún Yonko jugador libre de guerras.</p>}
              {state.warTargets.map((t) => (
                <button key={t.id} className="btn-danger px-4 py-2 text-sm self-start" disabled={busy} onClick={() => op({ op: "declare_war", kind: "JUSTICE", targetId: t.id })} data-testid="sov-war-justice">
                  Guerra de justicia contra {t.name}
                </button>
              ))}
            </div>
          ) : (
            <p className="text-sm text-ink-dim">
              {state.faction === "REVOLUTIONARY"
                ? "No hay guerra abierta. Solo el Líder o el Jefe de Estado Mayor revolucionario pueden declararla al Gobierno; cuando lo hagan, podrás golpear desde aquí."
                : state.faction === "MARINE" || state.faction === "CP0"
                ? "No hay ninguna guerra abierta ahora mismo. Cuando un Yonko o la revolución ataquen al Gobierno, o el Almirante de Flota declare una guerra de justicia, podrás luchar desde aquí."
                : "Solo un Yonko puede declarar guerras abiertas."}
            </p>
          )}
          {state.pastWars.length > 0 && (
            <div>
              <p className="text-xs text-ink-dim mb-1">Guerras pasadas</p>
              {state.pastWars.map((w) => (
                <p key={w.id} className="text-xs">
                  {w.attackerName} {w.attackerScore}–{w.defenderScore} {w.defenderName} · {w.outcome === "attacker" ? `vence ${w.attackerName}` : w.outcome === "defender" ? `vence ${w.defenderName}` : "tregua"}
                </p>
              ))}
            </div>
          )}
        </div>
      )}
    </Modal>
  );
}
