"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { factionTitle } from "@/lib/engine/progression";

type FactionId = "PIRATE" | "MARINE" | "REVOLUTIONARY" | "BOUNTY_HUNTER";

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
};

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
      <main className="flex-1 flex items-center justify-center p-6">
        <p className="text-ink-dim">Cargando el mundo...</p>
      </main>
    );
  }

  if (!me.user) {
    return (
      <main className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-sm">
          <h1 className="font-display text-3xl text-gold-bright text-center mb-1">Grand Line RPG</h1>
          <p className="text-ink-dim text-center mb-8 text-sm">Un rol de texto ambientado en el mundo de One Piece</p>

          <div className="panel p-6">
            <div className="flex gap-2 mb-5 text-sm">
              <button
                className={`flex-1 py-1.5 rounded ${mode === "login" ? "btn-gold" : "btn-ghost"}`}
                onClick={() => setMode("login")}
                type="button"
              >
                Entrar
              </button>
              <button
                className={`flex-1 py-1.5 rounded ${mode === "register" ? "btn-gold" : "btn-ghost"}`}
                onClick={() => setMode("register")}
                type="button"
              >
                Crear cuenta
              </button>
            </div>

            <form onSubmit={submitAuth} className="flex flex-col gap-3">
              <input
                className="bg-sea-deep border border-[--line] rounded px-3 py-2 text-sm outline-none focus:border-gold"
                placeholder="Nombre de usuario"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                autoComplete="username"
              />
              <input
                className="bg-sea-deep border border-[--line] rounded px-3 py-2 text-sm outline-none focus:border-gold"
                placeholder="Contraseña"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete={mode === "login" ? "current-password" : "new-password"}
              />
              {error && <p className="text-blood text-sm">{error}</p>}
              <button className="btn-gold py-2 mt-1 text-sm" disabled={busy} type="submit">
                {mode === "login" ? "Entrar" : "Crear cuenta"}
              </button>
            </form>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="flex-1 max-w-3xl w-full mx-auto p-6">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="font-display text-2xl text-gold-bright">Grand Line RPG</h1>
          <p className="text-ink-dim text-sm">Bienvenido, {me.user.username}</p>
        </div>
        <div className="flex gap-2">
          <Link href="/news" className="btn-ghost px-3 py-1.5 text-sm">
            Noticias del mundo
          </Link>
          <button className="btn-ghost px-3 py-1.5 text-sm" onClick={logout}>
            Salir
          </button>
        </div>
      </div>

      <div className="flex items-center justify-between mb-3">
        <h2 className="font-display text-lg">Tus personajes</h2>
        <Link href="/create" className="btn-gold px-4 py-2 text-sm">
          + Nuevo personaje
        </Link>
      </div>

      {error && <p className="text-blood text-sm mb-3">{error}</p>}

      {me.characters.length === 0 ? (
        <div className="panel p-8 text-center text-ink-dim">
          Todavía no tienes ningún personaje. El mar te espera.
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {me.characters.map((c) => (
            <div key={c.id} className="panel p-4 flex items-center justify-between hover:border-gold transition-colors">
              <Link href={`/play/${c.id}`} className="flex-1 min-w-0">
                <div className="font-display text-lg">
                  {c.name} <span className="text-ink-dim text-sm font-body">— Nv. {c.level}</span>
                </div>
                <div className="text-xs text-gold">{factionTitle(c.faction, c.bounty, c.notoriety)}</div>
                <div className="text-sm text-ink-dim">
                  {FACTION_LABEL[c.faction]} · {c.currentIsland.name}
                  {c.status !== "ALIVE" && <span className="text-blood"> · {c.status === "DEAD" ? "Caído" : c.status}</span>}
                </div>
              </Link>
              <div className="flex items-center gap-3 shrink-0">
                {c.faction === "PIRATE" && c.bounty > 0 && (
                  <div className="text-right">
                    <div className="text-gold-bright font-display">฿ {c.bounty.toLocaleString("es-ES")}</div>
                    <div className="text-xs text-ink-dim">Recompensa</div>
                  </div>
                )}
                {confirmDeleteId === c.id ? (
                  <div className="flex items-center gap-1.5 text-xs">
                    <span className="text-ink-dim">¿Borrar para siempre?</span>
                    <button className="btn-ghost px-2 py-1 text-blood" disabled={deleting} onClick={() => confirmDelete(c.id)}>
                      {deleting ? "..." : "Sí, borrar"}
                    </button>
                    <button className="btn-ghost px-2 py-1" disabled={deleting} onClick={() => setConfirmDeleteId(null)}>
                      No
                    </button>
                  </div>
                ) : (
                  <button
                    className="btn-ghost px-2 py-1.5 text-xs text-ink-dim hover:text-blood"
                    onClick={() => setConfirmDeleteId(c.id)}
                    title="Borrar personaje permanentemente"
                  >
                    Borrar
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </main>
  );
}
