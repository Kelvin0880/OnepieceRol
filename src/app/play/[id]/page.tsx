"use client";

import { useEffect, useState, useCallback, useRef, use } from "react";
import Link from "next/link";
import { characterCondition, conditionLabel } from "@/lib/engine/condition";
import { factionTitle } from "@/lib/engine/progression";
import { crewNounForFaction } from "@/lib/engine/crew-noun";

interface Island {
  id: string;
  name: string;
  description: string;
  dangerLevel: number;
  factionControl: string | null;
}

interface Weapon {
  id: string;
  name: string;
  kind: string;
  grade: string;
  atkBonus: number;
  description: string;
}

interface DevilFruit {
  id: string;
  name: string;
  englishName: string;
  type: string;
  rarity: string;
  description: string;
}

interface Companion {
  id: string;
  name: string;
  role: string;
  hp: number;
  maxHp: number;
  status: string;
}

interface LogEntry {
  id: string;
  text: string;
  kind: string;
  createdAt: string;
}

interface SceneMsg {
  id: string;
  role: "player" | "narrator";
  text: string;
  createdAt: string;
}

interface CrewMember {
  id: string;
  name: string;
  level: number;
  faction: string;
  status: string;
  currentIslandId: string;
  partyId: string | null;
  isSeparatedFromParty: boolean;
}

interface PartyMsg {
  id: string;
  authorCharacterId: string | null;
  authorName: string;
  text: string;
  createdAt: string;
}

interface PartyState {
  id: string;
  turnOrder: string[];
  turnIndex: number;
  awaitingNarrator: boolean;
  members: { id: string; name: string }[];
  messages: PartyMsg[];
}

interface Crew {
  id: string;
  name: string;
  flagDesc: string;
  shipName: string;
  totalBounty: number;
  reputation: number;
  captainId: string;
  inviteCode: string;
  members: CrewMember[];
}

interface OtherHere {
  id: string;
  name: string;
  faction: string;
  level: number;
  bounty: number;
  notoriety: number;
  crew: { id: string; name: string } | null;
}

interface PrisonerHere {
  id: string;
  name: string;
  faction: string;
  level: number;
}

interface Imprisonment {
  reason: string;
  bailBerries: number | null;
  minRescueLevel: number;
  capturedAt: string;
}

interface DuelResult {
  aId: string;
  bId: string;
  winner: "a" | "b" | "draw";
  aHpLeft: number;
  bHpLeft: number;
}

interface BattleSummary {
  id: string;
  status: "PROPOSED" | "RESOLVED" | "DECLINED";
  isChallenger: boolean;
  opponentCrewName: string;
  matchupCount: number;
  resultJson: string | null;
  createdAt: string;
}

interface Character {
  id: string;
  name: string;
  faction: string;
  status: string;
  level: number;
  experience: number;
  hp: number;
  maxHp: number;
  berries: number;
  bounty: number;
  notoriety: number;
  strength: number;
  agility: number;
  durability: number;
  willpower: number;
  intellect: number;
  observationHaki: number;
  armamentHaki: number;
  conquerorsHaki: boolean;
  poneglyphsRead: string;
  poneglyphHeat: number;
  currentIsland: Island;
  devilFruit: DevilFruit | null;
  equippedWeapon: Weapon | null;
  ownedWeapons: Weapon[];
  companions: Companion[];
  logs: LogEntry[];
  sceneMessages: SceneMsg[];
  deathCause: string | null;
  pendingEncounter: {
    phase: "threat" | "fighting" | "victory";
    assessment: "weaker" | "even" | "superior";
    enemyName: string;
    enemyHp: number;
    enemyMaxHp: number;
  } | null;
  crew: Crew | null;
  imprisonment: Imprisonment | null;
  partyId: string | null;
  isSeparatedFromParty: boolean;
}

interface StateResponse {
  character: Character;
  connectedIslands: Island[];
  othersHere: OtherHere[];
  prisonersHere: PrisonerHere[];
  crewBattles: BattleSummary[];
  party: PartyState | null;
  error?: string;
}

const ASSESSMENT_LABEL: Record<string, { text: string; color: string }> = {
  weaker: { text: "Parece más débil que tú", color: "text-emerald-300" },
  even: { text: "Parece un rival parejo", color: "text-gold" },
  superior: { text: "Parece superior a ti — cuidado", color: "text-blood" },
};

const CONDITION_COLOR: Record<string, string> = {
  ileso: "text-emerald-300",
  rasguñado: "text-gold",
  herido: "text-gold-bright",
  malherido: "text-orange-400",
  "al borde de la muerte": "text-blood",
};

const FACTION_LABEL: Record<string, string> = {
  PIRATE: "Pirata",
  MARINE: "Marine",
  REVOLUTIONARY: "Revolucionario",
  BOUNTY_HUNTER: "Cazarrecompensas",
};

function StatBar({ label, value, max, color }: { label: string; value: number; max: number; color: string }) {
  const pct = Math.max(0, Math.min(100, (value / max) * 100));
  return (
    <div>
      <div className="flex justify-between text-xs text-ink-dim mb-0.5">
        <span>{label}</span>
        <span>
          {value}/{max}
        </span>
      </div>
      <div className="h-2 rounded bg-black/30 overflow-hidden">
        <div className="h-full transition-all" style={{ width: `${pct}%`, background: color }} />
      </div>
    </div>
  );
}

export default function PlayPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [data, setData] = useState<StateResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [feed, setFeed] = useState<string[]>([]);
  const [arcIntro, setArcIntro] = useState<{ islandName: string; hook: string } | null>(null);
  const [crewName, setCrewName] = useState("");
  const [crewFlag, setCrewFlag] = useState("");
  const [crewShip, setCrewShip] = useState("");
  const [joinCode, setJoinCode] = useState("");
  const [crewError, setCrewError] = useState<string | null>(null);
  const [crewBusy, setCrewBusy] = useState(false);
  const [challengeCrewId, setChallengeCrewId] = useState<string | null>(null);
  const [matchups, setMatchups] = useState<Record<string, string>>({});
  const [battleError, setBattleError] = useState<string | null>(null);
  const [battleBusy, setBattleBusy] = useState(false);
  const [freeText, setFreeText] = useState("");
  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false);
  const sceneEndRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    const res = await fetch(`/api/characters/${id}`);
    const d = await res.json();
    if (!res.ok) {
      setError(d.error ?? "No se pudo cargar el personaje.");
      return;
    }
    setData(d);
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  // Presence ("who else is here") and world state drift on their own, so
  // poll softly instead of requiring the player to act to see updates.
  useEffect(() => {
    const interval = setInterval(load, 10_000);
    return () => clearInterval(interval);
  }, [load]);

  useEffect(() => {
    sceneEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [data?.character.sceneMessages.length, data?.party?.messages.length, busy]);

  async function doCrewAction(body: Record<string, unknown>) {
    setCrewBusy(true);
    setCrewError(null);
    try {
      const res = await fetch(`/api/characters/${id}/crew`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const result = await res.json();
      if (!res.ok) {
        setCrewError(result.error ?? "No se pudo completar la acción.");
        return;
      }
      setCrewName("");
      setCrewFlag("");
      setCrewShip("");
      setJoinCode("");
      await load();
    } finally {
      setCrewBusy(false);
    }
  }

  async function doBattleAction(body: Record<string, unknown>) {
    setBattleBusy(true);
    setBattleError(null);
    try {
      const res = await fetch(`/api/characters/${id}/battle`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const result = await res.json();
      if (!res.ok) {
        setBattleError(result.error ?? "No se pudo completar la acción.");
        return;
      }
      setChallengeCrewId(null);
      setMatchups({});
      await load();
    } finally {
      setBattleBusy(false);
    }
  }

  async function doPrisonAction(body: Record<string, unknown>) {
    setBattleBusy(true);
    setBattleError(null);
    try {
      const res = await fetch(`/api/characters/${id}/prison`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const result = await res.json();
      if (!res.ok) {
        setBattleError(result.error ?? "No se pudo completar la acción.");
        return;
      }
      if (result.log) setFeed((f) => [...result.log, ...f].slice(0, 60));
      await load();
    } finally {
      setBattleBusy(false);
    }
  }

  async function doAction(body: Record<string, unknown>): Promise<boolean> {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/characters/${id}/actions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const result = await res.json();
      if (!res.ok) {
        setError(result.error ?? "No se pudo completar la acción.");
        return false;
      }
      if (result.log) setFeed((f) => [...result.log, ...f].slice(0, 60));
      if (result.arcIntro) setArcIntro(result.arcIntro);
      if (result.confirmRequired === "leave_party") setShowLeaveConfirm(true);
      await load();
      return true;
    } finally {
      setBusy(false);
    }
  }

  async function submitFreeText() {
    const text = freeText.trim();
    if (!text || busy) return;
    const ok = await doAction({ freeText: text });
    if (ok) setFreeText("");
  }

  if (error && !data) {
    return (
      <main className="flex-1 flex items-center justify-center p-6">
        <p className="text-blood">{error}</p>
      </main>
    );
  }

  if (!data) {
    return (
      <main className="flex-1 flex items-center justify-center p-6">
        <p className="text-ink-dim">Cargando personaje...</p>
      </main>
    );
  }

  const { character, connectedIslands, party } = data;
  const isDead = character.status === "DEAD";
  const isImprisoned = character.status === "IMPRISONED";

  // Party turn-gating never applies while resolving a personal fight — you
  // can't be blocked from fighting for your life by whose turn it is in
  // the group scene (see resolvePartyFreeTextAction in perform-action.ts).
  const isMyPartyTurn = party ? party.turnOrder[party.turnIndex] === character.id : true;
  const partyBlocksInput = !!party && !character.pendingEncounter && (party.awaitingNarrator || !isMyPartyTurn);
  const partyTurnLabel = !party || character.pendingEncounter
    ? null
    : party.awaitingNarrator
    ? "El narrador está pensando..."
    : isMyPartyTurn
    ? "Es tu turno."
    : `Le toca a ${party.members.find((m) => m.id === party.turnOrder[party.turnIndex])?.name ?? "otro miembro del grupo"}.`;

  return (
    <main className="flex-1 w-full max-w-6xl mx-auto p-4 md:p-6 flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl text-gold-bright">{character.name}</h1>
          <p className="text-sm text-gold">
            {factionTitle(character.faction as "PIRATE" | "MARINE" | "REVOLUTIONARY" | "BOUNTY_HUNTER", character.bounty, character.notoriety)}
          </p>
          <p className="text-sm text-ink-dim">
            {FACTION_LABEL[character.faction]} · Nv. {character.level} · {character.currentIsland.name}
          </p>
        </div>
        <div className="flex gap-2">
          <Link href="/news" className="btn-ghost px-3 py-1.5 text-sm">
            Noticias
          </Link>
          <Link href="/" className="btn-ghost px-3 py-1.5 text-sm">
            Mis personajes
          </Link>
        </div>
      </div>

      {arcIntro && (
        <div className="panel p-5" style={{ borderColor: "var(--gold)" }}>
          <p className="text-xs text-gold-bright uppercase tracking-wide mb-1">Llegas por primera vez a</p>
          <h2 className="font-display text-xl text-gold-bright mb-2">{arcIntro.islandName}</h2>
          <p className="text-sm text-ink italic mb-4">{arcIntro.hook}</p>
          <button className="btn-gold px-4 py-2 text-sm" onClick={() => setArcIntro(null)}>
            Continuar
          </button>
        </div>
      )}

      {isDead && (
        <div className="panel p-4 border-blood text-blood" style={{ borderColor: "var(--blood)" }}>
          <p className="font-display">{character.name} ha caído.</p>
          <p className="text-sm mt-1 text-ink-dim">{character.deathCause}</p>
        </div>
      )}

      {isImprisoned && character.imprisonment && (
        <div className="panel p-4" style={{ borderColor: "var(--gold)" }}>
          <p className="font-display text-gold-bright">Encarcelado en {character.currentIsland.name}</p>
          <p className="text-sm mt-1 text-ink-dim">{character.imprisonment.reason}</p>
          <p className="text-xs mt-2 text-ink-dim">
            Nivel de poder necesario para rescatarte: <span className="text-gold">{character.imprisonment.minRescueLevel}</span>
          </p>
          {battleError && <p className="text-blood text-xs mt-2">{battleError}</p>}
          <div className="mt-3 flex flex-wrap items-center gap-2">
            {character.imprisonment.bailBerries != null ? (
              <button
                className="btn-gold px-4 py-2 text-sm"
                disabled={battleBusy || character.berries < character.imprisonment.bailBerries}
                onClick={() => doPrisonAction({ op: "bail" })}
              >
                Pagar fianza (฿ {character.imprisonment.bailBerries.toLocaleString("es-ES")})
              </button>
            ) : (
              <span className="text-xs text-ink-dim">Esta captura no admite fianza.</span>
            )}
            <span className="text-xs text-ink-dim">o espera a que un aliado venga a rescatarte.</span>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-[2fr_1fr] gap-4">
        {/* Main column */}
        <div className="flex flex-col gap-4">
          <div className="panel p-4">
            <div className="flex items-center justify-between mb-2">
              <h2 className="font-display text-lg">{character.currentIsland.name}</h2>
              <span className="text-xs text-ink-dim">Peligro {character.currentIsland.dangerLevel}/10</span>
            </div>
            <p className="text-sm text-ink-dim mb-4">{character.currentIsland.description}</p>

            {!isDead && !isImprisoned && (
              <div className="mb-4">
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs text-ink-dim">¿Qué haces?</label>
                  {partyTurnLabel && <span className={`text-xs ${isMyPartyTurn && !party?.awaitingNarrator ? "text-gold" : "text-ink-dim italic"}`}>{partyTurnLabel}</span>}
                </div>
                {showLeaveConfirm && (
                  <div className="panel p-3 mb-2" style={{ borderColor: "var(--gold)" }}>
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
                  className="w-full bg-sea-deep border border-[--line] rounded px-3 py-2 text-sm outline-none focus:border-gold resize-none"
                  rows={2}
                  placeholder={
                    character.pendingEncounter?.phase === "threat"
                      ? "Ej: Desenfundo mi espada y cargo contra él sin dudar."
                      : character.pendingEncounter?.phase === "victory"
                      ? "Ej: Le perdono la vida y le advierto que no vuelva."
                      : partyBlocksInput
                      ? "Espera tu turno..."
                      : "Ej: Entro al bar y me fijo si alguien interesante anda por ahí."
                  }
                  value={freeText}
                  disabled={busy || partyBlocksInput}
                  onChange={(e) => setFreeText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      submitFreeText();
                    }
                  }}
                />
                <div className="flex items-center gap-2 mt-2">
                  <button className="btn-gold px-4 py-2 text-sm" disabled={busy || partyBlocksInput || !freeText.trim()} onClick={submitFreeText}>
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
                </div>
              </div>
            )}

            {!isDead && !isImprisoned && (character.pendingEncounter?.phase === "threat" || character.pendingEncounter?.phase === "fighting") && (
              <div className="panel p-3 mb-3" style={{ borderColor: "var(--blood)" }}>
                <p className="text-sm mb-1">
                  {character.pendingEncounter.phase === "threat" ? "Te enfrentas a" : "Sigues luchando contra"}{" "}
                  <span className="text-gold-bright">{character.pendingEncounter.enemyName}</span>.
                </p>
                <p className={`text-xs mb-2 ${ASSESSMENT_LABEL[character.pendingEncounter.assessment].color}`}>
                  {ASSESSMENT_LABEL[character.pendingEncounter.assessment].text}
                </p>
                <StatBar
                  label={character.pendingEncounter.enemyName}
                  value={character.pendingEncounter.enemyHp}
                  max={character.pendingEncounter.enemyMaxHp}
                  color="var(--blood)"
                />
              </div>
            )}

            {!isDead && !isImprisoned && character.pendingEncounter?.phase === "victory" && (
              <div className="panel p-3 mb-3">
                <p className="text-sm">
                  <span className="text-gold-bright">{character.pendingEncounter.enemyName}</span> está derrotado y a tu merced. ¿Qué haces?
                </p>
              </div>
            )}

            {!isDead && !isImprisoned && !character.pendingEncounter && (
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs text-ink-dim">O, para lo simple:</span>
                <button
                  className="btn-ghost px-3 py-1.5 text-xs"
                  disabled={busy || partyBlocksInput}
                  onClick={() => (party ? doAction({ freeText: "Me pongo a entrenar un rato." }) : doAction({ action: "train" }))}
                >
                  Entrenar
                </button>
                <button
                  className="btn-ghost px-3 py-1.5 text-xs"
                  disabled={busy || partyBlocksInput}
                  onClick={() => (party ? doAction({ freeText: "Me tomo un momento para descansar." }) : doAction({ action: "rest" }))}
                >
                  Descansar
                </button>
              </div>
            )}

            {connectedIslands.length > 0 && !isDead && !isImprisoned && !character.pendingEncounter && (
              <div className="mt-4 pt-4 border-t border-[--line]">
                <p className="text-xs text-ink-dim mb-2">Zarpar hacia:</p>
                <div className="flex flex-wrap gap-2">
                  {connectedIslands.map((isl) => (
                    <button
                      key={isl.id}
                      className="btn-ghost px-3 py-1.5 text-xs"
                      disabled={busy}
                      onClick={() => doAction({ action: "travel", targetIslandId: isl.id })}
                    >
                      {isl.name}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {!isDead && (
            <div className="panel p-4">
              <h3 className="font-display text-sm text-ink-dim mb-2">{party ? "Escena compartida" : "Escena"}</h3>
              <div className="flex flex-col gap-3 max-h-[520px] overflow-y-auto scrollbar-thin pr-1">
                {party ? (
                  <>
                    {party.messages.length === 0 && <p className="text-sm text-ink-dim italic">La escena del grupo empieza aquí.</p>}
                    {party.messages.map((m) => {
                      const mine = m.authorCharacterId === character.id;
                      const isNarrator = m.authorCharacterId === null;
                      return (
                        <div
                          key={m.id}
                          className={`max-w-[85%] rounded-lg px-3 py-2 text-sm ${mine ? "self-end" : "self-start"} ${
                            isNarrator ? "bg-black/25 whitespace-pre-line" : mine ? "" : "bg-black/10 border border-[--line]"
                          }`}
                          style={mine ? { background: "var(--gold)", color: "var(--sea-deep)" } : undefined}
                        >
                          {!mine && <div className="text-[10px] uppercase tracking-wide text-ink-dim mb-0.5">{m.authorName}</div>}
                          {m.text}
                        </div>
                      );
                    })}
                  </>
                ) : (
                  <>
                    {character.sceneMessages.length === 0 && (
                      <p className="text-sm text-ink-dim italic">Escribe qué haces arriba para empezar a rolear.</p>
                    )}
                    {character.sceneMessages.map((m) =>
                      m.role === "player" ? (
                        <div key={m.id} className="self-end max-w-[85%] rounded-lg px-3 py-2 text-sm" style={{ background: "var(--gold)", color: "var(--sea-deep)" }}>
                          {m.text}
                        </div>
                      ) : (
                        <div key={m.id} className="self-start max-w-[85%] rounded-lg px-3 py-2 text-sm bg-black/25 whitespace-pre-line">
                          {m.text}
                        </div>
                      )
                    )}
                  </>
                )}
                {busy && (
                  <div className="self-start max-w-[85%] rounded-lg px-3 py-2 text-sm bg-black/25 flex items-center gap-1.5 text-ink-dim italic">
                    <span className="inline-block w-3 h-3 rounded-full border-2 border-gold/30 border-t-gold animate-spin" />
                    narrando...
                  </div>
                )}
                <div ref={sceneEndRef} />
              </div>
            </div>
          )}

          {data.othersHere.length > 0 && (
            <div className="panel p-4">
              <h3 className="font-display text-sm text-ink-dim mb-2">Aventureros en esta isla</h3>
              <div className="flex flex-col gap-2">
                {data.othersHere.map((o) => (
                  <div key={o.id} className="text-sm flex items-center justify-between">
                    <span>
                      {o.name} <span className="text-ink-dim text-xs">· Nv. {o.level} · {FACTION_LABEL[o.faction]}</span>
                    </span>
                    {o.crew && <span className="text-xs text-gold">{o.crew.name}</span>}
                  </div>
                ))}
              </div>
            </div>
          )}

          {!isDead && !isImprisoned && data.prisonersHere.length > 0 && (
            <div className="panel p-4">
              <h3 className="font-display text-sm text-ink-dim mb-2">Prisioneros en esta isla</h3>
              <div className="flex flex-col gap-2">
                {data.prisonersHere.map((p) => (
                  <div key={p.id} className="text-sm flex items-center justify-between">
                    <span>
                      {p.name} <span className="text-ink-dim text-xs">· Nv. {p.level} · {FACTION_LABEL[p.faction]}</span>
                    </span>
                    <button
                      className="btn-ghost px-3 py-1 text-xs"
                      disabled={battleBusy}
                      onClick={() => doPrisonAction({ op: "rescue", targetCharacterId: p.id })}
                    >
                      Rescatar
                    </button>
                  </div>
                ))}
              </div>
              {battleError && <p className="text-blood text-xs mt-2">{battleError}</p>}
            </div>
          )}

          {character.crew && character.crew.captainId === character.id && !isDead && !isImprisoned && (() => {
            const rivalCrews = new Map<string, { id: string; name: string; members: OtherHere[] }>();
            for (const o of data.othersHere) {
              if (!o.crew || o.crew.id === character.crew!.id) continue;
              const entry = rivalCrews.get(o.crew.id) ?? { id: o.crew.id, name: o.crew.name, members: [] };
              entry.members.push(o);
              rivalCrews.set(o.crew.id, entry);
            }
            const myMembersHere = character.crew!.members.filter((m) => m.currentIslandId === character.currentIsland.id && m.status === "ALIVE");
            if (rivalCrews.size === 0) return null;

            return (
              <div className="panel p-4">
                <h3 className="font-display text-sm text-ink-dim mb-2">Desafiar a otra tripulación</h3>
                {!challengeCrewId ? (
                  <div className="flex flex-wrap gap-2">
                    {[...rivalCrews.values()].map((rc) => (
                      <button key={rc.id} className="btn-ghost px-3 py-1.5 text-xs" onClick={() => setChallengeCrewId(rc.id)}>
                        Desafiar a {rc.name} ({rc.members.length})
                      </button>
                    ))}
                  </div>
                ) : (
                  (() => {
                    const rival = rivalCrews.get(challengeCrewId);
                    if (!rival) return null;
                    const rows = myMembersHere.slice(0, rival.members.length);
                    const chosenOpponents = new Set(Object.values(matchups));
                    return (
                      <div className="flex flex-col gap-2">
                        {rows.map((mine) => (
                          <div key={mine.id} className="flex items-center gap-2 text-sm">
                            <span className="w-32 truncate">{mine.name}</span>
                            <span className="text-ink-dim">vs</span>
                            <select
                              className="flex-1 bg-sea-deep border border-[--line] rounded px-2 py-1 text-xs outline-none focus:border-gold"
                              value={matchups[mine.id] ?? ""}
                              onChange={(e) => setMatchups((m) => ({ ...m, [mine.id]: e.target.value }))}
                            >
                              <option value="">— elegir rival —</option>
                              {rival.members
                                .filter((r) => r.id === matchups[mine.id] || !chosenOpponents.has(r.id))
                                .map((r) => (
                                  <option key={r.id} value={r.id}>
                                    {r.name} (Nv. {r.level})
                                  </option>
                                ))}
                            </select>
                          </div>
                        ))}
                        {battleError && <p className="text-blood text-xs">{battleError}</p>}
                        <div className="flex gap-2 mt-1">
                          <button
                            className="btn-gold px-3 py-1.5 text-xs"
                            disabled={battleBusy || rows.some((r) => !matchups[r.id])}
                            onClick={() =>
                              doBattleAction({
                                op: "propose",
                                targetCrewId: rival.id,
                                matchups: rows.map((r) => ({ myCharacterId: r.id, opponentCharacterId: matchups[r.id] })),
                              })
                            }
                          >
                            Proponer batalla
                          </button>
                          <button className="btn-ghost px-3 py-1.5 text-xs" onClick={() => setChallengeCrewId(null)}>
                            Cancelar
                          </button>
                        </div>
                      </div>
                    );
                  })()
                )}
              </div>
            );
          })()}

          {data.crewBattles.length > 0 && (
            <div className="panel p-4">
              <h3 className="font-display text-sm text-ink-dim mb-2">Batallas de tripulación</h3>
              <div className="flex flex-col gap-3">
                {data.crewBattles.map((b) => {
                  const result: { victor: "a" | "b" | "draw"; duels: DuelResult[] } | null = b.resultJson ? JSON.parse(b.resultJson) : null;
                  const won = result && ((b.isChallenger && result.victor === "a") || (!b.isChallenger && result.victor === "b"));
                  return (
                    <div key={b.id} className="text-sm border-b border-[--line] pb-2 last:border-0">
                      <div className="flex justify-between">
                        <span>
                          {b.isChallenger ? "Desafiaste a" : "Te desafió"} {b.opponentCrewName} ({b.matchupCount} vs {b.matchupCount})
                        </span>
                        <span
                          className={
                            b.status === "PROPOSED" ? "text-gold" : b.status === "DECLINED" ? "text-ink-dim" : won ? "text-emerald-300" : "text-blood"
                          }
                        >
                          {b.status === "PROPOSED" ? "Pendiente" : b.status === "DECLINED" ? "Rechazada" : won ? "Victoria" : "Derrota"}
                        </span>
                      </div>
                      {b.status === "PROPOSED" && !b.isChallenger && (
                        <div className="flex gap-2 mt-2">
                          <button className="btn-gold px-3 py-1 text-xs" disabled={battleBusy} onClick={() => doBattleAction({ op: "respond", battleId: b.id, accept: true })}>
                            Aceptar
                          </button>
                          <button className="btn-ghost px-3 py-1 text-xs" disabled={battleBusy} onClick={() => doBattleAction({ op: "respond", battleId: b.id, accept: false })}>
                            Rechazar
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {error && <p className="text-blood text-sm">{error}</p>}

          <div className="panel p-4 flex-1">
            <h3 className="font-display text-sm text-ink-dim mb-0.5">Bitácora</h3>
            <p className="text-xs text-ink-dim/70 mb-2">Resumen mecánico rápido — la escena completa está arriba.</p>
            <div className="flex flex-col gap-2 max-h-[240px] overflow-y-auto scrollbar-thin pr-1">
              {feed.length === 0 &&
                character.logs.map((l) => (
                  <p key={l.id} className="text-sm border-b border-[--line] pb-2">
                    {l.text}
                  </p>
                ))}
              {feed.map((line, i) => (
                <p key={i} className="text-sm border-b border-[--line] pb-2">
                  {line}
                </p>
              ))}
            </div>
          </div>
        </div>

        {/* Sidebar */}
        <div className="flex flex-col gap-4">
          <div className="panel p-4 flex flex-col gap-3">
            <div className="flex justify-between items-center">
              <span className="text-xs text-ink-dim">Estado</span>
              <span className={`text-sm font-display ${CONDITION_COLOR[characterCondition(character.hp, character.maxHp)]}`}>
                {conditionLabel(characterCondition(character.hp, character.maxHp))}
              </span>
            </div>
            <StatBar label="Vida" value={character.hp} max={character.maxHp} color="var(--blood)" />
            <div className="flex justify-between text-sm">
              <span className="text-ink-dim">Berries</span>
              <span className="text-gold-bright">฿ {character.berries.toLocaleString("es-ES")}</span>
            </div>
            {character.faction === "PIRATE" && (
              <div className="flex justify-between text-sm">
                <span className="text-ink-dim">Recompensa</span>
                <span className="text-gold-bright">฿ {character.bounty.toLocaleString("es-ES")}</span>
              </div>
            )}
            {character.faction !== "PIRATE" && (
              <div className="flex justify-between text-sm">
                <span className="text-ink-dim">Mérito</span>
                <span className="text-gold-bright">{character.notoriety.toLocaleString("es-ES")}</span>
              </div>
            )}
            {character.poneglyphHeat > 0 && (
              <div className="pt-2 border-t border-[--line]">
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-blood">Perseguido</span>
                  <span className="text-blood">{character.poneglyphHeat}/150</span>
                </div>
                <p className="text-xs text-ink-dim">Lo que sabes te hace un objetivo. Explorar puede traer cazadores.</p>
              </div>
            )}
          </div>

          <div className="panel p-4">
            <h3 className="font-display text-sm text-ink-dim mb-2">Atributos</h3>
            <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-sm">
              <span>Fuerza: {character.strength}</span>
              <span>Agilidad: {character.agility}</span>
              <span>Resistencia: {character.durability}</span>
              <span>Voluntad: {character.willpower}</span>
              <span>Intelecto: {character.intellect}</span>
            </div>
            <div className="mt-3 pt-3 border-t border-[--line] flex flex-col gap-2">
              <StatBar label="Haki de Observación" value={character.observationHaki} max={100} color="var(--gold)" />
              <StatBar label="Haki de Armadura" value={character.armamentHaki} max={100} color="var(--gold)" />
              {character.conquerorsHaki && <p className="text-xs text-gold-bright mt-1">✦ Portador del Haki del Rey Supremo</p>}
            </div>
          </div>

          <div className="panel p-4">
            <h3 className="font-display text-sm text-ink-dim mb-2">Equipo</h3>
            {character.devilFruit ? (
              <div className="mb-3">
                <p className="text-sm text-gold-bright">{character.devilFruit.name}</p>
                <p className="text-xs text-ink-dim">{character.devilFruit.description}</p>
                <p className="text-xs text-blood mt-1">✦ No puede nadar — el mar es su debilidad de por vida.</p>
              </div>
            ) : (
              <p className="text-xs text-ink-dim mb-3">Sin fruta del diablo.</p>
            )}
            {character.equippedWeapon ? (
              <div>
                <p className="text-sm">{character.equippedWeapon.name}</p>
                <p className="text-xs text-ink-dim">
                  {character.equippedWeapon.kind} · +{character.equippedWeapon.atkBonus} ATQ
                </p>
              </div>
            ) : (
              <p className="text-xs text-ink-dim">Sin arma equipada.</p>
            )}
            {(() => {
              const count = (JSON.parse(character.poneglyphsRead || "[]") as string[]).length;
              return count > 0 ? (
                <p className="text-xs text-gold mt-2 pt-2 border-t border-[--line]">
                  Poneglifos descifrados: {count}/4
                </p>
              ) : null;
            })()}
          </div>

          {character.companions.length > 0 && (
            <div className="panel p-4">
              <h3 className="font-display text-sm text-ink-dim mb-2">Compañeros de a bordo</h3>
              <div className="flex flex-col gap-2">
                {character.companions.map((c) => (
                  <div key={c.id} className="text-sm flex justify-between">
                    <span className={c.status !== "ALIVE" ? "text-blood line-through" : ""}>
                      {c.name} · {c.role}
                    </span>
                    <span className="text-ink-dim">
                      {c.hp}/{c.maxHp}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="panel p-4">
            <h3 className="font-display text-sm text-ink-dim mb-2">{crewNounForFaction(character.faction as "PIRATE" | "MARINE" | "REVOLUTIONARY" | "BOUNTY_HUNTER")}</h3>
            {character.crew ? (
              <div className="flex flex-col gap-2">
                <p className="text-sm text-gold-bright">{character.crew.name}</p>
                <p className="text-xs text-ink-dim">{character.crew.flagDesc}</p>
                <p className="text-xs text-ink-dim">Barco: {character.crew.shipName}</p>
                <div className="mt-1 flex flex-col gap-1">
                  {character.crew.members.map((m) => {
                    const presence =
                      m.id === character.id
                        ? null
                        : m.status !== "ALIVE"
                        ? null
                        : m.partyId && m.partyId === character.partyId
                        ? "contigo ahora"
                        : m.currentIslandId === character.currentIsland.id
                        ? "en esta isla, por su cuenta"
                        : "en otra isla";
                    return (
                      <div key={m.id} className="text-sm flex justify-between">
                        <span className={m.status !== "ALIVE" ? "text-blood line-through" : ""}>
                          {m.name} {m.id === character.crew!.captainId && <span className="text-gold text-xs">★</span>}
                        </span>
                        <span className="text-ink-dim text-xs">
                          Nv. {m.level}
                          {presence && ` · ${presence}`}
                        </span>
                      </div>
                    );
                  })}
                </div>
                {!party &&
                  character.isSeparatedFromParty &&
                  character.crew.members.some((m) => m.id !== character.id && m.status === "ALIVE" && m.currentIslandId === character.currentIsland.id) && (
                    <button className="btn-gold px-3 py-1.5 text-xs" disabled={busy} onClick={() => doAction({ action: "rejoin_party" })}>
                      Unirme al grupo
                    </button>
                  )}
                <div className="mt-2 pt-2 border-t border-[--line]">
                  <p className="text-xs text-ink-dim mb-1">Código de invitación:</p>
                  <p className="text-xs font-mono text-gold select-all break-all">{character.crew.inviteCode}</p>
                </div>
                {crewError && <p className="text-blood text-xs">{crewError}</p>}
                <button className="btn-ghost px-3 py-1.5 text-xs mt-2" disabled={crewBusy} onClick={() => doCrewAction({ op: "leave" })}>
                  Abandonar
                </button>
              </div>
            ) : (
              <div className="flex flex-col gap-4">
                <div>
                  <p className="text-xs text-ink-dim mb-2">Fundar una nueva:</p>
                  <input
                    className="w-full bg-sea-deep border border-[--line] rounded px-2 py-1.5 text-sm mb-1.5 outline-none focus:border-gold"
                    placeholder="Nombre"
                    value={crewName}
                    onChange={(e) => setCrewName(e.target.value)}
                  />
                  <input
                    className="w-full bg-sea-deep border border-[--line] rounded px-2 py-1.5 text-sm mb-1.5 outline-none focus:border-gold"
                    placeholder="Emblema / descripción"
                    value={crewFlag}
                    onChange={(e) => setCrewFlag(e.target.value)}
                  />
                  <input
                    className="w-full bg-sea-deep border border-[--line] rounded px-2 py-1.5 text-sm mb-2 outline-none focus:border-gold"
                    placeholder="Nombre del barco (opcional)"
                    value={crewShip}
                    onChange={(e) => setCrewShip(e.target.value)}
                  />
                  <button
                    className="btn-gold px-3 py-1.5 text-xs w-full"
                    disabled={crewBusy || crewName.trim().length < 2}
                    onClick={() => doCrewAction({ op: "create", name: crewName, flagDesc: crewFlag, shipName: crewShip })}
                  >
                    Fundar
                  </button>
                </div>
                <div className="pt-3 border-t border-[--line]">
                  <p className="text-xs text-ink-dim mb-2">Unirse con código:</p>
                  <input
                    className="w-full bg-sea-deep border border-[--line] rounded px-2 py-1.5 text-sm mb-2 outline-none focus:border-gold"
                    placeholder="Código de invitación"
                    value={joinCode}
                    onChange={(e) => setJoinCode(e.target.value)}
                  />
                  <button
                    className="btn-ghost px-3 py-1.5 text-xs w-full"
                    disabled={crewBusy || joinCode.trim().length < 2}
                    onClick={() => doCrewAction({ op: "join", inviteCode: joinCode })}
                  >
                    Unirse
                  </button>
                </div>
                {crewError && <p className="text-blood text-xs mt-2">{crewError}</p>}
              </div>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
