"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Anchor, ArrowLeft, Check, Crosshair, EyeOff, Flame, MapPin, Shield, Skull, Sword, Swords, Target, type LucideIcon } from "lucide-react";

const FACTION_LOOK: Record<string, { icon: LucideIcon; color: string }> = {
  PIRATE: { icon: Skull, color: "#f0c869" },
  MARINE: { icon: Anchor, color: "#6fb3e0" },
  REVOLUTIONARY: { icon: Flame, color: "#e0785f" },
  BOUNTY_HUNTER: { icon: Target, color: "#5fc7a0" },
  CP0: { icon: EyeOff, color: "#c9c9d6" },
};

const ARCHETYPE_ICON: Record<string, LucideIcon> = { swordsman: Sword, brawler: Swords, marksman: Crosshair, brawn: Shield };

function StatRow({ stats }: { stats: string }) {
  return (
    <div className="mt-2 grid grid-cols-5 gap-1.5" aria-label={stats}>
      {stats.split(" · ").map((part) => {
        const [label, value] = part.split(" ");
        const n = Number(value);
        return (
          <div key={label} className="text-center">
            <div className="h-10 rounded-sm bg-black/30 flex items-end overflow-hidden">
              <div className="w-full bg-gradient-to-t from-gold to-gold-bright transition-all" style={{ height: `${n * 10}%` }} />
            </div>
            <div className="text-[10px] text-ink-dim mt-0.5 font-display">{label}</div>
            <div className="text-[11px] text-gold-bright">{n}</div>
          </div>
        );
      })}
    </div>
  );
}

const ARCHETYPES = [
  { id: "swordsman", name: "Espadachín", description: "Ágil y letal con la hoja en la mano. Prospera en duelos rápidos.", stats: "FUE 8 · AGI 9 · RES 6 · VOL 5 · INT 4" },
  { id: "brawler", name: "Luchador Cuerpo a Cuerpo", description: "Puños de acero y un cuerpo que absorbe castigo sin quebrarse.", stats: "FUE 9 · AGI 6 · RES 9 · VOL 5 · INT 3" },
  { id: "marksman", name: "Tirador", description: "Frío, calculador, y letal a distancia antes de que el enemigo reaccione.", stats: "FUE 5 · AGI 8 · RES 5 · VOL 5 · INT 9" },
  { id: "brawn", name: "Fuerza Bruta", description: "Lento pero devastador. Lo que golpea, no se vuelve a levantar.", stats: "FUE 10 · AGI 4 · RES 10 · VOL 4 · INT 4" },
] as const;

const FACTIONS = [
  { id: "PIRATE", name: "Pirata", description: "Libertad absoluta. Persigues tu propia leyenda, a costa de una recompensa que no dejará de crecer.", island: "Pueblo Foosha" },
  { id: "MARINE", name: "Marine", description: "Justicia y disciplina. Ascender en la jerarquía exige méritos, no suerte.", island: "Cuartel Marine G-5" },
  { id: "REVOLUTIONARY", name: "Revolucionario", description: "Derrocar al Gobierno Mundial desde las sombras, célula a célula.", island: "Isla Baltigo" },
  { id: "BOUNTY_HUNTER", name: "Cazarrecompensas", description: "Ni ley ni bandera: solo el mejor postor y la cabeza correcta.", island: "Isla Gecko" },
  { id: "CP0", name: "CP-0 (Gobierno Mundial)", description: "Las manos invisibles de los Nobles Mundiales: espionaje, censura y operaciones negras. Se asciende de CP10 hasta CP0 sin que nadie sepa tu nombre.", island: "Tequila Wolf" },
] as const;

export default function CreateCharacterPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [faction, setFaction] = useState<(typeof FACTIONS)[number]["id"]>("PIRATE");
  const [archetypeId, setArchetypeId] = useState<(typeof ARCHETYPES)[number]["id"]>("swordsman");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const res = await fetch("/api/characters", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, faction, archetypeId }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "No se pudo crear el personaje.");
        return;
      }
      router.push(`/play/${data.id}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="flex-1 max-w-3xl w-full mx-auto p-4 sm:p-6 pb-16">
      <Link href="/" className="inline-flex items-center gap-1.5 text-sm text-ink-dim hover:text-gold mb-4">
        <ArrowLeft className="w-4 h-4" />
        Mis personajes
      </Link>
      <h1 className="font-display text-3xl text-gold-bright mb-1 animate-rise">Comienza tu leyenda</h1>
      <p className="text-ink-dim text-sm mb-8">Cada elección aquí es permanente — no hay vuelta atrás una vez zarpes.</p>

      <form onSubmit={submit} className="flex flex-col gap-8 stagger">
        <div>
          <label className="block text-sm text-ink-dim mb-2" htmlFor="char-name">
            Nombre del personaje
          </label>
          <input id="char-name" className="field w-full px-4 py-3 text-lg font-display" value={name} onChange={(e) => setName(e.target.value)} maxLength={24} placeholder="ej. Roronoa..." />
        </div>

        <div>
          <label className="block text-sm text-ink-dim mb-2">Facción</label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {FACTIONS.map((f) => {
              const look = FACTION_LOOK[f.id];
              const Icon = look.icon;
              const on = faction === f.id;
              return (
                <button
                  type="button"
                  key={f.id}
                  onClick={() => setFaction(f.id)}
                  className={`relative text-left p-4 panel transition-all duration-200 hover:-translate-y-0.5 ${on ? "panel-accent" : "opacity-85 hover:opacity-100"}`}
                  style={on ? { borderColor: look.color, boxShadow: `0 0 0 1px ${look.color}33, 0 12px 30px -16px ${look.color}` } : undefined}
                  aria-pressed={on}
                >
                  {on && <Check className="absolute top-3 right-3 w-4 h-4 animate-pop" style={{ color: look.color }} />}
                  <div className="flex items-center gap-2">
                    <span className="w-8 h-8 rounded-full grid place-items-center border" style={{ borderColor: look.color, color: look.color }}>
                      <Icon className="w-4 h-4" />
                    </span>
                    <span className="font-display text-sm text-gold-bright">{f.name}</span>
                  </div>
                  <div className="text-xs text-ink-dim mt-2">{f.description}</div>
                  <div className="text-xs text-ink-dim mt-2 italic inline-flex items-center gap-1">
                    <MapPin className="w-3 h-3" />
                    Inicias en: {f.island}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        <div>
          <label className="block text-sm text-ink-dim mb-2">Arquetipo</label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {ARCHETYPES.map((a) => {
              const Icon = ARCHETYPE_ICON[a.id];
              const on = archetypeId === a.id;
              return (
                <button
                  type="button"
                  key={a.id}
                  onClick={() => setArchetypeId(a.id)}
                  className={`relative text-left p-4 panel transition-all duration-200 hover:-translate-y-0.5 ${on ? "panel-accent" : "opacity-85 hover:opacity-100"}`}
                  aria-pressed={on}
                >
                  {on && <Check className="absolute top-3 right-3 w-4 h-4 text-gold animate-pop" />}
                  <div className="flex items-center gap-2">
                    <Icon className="w-5 h-5 text-gold" />
                    <span className="font-display text-sm text-gold-bright">{a.name}</span>
                  </div>
                  <div className="text-xs text-ink-dim mt-1">{a.description}</div>
                  <StatRow stats={a.stats} />
                </button>
              );
            })}
          </div>
        </div>

        {error && <p className="text-blood text-sm">{error}</p>}

        <button className="btn-gold py-3.5 font-display text-lg tracking-wider inline-flex items-center justify-center gap-2" disabled={busy || name.trim().length < 2} type="submit">
          <Anchor className="w-5 h-5" />
          Zarpar
        </button>
      </form>
    </main>
  );
}
