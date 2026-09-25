"use client";

import { Anchor, Apple, Flame, Sword, Users } from "lucide-react";
import StatBar from "@/components/ui/StatBar";
import WantedPoster from "@/components/ui/WantedPoster";
import AttributesCard from "./AttributesCard";
import PortraitEditor from "./PortraitEditor";
import { characterCondition, conditionLabel } from "@/lib/engine/condition";
import { xpToNextLevel } from "@/lib/engine/economy";
import { rankProgress, type FactionKey } from "@/lib/engine/progression";
import { crewNounForFaction } from "@/lib/engine/crew-noun";
import { formatBerries, formatNumber } from "@/lib/ui/format";
import { CONDITION_COLOR } from "./labels";
import type { Character, PartyState } from "./types";

function Heading({ icon: Icon, children }: { icon: typeof Anchor; children: React.ReactNode }) {
  return (
    <h3 className="font-display text-sm text-ink-dim mb-2 flex items-center gap-2">
      <Icon className="w-4 h-4 text-gold" />
      {children}
    </h3>
  );
}

export default function CharacterSheet({
  character,
  party,
  busy,
  onOpenCrew,
  onRejoin,
  onChanged,
}: {
  character: Character;
  party: PartyState | null;
  busy: boolean;
  onOpenCrew: () => void;
  onRejoin: () => void;
  onChanged: () => void;
}) {
  const faction = character.faction as FactionKey;
  const condition = characterCondition(character.hp, character.maxHp);
  const r = rankProgress(faction, character.bounty, character.notoriety);
  const poneglyphs = (JSON.parse(character.poneglyphsRead || "[]") as string[]).length;
  const xpMax = xpToNextLevel(character.level);

  return (
    <div className="flex flex-col gap-4 stagger">
      <section className="panel p-4 flex flex-col gap-3">
        <div className="flex justify-between items-center">
          <span className="text-xs text-ink-dim">Estado</span>
          <span className={`text-sm font-display ${CONDITION_COLOR[condition]}`}>{conditionLabel(condition)}</span>
        </div>
        <StatBar label="Vida" value={character.hp} max={character.maxHp} color="var(--blood)" />
        <div data-testid="xp-bar">
          <StatBar label={`Experiencia (nivel ${character.level} → ${character.level + 1})`} value={character.experience} max={xpMax} color="var(--gold)" />
          <p className="text-[11px] text-ink-dim mt-0.5">
            Faltan {Math.max(0, xpMax - character.experience)} XP para el nivel {character.level + 1}. Se gana explorando y venciendo enemigos; entrenar no da nivel, sube el Haki.
          </p>
        </div>
        <div>
          <StatBar label={`Estamina (${character.fatigue})`} value={character.stamina} max={character.maxStamina} color="var(--stamina)" />
          {character.stamina < character.maxStamina * 0.25 && <p className="text-xs text-orange-400 mt-1">Tu cuerpo flaquea: golpeas y te defiendes peor. Descansa para recuperar el aliento.</p>}
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-ink-dim">Berries</span>
          <span className="text-gold-bright font-display tabular-nums">{formatBerries(character.berries)}</span>
        </div>
        <div data-testid="rank-progress">
          <div className="flex justify-between text-xs text-ink-dim mb-0.5 gap-2">
            <span>
              Rango: <span className="text-gold-bright">{r.title}</span>
            </span>
            <span className="text-right">{r.nextTitle ? `→ ${r.nextTitle}` : "cima"}</span>
          </div>
          <StatBar value={r.fraction * 100} max={100} color="var(--gold)" hideNumbers size="sm" />
          <p className="text-[11px] text-ink-dim mt-0.5">
            {r.target !== null
              ? `${r.metric}: ${formatNumber(r.value)} / ${formatNumber(r.target)} · faltan ${formatNumber(r.remaining ?? 0)} para «${r.nextTitle}». El ascenso es automático y sale en las noticias.`
              : `${r.metric}: ${formatNumber(r.value)} · has llegado al escalón más alto.`}
          </p>
        </div>
        {character.faction === "PIRATE" ? (
          <div className="flex justify-between text-sm">
            <span className="text-ink-dim">Recompensa</span>
            <span className="text-gold-bright tabular-nums">{formatBerries(character.bounty)}</span>
          </div>
        ) : (
          <div className="flex justify-between text-sm">
            <span className="text-ink-dim">Mérito</span>
            <span className="text-gold-bright tabular-nums">{formatNumber(character.notoriety)}</span>
          </div>
        )}
        {character.poneglyphHeat > 0 && (
          <div className="pt-2 border-t border-line">
            <div className="flex justify-between text-xs mb-1">
              <span className="text-blood flex items-center gap-1">
                <Flame className="w-3.5 h-3.5" />
                Perseguido
              </span>
              <span className="text-blood">{character.poneglyphHeat}/150</span>
            </div>
            <StatBar value={character.poneglyphHeat} max={150} color="var(--blood)" hideNumbers size="sm" />
            <p className="text-xs text-ink-dim mt-1">Lo que sabes te hace un objetivo. Explorar puede traer cazadores.</p>
          </div>
        )}
      </section>

      {(() => {
        const photoUrl = character.portraitUpdatedAt ? `/api/characters/${character.id}/portrait?v=${new Date(character.portraitUpdatedAt).getTime()}` : null;
        return (
          <div className="flex flex-col items-center gap-2">
            {character.faction === "PIRATE" ? (
              <WantedPoster name={character.name} bounty={character.bounty} deceased={character.status === "DEAD"} photoUrl={photoUrl} />
            ) : (
              photoUrl && <img src={photoUrl} alt={character.name} className="w-28 h-28 rounded-full object-cover border-2 border-gold/50" data-testid="poster-photo" />
            )}
            {character.status !== "DEAD" && <PortraitEditor characterId={character.id} hasPhoto={!!photoUrl} onChanged={onChanged} />}
          </div>
        );
      })()}

      <section className="panel p-4">
        <h3 className="font-display text-sm text-ink-dim mb-2">Atributos</h3>
        <AttributesCard
          characterId={character.id}
          level={character.level}
          points={character.attributePoints ?? 0}
          values={{ strength: character.strength, agility: character.agility, durability: character.durability, willpower: character.willpower, intellect: character.intellect }}
          onChanged={onChanged}
        />
        <div className="mt-3 pt-3 border-t border-line flex flex-col gap-2">
          <StatBar label="Haki de Observación" value={character.observationHaki} max={100} color="var(--gold)" />
          <StatBar label="Haki de Armadura" value={character.armamentHaki} max={100} color="var(--gold)" />
          {character.conquerorsHaki && <p className="text-xs text-gold-bright mt-1">✦ Portador del Haki del Rey Supremo</p>}
        </div>
      </section>

      <section className="panel p-4">
        <Heading icon={Sword}>Equipo</Heading>
        {character.devilFruit ? (
          <div className="mb-3 rounded-md border border-fruit/40 bg-fruit/5 p-2.5">
            <p className="text-sm text-gold-bright flex items-center gap-1.5">
              <Apple className="w-4 h-4 text-fruit" />
              {character.devilFruit.name}
            </p>
            <p className="text-xs text-ink-dim">{character.devilFruit.description}</p>
            <p className="text-xs text-blood mt-1">✦ No puede nadar — el mar es su debilidad de por vida.</p>
            <div className="mt-2">
              <StatBar label={`Dominio: ${character.fruitPhase ?? ""}`} value={character.fruitMastery} max={100} color="var(--fruit)" />
              <p className="text-[11px] text-ink-dim mt-1">
                {character.fruitAwakened
                  ? "Tu fruta ha despertado: su poder es total."
                  : character.fruitMastery >= 100
                  ? "Dominio máximo. Solo un combate al límite (un jefe, o ganar al borde de la muerte) puede provocar el Despertar."
                  : "Úsala en combate (descríbelo) o entrena con ella para dominarla y desbloquear sus fases."}
              </p>
            </div>
          </div>
        ) : (
          <p className="text-xs text-ink-dim mb-3">Sin fruta del diablo.</p>
        )}
        {character.equippedWeapon ? (
          <div>
            <p className="text-sm">{character.equippedWeapon.name}</p>
            <p className="text-xs text-ink-dim">
              {character.equippedWeapon.kind} · +{character.equippedWeapon.atkBonus} ATQ
            </p>
          </div>
        ) : (
          <p className="text-xs text-ink-dim">Sin arma equipada.</p>
        )}
        {poneglyphs > 0 && (
          <div className="mt-2 pt-2 border-t border-line">
            <p className="text-xs text-gold mb-1">Poneglifos descifrados: {poneglyphs}/4</p>
            <div className="flex gap-1" aria-hidden>
              {[0, 1, 2, 3].map((i) => (
                <span key={i} className={`h-2 flex-1 rounded-sm ${i < poneglyphs ? "bg-[#c0392b]" : "bg-black/30"}`} />
              ))}
            </div>
          </div>
        )}
      </section>

      <section className="panel p-4" data-testid="crew-summary">
        <div className="flex items-center justify-between mb-2">
          <h3 className="font-display text-sm text-ink-dim flex items-center gap-2">
            <Users className="w-4 h-4 text-gold" />
            {crewNounForFaction(faction)}
          </h3>
          <button className="btn-gold px-3 py-1 text-xs inline-flex items-center gap-1.5" onClick={onOpenCrew} data-testid="crew-open">
            Abrir panel
            {character.pendingCrewInvites > 0 && <span className="badge-count">{character.pendingCrewInvites}</span>}
          </button>
        </div>
        {character.crew ? (
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-2">
              {character.crew.hasEmblem && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={`/api/crews/${character.crew.id}/emblem?v=${character.crew.emblemVersion}`} alt="" className="w-8 h-8 rounded border border-gold/40 object-cover" />
              )}
              <p className="text-sm text-gold-bright">{character.crew.name}</p>
            </div>
            <p className="text-xs text-ink-dim">
              {character.crew.members.length} miembro{character.crew.members.length === 1 ? "" : "s"} · Barco: {character.crew.shipName}
            </p>
            {!party && character.isSeparatedFromParty && character.crew.members.some((m) => m.id !== character.id && m.status === "ALIVE" && m.currentIslandId === character.currentIsland.id) && (
              <button className="btn-gold px-3 py-1.5 text-xs mt-1" disabled={busy} onClick={onRejoin}>
                Unirme al grupo
              </button>
            )}
          </div>
        ) : (
          <p className="text-xs text-ink-dim">{character.faction === "BOUNTY_HUNTER" ? "Los cazarrecompensas trabajan en solitario." : "Sin tripulación. Ábrela para fundar una, aceptar invitaciones o unirte con un código."}</p>
        )}
        {character.companions.length > 0 && (
          <div className="mt-2 pt-2 border-t border-line flex flex-col gap-1" data-testid="companion-summary">
            <p className="text-xs text-ink-dim">Nakamas NPC (siempre a tu nivel):</p>
            {character.companions.map((c) => (
              <div key={c.id} className="text-xs flex justify-between gap-2">
                <span className={c.status !== "ALIVE" ? "text-blood line-through" : ""}>
                  {c.name} · {c.role} · Nv. {c.level}
                </span>
                <span className={c.status === "ALIVE" ? "text-jade" : "text-blood"}>{c.status === "ALIVE" ? "en pie" : c.status === "IMPRISONED" ? "preso" : "caído"}</span>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
