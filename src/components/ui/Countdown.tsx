"use client";
import { useEffect, useState } from "react";

function format(ms: number): string {
  const s = Math.max(0, Math.ceil(ms / 1000));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const mm = String(m).padStart(2, "0");
  const ss = String(sec).padStart(2, "0");
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}

const LABEL: Record<string, string> = { herido: "vuelve en", detenido: "sale en", sucesor: "sucesor en" };

/** A live countdown (ticks every second) to when a resident is back, released or replaced. */
export default function Countdown({ at, kind }: { at: string; kind: string }) {
  const target = new Date(at).getTime();
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  const left = target - now;
  return (
    <span className="tabular-nums text-amber-200" data-testid="countdown">
      {left > 0 ? `${LABEL[kind] ?? "en"} ${format(left)}` : kind === "sucesor" ? "su sucesor llega en un momento" : "ya casi disponible"}
    </span>
  );
}
