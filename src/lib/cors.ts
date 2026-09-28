/** The public landing on GitHub Pages is the only other site allowed to read the game's ping; local previews too, outside production. */
export const LANDING_ORIGIN = "https://kelvin0880.github.io";

export function pingCorsOrigin(origin: string | null, production: boolean): string | null {
  if (!origin) return null;
  if (origin === LANDING_ORIGIN) return origin;
  if (!production && /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)) return origin;
  return null;
}
