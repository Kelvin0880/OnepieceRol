"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

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
  { id: "CP0", name: "CP-0 (Gobierno Mundial)", description: "Las manos invisibles de los Nobles Mundiales: espionaje, censura y operaciones negras. Se asciende de CP10 hasta CP0 sin que nadie sepa tu nombre.", island: "Loguetown" },
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
    <main className="flex-1 max-w-2xl w-full mx-auto p-6">
      <h1 className="font-display text-2xl text-gold-bright mb-1">Comienza tu leyenda</h1>
      <p className="text-ink-dim text-sm mb-8">Cada elección aquí es permanente — no hay vuelta atrás una vez zarpes.</p>

      <form onSubmit={submit} className="flex flex-col gap-8">
        <div>
          <label className="block text-sm text-ink-dim mb-2">Nombre del personaje</label>
          <input
            className="w-full bg-sea-panel border border-[--line] rounded px-3 py-2 outline-none focus:border-gold"
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={24}
            placeholder="ej. Roronoa..."
          />
        </div>

        <div>
          <label className="block text-sm text-ink-dim mb-2">Facción</label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {FACTIONS.map((f) => (
              <button
                type="button"
                key={f.id}
                onClick={() => setFaction(f.id)}
                className={`text-left p-3 rounded panel ${faction === f.id ? "border-gold" : ""}`}
                style={faction === f.id ? { borderColor: "var(--gold)" } : undefined}
              >
                <div className="font-display text-sm text-gold-bright">{f.name}</div>
                <div className="text-xs text-ink-dim mt-1">{f.description}</div>
                <div className="text-xs text-ink-dim mt-2 italic">Inicias en: {f.island}</div>
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-sm text-ink-dim mb-2">Arquetipo</label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {ARCHETYPES.map((a) => (
              <button
                type="button"
                key={a.id}
                onClick={() => setArchetypeId(a.id)}
                className="text-left p-3 rounded panel"
                style={archetypeId === a.id ? { borderColor: "var(--gold)" } : undefined}
              >
                <div className="font-display text-sm text-gold-bright">{a.name}</div>
                <div className="text-xs text-ink-dim mt-1">{a.description}</div>
                <div className="text-xs text-gold mt-2 font-mono">{a.stats}</div>
              </button>
            ))}
          </div>
        </div>

        {error && <p className="text-blood text-sm">{error}</p>}

        <button className="btn-gold py-3 font-display" disabled={busy || name.trim().length < 2} type="submit">
          Zarpar
        </button>
      </form>
    </main>
  );
}
