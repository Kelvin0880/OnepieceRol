"use client";

import { useEffect, useState, useCallback, useRef, use } from "react";
import { Skull } from "lucide-react";
import { AnimatePresence, m } from "motion/react";
import HitVignette from "@/components/motion/HitVignette";
import { SPRING } from "@/components/motion/presets";
import InventoryPanel from "./InventoryPanel";
import StylesPanel from "./StylesPanel";
import ColiseumPanel from "./ColiseumPanel";
import VoyagePanel from "./VoyagePanel";
import EmpirePanel from "./EmpirePanel";
import DenDenPanel from "./DenDenPanel";
import OocPanel from "./OocPanel";
import CrewPanel from "./CrewPanel";
import SovereigntyPanel from "./SovereigntyPanel";
import RoutePanel from "./RoutePanel";
import PathPanel from "./PathPanel";
import PlayHeader, { type PanelKey } from "./PlayHeader";
import EventsPanel from "./EventsPanel";
import { useBadges } from "./useBadges";
import DuelPanel from "./DuelPanel";
import JointFightPanel from "./JointFightPanel";
import ScenePanel from "./ScenePanel";
import IslandCard from "./IslandCard";
import FruitRemovalCard from "./FruitRemovalCard";
import { FRUIT_REMOVAL_ISLAND } from "@/lib/engine/fruit-removal";
import CharacterSheet from "./CharacterSheet";
import TravelCinematic, { type TravelKind } from "@/three/travel/TravelCinematic";
import { IslandPeoplePanel } from "./IslandPeople";
import { RescueRaidPanel, CaptivesPanel, AdmiralAlertPanel, BlackMarketPanel, BusterCallPanel, MissionsPanel, PrisonCard, RaidPanel, TerritoryPanel, WorldEventPanel } from "./WorldPanels";
import { CrewBattlesPanel, CrewChallengePanel, OthersHerePanel, PrisonersHerePanel } from "./PeoplePanels";
import Modal from "@/components/ui/Modal";
import { rememberCharacter } from "@/components/ui/BackToCharacter";
import { ToastStack, useToasts } from "@/components/ui/Toasts";
import { diffVitals, type VitalsSnapshot } from "@/lib/ui/format";
import { crewNounForFaction } from "@/lib/engine/crew-noun";
import { factionTitle, type FactionKey } from "@/lib/engine/progression";
import AdSense from "@/components/ui/AdSense";
import type { StateResponse } from "./types";

function snapshot(d: StateResponse): VitalsSnapshot {
  const c = d.character;
  return { level: c.level, hp: c.hp, berries: c.berries, bounty: c.bounty, notoriety: c.notoriety, rankTitle: factionTitle(c.faction as FactionKey, c.bounty, c.notoriety), attributePoints: c.attributePoints ?? 0 };
}

export default function PlayPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [data, setData] = useState<StateResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [feed, setFeed] = useState<string[]>([]);
  const [arcIntro, setArcIntro] = useState<{ islandName: string; hook: string } | null>(null);
  const [battleError, setBattleError] = useState<string | null>(null);
  const [battleBusy, setBattleBusy] = useState(false);
  const [freeText, setFreeText] = useState("");
  const [escapePlan, setEscapePlan] = useState("");
  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false);
  const [panel, setPanel] = useState<PanelKey | null>(null);
  const { counts: badges, markSeen } = useBadges(id);
  const [oocStarter, setOocStarter] = useState<string | undefined>(undefined);
  const { toasts, push } = useToasts();
  const lastVitals = useRef<{ id: string; v: VitalsSnapshot } | null>(null);
  const [cinematic, setCinematic] = useState<{ kind: TravelKind; island: { name: string; sea: string; dangerLevel: number }; holdFor?: Promise<unknown> } | null>(null);
  // Set only while genuinely at sea; a long voyage can run up to an hour, so this (not VoyagePanel's own poll,
  // which won't stay mounted that whole time) is the one reliably-running place arrival is observed.
  const prevVoyageRef = useRef<StateResponse["voyage"] | null>(null);

  const load = useCallback(async () => {
    const res = await fetch(`/api/characters/${id}`);
    const d = await res.json();
    if (!res.ok) {
      setError(d.error ?? "No se pudo cargar el personaje.");
      return;
    }
    const v = snapshot(d);
    const prev = lastVitals.current?.id === id ? lastVitals.current.v : null;
    push(diffVitals(prev, v));
    lastVitals.current = { id, v };
    rememberCharacter({ id, name: d.character.name });
    if (prevVoyageRef.current && !d.voyage) {
      const isl = d.character.currentIsland;
      setCinematic({ kind: "arrive", island: { name: isl.name, sea: isl.sea, dangerLevel: isl.dangerLevel } });
    }
    prevVoyageRef.current = d.voyage ?? null;
    setData(d);
  }, [id, push]);

  useEffect(() => {
    load();
  }, [load]);

  // Server-Sent Events push a refresh the instant something shared changes (a crewmate's move, a fight
  // resolving...). The poll stays as the safety net and only slows down while the stream is healthy.
  const streamHealthy = useRef(false);
  useEffect(() => {
    if (typeof EventSource === "undefined") return;
    const es = new EventSource(`/api/characters/${id}/stream`);
    let timer: ReturnType<typeof setTimeout> | null = null;
    es.addEventListener("ready", () => {
      streamHealthy.current = true;
    });
    es.addEventListener("refresh", () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => load(), 150);
    });
    es.onerror = () => {
      streamHealthy.current = false;
    };
    return () => {
      es.close();
      if (timer) clearTimeout(timer);
      streamHealthy.current = false;
    };
  }, [id, load]);

  useEffect(() => {
    let tick = 0;
    const interval = setInterval(() => {
      tick++;
      if (!streamHealthy.current || tick % 3 === 0) load();
    }, 10_000);
    return () => clearInterval(interval);
  }, [load]);

  async function postJson(path: string, body: Record<string, unknown>) {
    const res = await fetch(`/api/characters/${id}/${path}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const result = await res.json().catch(() => ({}));
    return { ok: res.ok, result };
  }

  async function doBattleAction(body: Record<string, unknown>): Promise<boolean> {
    setBattleBusy(true);
    setBattleError(null);
    try {
      const { ok, result } = await postJson("battle", body);
      if (!ok) {
        setBattleError(result.error ?? "No se pudo completar la acción.");
        return false;
      }
      await load();
      return true;
    } finally {
      setBattleBusy(false);
    }
  }

  async function doPrisonAction(body: Record<string, unknown>, path = "prison") {
    setBattleBusy(true);
    setBattleError(null);
    try {
      const { ok, result } = await postJson(path, body);
      if (!ok) {
        setBattleError(result.error ?? "No se pudo completar la acción.");
        return;
      }
      if (result.log) setFeed((f) => [...result.log, ...f].slice(0, 60));
      await load();
    } finally {
      setBattleBusy(false);
    }
  }

  async function doWorldEvent(side: "defend" | "assist" | "chaos") {
    if (!data?.worldEvent) return;
    setBattleBusy(true);
    setBattleError(null);
    try {
      const { ok, result } = await postJson("world-event", { op: "intervene", arcId: data.worldEvent.arcId, side });
      if (!ok) setBattleError(result.error ?? "No se pudo intervenir.");
      else if (result.log) setFeed((f) => [...result.log, ...f].slice(0, 60));
      await load();
    } finally {
      setBattleBusy(false);
    }
  }

  // A retry of the same action reuses its requestId, so if the first attempt actually reached the server (slow
  // AI, dropped connection) the server hands back that result instead of running the turn twice.
  const pendingRequest = useRef<{ key: string; id: string } | null>(null);

  async function doAction(body: Record<string, unknown>): Promise<boolean> {
    setBusy(true);
    setError(null);
    const key = JSON.stringify(body);
    if (!pendingRequest.current || pendingRequest.current.key !== key) pendingRequest.current = { key, id: crypto.randomUUID() };
    try {
      const res = await fetch(`/api/characters/${id}/actions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...body, requestId: pendingRequest.current.id }),
      });
      const result = await res.json();
      if (!res.ok) {
        pendingRequest.current = null;
        setError(result.error ?? "No se pudo completar la acción.");
        return false;
      }
      pendingRequest.current = null;
      if (result.log) setFeed((f) => [...result.log, ...f].slice(0, 60));
      if (result.arcIntro) setArcIntro(result.arcIntro);
      if (result.confirmRequired === "leave_party") setShowLeaveConfirm(true);
      await load();
      return true;
    } catch {
      setError("La respuesta tardó demasiado o se cortó la conexión. Tu acción puede haberse procesado: mira la escena. Si no aparece, vuelve a enviar — no se duplicará.");
      for (const ms of [3000, 9000, 20000]) setTimeout(() => load(), ms);
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function doDuelOp(body: Record<string, unknown>) {
    setBusy(true);
    setError(null);
    try {
      const { ok, result } = await postJson("duel", body);
      if (!ok) setError(result.error ?? "No se pudo completar la acción del duelo.");
      await load();
    } finally {
      setBusy(false);
    }
  }

  // The clip covers the request in flight; onDone only fires once both the animation's own length and the
  // response have settled, so a slow connection never reveals stale island data behind it.
  function travelHop(islandId: string) {
    const target = data?.connectedIslands.find((isl) => isl.id === islandId);
    const p = doAction({ action: "travel", targetIslandId: islandId });
    if (target) setCinematic({ kind: "hop", island: { name: target.name, sea: target.sea, dangerLevel: target.dangerLevel }, holdFor: p });
  }

  async function submitFreeText() {
    const text = freeText.trim();
    if (!text || busy) return;
    const ok = await doAction({ freeText: text });
    if (ok) setFreeText("");
  }

  const openOoc = (starter?: string) => {
    setOocStarter(starter);
    setPanel("ooc");
  };

  if (error && !data) {
    return (
      <main className="flex-1 flex items-center justify-center p-6">
        <p className="text-blood">{error}</p>
      </main>
    );
  }

  if (!data) {
    return (
      <main className="flex-1 flex flex-col items-center justify-center gap-3 p-6">
        <span className="inline-block w-8 h-8 rounded-full border-2 border-gold/30 border-t-gold animate-spin" />
        <p className="text-ink-dim">Cargando personaje...</p>
      </main>
    );
  }

  const { character, connectedIslands, voyage, party, duel, jointFight, territory, busterCall, raid, blackMarket, missions } = data;
  const duelActive = duel?.status === "ACTIVE";
  const jointActive = jointFight?.status === "ACTIVE";
  const isDead = character.status === "DEAD";
  const isImprisoned = character.status === "IMPRISONED";
  const free = !isDead && !isImprisoned;

  // Party rounds: everyone writes, then the narrator answers all at once. A personal fight is never blocked by the round
  // (see resolvePartyFreeTextAction in perform-action.ts).
  const iActedThisRound = party ? party.actedIds.includes(character.id) : false;
  const partyBlocksInput = !!party && !character.pendingEncounter && !duelActive && !jointActive && (party.awaitingNarrator || iActedThisRound);
  // The narrator opens (or answers), then every member acts once in turnOrder, then the narrator answers again, in a loop.
  const nextTurnId = party ? party.turnOrder.find((id) => !party.actedIds.includes(id)) : undefined;
  const nextTurnName = party && nextTurnId ? party.members.find((m) => m.id === nextTurnId)?.name : undefined;
  const partyTurnLabel =
    !party || character.pendingEncounter || jointActive
      ? null
      : party.awaitingNarrator
      ? "El narrador está respondiendo a la ronda..."
      : nextTurnId === character.id
      ? "Es tu turno."
      : nextTurnName
      ? `Le toca a ${nextTurnName}.`
      : `Ronda: ${party.actedIds.length} de ${party.members.length} han actuado.`;
  const actions = { act: doPrisonAction, busy: battleBusy, error: battleError };

  return (
    <main className="flex-1 w-full max-w-6xl mx-auto px-4 md:px-6 pb-16 flex flex-col gap-4">
      {cinematic && <TravelCinematic kind={cinematic.kind} island={cinematic.island} holdFor={cinematic.holdFor} onDone={() => setCinematic(null)} />}
      <PlayHeader data={data} badges={badges} markSeen={markSeen} onOpen={(p) => (p === "ooc" ? openOoc() : setPanel(p))} />
      <AdSense slot={process.env.NEXT_PUBLIC_ADSENSE_SLOT_PLAY} />
      <ToastStack toasts={toasts} />
      {!isDead && <HitVignette hp={character.hp} maxHp={character.maxHp} />}
      {(character.pendingSeatChallenges ?? 0) > 0 && (
        <button className="rounded border border-blood/70 bg-blood/15 px-3 py-2 text-left text-sm text-gold-bright animate-rise" onClick={() => setPanel("power")} data-testid="seat-challenge-alert">
          ⚔️ Te han desafiado por tu puesto de mando. Tienes 24 h para responder o lo pierdes. <span className="underline">Responder</span>
        </button>
      )}

      <AnimatePresence>
      {panel === "route" && <RoutePanel key="route" characterId={character.id} onClose={() => setPanel(null)} onChanged={() => load()} />}
      {panel === "path" && <PathPanel key="path" characterId={character.id} onClose={() => setPanel(null)} onOpen={(p) => setPanel(p)} />}
      {panel === "power" && <SovereigntyPanel key="power" characterId={character.id} onClose={() => setPanel(null)} onChanged={() => load()} />}
      {panel === "events" && <EventsPanel key="events" characterId={character.id} onClose={() => setPanel(null)} onChanged={() => load()} />}
      {panel === "denden" && <DenDenPanel key="denden" characterId={character.id} onClose={() => setPanel(null)} />}
      {panel === "empire" && <EmpirePanel key="empire" characterId={character.id} onClose={() => setPanel(null)} onChanged={() => load()} />}
      {panel === "voyage" && (
        <VoyagePanel
          key="voyage"
          characterId={character.id}
          onClose={() => setPanel(null)}
          onChanged={() => load()}
          onDeparted={(o) => setCinematic({ kind: "depart", island: { name: o.name, sea: o.sea, dangerLevel: o.danger } })}
        />
      )}
      {panel === "coliseum" && <ColiseumPanel key="coliseum" characterId={character.id} onClose={() => setPanel(null)} onChanged={() => load()} />}
      {panel === "styles" && <StylesPanel key="styles" characterId={character.id} onClose={() => setPanel(null)} onChanged={() => load()} />}
      {panel === "inventory" && <InventoryPanel key="inventory" characterId={character.id} onClose={() => setPanel(null)} onChanged={() => load()} />}
      {panel === "crew" && (
        <CrewPanel
          key="crew"
          characterId={character.id}
          characterName={character.name}
          characterLevel={character.level}
          isCaptain={character.isCaptain}
          faction={character.faction}
          crew={character.crew}
          companions={character.companions}
          factionNoun={crewNounForFaction(character.faction as FactionKey)}
          onClose={() => setPanel(null)}
          onChanged={() => load()}
        />
      )}
      {panel === "ooc" && <OocPanel key="ooc" characterId={character.id} starter={oocStarter} onClose={() => setPanel(null)} onChanged={() => load()} onRestoreText={(t) => setFreeText(t)} />}
      {panel === "guide" && (
        <Modal key="guide" onClose={() => setPanel(null)} size="sm" className="p-6" label="Mapa y Guía">
          <h3 className="font-display text-xl text-gold-bright mb-2">Mapa y Guía del Jugador</h3>
          <p className="text-sm text-ink-dim mb-4">
            Referencia externa (se abre en una pestaña nueva): un mapa interactivo de todas las islas con su peligro, nivel mínimo y conexiones, y la guía completa de cómo se juega — incluyendo cómo se sube de nivel de verdad.
          </p>
          <div className="flex flex-col gap-2">
            <a className="btn-gold px-4 py-2 text-sm text-center" href="https://kelvin0880.github.io/OnepieceRol/mapa.html" target="_blank" rel="noopener noreferrer">
              Abrir mapa de ruta
            </a>
            <a className="btn-ghost px-4 py-2 text-sm text-center" href="https://kelvin0880.github.io/OnepieceRol/guia.html" target="_blank" rel="noopener noreferrer">
              Abrir guía del jugador
            </a>
          </div>
          <button className="btn-ghost px-3 py-1.5 text-xs mt-4 w-full" onClick={() => setPanel(null)}>
            Cerrar
          </button>
        </Modal>
      )}
      </AnimatePresence>

      {arcIntro && (
        <m.section
          className="panel panel-accent shine-sweep p-5"
          style={{ transformPerspective: 900, originY: 0 }}
          initial={{ opacity: 0, rotateX: -60, y: -10 }}
          animate={{ opacity: 1, rotateX: 0, y: 0 }}
          transition={{ ...SPRING.soft, opacity: { duration: 0.25 } }}
        >
          <p className="text-xs text-gold-bright uppercase tracking-wide mb-1">Llegas por primera vez a</p>
          <h2 className="font-display text-xl text-gold-bright mb-2">{arcIntro.islandName}</h2>
          <p className="text-sm text-ink italic mb-4">{arcIntro.hook}</p>
          <button className="btn-gold px-4 py-2 text-sm" onClick={() => setArcIntro(null)}>
            Continuar
          </button>
        </m.section>
      )}

      {isDead && (
        <section className="panel panel-danger p-4 animate-rise flex items-start gap-3">
          <Skull className="w-6 h-6 text-blood shrink-0" />
          <div>
            <p className="font-display text-blood">{character.name} ha caído.</p>
            <p className="text-sm mt-1 text-ink-dim">{character.deathCause}</p>
          </div>
        </section>
      )}

      {isImprisoned && character.imprisonment && <PrisonCard character={character} {...actions} escapePlan={escapePlan} setEscapePlan={setEscapePlan} />}

      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)] gap-4">
        <div className="flex flex-col gap-4 min-w-0">
          {duel && <DuelPanel duel={duel} characterId={character.id} busy={busy} doDuelOp={doDuelOp} onOoc={openOoc} />}
          {data.admiralAlert && !isDead && <AdmiralAlertPanel alert={data.admiralAlert} />}
          {data.rescueRaid && !isDead && !jointActive && <RescueRaidPanel rescue={data.rescueRaid} {...actions} />}
          {data.captives && !isDead && <CaptivesPanel captives={data.captives} {...actions} />}
          {busterCall && !isDead && <BusterCallPanel busterCall={busterCall} islandName={character.currentIsland.name} jointActive={!!jointActive} {...actions} />}
          {data.worldEvent && <WorldEventPanel worldEvent={data.worldEvent} jointActive={!!jointActive} onIntervene={doWorldEvent} busy={battleBusy} error={battleError} />}
          {jointFight && <JointFightPanel jointFight={jointFight} onOoc={openOoc} busy={busy} doAction={doAction} />}

          <IslandCard character={character} connectedIslands={connectedIslands} voyage={voyage} busy={busy} onTravel={travelHop} />
          {!isDead && !isImprisoned && character.currentIsland.name === FRUIT_REMOVAL_ISLAND && <FruitRemovalCard characterId={character.id} fruitName={character.devilFruit?.name ?? null} onChanged={load} />}
          {!isDead && !isImprisoned && <IslandPeoplePanel canon={data.canonHere} cast={data.islandCast ?? []} islandName={character.currentIsland.name} act={doPrisonAction} busy={battleBusy} error={battleError} jointActive={!!jointActive} nakamas={character.companions.filter((n) => n.status === "ALIVE").length} onRecruit={(text) => { setFreeText(text); document.querySelector('[data-testid="composer"]')?.scrollIntoView({ behavior: "smooth", block: "center" }); }} />}

          {!isDead && (
            <ScenePanel
              character={character}
              party={party}
              jointFight={jointFight}
              duelActive={!!duelActive}
              busy={busy}
              freeText={freeText}
              setFreeText={setFreeText}
              onSubmit={submitFreeText}
              doAction={doAction}
              onOoc={openOoc}
              showLeaveConfirm={showLeaveConfirm}
              setShowLeaveConfirm={setShowLeaveConfirm}
              partyBlocksInput={partyBlocksInput}
              partyTurnLabel={partyTurnLabel}
              isMyTurnNow={!partyBlocksInput}
              canCloseRound={!!party && party.actedIds.length > 0 && !party.awaitingNarrator}
              onCloseRound={() => doAction({ action: "party_close_round" })}
            />
          )}
          {error && (
            <p className="text-blood text-sm panel panel-danger px-3 py-2 animate-rise" role="alert">
              {error}
            </p>
          )}

          {missions && free && <MissionsPanel missions={missions} />}
          {raid && free && <RaidPanel raid={raid} jointActive={!!jointActive} {...actions} />}
          {territory && free && <TerritoryPanel territory={territory} jointActive={!!jointActive} {...actions} />}
          {blackMarket && free && <BlackMarketPanel blackMarket={blackMarket} berries={character.berries} {...actions} />}

          {data.othersHere.length > 0 && <OthersHerePanel data={data} busy={busy} onDuel={doDuelOp} />}
          {free && data.prisonersHere.length > 0 && <PrisonersHerePanel data={data} busy={battleBusy} error={battleError} onRescue={(targetCharacterId) => doPrisonAction({ op: "rescue", targetCharacterId })} />}
          {free && <CrewChallengePanel data={data} busy={battleBusy} error={battleError} onBattle={doBattleAction} />}
          {data.crewBattles.length > 0 && <CrewBattlesPanel battles={data.crewBattles} busy={battleBusy} onBattle={doBattleAction} />}

          <section className="panel p-4">
            <h3 className="font-display text-sm text-ink-dim mb-0.5">Bitácora</h3>
            <p className="text-xs text-ink-dim/70 mb-2">Resumen mecánico rápido — la escena completa está arriba.</p>
            <div className="flex flex-col gap-2 max-h-[240px] overflow-y-auto scrollbar-thin pr-1">
              {(feed.length > 0 ? feed.map((text, i) => ({ id: String(i), text })) : character.logs).map((l) => (
                <p key={l.id} className="text-sm border-b border-line pb-2 last:border-0">
                  {l.text}
                </p>
              ))}
            </div>
          </section>
        </div>

        <aside className="min-w-0">
          <CharacterSheet character={character} party={party} busy={busy} onOpenCrew={() => setPanel("crew")} onRejoin={() => doAction({ action: "rejoin_party" })} onChanged={() => load()} />
        </aside>
      </div>
    </main>
  );
}
