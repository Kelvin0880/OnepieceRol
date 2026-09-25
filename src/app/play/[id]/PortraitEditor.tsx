"use client";

import { useState } from "react";
import { shrinkToDataUrl } from "@/lib/ui/image";

/** Upload / remove the picture shown on the character's poster (everyone can see it). */
export default function PortraitEditor({ characterId, hasPhoto, onChanged }: { characterId: string; hasPhoto: boolean; onChanged: () => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function send(dataUrl: string | null) {
    const res = await fetch(`/api/characters/${characterId}/portrait`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ dataUrl }) });
    const r = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(r.error ?? "No se pudo guardar la foto.");
    onChanged();
  }

  async function pick(file: File | undefined) {
    if (!file) return;
    setBusy(true);
    setError(null);
    try {
      await send(await shrinkToDataUrl(file));
    } catch (e) {
      setError(e instanceof Error && e.message !== "no canvas" ? e.message : "No pude leer esa imagen. Prueba con un PNG o JPG.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col items-center gap-1" data-testid="portrait-editor">
      <div className="flex gap-2 items-center flex-wrap justify-center">
        <label className={`btn-ghost px-3 py-1.5 text-xs cursor-pointer ${busy ? "opacity-50 pointer-events-none" : ""}`}>
          {hasPhoto ? "Cambiar foto del cartel" : "Subir foto para el cartel"}
          <input type="file" accept="image/png,image/jpeg,image/webp" className="hidden" data-testid="portrait-file" onChange={(e) => pick(e.target.files?.[0])} />
        </label>
        {hasPhoto && (
          <button className="btn-ghost px-3 py-1.5 text-xs" disabled={busy} onClick={() => { setBusy(true); setError(null); send(null).catch((e) => setError(e.message)).finally(() => setBusy(false)); }}>
            Quitar foto
          </button>
        )}
      </div>
      {error && <p className="text-xs text-blood" data-testid="portrait-error">{error}</p>}
    </div>
  );
}
