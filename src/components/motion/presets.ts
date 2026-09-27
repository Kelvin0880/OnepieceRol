export const SPRING = {
  soft: { type: "spring", stiffness: 260, damping: 26 },
  snappy: { type: "spring", stiffness: 520, damping: 38 },
  bouncy: { type: "spring", stiffness: 420, damping: 17 },
  sheet: { type: "spring", stiffness: 380, damping: 38, mass: 0.9 },
} as const;

export const EASE_OUT = [0.22, 1, 0.36, 1] as const;
export const EASE_IN = [0.55, 0, 1, 0.45] as const;

export const MEDIA = {
  desktop: "(min-width: 640px)",
  finePointer: "(hover: hover) and (pointer: fine)",
} as const;
