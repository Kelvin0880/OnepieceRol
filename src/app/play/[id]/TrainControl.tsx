"use client";

import { useEffect, useState } from "react";
import { Dumbbell } from "lucide-react";
import {
  autoTrainingFocus,
  FULL_MASTERY_LEVEL,
  isLevelCapped,
  isTrainingMaxed,
  levelCap,
  trainingReadyInMs,
  trainingValue,
  type TrainingChoice,
  type TrainingFocus,
  type TrainingState,
} from "@/lib/engine/training";
import type { Character } from "./types";

const PARTY_PHRASES: Record<TrainingChoice, string> = {
  auto: "Me pongo a entrenar un rato.",
  armament: "Me pongo a entrenar mi Haki de Armadura.",
  observation: "Me pongo a entrenar mi Haki de Observación.",
  fruit: "Me pongo a entrenar el dominio de mi fruta.",
};

const SHORT: Record<TrainingFocus, string> = { armament: "Haki de Armadura", observation: "Haki de Observación", fruit: "Fruta" };

const storageKey = (id: string) => `grandline:train-focus:${id}`;

function readStoredChoice(id: string): TrainingChoice {
  try {
    const v = window.localStorage.getItem(storageKey(id));
    if (v === "armament" || v === "observation" || v === "fruit" || v === "auto") return v;
  } catch {}
  return "auto";
}

function writeStoredChoice(id: string, choice: TrainingChoice): void {
  try {
    window.localStorage.setItem(storageKey(id), choice);
  } catch {}
}

// Re-renders every 15 s only while a cooldown is actually running, so the countdown on the button stays honest.
// The clock is read fresh on every render (never a stale "now" from mount), so a session that just finished
// shows the full 30 min at once instead of a figure computed against an old timestamp.
function useCooldown(lastTrainedAt: string | null | undefined): number {
  const [, setTick] = useState(0);
  const remaining = trainingReadyInMs(lastTrainedAt);
  const active = remaining > 0;
  useEffect(() => {
    if (!active) return;
    const t = setInterval(() => setTick((n) => n + 1), 15_000);
    return () => clearInterval(t);
  }, [active]);
  return remaining;
}

export default function TrainControl({
  character,
  inParty,
  disabled,
  doAction,
}: {
  character: Character;
  inParty: boolean;
  disabled: boolean;
  doAction: (body: Record<string, unknown>) => Promise<boolean>;
}) {
  // The play page fetches the character client-side, so this never renders on the server: reading the remembered
  // choice in the initializer is safe and avoids a flash of "auto" followed by the real choice.
  const [choice, setChoice] = useState<TrainingChoice>(() => (typeof window === "undefined" ? "auto" : readStoredChoice(character.id)));

  const state: TrainingState = {
    level: character.level,
    armamentHaki: character.armamentHaki,
    observationHaki: character.observationHaki,
    fruitMastery: character.fruitMastery,
    hasFruit: !!character.devilFruit,
  };
  const focuses: TrainingFocus[] = state.hasFruit ? ["armament", "observation", "fruit"] : ["armament", "observation"];
  // A remembered pick that is now at its ceiling (or a fruit the character doesn't have) quietly trains "auto"
  // instead; the remembered pick comes back by itself once a level up opens room again.
  const effectiveChoice: TrainingChoice = choice !== "auto" && (!focuses.includes(choice) || isTrainingMaxed(choice, state)) ? "auto" : choice;
  const autoPick = autoTrainingFocus(state);
  const allCapped = focuses.every((f) => isTrainingMaxed(f, state));
  const remaining = useCooldown(character.lastTrainedAt);
  const coolingDown = remaining > 0;

  const label = (f: TrainingFocus) =>
    `${SHORT[f]} · ${trainingValue(f, state)}${isLevelCapped(f, state) ? ` (tope nv. ${character.level})` : isTrainingMaxed(f, state) ? " (máx.)" : ""}`;

  return (
    <span className="inline-flex flex-wrap items-center gap-1.5" data-testid="train-control">
      <button
        className="btn-ghost px-3 py-1.5 text-xs inline-flex items-center gap-1.5"
        data-testid="train-button"
        disabled={disabled || coolingDown}
        title={coolingDown ? "Necesitas descansar antes de volver a entrenar en serio." : undefined}
        onClick={() => (inParty ? doAction({ freeText: PARTY_PHRASES[effectiveChoice] }) : doAction({ action: "train", focus: effectiveChoice }))}
      >
        <Dumbbell className="w-3.5 h-3.5" />
        {coolingDown ? `Entrenar (en ${Math.ceil(remaining / 60_000)} min)` : "Entrenar"}
      </button>
      <select
        className="field px-2 py-1.5 text-xs max-w-[13.5rem]"
        aria-label="Qué entrenar"
        data-testid="train-focus"
        value={effectiveChoice}
        disabled={disabled}
        onChange={(e) => {
          const next = e.target.value as TrainingChoice;
          setChoice(next);
          writeStoredChoice(character.id, next);
        }}
      >
        <option value="auto">{allCapped ? "Todo al tope de tu nivel" : `Lo más atrasado (${SHORT[autoPick]})`}</option>
        {focuses.map((f) => (
          <option key={f} value={f} disabled={isTrainingMaxed(f, state)}>
            {label(f)}
          </option>
        ))}
      </select>
      {allCapped && state.level < FULL_MASTERY_LEVEL && (
        <span className="basis-full text-[11px] text-ink-dim" data-testid="train-all-capped">
          Todo está al tope de tu nivel ({levelCap(state.level)}): sube de nivel para seguir creciendo. Entrenar ahora no sube nada, solo cuenta para las misiones de entrenamiento.
        </span>
      )}
    </span>
  );
}
