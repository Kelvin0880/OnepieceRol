"use client";

import Link from "next/link";
import { useSyncExternalStore } from "react";
import { ArrowLeft } from "lucide-react";

const KEY = "grandline:lastCharacter";

export interface LastCharacter {
  id: string;
  name: string;
}

export function rememberCharacter(c: LastCharacter) {
  try {
    localStorage.setItem(KEY, JSON.stringify(c));
  } catch {}
}

function read(): string | null {
  try {
    return localStorage.getItem(KEY);
  } catch {
    return null;
  }
}

const subscribe = (cb: () => void) => {
  window.addEventListener("storage", cb);
  return () => window.removeEventListener("storage", cb);
};

// A real link back to the character you were playing (not history.back(), which breaks as soon as you open two
// pages in a row). Falls back to the character list when nobody was played on this device yet.
export default function BackToCharacter({ className = "" }: { className?: string }) {
  const raw = useSyncExternalStore(subscribe, read, () => null);
  let last: LastCharacter | null = null;
  try {
    last = raw ? (JSON.parse(raw) as LastCharacter) : null;
  } catch {}
  return last ? (
    <Link href={`/play/${last.id}`} className={`btn-gold inline-flex items-center gap-1.5 px-3 py-1.5 text-sm max-w-[14rem] ${className}`} data-testid="back-to-character">
      <ArrowLeft className="w-4 h-4 shrink-0" />
      <span className="truncate">Volver a {last.name}</span>
    </Link>
  ) : (
    <Link href="/" className={`btn-ghost inline-flex items-center gap-1.5 px-3 py-1.5 text-sm ${className}`} data-testid="back-to-character">
      <ArrowLeft className="w-4 h-4" />
      Mis personajes
    </Link>
  );
}
