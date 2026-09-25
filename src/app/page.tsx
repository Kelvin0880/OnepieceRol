"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Anchor, BookOpen, Compass, EyeOff, Flame, Globe2, MapPin, Newspaper, Plus, Skull, Swords, Target, Trash2, type LucideIcon } from "lucide-react";
import { factionTitle, rankProgress, type FactionKey } from "@/lib/engine/progression";
import WantedPoster from "@/components/ui/WantedPoster";
import StatBar from "@/components/ui/StatBar";
import { formatNumber } from "@/lib/ui/format";

type FactionId = FactionKey;

interface MeCharacter {
  id: string;
  name: string;
  faction: FactionId;
  level: number;
  status: string;
  bounty: number;
  notoriety: number;
  currentIsland: { name: string };
}

interface MeResponse {
  user: { id: string; username: string } | null;
  characters: MeCharacter[];
}

const FACTION_LABEL: Record<string, string> = {
  PIRATE: "Pirata",
  MARINE: "Marine",
  REVOLUTIONARY: "Revolucionario",
  BOUNTY_HUNTER: "Cazarrecompensas",
  CP0: "CP-0",
};

const FACTION_LOOK: Record<string, { icon: LucideIcon; color: string }> = {
  PIRATE: { icon: Skull, color: "#f0c869" },
  MARINE: { icon: Anchor, color: "#6fb3e0" },
  REVOLUTIONARY: { icon: Flame, color: "#e0785f" },
  BOUNTY_HUNTER: { icon: Target, color: "#5fc7a0" },
  CP0: { icon: EyeOff, color: "#c9c9d6" },
};

// A slowly turning compass rose: the only decoration the title needs.
function CompassRose({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 200 200" className={className} aria-hidden>
      <g fill="none" stroke="currentColor" strokeWidth="1.2" opacity="0.55">
        <circle cx="100" cy="100" r="92" />
        <circle cx="100" cy="100" r="70" strokeDasharray="2 6" />
        <circle cx="100" cy="100" r="30" />
      </g>
      <g fill="currentColor">
        <path d="M100 8 L112 100 L100 192 L88 100 Z" opacity="0.9" />
        <path d="M8 100 L100 88 L192 100 L100 112 Z" opacity="0.6" />
        <path d="M35 35 L104 96 L165 165 L96 104 Z" opacity="0.25" />
        <path d="M165 35 L104 104 L35 165 L96 96 Z" opacity="0.25" />
      </g>
      <text x="100" y="26" textAnchor="middle" fontSize="14" fill="currentColor" fontFamily="serif">N</text>
    </svg>
  );
}

const FEATURES: { icon: LucideIcon; title: string; text: string }[] = [
  { icon: Compass, title: "Rol libre con narrador IA", text: "Escribe lo que haces; el narrador lo cuenta y un árbitro justo decide." },
  { icon: Skull, title: "Muerte permanente", text: "Cada combate importa: si caes, tu leyenda termina de verdad." },
  { icon: Globe2, title: "Un mundo que se mueve solo", text: "Yonko, almirantes y noticias que cambian aunque no estés." },
];

export default function HomePage() {
  const [me, setMe] = useState<MeResponse | null>(null);
  const [mode, setMode] = useState<"login" | "register">("login");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  async function loadMe() {
    const res = await fetch("/api/me");
    setMe(await res.json());
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadMe();
  }, []);

  async function submitAuth(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const res = await fetch(`/api/auth/${mode}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Algo salió mal.");
        return;
      }
      await loadMe();
    } finally {
      setBusy(false);
    }
  }

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    await loadMe();
  }

  async function confirmDelete(characterId: string) {
    setDeleting(true);
    try {
      const res = await fetch(`/api/characters/${characterId}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "No se pudo borrar el personaje.");
        return;
      }
      setConfirmDeleteId(null);
      await loadMe();
    } finally {
      setDeleting(false);
    }
  }

  if (!me) {
    return (
      <main className="flex-1 flex flex-col items-center justify-center gap-4 p-6">
        <CompassRose className="w-16 h-16 text-gold animate-spin-slow" />
        <p className="text-ink-dim">Cargando el mundo...</p>
      </main>
    );
  }

  if (!me.user) {
    return (
      <main className="flex-1 flex items-center justify-center p-4 sm:p-6">
        <div className="w-full max-w-5xl grid gap-8 lg:grid-cols-[1.1fr_1fr] items-center">
          <section className="text-center lg:text-left animate-rise">
            <div className="relative mx-auto lg:mx-0 w-28 h-28 sm:w-36 sm:h-36 mb-4">
              <CompassRose className="absolute inset-0 w-full h-full text-gold animate-spin-slow" />
            </div>
            <h1 className="font-display text-4xl sm:text-5xl text-gold-bright mb-2 drop-shadow-[0_2px_12px_rgba(240,200,105,0.25)]">Grand Line RPG</h1>
            <p className="text-ink-dim text-base sm:text-lg mb-6">Un rol de texto ambientado en el mundo de One Piece</p>
            <ul className="hidden sm:grid gap-3 text-left max-w-md mx-auto lg:mx-0 stagger">
              {FEATURES.map((f) => (
                <li key={f.title} className="flex gap-3 items-start">
                  <span className="w-9 h-9 shrink-0 rounded-full grid place-items-center border border-gold/40 text-gold">
                    <f.icon className="w-4 h-4" />
                  </span>
                  <span>
                    <span className="font-display text-sm text-gold-bright block">{f.title}</span>
                    <span className="text-sm text-ink-dim">{f.text}</span>
                  </span>
                </li>
              ))}
            </ul>
          </section>

          <div className="panel panel-accent p-6 w-full max-w-sm mx-auto animate-rise" style={{ animationDelay: "0.1s" }}>
            <div className="flex gap-2 mb-5 text-sm">
              <button className={`flex-1 py-2 rounded ${mode === "login" ? "btn-gold" : "btn-ghost"}`} onClick={() => setMode("login")} type="button">
                Entrar
              </button>
              <button className={`flex-1 py-2 rounded ${mode === "register" ? "btn-gold" : "btn-ghost"}`} onClick={() => setMode("register")} type="button">
                Crear cuenta
              </button>
            </div>

            <form onSubmit={submitAuth} className="flex flex-col gap-3">
              <input className="field px-3 py-2.5 text-sm" placeholder="Nombre de usuario" value={username} onChange={(e) => setUsername(e.target.value)} autoComplete="username" />
              <input
                className="field px-3 py-2.5 text-sm"
                placeholder="Contraseña"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete={mode === "login" ? "current-password" : "new-password"}
              />
              {error && <p className="text-blood text-sm animate-rise">{error}</p>}
              <button className="btn-gold py-2.5 mt-1 text-sm" disabled={busy} type="submit">
                {mode === "login" ? "Entrar" : "Crear cuenta"}
              </button>
            </form>
            <div className="mt-5 pt-4 border-t border-line flex justify-center gap-4 text-xs">
              <a className="text-ink-dim hover:text-gold inline-flex items-center gap-1" href="https://kelvin0880.github.io/OnepieceRol/mapa.html" target="_blank" rel="noopener noreferrer">
                <MapPin className="w-3.5 h-3.5" />
                Mapa del mundo
              </a>
              <a className="text-ink-dim hover:text-gold inline-flex items-center gap-1" href="https://kelvin0880.github.io/OnepieceRol/guia.html" target="_blank" rel="noopener noreferrer">
                <BookOpen className="w-3.5 h-3.5" />
                Guía del jugador
              </a>
            </div>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="flex-1 max-w-4xl w-full mx-auto p-4 sm:p-6 pb-16">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-8">
        <div className="flex items-center gap-3">
          <CompassRose className="w-10 h-10 text-gold animate-spin-slow" />
          <div>
            <h1 className="font-display text-2xl text-gold-bright">Grand Line RPG</h1>
            <p className="text-ink-dim text-sm">Bienvenido, {me.user.username}</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/news" className="btn-ghost px-3 py-1.5 text-sm inline-flex items-center gap-1.5">
            <Newspaper className="w-4 h-4" />
            Noticias del mundo
          </Link>
          <Link href="/codex" className="btn-ghost px-3 py-1.5 text-sm inline-flex items-center gap-1.5">
            <BookOpen className="w-4 h-4" />
            Códice
          </Link>
          <button className="btn-ghost px-3 py-1.5 text-sm" onClick={logout}>
            Salir
          </button>
        </div>
      </div>

      <div className="flex items-center justify-between mb-3">
        <h2 className="font-display text-lg">Tus personajes</h2>
        <Link href="/create" className="btn-gold px-4 py-2 text-sm inline-flex items-center gap-1.5">
          <Plus className="w-4 h-4" />
          Nuevo personaje
        </Link>
      </div>

      {error && <p className="text-blood text-sm mb-3">{error}</p>}

      {me.characters.length === 0 ? (
        <div className="panel p-10 text-center text-ink-dim flex flex-col items-center gap-3 animate-rise">
          <Swords className="w-10 h-10 text-gold/60" />
          Todavía no tienes ningún personaje. El mar te espera.
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 stagger">
          {me.characters.map((c) => {
            const look = FACTION_LOOK[c.faction] ?? FACTION_LOOK.PIRATE;
            const r = rankProgress(c.faction, c.bounty, c.notoriety);
            const dead = c.status === "DEAD";
            return (
              <div key={c.id} className={`panel p-4 flex flex-col gap-3 transition-all duration-200 hover:-translate-y-0.5 hover:border-gold ${dead ? "opacity-60 grayscale" : ""}`} style={{ borderTop: `3px solid ${look.color}` }}>
                <Link href={`/play/${c.id}`} className="flex gap-3 min-w-0">
                  {c.faction === "PIRATE" ? (
                    <WantedPoster name={c.name} bounty={c.bounty} size="sm" deceased={dead} />
                  ) : (
                    <span className="w-16 h-16 shrink-0 rounded-full grid place-items-center border-2" style={{ borderColor: look.color, color: look.color, background: "rgba(0,0,0,0.25)" }}>
                      <look.icon className="w-7 h-7" />
                    </span>
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="font-display text-lg truncate">
                      {c.name} <span className="text-ink-dim text-sm font-body">— Nv. {c.level}</span>
                    </div>
                    <div className="text-xs text-gold" data-testid="rank-title">
                      {factionTitle(c.faction, c.bounty, c.notoriety)}
                    </div>
                    <div className="text-sm text-ink-dim inline-flex items-center gap-1">
                      {FACTION_LABEL[c.faction]} · <MapPin className="w-3 h-3" /> {c.currentIsland.name}
                      {c.status !== "ALIVE" && <span className="text-blood"> · {dead ? "Caído" : c.status === "IMPRISONED" ? "Encarcelado" : c.status}</span>}
                    </div>
                    {r.target !== null && (
                      <div className="mt-1.5" title={`${r.metric}: ${formatNumber(r.value)} / ${formatNumber(r.target)} para «${r.nextTitle}»`}>
                        <StatBar value={r.fraction * 100} max={100} color={look.color} hideNumbers size="sm" />
                        <div className="text-[10px] text-ink-dim mt-0.5">→ {r.nextTitle}</div>
                      </div>
                    )}
                  </div>
                </Link>
                <div className="flex items-center justify-between gap-2 border-t border-line pt-2">
                  <Link href={`/play/${c.id}`} className="btn-gold px-3 py-1.5 text-xs">
                    {dead ? "Ver su historia" : "Jugar"}
                  </Link>
                  {confirmDeleteId === c.id ? (
                    <div className="flex items-center gap-1.5 text-xs animate-rise">
                      <span className="text-ink-dim">¿Borrar para siempre?</span>
                      <button className="btn-danger px-2 py-1" disabled={deleting} onClick={() => confirmDelete(c.id)}>
                        {deleting ? "..." : "Sí, borrar"}
                      </button>
                      <button className="btn-ghost px-2 py-1" disabled={deleting} onClick={() => setConfirmDeleteId(null)}>
                        No
                      </button>
                    </div>
                  ) : (
                    <button className="btn-ghost px-2 py-1.5 text-xs text-ink-dim hover:text-blood inline-flex items-center gap-1" onClick={() => setConfirmDeleteId(c.id)} title="Borrar personaje permanentemente">
                      <Trash2 className="w-3.5 h-3.5" />
                      Borrar
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </main>
  );
}
