"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";

interface Stats {
  strength: number;
  agility: number;
  durability: number;
  willpower: number;
  intellect: number;
  armamentHaki: number;
  observationHaki: number;
  conquerorsHaki: boolean;
  fruitPhase: string | null;
}

interface Actor {
  id: string;
  name: string;
  role: string;
  rankLabel: string | null;
  factionType: string;
  factionName: string;
  status: string;
  powerLevel: number;
  description: string;
  personality: string | null;
  canonBounty: string | null;
  canonWeapon: string | null;
  devilFruit: { name: string; englishName: string; type: string; rarity: string } | null;
  stats: Stats | null;
  abilities: string[];
  styles?: string[];
  home: string | null;
  location: string | null;
  locationKind: string | null;
  focus: string | null;
}

const FACTIONS: { id: string; label: string }[] = [
  { id: "ALL", label: "Todos" },
  { id: "PIRATE", label: "Piratas" },
  { id: "MARINE", label: "Marina" },
  { id: "REVOLUTIONARY", label: "Revolucionarios" },
  { id: "CIPHER_POL", label: "Cipher Pol" },
  { id: "BOUNTY_HUNTER", label: "Cazarrecompensas" },
  { id: "CIVILIAN", label: "Civiles" },
];

const STATUS_LABEL: Record<string, string> = { ACTIVE: "Activo", RETIRED: "Retirado", DEFEATED: "Derrotado", DECEASED: "Fallecido", CAPTURED: "Capturado" };
const PHASE_LABEL: Record<string, string> = { initial: "dominio inicial", advanced: "dominio avanzado", awakened: "despertada" };

function Bar({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <div className="flex justify-between text-[10px] text-ink-dim">
        <span>{label}</span>
        <span>{value}</span>
      </div>
      <div className="h-1 rounded bg-black/30 overflow-hidden">
        <div className="h-full" style={{ width: `${Math.min(100, value)}%`, background: "var(--gold)" }} />
      </div>
    </div>
  );
}

function ActorCard({ a }: { a: Actor }) {
  const gone = a.status !== "ACTIVE";
  return (
    <div className={`panel p-4 flex flex-col gap-2 ${gone ? "opacity-70" : ""}`} data-testid="codex-card">
      <div className="flex items-baseline justify-between gap-2">
        <h3 className="font-display text-lg text-gold-bright">{a.name}</h3>
        <span className={`text-[10px] uppercase tracking-wide ${gone ? "text-blood" : "text-emerald-300"}`}>{STATUS_LABEL[a.status] ?? a.status}</span>
      </div>
      <p className="text-xs text-ink-dim">
        {a.rankLabel ?? a.role.toLowerCase().replace(/_/g, " ")} · {a.factionName}
      </p>
      <p className="text-sm">{a.description}</p>
      {a.personality && <p className="text-xs italic text-ink-dim">«{a.personality}»</p>}

      <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
        <span className="text-ink-dim">Recompensa</span>
        <span className="text-gold-bright text-right" data-testid="codex-bounty">
          {a.canonBounty && a.canonBounty !== "0" ? `฿ ${Number(a.canonBounty).toLocaleString("es-ES")}` : "sin recompensa conocida"}
        </span>
        <span className="text-ink-dim">Fruta</span>
        <span className="text-right">
          {a.devilFruit ? `${a.devilFruit.name}${a.stats?.fruitPhase ? ` (${PHASE_LABEL[a.stats.fruitPhase] ?? a.stats.fruitPhase})` : ""}` : "ninguna"}
        </span>
        <span className="text-ink-dim">Arma</span>
        <span className="text-right">{a.canonWeapon ?? "—"}</span>
        <span className="text-ink-dim">Nivel de poder</span>
        <span className="text-right">{a.powerLevel}</span>
        {!gone && (
          <>
            <span className="text-ink-dim">Ubicación</span>
            <span className="text-right text-gold" data-testid="codex-location">
              {a.locationKind === "sea" ? "🌊" : a.locationKind === "unknown" ? "❓" : "📍"} {a.location}
            </span>
          </>
        )}
        {a.home && (
          <>
            <span className="text-ink-dim">Hogar</span>
            <span className="text-right">{a.home}</span>
          </>
        )}
      </div>
      {a.focus && <p className="text-[11px] text-orange-300">{a.focus}</p>}

      {a.stats && (
        <div className="grid grid-cols-2 gap-x-3 gap-y-1">
          <Bar label="Fuerza" value={a.stats.strength} />
          <Bar label="Agilidad" value={a.stats.agility} />
          <Bar label="Resistencia" value={a.stats.durability} />
          <Bar label="Voluntad" value={a.stats.willpower} />
          <Bar label="Intelecto" value={a.stats.intellect} />
          <Bar label="Haki de Armadura" value={a.stats.armamentHaki} />
          <Bar label="Haki de Observación" value={a.stats.observationHaki} />
          <div className="text-[10px] text-ink-dim self-end">Haki del Rey: {a.stats.conquerorsHaki ? "sí" : "no"}</div>
        </div>
      )}
      {a.styles && a.styles.length > 0 && (
        <p className="text-xs text-gold" data-testid="codex-styles">
          Estilo de combate: {a.styles.join(" · ")}
        </p>
      )}
      {a.abilities.length > 0 && (
        <div>
          <p className="text-[10px] uppercase tracking-wide text-ink-dim mb-0.5">Habilidades</p>
          <ul className="text-xs list-disc pl-4">
            {a.abilities.map((ab) => (
              <li key={ab}>{ab}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

interface PlayerRow {
  id: string;
  name: string;
  faction: string;
  rank: string;
  title: string | null;
  level: number;
  bounty: number | null;
  notoriety: number | null;
  status: string;
  location: string | null;
  fruit: string | null;
  crew: string | null;
  joinedAt: string;
  diedAt: string | null;
  deathCause: string | null;
}

const PLAYER_STATUS: Record<string, string> = { ALIVE: "Vivo", DEAD: "Muerto", IMPRISONED: "Preso" };

function PlayersSection({ query }: { query: string }) {
  const [players, setPlayers] = useState<PlayerRow[] | null>(null);
  useEffect(() => {
    fetch("/api/codex/players")
      .then((r) => r.json())
      .then((d) => setPlayers(d.players))
      .catch(() => setPlayers([]));
  }, []);
  const q = query.trim().toLowerCase();
  const shown = (players ?? []).filter((p) => !q || p.name.toLowerCase().includes(q) || (p.crew ?? "").toLowerCase().includes(q) || p.faction.toLowerCase().includes(q));
  if (players === null) return <p className="text-ink-dim">Cargando…</p>;
  return (
    <>
      <p className="text-xs text-ink-dim" data-testid="codex-players-count">
        {shown.length} jugador{shown.length === 1 ? "" : "es"} en el registro
      </p>
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {shown.map((p) => (
          <div key={p.id} className={`panel p-3 flex flex-col gap-1 ${p.status === "DEAD" ? "opacity-70" : ""}`} data-testid="codex-player">
            <div className="flex items-start justify-between gap-2">
              <strong className="text-gold-bright">{p.name}</strong>
              <span className={`text-xs ${p.status === "DEAD" ? "text-blood" : p.status === "IMPRISONED" ? "text-orange-300" : "text-emerald-300"}`}>{PLAYER_STATUS[p.status] ?? p.status}</span>
            </div>
            <p className="text-xs text-gold">
              {p.title ? `${p.title} · ` : ""}
              {p.rank}
            </p>
            <p className="text-xs text-ink-dim">
              {p.faction} · Nv. {p.level}
              {p.crew ? ` · ${p.crew}` : ""}
              {p.location ? ` · ${p.location}` : ""}
            </p>
            <p className="text-xs text-ink-dim">
              {p.bounty != null ? `Recompensa: ฿ ${p.bounty.toLocaleString("es-ES")}` : `Renombre: ${p.notoriety ?? 0}`} · {p.fruit ? `Fruta: ${p.fruit}` : "Sin fruta del Diablo"}
            </p>
            <p className="text-[11px] text-ink-dim">
              Desde {new Date(p.joinedAt).toLocaleDateString("es-ES")}
              {p.status === "DEAD" && p.diedAt ? ` · murió el ${new Date(p.diedAt).toLocaleDateString("es-ES")}${p.deathCause ? `: ${p.deathCause}` : ""}` : ""}
            </p>
          </div>
        ))}
      </div>
    </>
  );
}

export default function CodexPage() {
  const [section, setSection] = useState<"canon" | "players">("canon");
  const [actors, setActors] = useState<Actor[] | null>(null);
  const [faction, setFaction] = useState("ALL");
  const [showHistory, setShowHistory] = useState(false);
  const [query, setQuery] = useState("");

  useEffect(() => {
    fetch("/api/codex")
      .then((r) => r.json())
      .then((d) => setActors(d.actors))
      .catch(() => setActors([]));
  }, []);

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (actors ?? []).filter((a) => (showHistory ? a.status !== "ACTIVE" : a.status === "ACTIVE") && (faction === "ALL" || a.factionType === faction) && (!q || a.name.toLowerCase().includes(q) || a.factionName.toLowerCase().includes(q)));
  }, [actors, faction, showHistory, query]);

  return (
    <main className="flex-1 max-w-6xl w-full mx-auto p-6 flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-2xl text-gold-bright">Códice del mundo</h1>
        <div className="flex gap-2">
          <Link href="/news" className="btn-ghost px-3 py-1.5 text-sm">
            Noticias
          </Link>
          <button className="btn-ghost px-3 py-1.5 text-sm" onClick={() => history.back()}>
            Volver
          </button>
        </div>
      </div>
      <p className="text-sm text-ink-dim">
        Todos los personajes que mueven el mundo: recompensa, fruta, arma, habilidades, estadísticas y dónde están ahora. Quien se mueve en secreto aparece como «Ubicación desconocida»; quien va navegando, como «En el mar, entre X y Y».
      </p>

      <div className="flex gap-2">
        <button onClick={() => setSection("canon")} className={`px-3 py-1.5 rounded text-sm border ${section === "canon" ? "border-gold-bright text-gold-bright" : "border-white/15 text-ink-dim"}`} data-testid="codex-tab-canon">
          Personajes canon
        </button>
        <button onClick={() => setSection("players")} className={`px-3 py-1.5 rounded text-sm border ${section === "players" ? "border-gold-bright text-gold-bright" : "border-white/15 text-ink-dim"}`} data-testid="codex-tab-players">
          Jugadores
        </button>
      </div>

      {section === "players" && (
        <>
          <input className="input w-full sm:w-72" placeholder="Buscar jugador, tripulación o facción…" value={query} onChange={(e) => setQuery(e.target.value)} data-testid="codex-search" />
          <PlayersSection query={query} />
        </>
      )}

      {section === "canon" && (<>
      <div className="flex flex-wrap gap-2 items-center">
        {FACTIONS.map((f) => (
          <button key={f.id} onClick={() => setFaction(f.id)} className={`px-3 py-1 rounded-full text-xs border ${faction === f.id ? "border-gold-bright text-gold-bright" : "border-white/15 text-ink-dim"}`}>
            {f.label}
          </button>
        ))}
        <button onClick={() => setShowHistory((v) => !v)} className={`px-3 py-1 rounded-full text-xs border ${showHistory ? "border-blood text-blood" : "border-white/15 text-ink-dim"}`} data-testid="codex-history">
          {showHistory ? "Viendo historia (fuera de juego)" : "Ver historia (fuera de juego)"}
        </button>
        <input className="input ml-auto w-56" placeholder="Buscar por nombre o facción…" value={query} onChange={(e) => setQuery(e.target.value)} data-testid="codex-search" />
      </div>

      {actors === null ? (
        <p className="text-ink-dim">Cargando…</p>
      ) : shown.length === 0 ? (
        <p className="text-ink-dim">Nadie coincide con ese filtro.</p>
      ) : (
        <>
          <p className="text-xs text-ink-dim" data-testid="codex-count">
            {shown.length} personaje{shown.length === 1 ? "" : "s"}
          </p>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {shown.map((a) => (
              <ActorCard key={a.id} a={a} />
            ))}
          </div>
        </>
      )}
      </>)}
    </main>
  );
}
