"use client";

import Modal from "@/components/ui/Modal";
import { useCallback, useEffect, useState } from "react";

export interface PanelMember {
  id: string;
  name: string;
  level: number;
  faction: string;
  status: string;
  currentIslandId: string;
  partyId: string | null;
  isSeparatedFromParty: boolean;
  hp: number;
  maxHp: number;
  stamina: number;
  maxStamina: number;
  armamentHaki: number;
  observationHaki: number;
  conquerorsHaki: boolean;
  devilFruit: string | null;
  weapon: string | null;
  islandName: string;
}

export interface PanelCompanion {
  id: string;
  name: string;
  role: string;
  status: string;
  level: number;
  hp: number;
  maxHp: number;
  loyalty: number;
  rank: string;
  atk: number;
  def: number;
  spd: number;
  abilities: string[];
  nextAbilityAtLevel: number | null;
  personality: string | null;
  belongings: string[];
  stay?: boolean;
  errand?: { label: string; msLeft: number } | null;
}

interface EmpireInfo {
  domains: { islandId: string; islandName: string; garrison: number; isOwner: boolean }[];
  errands: { kind: "patrol" | "tribute" | "scout"; label: string; brief: string; durationMs: number }[];
}

export interface PanelCrew {
  id: string;
  name: string;
  flagDesc: string;
  shipName: string;
  captainId: string;
  inviteCode: string;
  hasEmblem: boolean;
  emblemVersion: number;
  members: PanelMember[];
}

interface Candidate {
  id: string;
  name: string;
  level: number;
  islandName: string;
  sameIsland: boolean;
  alreadyInvited: boolean;
}
interface Received {
  id: string;
  crewName: string;
  fromName: string;
  expiresInMinutes: number;
}
interface Sent {
  id: string;
  toName: string;
  fromName: string;
}

function Bar({ label, value, max, color }: { label: string; value: number; max: number; color: string }) {
  const pct = Math.max(0, Math.min(100, (value / Math.max(1, max)) * 100));
  return (
    <div>
      <div className="flex justify-between text-[11px] text-ink-dim">
        <span>{label}</span>
        <span>
          {Math.round(value)}/{max}
        </span>
      </div>
      <div className="h-1.5 rounded bg-black/30 overflow-hidden">
        <div className="h-full" style={{ width: `${pct}%`, background: color }} />
      </div>
    </div>
  );
}

const hakiText = (m: PanelMember) => {
  const parts: string[] = [];
  if (m.armamentHaki > 0) parts.push(`Armadura ${m.armamentHaki}`);
  if (m.observationHaki > 0) parts.push(`Observación ${m.observationHaki}`);
  if (m.conquerorsHaki) parts.push("Rey");
  return parts.length ? parts.join(" · ") : "sin Haki";
};

/** Shrinks any picked image to a 256px square (cover) WebP/JPEG in the browser, so uploads stay tiny and valid. */
async function shrinkToDataUrl(file: File): Promise<string> {
  const bitmap = await createImageBitmap(file);
  const size = 256;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("no canvas");
  const scale = Math.max(size / bitmap.width, size / bitmap.height);
  const w = bitmap.width * scale;
  const h = bitmap.height * scale;
  ctx.drawImage(bitmap, (size - w) / 2, (size - h) / 2, w, h);
  const webp = canvas.toDataURL("image/webp", 0.85);
  return webp.startsWith("data:image/webp") ? webp : canvas.toDataURL("image/jpeg", 0.85);
}

/**
 * Own panel for everything crew: members with their live status (so you can see how your
 * nakamas are doing in multiplayer), NPC nakamas with stats and abilities, and the full
 * invite / join flow (invite by list or name, answer received invitations, join by code).
 */
export default function CrewPanel({
  characterId,
  characterName,
  characterLevel,
  isCaptain,
  faction,
  crew,
  companions,
  factionNoun,
  onClose,
  onChanged,
}: {
  characterId: string;
  characterName: string;
  characterLevel: number;
  isCaptain: boolean;
  faction: string;
  crew: PanelCrew | null;
  companions: PanelCompanion[];
  factionNoun: string;
  onClose: () => void;
  onChanged: () => void;
}) {
  const [tab, setTab] = useState<"crew" | "nakamas" | "invite">("crew");
  const [received, setReceived] = useState<Received[]>([]);
  const [sent, setSent] = useState<Sent[]>([]);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [search, setSearch] = useState("");
  const [inviteName, setInviteName] = useState("");
  const [joinCode, setJoinCode] = useState("");
  const [newName, setNewName] = useState("");
  const [newFlag, setNewFlag] = useState("");
  const [newShip, setNewShip] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [confirmLeave, setConfirmLeave] = useState(false);
  const [empire, setEmpire] = useState<EmpireInfo | null>(null);
  const [missionFor, setMissionFor] = useState<string | null>(null);

  const loadEmpire = useCallback(async () => {
    const res = await fetch(`/api/characters/${characterId}/empire`);
    if (res.ok) setEmpire(await res.json());
  }, [characterId]);

  async function sendMission(companionId: string, kind: string, islandId?: string) {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const res = await fetch(`/api/characters/${characterId}/empire`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ op: "errand", companionId, kind, islandId }) });
      const r = await res.json().catch(() => ({}));
      if (!res.ok) setError(r.error ?? "No se pudo dar la orden.");
      else {
        setNotice((r.log as string[]).join(" "));
        setMissionFor(null);
        onChanged();
      }
    } finally {
      setBusy(false);
    }
  }

  const reload = useCallback(
    async (q?: string) => {
      const res = await fetch(`/api/characters/${characterId}/crew${q ? `?name=${encodeURIComponent(q)}` : ""}`);
      if (!res.ok) return;
      const d = await res.json();
      setReceived(d.received);
      setSent(d.sent);
      setCandidates(d.candidates);
    },
    [characterId]
  );

  useEffect(() => {
    reload();
  }, [reload]);

  async function op(body: Record<string, unknown>, after?: () => void) {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const res = await fetch(`/api/characters/${characterId}/crew`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const r = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(r.error ?? "No se pudo completar.");
        return;
      }
      if (r.message) setNotice(r.message);
      after?.();
      onChanged();
      await reload(search || undefined);
    } finally {
      setBusy(false);
    }
  }

  const tabBtn = (id: typeof tab, label: string, badge?: number) => (
    <button key={id} className={`px-3 py-1.5 text-sm rounded ${tab === id ? "btn-gold" : "btn-ghost"}`} onClick={() => setTab(id)} data-testid={`crew-tab-${id}`}>
      {label}
      {badge ? <span className="ml-1.5 text-[11px] px-1.5 rounded bg-blood text-white">{badge}</span> : null}
    </button>
  );

  const aliveNpcs = companions.filter((c) => c.status === "ALIVE").length;
  const isSolo = faction === "BOUNTY_HUNTER";

  async function pickEmblem(file: File | undefined) {
    if (!file) return;
    setBusy(true);
    setError(null);
    try {
      const dataUrl = await shrinkToDataUrl(file);
      await op({ op: "set_emblem", dataUrl });
    } catch {
      setError("No pude leer esa imagen. Prueba con un PNG, JPG o WebP.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal onClose={onClose} testId="crew-panel" size="xl" label="Tripulación" className="p-4 gap-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-3">
            {crew?.hasEmblem && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={`/api/crews/${crew.id}/emblem?v=${crew.emblemVersion}`} alt={`Bandera de ${crew.name}`} className="w-14 h-14 rounded border border-gold/40 object-cover" data-testid="crew-emblem" />
            )}
            <div>
            <h3 className="font-display text-xl text-gold-bright">{crew ? crew.name : factionNoun}</h3>
            {crew && (
              <p className="text-xs text-ink-dim">
                {crew.flagDesc} · Barco: {crew.shipName}
              </p>
            )}
            </div>
          </div>
          <button className="btn-ghost px-3 py-1.5 text-xs" onClick={onClose}>
            Cerrar
          </button>
        </div>

        {isSolo && (
          <div className="rounded border border-gold/40 p-4" data-testid="solo-notice">
            <p className="text-sm text-gold-bright">Los cazarrecompensas trabajan siempre en solitario.</p>
            <p className="text-xs text-ink-dim mt-1">No formas tripulación ni te unes a ninguna: tu gremio es tu reputación. Sí puedes reclutar nakamas NPC con tu texto ({aliveNpcs}/3 ahora mismo) y pelear junto a otros jugadores cuando la ocasión lo pida.</p>
          </div>
        )}

        <div className={`flex gap-2 flex-wrap ${isSolo ? "hidden" : ""}`}>
          {tabBtn("crew", "Miembros")}
          {tabBtn("nakamas", `Nakamas NPC (${aliveNpcs}/3)`)}
          {tabBtn("invite", "Invitar y unirse", received.length)}
        </div>

        {notice && (
          <p className="text-sm text-gold" data-testid="crew-notice">
            {notice}
          </p>
        )}
        {error && (
          <p className="text-sm text-blood" data-testid="crew-error">
            {error}
          </p>
        )}

        {!isSolo && tab === "crew" && (
          <div className="flex flex-col gap-3">
            {!crew && <p className="text-sm text-ink-dim">Aún no tienes {factionNoun.toLowerCase()}. Funda una o únete a otra desde la pestaña «Invitar y unirse».</p>}
            {crew && (
              <>
                <div className="grid gap-2 md:grid-cols-2" data-testid="crew-members">
                  {crew.members.map((m) => {
                    const me = m.id === characterId;
                    const together = m.partyId && !m.isSeparatedFromParty;
                    return (
                      <div key={m.id} className="rounded border border-white/10 p-3 flex flex-col gap-1.5" data-testid="crew-member">
                        <div className="flex justify-between items-baseline">
                          <span className={`text-sm font-display ${m.status !== "ALIVE" ? "text-blood line-through" : "text-gold-bright"}`}>
                            {m.name} {m.id === crew.captainId && <span className="text-gold text-xs">★ capitán</span>} {me && <span className="text-ink-dim text-xs">(tú)</span>}
                          </span>
                          <span className="text-xs text-ink-dim">Nv. {m.level}</span>
                        </div>
                        <Bar label="Vida" value={m.hp} max={m.maxHp} color="var(--blood)" />
                        <Bar label="Aguante" value={m.stamina} max={m.maxStamina} color="#4a90c2" />
                        <p className="text-[11px] text-ink-dim">
                          {hakiText(m)}
                          {m.devilFruit ? ` · ${m.devilFruit}` : ""}
                        </p>
                        <p className="text-[11px] text-ink-dim">
                          Arma: {m.weapon ?? "ninguna"} · {m.islandName} {together ? "· contigo ahora" : ""}
                        </p>
                        {isCaptain && !me && (
                          <button className="btn-ghost px-2 py-1 text-[11px] self-start" disabled={busy} onClick={() => op({ op: "kick", targetId: m.id })}>
                            Expulsar
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
                <div className="rounded border border-white/10 p-3 flex flex-col gap-1.5">
                  <p className="text-xs text-ink-dim">Código de invitación (compártelo con quien quieras que se una):</p>
                  <div className="flex gap-2 items-center">
                    <span className="text-xs font-mono text-gold select-all break-all flex-1" data-testid="crew-code">
                      {crew.inviteCode}
                    </span>
                    <button
                      className="btn-ghost px-2 py-1 text-xs"
                      onClick={() => {
                        navigator.clipboard?.writeText(crew.inviteCode).then(() => {
                          setCopied(true);
                          setTimeout(() => setCopied(false), 1500);
                        });
                      }}
                    >
                      {copied ? "¡Copiado!" : "Copiar"}
                    </button>
                  </div>
                </div>
                {isCaptain && (
                  <div className="rounded border border-white/10 p-3 flex flex-col gap-2" data-testid="emblem-editor">
                    <p className="text-xs text-ink-dim">Bandera de tu {factionNoun.toLowerCase()} (imagen cuadrada; se ajusta sola a 256 px):</p>
                    <div className="flex gap-2 items-center flex-wrap">
                      <label className="btn-ghost px-3 py-1.5 text-xs cursor-pointer">
                        Subir imagen
                        <input type="file" accept="image/png,image/jpeg,image/webp,image/gif" className="hidden" data-testid="emblem-file" onChange={(e) => pickEmblem(e.target.files?.[0])} />
                      </label>
                      {crew.hasEmblem && (
                        <button className="btn-ghost px-3 py-1.5 text-xs" disabled={busy} onClick={() => op({ op: "set_emblem", dataUrl: null })}>
                          Quitar bandera
                        </button>
                      )}
                    </div>
                  </div>
                )}
                {confirmLeave ? (
                  <div className="flex gap-2 items-center">
                    <span className="text-sm text-blood">¿Seguro que quieres abandonar {crew.name}?</span>
                    <button className="btn-gold px-3 py-1.5 text-xs" disabled={busy} onClick={() => op({ op: "leave" }, () => setConfirmLeave(false))}>
                      Sí, abandonar
                    </button>
                    <button className="btn-ghost px-3 py-1.5 text-xs" onClick={() => setConfirmLeave(false)}>
                      No
                    </button>
                  </div>
                ) : (
                  <button className="btn-ghost px-3 py-1.5 text-xs self-start" onClick={() => setConfirmLeave(true)}>
                    Abandonar
                  </button>
                )}
              </>
            )}
          </div>
        )}

        {(isSolo || tab === "nakamas") && (
          <div className="flex flex-col gap-3" data-testid="nakamas">
            <p className="text-xs text-ink-dim">
              Tus nakamas NPC suben de nivel contigo (siempre a nivel {characterLevel}): nunca se quedan atrás. Para reclutar a alguien de la escena, invítalo con tu texto: «Jorge, únete a mi tripulación». Que acepte lo decide el juez según lo convincente que seas.
            </p>
            {companions.length === 0 && <p className="text-sm text-ink-dim">Todavía no tienes nakamas NPC.</p>}
            <div className="grid gap-2 md:grid-cols-2">
              {companions.map((c) => (
                <div key={c.id} className="rounded border border-white/10 p-3 flex flex-col gap-1.5" data-testid="nakama-card">
                  <div className="flex justify-between items-baseline">
                    <span className={`text-sm font-display ${c.status !== "ALIVE" ? "text-blood line-through" : "text-gold-bright"}`}>{c.name}</span>
                    <span className="text-xs text-ink-dim">
                      {c.role} · Nv. {c.level}
                    </span>
                  </div>
                  <Bar label={`Lealtad (${c.rank})`} value={c.loyalty} max={100} color="var(--gold)" />
                  <p className="text-[11px] text-ink-dim">
                    Ataque {c.atk} · Defensa {c.def} · Velocidad {c.spd}
                  </p>
                  <p className="text-[11px] text-gold">Habilidades: {c.abilities.join(" · ")}</p>
                  <p className="text-[11px] text-ink-dim" data-testid="companion-belongings">Lleva: {c.belongings.join(", ")}</p>
                  {c.nextAbilityAtLevel && <p className="text-[11px] text-ink-dim">Nueva habilidad al nivel {c.nextAbilityAtLevel}.</p>}
                  {c.status === "ALIVE" && c.errand && (
                    <p className="text-[11px] text-gold" data-testid="nakama-away">
                      En misión: {c.errand.label} · vuelve en {Math.max(1, Math.round(c.errand.msLeft / 60000))} min
                    </p>
                  )}
                  {c.status === "ALIVE" && !c.errand && (
                    <p className="text-[11px]" data-testid="nakama-presence">
                      {c.stay ? <span className="text-ink-dim">Se queda en el barco</span> : <span className="text-emerald-300">Te acompaña</span>}
                    </p>
                  )}
                  {c.status === "ALIVE" && (
                    <div className="flex flex-wrap gap-1.5">
                      {!c.errand && (
                        <button className="btn-ghost px-2 py-1 text-[11px]" disabled={busy} onClick={() => op({ op: "set_companion_stay", companionId: c.id, stay: !c.stay })} data-testid="nakama-toggle-stay">
                          {c.stay ? "Que me acompañe" : "Que se quede en el barco"}
                        </button>
                      )}
                      {!c.errand && !c.stay && companions.filter((x) => x.status === "ALIVE").length > 1 && (
                        <button className="btn-ghost px-2 py-1 text-[11px]" disabled={busy} onClick={() => op({ op: "set_companion_focus", companionId: c.id })} data-testid="nakama-only-this">
                          Solo este me acompaña
                        </button>
                      )}
                      {!c.errand && (
                        <button
                          className="btn-ghost px-2 py-1 text-[11px]"
                          disabled={busy}
                          onClick={() => {
                            setMissionFor(missionFor === c.id ? null : c.id);
                            loadEmpire();
                          }}
                          data-testid="nakama-mission-open"
                        >
                          Encargarle una misión
                        </button>
                      )}
                      <button className="btn-ghost px-2 py-1 text-[11px]" disabled={busy} onClick={() => op({ op: "dismiss_companion", companionId: c.id })}>
                        Despedir
                      </button>
                    </div>
                  )}
                  {missionFor === c.id && !c.errand && (
                    <div className="flex flex-col gap-1.5 rounded border border-white/10 p-2" data-testid="nakama-missions">
                      {(empire?.errands ?? []).map((e) => {
                        const domains = (empire?.domains ?? []).filter((d) => d.isOwner && d.garrison < 100);
                        if (e.kind === "patrol") {
                          return (
                            <div key={e.kind} className="flex flex-col gap-1">
                              <span className="text-[11px] text-ink-dim">{e.label}: {e.brief}</span>
                              {domains.length === 0 ? <span className="text-[11px] text-ink-dim">Necesitas sostener un dominio con la guarnición por debajo de 100.</span> : domains.map((d) => (
                                <button key={d.islandId} className="btn-gold px-2 py-1 text-[11px] self-start" disabled={busy} onClick={() => sendMission(c.id, "patrol", d.islandId)}>
                                  Patrullar {d.islandName}
                                </button>
                              ))}
                            </div>
                          );
                        }
                        return (
                          <button key={e.kind} className="btn-gold px-2 py-1 text-[11px] self-start text-left" disabled={busy} onClick={() => sendMission(c.id, e.kind)} data-testid={`nakama-mission-${e.kind}`} title={e.brief}>
                            {e.label} ({Math.round(e.durationMs / 60000)} min): {e.brief}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {!isSolo && tab === "invite" && (
          <div className="flex flex-col gap-4">
            <section data-testid="invites-received">
              <h4 className="font-display text-sm text-ink-dim mb-1">Invitaciones recibidas</h4>
              {received.length === 0 && <p className="text-xs text-ink-dim">Ninguna por ahora.</p>}
              {received.map((r) => (
                <div key={r.id} className="flex items-center justify-between gap-2 rounded border border-gold/40 px-3 py-2 mb-1">
                  <p className="text-sm">
                    <span className="text-gold-bright">{r.fromName}</span> te invita a <span className="text-gold-bright">{r.crewName}</span>
                    <span className="text-[11px] text-ink-dim"> · caduca en {Math.round(r.expiresInMinutes / 60)} h</span>
                  </p>
                  <div className="flex gap-1">
                    <button className="btn-gold px-2 py-1 text-xs" disabled={busy} onClick={() => op({ op: "respond", inviteId: r.id, accept: true })} data-testid="invite-accept">
                      Aceptar
                    </button>
                    <button className="btn-ghost px-2 py-1 text-xs" disabled={busy} onClick={() => op({ op: "respond", inviteId: r.id, accept: false })}>
                      Rechazar
                    </button>
                  </div>
                </div>
              ))}
            </section>

            {crew ? (
              <section data-testid="invite-section">
                <h4 className="font-display text-sm text-ink-dim mb-1">Invitar a un jugador</h4>
                <div className="flex gap-2 mb-2">
                  <input className="input flex-1" placeholder="Buscar por nombre…" value={search} onChange={(e) => setSearch(e.target.value)} onKeyDown={(e) => e.key === "Enter" && reload(search.trim() || undefined)} />
                  <button className="btn-ghost px-3 py-1.5 text-xs" onClick={() => reload(search.trim() || undefined)}>
                    Buscar
                  </button>
                </div>
                <p className="text-[11px] text-ink-dim mb-1">{search.trim() ? "Resultados" : "Jugadores de tu facción, sin tripulación, en tu isla"}:</p>
                {candidates.length === 0 && <p className="text-xs text-ink-dim">Nadie disponible con ese criterio.</p>}
                <div className="flex flex-col gap-1" data-testid="candidates">
                  {candidates.map((c) => (
                    <div key={c.id} className="flex items-center justify-between rounded border border-white/10 px-3 py-1.5">
                      <span className="text-sm">
                        {c.name} <span className="text-[11px] text-ink-dim">Nv. {c.level} · {c.islandName}</span>
                      </span>
                      <button className="btn-gold px-2 py-1 text-xs" disabled={busy || c.alreadyInvited} onClick={() => op({ op: "invite", targetCharacterId: c.id })} data-testid="candidate-invite">
                        {c.alreadyInvited ? "Invitado" : "Invitar"}
                      </button>
                    </div>
                  ))}
                </div>
                <div className="flex gap-2 mt-2">
                  <input className="input flex-1" placeholder="O escribe el nombre exacto de cualquier jugador" value={inviteName} onChange={(e) => setInviteName(e.target.value)} data-testid="invite-name" />
                  <button className="btn-ghost px-3 py-1.5 text-xs" disabled={busy || !inviteName.trim()} onClick={() => op({ op: "invite", targetName: inviteName }, () => setInviteName(""))} data-testid="invite-by-name">
                    Invitar
                  </button>
                </div>
                {sent.length > 0 && (
                  <div className="mt-3">
                    <h4 className="font-display text-sm text-ink-dim mb-1">Invitaciones enviadas (pendientes)</h4>
                    {sent.map((s) => (
                      <div key={s.id} className="flex items-center justify-between text-sm rounded border border-white/10 px-3 py-1.5 mb-1">
                        <span>
                          {s.toName} <span className="text-[11px] text-ink-dim">(la envió {s.fromName})</span>
                        </span>
                        <button className="btn-ghost px-2 py-1 text-xs" disabled={busy} onClick={() => op({ op: "cancel_invite", inviteId: s.id })}>
                          Cancelar
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </section>
            ) : (
              <section className="flex flex-col gap-4">
                <div>
                  <h4 className="font-display text-sm text-ink-dim mb-1">Fundar {factionNoun.toLowerCase()}</h4>
                  <input className="input w-full mb-1.5" placeholder="Nombre" value={newName} onChange={(e) => setNewName(e.target.value)} data-testid="new-crew-name" />
                  <input className="input w-full mb-1.5" placeholder="Emblema / descripción" value={newFlag} onChange={(e) => setNewFlag(e.target.value)} />
                  <input className="input w-full mb-2" placeholder="Nombre del barco (opcional)" value={newShip} onChange={(e) => setNewShip(e.target.value)} />
                  <button className="btn-gold px-3 py-1.5 text-xs" disabled={busy || newName.trim().length < 2} onClick={() => op({ op: "create", name: newName, flagDesc: newFlag, shipName: newShip })} data-testid="new-crew-go">
                    Fundar
                  </button>
                </div>
              </section>
            )}

            {!crew && (
              <section>
                <h4 className="font-display text-sm text-ink-dim mb-1">Unirse con un código</h4>
                <div className="flex gap-2">
                  <input className="input flex-1" placeholder="Código de invitación" value={joinCode} onChange={(e) => setJoinCode(e.target.value)} data-testid="join-code" />
                  <button className="btn-ghost px-3 py-1.5 text-xs" disabled={busy || joinCode.trim().length < 2} onClick={() => op({ op: "join", inviteCode: joinCode })} data-testid="join-go">
                    Unirse
                  </button>
                </div>
              </section>
            )}
          </div>
        )}
        <p className="text-[11px] text-ink-dim">Jugando como {characterName}.{isCaptain ? " Eres el capitán: puedes expulsar miembros." : ""}</p>
    </Modal>
  );
}
