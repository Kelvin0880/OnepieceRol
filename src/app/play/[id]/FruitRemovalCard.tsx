"use client";

import { useCallback, useEffect, useState } from "react";
import { Droplets } from "lucide-react";
import { formatBerries } from "@/lib/ui/format";

interface Offer {
  island: string;
  here: boolean;
  fruitName: string | null;
  mastery: number;
  awakened: boolean;
  price: number;
  berries: number;
  blockedReason: string | null;
}

// Isla Kairos only: the one place in the world where a devil fruit can be given back (game/fruit-removal.ts).
// Irreversible, so it takes two deliberate steps: open the ritual, then type the fruit's exact name.
export default function FruitRemovalCard({ characterId, fruitName, onChanged }: { characterId: string; fruitName: string | null; onChanged: () => void }) {
  const [offer, setOffer] = useState<Offer | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [typed, setTyped] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  const fetchOffer = useCallback(
    () =>
      fetch(`/api/characters/${characterId}/fruit-removal`)
        .then((res) => (res.ok ? (res.json() as Promise<Offer>) : null))
        .catch(() => null), // the card just stays empty; nothing else depends on it
    [characterId],
  );

  // Refetch whenever the fruit changes (given back here, or a new one eaten from the bag), keeping any success line.
  useEffect(() => {
    let cancelled = false;
    void fetchOffer().then((next) => {
      if (!cancelled && next) setOffer(next);
    });
    return () => {
      cancelled = true;
    };
  }, [fetchOffer, fruitName]);

  async function perform() {
    if (!offer?.fruitName) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/characters/${characterId}/fruit-removal`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fruitName: typed }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(body.error ?? "No se pudo completar el ritual.");
        return;
      }
      setDone(body.message);
      setConfirming(false);
      setTyped("");
      const next = await fetchOffer();
      if (next) setOffer(next);
      onChanged();
    } catch {
      setError("Se cortó la conexión. Recarga para ver si el ritual se completó antes de volver a intentarlo.");
    } finally {
      setBusy(false);
    }
  }

  if (!offer || !offer.here) return null;
  const canAfford = offer.berries >= offer.price;

  return (
    <section className="panel p-4" data-testid="fruit-removal-card">
      <h3 className="font-display text-base flex items-center gap-2 mb-1">
        <Droplets className="w-5 h-5 text-gold" />
        Las Aguas Quietas
      </h3>
      <p className="text-sm text-ink-dim">
        La Orden del Mar Callado sumerge a los usuarios en el manantial de Kairoseki hasta arrancarles el poder de su fruta. Es para siempre: pierdes la fruta y todo su dominio, vuelves a poder nadar, y la próxima
        fruta que comas empezará desde cero.
      </p>
      {done && (
        <p className="text-sm text-jade mt-3 whitespace-pre-line" data-testid="fruit-removal-done">
          {done}
        </p>
      )}
      {offer.fruitName ? (
        <div className="mt-3 flex flex-col gap-2">
          <p className="text-sm">
            Tu fruta: <span className="text-gold-bright">{offer.fruitName}</span> · dominio {offer.mastery}
            {offer.awakened ? " · despertada" : ""}
          </p>
          <p className="text-sm">
            Precio del ritual: <span className={canAfford ? "text-gold-bright" : "text-blood"} data-testid="fruit-removal-price">{formatBerries(offer.price)}</span>
            {!canAfford && <span className="text-xs text-ink-dim"> (tienes {formatBerries(offer.berries)})</span>}
          </p>
          {offer.blockedReason ? (
            <p className="text-xs text-ink-dim" data-testid="fruit-removal-blocked">
              {offer.blockedReason}
            </p>
          ) : !confirming ? (
            <button className="btn-ghost px-3 py-1.5 text-xs self-start" data-testid="fruit-removal-open" onClick={() => setConfirming(true)}>
              Quiero quitarme la fruta
            </button>
          ) : (
            <div className="rounded-md border border-blood/50 bg-blood/5 p-3 flex flex-col gap-2" data-testid="fruit-removal-confirm">
              <p className="text-xs text-blood">No se puede deshacer. Escribe el nombre exacto de tu fruta para confirmar: {offer.fruitName}</p>
              <input className="input text-sm" value={typed} onChange={(e) => setTyped(e.target.value)} placeholder={offer.fruitName} data-testid="fruit-removal-input" aria-label="Nombre de tu fruta" />
              <div className="flex flex-wrap gap-2">
                <button className="btn-gold px-3 py-1.5 text-xs" disabled={busy || typed.trim() !== offer.fruitName} onClick={perform} data-testid="fruit-removal-submit">
                  {busy ? "Sumergiéndote..." : `Pagar ${formatBerries(offer.price)} y quitarme la fruta`}
                </button>
                <button
                  className="btn-ghost px-3 py-1.5 text-xs"
                  disabled={busy}
                  onClick={() => {
                    setConfirming(false);
                    setTyped("");
                  }}
                >
                  Cancelar
                </button>
              </div>
            </div>
          )}
          {error && (
            <p className="text-xs text-blood" data-testid="fruit-removal-error">
              {error}
            </p>
          )}
        </div>
      ) : (
        !done && <p className="text-xs text-ink-dim mt-2">No llevas ninguna fruta dentro: aquí no hay nada que hacer por ti, salvo escuchar las historias de quienes vinieron a renunciar a la suya.</p>
      )}
    </section>
  );
}
