export const FACTION_LABEL: Record<string, string> = {
  PIRATE: "Pirata",
  MARINE: "Marine",
  REVOLUTIONARY: "Revolucionario",
  BOUNTY_HUNTER: "Cazarrecompensas",
  CP0: "CP-0",
};

export const FACTION_ACCENT: Record<string, string> = {
  PIRATE: "#f0c869",
  MARINE: "#6fb3e0",
  REVOLUTIONARY: "#e0785f",
  BOUNTY_HUNTER: "#5fc7a0",
  CP0: "#c9c9d6",
};

export const ASSESSMENT_LABEL: Record<string, { text: string; color: string }> = {
  weaker: { text: "Parece más débil que tú", color: "text-emerald-300" },
  even: { text: "Parece un rival parejo", color: "text-gold" },
  superior: { text: "Parece superior a ti — cuidado", color: "text-blood" },
};

export const CONDITION_COLOR: Record<string, string> = {
  ileso: "text-emerald-300",
  rasguñado: "text-gold",
  herido: "text-gold-bright",
  malherido: "text-orange-400",
  "al borde de la muerte": "text-blood",
};
