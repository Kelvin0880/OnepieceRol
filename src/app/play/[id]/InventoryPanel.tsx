"use client";

import { useCallback, useEffect, useState } from "react";

interface View {
  berries: number;
  slotsUsed: number;
  slots: number;
  hasFruit: boolean;
  fruits: { inventoryItemId: string; name: string; englishName: string; type: string; rarity: string; description: string; sellValue: number }[];
  items: { id: string; name: string; kind: string; description: string; quantity: number; usable: boolean; sellValue: number }[];
  weapons: { id: string; name: string; kind: string; atkBonus: number; description: string; equipped: boolean }[];
  devilFruit: { name: string; description: string } | null;
  poneglyphsRead: string;
  shop: { id: string; name: string; kind: string; description: string; price: number }[];
}

type Tab = "bag" | "gear" | "shop";

export default function InventoryPanel({ characterId, onClose, onChanged }: { characterId: string; onClose: () => void; onChanged: () => void }) {
  const [view, setView] = useState<View | null>(null);
  const [tab, setTab] = useState<Tab>("bag");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirmEat, setConfirmEat] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const res = await fetch(`/api/characters/${characterId}/inventory`);
    if (res.ok) setView(await res.json());
  }, [characterId]);
  useEffect(() => {
    refresh();
  }, [refresh]);

  async function act(path: string, body: unknown) {
    setBusy(true);
    setNotice(null);
    setError(null);
    try {
      const res = await fetch(`/api/characters/${characterId}/${path}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const out = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(out.error ?? "No se pudo.");
      if (out.message) setNotice(out.message);
      await refresh();
      onChanged();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error inesperado.");
    } finally {
      setBusy(false);
    }
  }

  const poneglyphs = view ? (JSON.parse(view.poneglyphsRead || "[]") as string[]).length : 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3" style={{ background: "rgba(0,0,0,0.65)" }} onClick={onClose} data-testid="inventory-panel">
      <div className="panel p-4 w-full max-w-2xl max-h-[92vh] overflow-y-auto flex flex-col gap-3 [&>*]:shrink-0" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between gap-2">
          <h3 className="font-display text-xl text-gold-bright">Inventario</h3>
          <button className="btn-ghost px-3 py-1.5 text-sm" onClick={onClose}>
            Cerrar
          </button>
        </div>
        <div className="flex gap-2 flex-wrap">
          {(
            [
              ["bag", "Mochila"],
              ["gear", "Equipo"],
              ["shop", "Mercader"],
            ] as [Tab, string][]
          ).map(([id, label]) => (
            <button key={id} className={tab === id ? "btn-gold px-3 py-1.5 text-sm" : "btn-ghost px-3 py-1.5 text-sm"} onClick={() => setTab(id)} data-testid={`inv-tab-${id}`}>
              {label}
            </button>
          ))}
        </div>
        {view && (
          <p className="text-xs text-ink-dim">
            Berries: <span className="text-gold-bright" data-testid="inv-berries">฿ {view.berries.toLocaleString("es-ES")}</span> · Mochila {view.slotsUsed}/{view.slots}
          </p>
        )}
        {notice && (
          <p className="text-sm text-gold" data-testid="inv-notice">
            {notice}
          </p>
        )}
        {error && (
          <p className="text-sm text-blood" data-testid="inv-error">
            {error}
          </p>
        )}

        {view && tab === "bag" && (
          <div className="flex flex-col gap-2" data-testid="inv-items">
            {view.fruits.map((f) => (
              <div key={f.inventoryItemId} className="rounded border border-[#9b6fd6]/60 p-2 flex flex-col gap-1" data-testid="inv-fruit">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="text-sm" style={{ color: "#c9a7f5" }} data-testid="inv-fruit-name">{f.name}</span>
                  <span className="text-[11px] text-ink-dim">Fruta del Diablo · {f.type} · {f.rarity}</span>
                </div>
                <p className="text-xs text-ink-dim">{f.description}</p>
                {confirmEat === f.inventoryItemId ? (
                  <div className="rounded bg-black/30 p-2 flex flex-col gap-2">
                    <p className="text-xs text-blood">
                      Si te comes la {f.name} ganarás su poder, pero el mar te rechazará para siempre (no podrás nadar) y no se puede deshacer.
                      {view.hasFruit ? " Ya cargas con otra fruta: comer una segunda te mataría." : ""}
                    </p>
                    <div className="flex gap-2 flex-wrap">
                      <button className="btn-gold px-3 py-1 text-xs" disabled={busy || view.hasFruit} onClick={() => { setConfirmEat(null); act("inventory", { op: "eat", inventoryItemId: f.inventoryItemId }); }} data-testid="inv-eat-confirm">
                        Sí, comerla
                      </button>
                      <button className="btn-ghost px-3 py-1 text-xs" onClick={() => setConfirmEat(null)}>
                        No, guardarla
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex gap-2 flex-wrap">
                    <button className="btn-gold px-3 py-1 text-xs" disabled={busy} onClick={() => setConfirmEat(f.inventoryItemId)} data-testid="inv-eat">
                      Comer
                    </button>
                    <button className="btn-ghost px-3 py-1 text-xs" disabled={busy} onClick={() => act("inventory", { op: "sellFruit", inventoryItemId: f.inventoryItemId })}>
                      Vender (฿ {f.sellValue.toLocaleString("es-ES")})
                    </button>
                  </div>
                )}
              </div>
            ))}
            {view.items.length === 0 && view.fruits.length === 0 && <p className="text-sm text-ink-dim">La mochila está vacía. Explorar con éxito puede dejarte objetos, y el mercader vende lo básico.</p>}
            {view.items.map((it) => (
              <div key={it.id} className="rounded border border-white/10 p-2 flex flex-col gap-1" data-testid={`inv-item-${it.id}`}>
                <div className="flex items-baseline justify-between gap-2">
                  <span className="text-sm text-gold-bright">
                    {it.name} {it.quantity > 1 && <span className="text-ink-dim">× {it.quantity}</span>}
                  </span>
                  <span className="text-[11px] text-ink-dim">{it.kind}</span>
                </div>
                <p className="text-xs text-ink-dim">{it.description}</p>
                <div className="flex gap-2 flex-wrap">
                  {it.usable && (
                    <button className="btn-gold px-3 py-1 text-xs" disabled={busy} onClick={() => act("inventory", { op: "use", itemId: it.id })} data-testid={`inv-use-${it.id}`}>
                      Usar
                    </button>
                  )}
                  <button className="btn-ghost px-3 py-1 text-xs" disabled={busy} onClick={() => act("inventory", { op: "sell", itemId: it.id })}>
                    Vender uno (฿ {it.sellValue.toLocaleString("es-ES")})
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {view && tab === "gear" && (
          <div className="flex flex-col gap-3" data-testid="inv-gear">
            <section>
              <h4 className="font-display text-sm text-ink-dim mb-1">Armas</h4>
              {view.weapons.length === 0 && <p className="text-xs text-ink-dim">Sin armas.</p>}
              {view.weapons.map((w) => (
                <div key={w.id} className="rounded border border-white/10 p-2 mb-1 flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm">{w.name}</p>
                    <p className="text-xs text-ink-dim">
                      {w.kind} · +{w.atkBonus} ATQ
                    </p>
                  </div>
                  {w.equipped ? (
                    <span className="text-xs text-gold shrink-0">Equipada</span>
                  ) : (
                    <button className="btn-ghost px-3 py-1 text-xs shrink-0" disabled={busy} onClick={() => act("equip", { weaponId: w.id })} data-testid={`inv-equip-${w.id}`}>
                      Equipar
                    </button>
                  )}
                </div>
              ))}
            </section>
            <section>
              <h4 className="font-display text-sm text-ink-dim mb-1">Fruta del Diablo</h4>
              {view.devilFruit ? (
                <>
                  <p className="text-sm text-gold-bright">{view.devilFruit.name}</p>
                  <p className="text-xs text-ink-dim">{view.devilFruit.description}</p>
                </>
              ) : (
                <p className="text-xs text-ink-dim">Ninguna.</p>
              )}
            </section>
            <p className="text-xs text-ink-dim">Poneglifos descifrados: {poneglyphs}/4</p>
          </div>
        )}

        {view && tab === "shop" && (
          <div className="flex flex-col gap-2" data-testid="inv-shop">
            <p className="text-xs text-ink-dim">Un mercader de puerto. Los precios suben en islas peligrosas.</p>
            {view.shop.map((s) => (
              <div key={s.id} className="rounded border border-white/10 p-2 flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-sm text-gold-bright">{s.name}</p>
                  <p className="text-xs text-ink-dim">{s.description}</p>
                </div>
                <button className="btn-ghost px-3 py-1 text-xs shrink-0" disabled={busy} onClick={() => act("inventory", { op: "buy", itemId: s.id })} data-testid={`inv-buy-${s.id}`}>
                  ฿ {s.price.toLocaleString("es-ES")}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
