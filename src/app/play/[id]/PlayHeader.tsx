"use client";

import Link from "next/link";
import type { ComponentType, ReactNode } from "react";
import { Backpack, BookOpen, Compass, Crown, Flag, Map as MapIcon, MessageCircleQuestion, Newspaper, Radio, ShieldAlert, Trophy, UserRound, Users, Zap } from "lucide-react";
import StatBar from "@/components/ui/StatBar";
import { factionTitle, type FactionKey } from "@/lib/engine/progression";
import { crewNounForFaction } from "@/lib/engine/crew-noun";
import { FACTION_ACCENT, FACTION_LABEL } from "./labels";
import type { StateResponse } from "./types";

export type PanelKey = "crew" | "coliseum" | "empire" | "denden" | "voyage" | "styles" | "inventory" | "ooc" | "guide" | "power";

interface NavItem {
  key: string;
  label: string;
  icon: ComponentType<{ className?: string }>;
  testId?: string;
  onClick?: () => void;
  href?: string;
  badge?: number;
  highlight?: boolean;
}

function NavButton({ item }: { item: NavItem }) {
  const Icon = item.icon;
  const cls = `${item.highlight ? "btn-gold" : "btn-ghost"} shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 text-sm whitespace-nowrap`;
  const inner: ReactNode = (
    <>
      <Icon className="w-4 h-4 opacity-80" />
      {item.label}
      {!!item.badge && item.badge > 0 && <span className="badge-count">{item.badge}</span>}
    </>
  );
  return item.href ? (
    <Link href={item.href} className={cls} data-testid={item.testId}>
      {inner}
    </Link>
  ) : (
    <button className={cls} onClick={item.onClick} data-testid={item.testId}>
      {inner}
    </button>
  );
}

// Sticky header: identity + live vitals (so a phone player never scrolls away from their life bar mid-fight) and
// one strip with every tool. On phones the strip scrolls sideways instead of wrapping into half a screen.
export default function PlayHeader({ data, onOpen }: { data: StateResponse; onOpen: (p: PanelKey) => void }) {
  const { character, coliseum, territory } = data;
  const isDead = character.status === "DEAD";
  const isImprisoned = character.status === "IMPRISONED";
  const faction = character.faction as FactionKey;

  const items: NavItem[] = [
    { key: "crew", label: crewNounForFaction(faction), icon: Users, testId: "crew-open-header", onClick: () => onOpen("crew"), badge: character.pendingCrewInvites },
  ];
  if (coliseum || character.currentIsland.name === "Dressrosa")
    items.push({ key: "coliseum", label: "Coliseo", icon: Trophy, testId: "coliseum-open", onClick: () => onOpen("coliseum"), highlight: !!(coliseum && coliseum.onDressrosa && coliseum.status === "ANNOUNCED" && !coliseum.registered) });
  if (character.companions.length > 0 || territory?.isOwner) items.push({ key: "empire", label: "Imperio", icon: Crown, testId: "empire-open", onClick: () => onOpen("empire") });
  if (!isDead) items.push({ key: "power", label: "Poder", icon: Flag, testId: "power-open", onClick: () => onOpen("power") });
  if (!isDead && !isImprisoned) items.push({ key: "denden", label: "Den Den Mushi", icon: Radio, testId: "denden-open", onClick: () => onOpen("denden") });
  items.push(
    { key: "voyage", label: "Rumbo", icon: Compass, testId: "voyage-open", onClick: () => onOpen("voyage") },
    { key: "styles", label: "Estilos", icon: Zap, testId: "styles-open", onClick: () => onOpen("styles") },
    { key: "inventory", label: "Inventario", icon: Backpack, testId: "inventory-open", onClick: () => onOpen("inventory"), badge: character.attributePoints ?? 0 },
    { key: "ooc", label: "Fuera de rol", icon: MessageCircleQuestion, testId: "ooc-open", onClick: () => onOpen("ooc") },
    { key: "guide", label: "Mapa y Guía", icon: MapIcon, onClick: () => onOpen("guide") }
  );
  if (data.admin) items.push({ key: "admin", label: "Administración", icon: ShieldAlert, href: "/admin", testId: "admin-header-link", badge: data.admin.pending, highlight: data.admin.pending > 0 });
  items.push(
    { key: "codex", label: "Códice", icon: BookOpen, href: "/codex" },
    { key: "news", label: "Noticias", icon: Newspaper, href: "/news" },
    { key: "home", label: "Mis personajes", icon: UserRound, href: "/" }
  );

  const accent = FACTION_ACCENT[character.faction] ?? "var(--gold)";

  return (
    <header className="sticky top-0 z-40 -mx-4 md:-mx-6 px-4 md:px-6 pt-3 pb-2 bg-sea-deep/85 backdrop-blur-md border-b border-line" data-testid="play-header">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 shrink-0 rounded-full grid place-items-center font-display text-lg border-2" style={{ borderColor: accent, color: accent, background: "rgba(0,0,0,0.3)" }} aria-hidden>
          {character.name.slice(0, 1).toUpperCase()}
        </div>
        <div className="min-w-0 flex-1">
          <h1 className="font-display text-xl sm:text-2xl text-gold-bright leading-tight truncate">{character.name}</h1>
          <p className="text-xs sm:text-sm text-gold truncate">
            {character.title ? `${character.title} · ` : ""}
            {factionTitle(faction, character.bounty, character.notoriety)}
          </p>
          <p className="text-xs text-ink-dim truncate">
            {FACTION_LABEL[character.faction]} · Nv. {character.level} · {character.currentIsland.name}
          </p>
        </div>
        <div className="w-28 sm:w-44 shrink-0 flex flex-col gap-1 lg:hidden" data-testid="header-vitals">
          <StatBar label="Vida" value={character.hp} max={character.maxHp} color="var(--blood)" size="sm" />
          <StatBar label="Aguante" value={character.stamina} max={character.maxStamina} color="var(--stamina)" size="sm" />
        </div>
      </div>
      <nav className="mt-2 -mx-4 px-4 md:mx-0 md:px-0 flex gap-2 overflow-x-auto md:flex-wrap scrollbar-none" aria-label="Herramientas del personaje">
        {items.map((it) => (
          <NavButton key={it.key} item={it} />
        ))}
      </nav>
    </header>
  );
}
