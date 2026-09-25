"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export type BadgeKey = "news" | "denden" | "events" | "inventory";

interface Server {
  now: number;
  news: number;
  denden: number;
  events: number;
  inventory: string[];
}

const key = (characterId: string, k: string) => `badge:${characterId}:${k}`;
const read = (k: string): string | null => {
  try {
    return localStorage.getItem(k);
  } catch {
    return null;
  }
};
const write = (k: string, v: string) => {
  try {
    localStorage.setItem(k, v);
  } catch {
    /* private mode: badges just start from zero every visit */
  }
};

/**
 * "Something new" counters for the header buttons. What the player has already seen lives in localStorage; the very
 * first visit marks everything as seen so nobody opens the game to a wall of red numbers.
 */
export function useBadges(characterId: string) {
  const [counts, setCounts] = useState<Record<BadgeKey, number>>({ news: 0, denden: 0, events: 0, inventory: 0 });
  const last = useRef<Server | null>(null);

  const compute = useCallback(
    (s: Server) => {
      const inv = read(key(characterId, "inventory"));
      const seen = new Set<string>(inv ? (JSON.parse(inv) as string[]) : s.inventory);
      if (!inv) write(key(characterId, "inventory"), JSON.stringify(s.inventory));
      setCounts({ news: s.news, denden: s.denden, events: s.events, inventory: s.inventory.filter((n) => !seen.has(n)).length });
    },
    [characterId]
  );

  const refresh = useCallback(async () => {
    const since = (k: string) => {
      const v = read(key(characterId, k));
      if (v) return v;
      write(key(characterId, k), String(Date.now()));
      return String(Date.now());
    };
    try {
      const res = await fetch(`/api/characters/${characterId}/badges?news=${since("news")}&denden=${since("denden")}&events=${since("events")}`);
      if (!res.ok) return;
      const s = (await res.json()) as Server;
      last.current = s;
      compute(s);
    } catch {
      /* transient network error: keep the old numbers */
    }
  }, [characterId, compute]);

  useEffect(() => {
    refresh();
    const t = setInterval(refresh, 15000);
    return () => clearInterval(t);
  }, [refresh]);

  /** Call when the player opens a section: it counts as seen from this moment. */
  const markSeen = useCallback(
    (k: BadgeKey) => {
      if (k === "inventory") write(key(characterId, "inventory"), JSON.stringify(last.current?.inventory ?? []));
      else write(key(characterId, k), String(last.current?.now ?? Date.now()));
      setCounts((c) => ({ ...c, [k]: 0 }));
    },
    [characterId]
  );

  return { counts, markSeen, refresh };
}

export function badgeLabel(n: number): string {
  return n > 9 ? "9+" : String(n);
}
