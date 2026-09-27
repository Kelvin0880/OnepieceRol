// Pure decisions behind the interface animations, kept apart from React so they can be unit tested.

export interface BarReading {
  value: number;
  max: number;
}

// Signed change worth floating over a bar ("-12", "+30"). A change of max (level up, new max life) is a reset,
// not a hit or a heal, so it floats nothing.
export function barDelta(prev: BarReading | null, next: BarReading): number | null {
  if (!prev || prev.max !== next.max) return null;
  const d = Math.round(next.value - prev.value);
  return d === 0 ? null : d;
}

// A hit that takes a visible chunk of the bar shakes it; chip damage only flashes.
export function isBigHit(prevPct: number, nextPct: number, threshold = 8): boolean {
  return prevPct - nextPct >= threshold;
}

// How strong the red screen-edge flash is for a loss of life: always noticeable, never blinding.
export function hitFlashStrength(prevHp: number, nextHp: number, maxHp: number): number {
  if (nextHp >= prevHp || maxHp <= 0) return 0;
  const lost = (prevHp - nextHp) / maxHp;
  return Math.min(0.85, 0.3 + lost * 2.5);
}

// A bottom sheet closes when dragged down far enough or flicked down fast enough.
export function shouldDismissSheet(offsetY: number, velocityY: number, height: number): boolean {
  if (offsetY <= 0) return false;
  return offsetY > Math.min(140, height * 0.3) || velocityY > 650;
}

// Pointer position inside a card -> rotation in degrees (top edge tilts away, like holding a poster).
export function tiltFromPointer(x: number, y: number, width: number, height: number, max: number): { rotateX: number; rotateY: number } {
  if (width <= 0 || height <= 0) return { rotateX: 0, rotateY: 0 };
  const nx = Math.min(1, Math.max(0, x / width)) - 0.5;
  const ny = Math.min(1, Math.max(0, y / height)) - 0.5;
  return { rotateX: round2(-ny * 2 * max), rotateY: round2(nx * 2 * max) };
}

function round2(n: number): number {
  return Math.round(n * 100) / 100 + 0;
}
