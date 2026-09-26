"use client";

import { Anchor, Check, Coins, Crown, Flag, Lock, ScrollText, Siren, Skull, Target } from "lucide-react";
import StatBar from "@/components/ui/StatBar";
import { CELL_LABELS } from "@/lib/engine/impel-down";
import { formatBerries, formatMinutes } from "@/lib/ui/format";
import { useEffect, useState } from "react";
import type { AdmiralAlertState, BlackMarketState, BusterCallState, Character, MissionsState, RaidState, TerritoryState, WorldEventHere } from "./types";

type Act = (body: Record<string, unknown>, path?: string) => Promise<void>;

interface Common {
  act: Act;
  busy: boolean;
  error: string | null;
}

function ErrorLine({ error }: { error: string | null }) {
  return error ? <p className="text-blood text-xs mt-2">{error}</p> : null;
}

function Title({ icon: Icon, children, tone = "text-gold-bright" }: { icon: typeof Anchor; children: React.ReactNode; tone?: string }) {
  return (
    <h3 className={`font-display text-lg flex items-center gap-2 ${tone}`}>
      <Icon className="w-5 h-5 shrink-0" />
      <span>{children}</span>
    </h3>
  );
}

export function PrisonCard({ character, act, busy, error, escapePlan, setEscapePlan }: Common & { character: Character; escapePlan: string; setEscapePlan: (s: string) => void }) {
  const imp = character.imprisonment!;
  return (
    <section className="panel panel-accent p-4 animate-rise">
      <Title icon={Lock}>Encarcelado en {character.currentIsland.name}</Title>
      <p className="text-sm mt-1 text-ink-dim">{imp.reason}</p>
      <p className="text-xs mt-2 text-ink-dim">
        {imp.cellLevel > 0 && <span className="block text-blood mb-1">Recluido en Impel Down — {CELL_LABELS[imp.cellLevel]}. Sin fianza posible.</span>}
        Nivel de poder necesario para rescatarte: <span className="text-gold">{imp.minRescueLevel}</span>
      </p>
      <ErrorLine error={error} />
      <div className="mt-3 flex flex-wrap items-center gap-2">
        {imp.bailBerries != null ? (
          <button className="btn-gold px-4 py-2 text-sm" disabled={busy || character.berries < imp.bailBerries} onClick={() => act({ op: "bail" })}>
            Pagar fianza ({formatBerries(imp.bailBerries)})
          </button>
        ) : (
          <span className="text-xs text-ink-dim">Esta captura no admite fianza.</span>
        )}
        <span className="text-xs text-ink-dim">o espera a que un aliado venga a rescatarte, o intenta fugarte tú mismo.</span>
      </div>
      <div className="mt-4 border-t border-line pt-3">
        <p className="text-sm font-display text-gold">Plan de fuga</p>
        <p className="text-xs text-ink-dim">
          Progreso: {imp.escapeProgress}/{imp.escapeNeeded} {imp.cellLevel > 0 ? "niveles" : "obstáculo"} · Alerta de los guardias: {imp.alert}/5. Cada intento tiene enfriamiento de 30 min; si te pillan, te llevan a un nivel más profundo y te hieren.
        </p>
        <div className="my-2 grid grid-cols-2 gap-3">
          <StatBar value={imp.escapeProgress} max={Math.max(1, imp.escapeNeeded)} color="var(--jade)" hideNumbers size="sm" />
          <StatBar value={imp.alert} max={5} color="var(--blood)" hideNumbers size="sm" />
        </div>
        <textarea
          className="field w-full px-3 py-2 text-sm resize-none"
          rows={3}
          placeholder="Ej: Espero al cambio de ronda, aflojo el barrote que llevo días limando y me cuelo por el conducto de ventilación."
          value={escapePlan}
          maxLength={3000}
          disabled={busy || imp.escapeCooldownMs > 0}
          onChange={(e) => setEscapePlan(e.target.value)}
        />
        <button
          className="btn-gold px-4 py-2 text-sm mt-2"
          disabled={busy || !escapePlan.trim() || imp.escapeCooldownMs > 0}
          onClick={async () => {
            await act({ op: "escape", plan: escapePlan });
            setEscapePlan("");
          }}
        >
          {imp.escapeCooldownMs > 0 ? `Espera ${Math.ceil(imp.escapeCooldownMs / 60000)} min` : "Intentar la fuga"}
        </button>
      </div>
    </section>
  );
}

function useCountdown(arrivesAt: string): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  return Math.max(0, new Date(arrivesAt).getTime() - now);
}

/** The Government sends an admiral: a loud alert with a live countdown, and the two honest options. */
export function AdmiralAlertPanel({ alert }: { alert: AdmiralAlertState }) {
  const left = useCountdown(alert.arrivesAt);
  const mm = String(Math.floor(left / 60000)).padStart(2, "0");
  const ss = String(Math.floor((left % 60000) / 1000)).padStart(2, "0");
  const arrived = alert.status === "ARRIVED" || left === 0;
  return (
    <section className="panel panel-danger p-4 animate-rise animate-danger sticky top-2 z-30" data-testid="admiral-alert" role="alert">
      <Title icon={Siren} tone="text-[#f0907a]">
        {arrived ? `¡El almirante ${alert.admiralName} está atacando ${alert.islandName}!` : `¡ALERTA! El almirante ${alert.admiralName} viene a ${alert.islandName}`}
      </Title>
      {!arrived && (
        <p className="font-display text-3xl text-gold-bright mt-2" data-testid="admiral-countdown">
          {mm}:{ss}
        </p>
      )}
      {alert.hunted ? (
        arrived ? (
          <p className="text-sm text-ink-dim mt-1">Ya no hay escapatoria: el combate contra el almirante es inevitable. Los que caigan serán capturados y el evento termina cuando todos hayan sido derrotados.</p>
        ) : (
          <p className="text-sm text-ink-dim mt-1">
            El Gobierno Mundial lo ha enviado a erradicar a los piratas de esta isla. Tienes dos opciones: <b className="text-gold">zarpar antes de que llegue</b> o <b className="text-gold">quedarte y enfrentarte a él</b> en cuanto desembarque, sin posibilidad de huir. Es un almirante: ataca sin piedad a todos y responde a cada acción.
          </p>
        )
      ) : (
        <p className="text-sm text-ink-dim mt-1">Un almirante de la Marina ha sido enviado contra los piratas de esta isla. A ti no te busca.</p>
      )}
    </section>
  );
}

export function BusterCallPanel({ busterCall, islandName, jointActive, act, busy, error }: Common & { busterCall: BusterCallState; islandName: string; jointActive: boolean }) {
  return (
    <section className="panel panel-danger p-4 animate-rise animate-danger" data-testid="buster-call">
      <Title icon={Siren} tone="text-[#f0907a]">
        ¡BUSTER CALL sobre {islandName}!
      </Title>
      <p className="text-sm text-ink-dim mt-1">{busterCall.reason}</p>
      <p className="text-sm mt-2">
        Oleada {busterCall.wave}/{busterCall.waves}: <span className="text-gold">{busterCall.waveName}</span> · Hundidas: {busterCall.wavesBroken}/{busterCall.waves} · Tiempo: {Math.ceil(busterCall.msLeft / 60000)} min
      </p>
      <div className="mt-2">
        <StatBar label="Oleadas hundidas" value={busterCall.wavesBroken} max={busterCall.waves} color="var(--gold)" size="sm" />
      </div>
      <p className="text-xs text-ink-dim mt-1">Si el tiempo se agota, la flota bombardea la isla: todos los que sigan aquí reciben un golpe brutal y el juez decide el destino de quien caiga. Defiende o zarpa.</p>
      <ErrorLine error={error} />
      <div className="flex flex-wrap gap-2 mt-3">
        <button className="btn-gold px-4 py-2 text-sm" disabled={busy || jointActive} onClick={() => act({ op: "defend" }, "buster-call")}>
          Defender contra la oleada
        </button>
        <button className="btn-ghost px-3 py-2 text-xs" disabled={busy} onClick={() => act({ op: busterCall.iAmMustered ? "unmuster" : "muster" }, "buster-call")}>
          {busterCall.iAmMustered ? "Salir de la línea de defensa" : "Sumarme a la defensa"} ({busterCall.musterCount})
        </button>
      </div>
    </section>
  );
}

export function MissionsPanel({ missions }: { missions: MissionsState }) {
  const open = missions.missions.filter((m) => m.status !== "DONE").length;
  return (
    <section className="panel p-4 animate-rise" data-testid="missions-panel">
      <div className="flex items-center justify-between gap-2">
        <Title icon={ScrollText}>Panorama y misiones de {missions.islandName}</Title>
        {missions.missions.length > 0 && <span className="chip shrink-0">{open} activas</span>}
      </div>
      {missions.briefing && (
        <details className="mt-2 group">
          <summary className="text-sm text-gold cursor-pointer select-none">Lo que debes saber de esta isla (toca para leer)</summary>
          <p className="text-sm mt-2 whitespace-pre-line animate-fade" data-testid="island-briefing">
            {missions.briefing.ready ? missions.briefing.text : "El narrador está reuniendo el panorama de la isla..."}
          </p>
        </details>
      )}
      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        {missions.missions.map((m) => (
          <div key={m.id} data-testid="mission" className={`rounded-md border px-3 py-2 ${m.status === "DONE" ? "border-jade/40 opacity-60" : m.isArc ? "border-gold/60 bg-gold/5" : "border-line bg-black/10"}`}>
            <p className="text-sm flex items-start gap-1.5">
              {m.status === "DONE" ? <Check className="w-4 h-4 text-jade shrink-0 mt-0.5" /> : <Target className="w-4 h-4 text-gold shrink-0 mt-0.5" />}
              <span className="text-gold">{m.title}</span>
            </p>
            <p className="text-xs text-ink-dim mt-0.5">{m.brief}</p>
            <p className="text-[11px] text-ink-dim mt-1">
              {formatBerries(m.berries)} · {m.xp} XP
            </p>
            <StatBar label="Progreso" value={m.progress} max={m.target} color="var(--gold)" size="sm" />
          </div>
        ))}
      </div>
      {missions.missions.length === 0 && <p className="text-xs text-ink-dim mt-2">Por ahora no hay encargos nuevos aquí: vuelve en un rato.</p>}
    </section>
  );
}

export function RaidPanel({ raid, jointActive, act, busy, error }: Common & { raid: RaidState; jointActive: boolean }) {
  return (
    <section className="panel panel-accent p-4 animate-rise" data-testid="raid-panel">
      <Title icon={Crown}>El Trono Vacío de {raid.islandName}</Title>
      {!raid.knowsTruth ? (
        <p className="text-sm text-ink-dim mt-1">Sientes que hay un poder oculto tras estos muros, pero aún no sabes cómo enfrentarlo. Solo quien ha llegado a Laugh Tale conoce la verdad.</p>
      ) : (
        <>
          <p className="text-sm text-ink-dim mt-1">
            {raid.status ? `Fase ${raid.phase}/${raid.phases}: ${raid.phaseName}.` : "Nadie ha reunido aún una coalición."}
            {raid.cooldownMs > 0 && ` La guardia se reorganiza (${Math.ceil(raid.cooldownMs / 60000)} min).`}
          </p>
          {raid.status && (
            <div className="mt-2">
              <StatBar label="Avance del asalto" value={raid.phase} max={raid.phases} color="var(--gold)" size="sm" />
            </div>
          )}
          {raid.muster.length > 0 && (
            <p className="text-sm mt-2">
              Coalición ({raid.muster.length}/{raid.maxParticipants}): <span className="text-gold">{raid.muster.map((m) => m.name).join(", ")}</span>
            </p>
          )}
          {raid.allies.length > 0 && (
            <p className="text-sm mt-1">
              Aliados: <span className="text-gold">{raid.allies.map((a) => a.name).join(", ")}</span>
            </p>
          )}
          <ErrorLine error={error} />
          {raid.status !== "CLAIM_VOTE" && raid.status !== "ACTIVE" && (
            <div className="flex flex-wrap gap-2 mt-3">
              {!raid.iAmMustered ? (
                <button className="btn-gold px-4 py-2 text-sm" disabled={busy || !raid.onRaidIsland || raid.cooldownMs > 0} onClick={() => act({ op: "muster" }, "raid")}>
                  {raid.status ? "Unirme a la coalición" : "Reunir una coalición"}
                </button>
              ) : (
                <button className="btn-ghost px-3 py-2 text-xs" disabled={busy} onClick={() => act({ op: "unmuster" }, "raid")}>
                  Abandonar la coalición
                </button>
              )}
              {raid.iAmLeader && raid.status === "MUSTERING" && (
                <button className="btn-gold px-4 py-2 text-sm" disabled={busy || jointActive} onClick={() => act({ op: "launch" }, "raid")} data-testid="raid-launch">
                  ¡Dar la orden de asalto!
                </button>
              )}
            </div>
          )}
          {raid.iAmLeader && raid.status === "MUSTERING" && raid.standings.length > 0 && (
            <div className="mt-3">
              <p className="text-xs text-ink-dim mb-1">Aliados de renombre que confían en ti:</p>
              <div className="flex flex-wrap gap-2">
                {raid.standings.map((s) => (
                  <button key={s.actorId} className="btn-ghost px-3 py-1 text-xs" disabled={busy || s.pledged || s.standing < 60} onClick={() => act({ op: "pledge", actorId: s.actorId }, "raid")}>
                    {s.name} ({s.standing}/60){s.pledged ? " ✓" : ""}
                  </button>
                ))}
              </div>
            </div>
          )}
          {raid.voting && (
            <div className="mt-3" data-testid="raid-vote">
              <p className="text-sm">El Rey Sin Nombre ha caído. ¿Quién será el Rey de los Piratas?</p>
              <div className="flex flex-wrap gap-2 mt-2">
                {raid.voting.candidates.map((c) => (
                  <button key={c.id} className="btn-gold px-3 py-1 text-xs" disabled={busy || !raid.voting!.iCanVote} onClick={() => act({ op: "vote", candidateId: c.id }, "raid")}>
                    {c.name}
                  </button>
                ))}
              </div>
              {raid.voting.iVoted && <p className="text-xs text-ink-dim mt-1">Tu voto está registrado.</p>}
            </div>
          )}
        </>
      )}
    </section>
  );
}

export function BlackMarketPanel({ blackMarket, berries, act, busy, error }: Common & { blackMarket: BlackMarketState; berries: number }) {
  return (
    <section className="panel p-4 animate-rise" style={{ borderColor: "rgba(181,68,46,0.6)" }} data-testid="black-market">
      <Title icon={Skull}>Mercado negro</Title>
      <p className="text-xs text-ink-dim">Sin preguntas y sin garantías: cualquier trato puede ser una trampa de la Marina. El género cambia en {formatMinutes(blackMarket.msToRefresh)}.</p>
      <ErrorLine error={error} />
      <div className="mt-2 divide-y divide-line">
        {blackMarket.offers.map((o) => (
          <div key={o.id} className="flex items-center justify-between gap-3 py-2">
            <div className="min-w-0">
              <p className="text-sm text-gold">{o.name}</p>
              <p className="text-xs text-ink-dim">{o.description}</p>
            </div>
            <button className="btn-ghost px-3 py-1 text-xs whitespace-nowrap inline-flex items-center gap-1" disabled={busy || berries < o.price} onClick={() => act({ op: "buy", offerId: o.id }, "black-market")}>
              <Coins className="w-3.5 h-3.5" />
              {formatBerries(o.price)}
            </button>
          </div>
        ))}
      </div>
    </section>
  );
}

export function TerritoryPanel({ territory, jointActive, act, busy, error }: Common & { territory: TerritoryState; jointActive: boolean }) {
  return (
    <section className="panel panel-accent p-4 animate-rise" data-testid="territory-panel">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-1">
        <Title icon={Flag}>Dominio de {territory.islandName}</Title>
        <span className="chip">{territory.status === "HELD" ? (territory.heldByPlayers ? "En manos de jugadores" : "Bajo un poder local") : territory.status === "CONQUEST" ? "Asalto en curso" : "Votación abierta"}</span>
      </div>
      <p className="text-sm">
        Dueño: <span className="text-gold">{territory.ownerName}</span> — {territory.title}
      </p>
      {territory.garrison != null && (
        <div className="mt-2">
          <StatBar label="Guarnición" value={territory.garrison} max={100} color="var(--gold)" />
        </div>
      )}
      {territory.status === "CONQUEST" && (
        <div className="mt-2 text-sm">
          <div className="flex flex-wrap gap-1 mb-2">
            {territory.stages.map((s) => (
              <span key={s.id} className={`text-xs px-2 py-0.5 rounded border ${s.id === territory.stage ? "border-gold text-gold bg-gold/10" : "border-line text-ink-dim"}`}>
                {s.label}
              </span>
            ))}
          </div>
          <p className="text-xs text-ink-dim">
            Frente actual: {territory.stageLabel}. {territory.stage === "HOLDER" && !territory.holderHome && `${territory.holderName} no está en la isla: hay que esperar a que regrese.`}
          </p>
        </div>
      )}
      {territory.contributions.length > 0 && <p className="text-xs text-ink-dim mt-2">Aportes: {territory.contributions.map((c) => `${c.name} ${c.points}`).join(" · ")}</p>}
      {territory.muster.length > 0 && territory.status !== "CLAIM_VOTE" && <p className="text-xs text-ink-dim mt-1">Hueste reunida: {territory.muster.map((m) => m.name).join(", ")}</p>}
      <ErrorLine error={error} />
      <div className="flex flex-wrap gap-2 mt-3">
        {territory.canAssault && !jointActive && (
          <>
            <button className="btn-ghost px-3 py-1.5 text-xs" disabled={busy} onClick={() => act({ op: territory.iAmMustered ? "unmuster" : "muster" }, "territory")}>
              {territory.iAmMustered ? "Retirarme de la hueste" : "Sumarme a la hueste"}
            </button>
            <button className="btn-gold px-4 py-1.5 text-sm" disabled={busy} onClick={() => act({ op: "assault" }, "territory")}>
              Asaltar ({territory.status === "CONQUEST" ? territory.stageLabel : "el ejército"})
            </button>
          </>
        )}
        {territory.isOwner && (
          <>
            <button className="btn-gold px-3 py-1.5 text-xs" disabled={busy || !territory.pendingIncome} onClick={() => act({ op: "collect" }, "territory")}>
              Cobrar tributos ({formatBerries(territory.pendingIncome ?? 0)})
            </button>
            <button className="btn-ghost px-3 py-1.5 text-xs" disabled={busy || !territory.fortifyCost} onClick={() => act({ op: "fortify" }, "territory")}>
              Reforzar guarnición ({formatBerries(territory.fortifyCost ?? 0)})
            </button>
            <button className="btn-ghost px-3 py-1.5 text-xs" disabled={busy || jointActive || (territory.garrison ?? 100) >= 100} onClick={() => act({ op: "defend" }, "territory")}>
              Repeler fuerza de retoma
            </button>
          </>
        )}
      </div>
      {territory.status === "CLAIM_VOTE" && (
        <div className="mt-3">
          <p className="text-sm text-gold">La resistencia ha caído. Quienes participaron votan quién se queda la isla (peso = lo aportado).</p>
          {territory.voteDeadline && <p className="text-xs text-ink-dim">Cierra: {new Date(territory.voteDeadline).toLocaleString("es-ES")} o cuando voten todos.</p>}
          {territory.iContributed ? (
            <div className="flex flex-wrap gap-2 mt-2">
              {territory.contributions.map((c) => (
                <button key={c.id} className={territory.myVote === c.id ? "btn-gold px-3 py-1.5 text-xs" : "btn-ghost px-3 py-1.5 text-xs"} disabled={busy} onClick={() => act({ op: "vote", candidateId: c.id }, "territory")}>
                  Votar por {c.name}
                </button>
              ))}
            </div>
          ) : (
            <p className="text-xs text-ink-dim mt-1">Solo votan quienes participaron en la conquista.</p>
          )}
          {territory.votes.length > 0 && <p className="text-xs text-ink-dim mt-2">Votos: {territory.votes.map((v) => `${v.voter} → ${v.candidate}`).join(" · ")}</p>}
        </div>
      )}
    </section>
  );
}

export function WorldEventPanel({ worldEvent, jointActive, onIntervene, busy, error }: { worldEvent: WorldEventHere; jointActive: boolean; onIntervene: (side: "defend" | "assist" | "chaos") => void; busy: boolean; error: string | null }) {
  return (
    <section className="panel panel-accent p-4 animate-rise" data-testid="world-event-panel">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-1">
        <Title icon={Anchor}>Evento mundial: {worldEvent.title}</Title>
        <span className="chip text-orange-300">
          Capítulo {worldEvent.stage}/{worldEvent.totalStages}
        </span>
      </div>
      <div className="flex gap-1 my-2" aria-hidden>
        {Array.from({ length: worldEvent.totalStages }, (_, i) => (
          <span key={i} className={`h-1.5 flex-1 rounded-full ${i < worldEvent.stage ? "bg-orange-400/80" : "bg-black/30"}`} />
        ))}
      </div>
      <p className="text-sm text-ink-dim mb-2">
        Algo grande está pasando aquí{worldEvent.locationName ? `, en ${worldEvent.locationName}` : ""}. {worldEvent.target}
        {worldEvent.aggressor ? ` y ${worldEvent.aggressor}` : ""} están en el centro. Con nivel suficiente ({worldEvent.minLevel}+) puedes meterte: pelearás contra una vanguardia y tu victoria inclina la historia.
      </p>
      <p className="text-xs text-ink-dim mb-2">
        Defensores: {worldEvent.defenders} · Aliados del agresor: {worldEvent.helpers}
      </p>
      {worldEvent.reason ? (
        <p className="text-xs text-orange-300" data-testid="world-event-reason">
          {worldEvent.reason}
        </p>
      ) : (
        <div className="flex gap-2 flex-wrap">
          <button className="btn-gold px-3 py-1.5 text-xs" disabled={busy || jointActive} onClick={() => onIntervene("defend")} data-testid="intervene-defend">
            Defender a {worldEvent.target}
          </button>
          <button className="btn-ghost px-3 py-1.5 text-xs" disabled={busy || jointActive} onClick={() => onIntervene("assist")} data-testid="intervene-assist">
            Apoyar a {worldEvent.aggressor ?? "los perseguidores"}
          </button>
          <button className="btn-ghost px-3 py-1.5 text-xs" disabled={busy || jointActive} onClick={() => onIntervene("chaos")} data-testid="intervene-chaos">
            Pelear contra todos
          </button>
        </div>
      )}
      <ErrorLine error={error} />
    </section>
  );
}
