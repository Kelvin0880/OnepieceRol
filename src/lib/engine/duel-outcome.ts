/**
 * What a winner may do with a beaten player in a fight to the death. The players agree the stakes outside the game;
 * these rules only say which options exist for each pair of factions and what a delivery pays. Pure: no DB.
 */

export type VerdictChoice = "kill" | "capture" | "spare";

export const REWARD_CAP = 100_000_000;
const GOVERNMENT = ["MARINE", "CP0"];

export interface VerdictOptions {
  kill: true;
  spare: true;
  canCapture: boolean;
  /** "impel" = the winner is the Government and sends them to prison; "sell" = anyone else hands them to the Marines. */
  captureMode: "impel" | "sell" | null;
  captureLabel: string | null;
}

/** The Government does not buy its own people and pirates do not lock up Marines: only wanted outsiders can be captured. */
export function verdictOptions(winnerFaction: string, loserFaction: string): VerdictOptions {
  if (GOVERNMENT.includes(loserFaction)) return { kill: true, spare: true, canCapture: false, captureMode: null, captureLabel: null };
  if (GOVERNMENT.includes(winnerFaction)) {
    return { kill: true, spare: true, canCapture: true, captureMode: "impel", captureLabel: "Capturar y encarcelar (Impel Down según su recompensa)" };
  }
  return { kill: true, spare: true, canCapture: true, captureMode: "sell", captureLabel: "Capturar y entregar a la Marina (cobras la recompensa)" };
}

/** Pirates are paid on their bounty, everyone else on their notoriety: the more wanted, the bigger the delivery. */
export function captureReward(loserFaction: string, bounty: number, notoriety: number): number {
  const raw = loserFaction === "PIRATE" ? Math.round(bounty * 0.1) : Math.round(notoriety * 500);
  return Math.max(0, Math.min(REWARD_CAP, raw));
}
