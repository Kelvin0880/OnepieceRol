import { Rng } from "./rng";
import { Combatant, CombatRoundLog, resolveExchange } from "./combat";

export interface BattleFighter {
  id: string;
  combatant: Combatant;
}

export interface Matchup {
  aId: string;
  bId: string;
}

export interface DuelOutcome {
  aId: string;
  bId: string;
  winner: "a" | "b" | "draw";
  aHpLeft: number;
  bHpLeft: number;
}

export interface AssistEvent {
  assisterId: string;
  assistedId: string;
  wave: number;
}

export interface GroupBattleResult {
  victor: "a" | "b" | "draw";
  duels: DuelOutcome[];
  log: CombatRoundLog[];
  assists: AssistEvent[];
}

const MAX_WAVES = 14;
const ASSIST_BONUS_PCT = 0.2;
const MAX_ASSISTERS_PER_DUEL = 3;
const FREE_TO_ASSIST_HP_FRACTION = 0.5;

interface DuelState {
  aId: string;
  bId: string;
  aBase: Combatant;
  bBase: Combatant;
  aHp: number;
  bHp: number;
  aAssists: number;
  bAssists: number;
  concluded: boolean;
  freedThisWave: "a" | "b" | null;
}

function withAtkBonus(c: Combatant, assists: number): Combatant {
  if (assists === 0) return c;
  return { ...c, atk: Math.round(c.atk * (1 + ASSIST_BONUS_PCT * assists)) };
}

/**
 * A full crew-vs-crew clash: every fighter has a named, individually chosen
 * opponent (no generic mob math), but duels don't run to completion in
 * isolation — they advance one exchange per "wave" together, so a fighter
 * who finishes early and isn't badly hurt can peel off and reinforce a
 * teammate still struggling, the way an anime group fight actually reads.
 */
export function runGroupBattle(rng: Rng, sideA: BattleFighter[], sideB: BattleFighter[], matchups: Matchup[]): GroupBattleResult {
  if (sideA.length === 0 || sideB.length === 0) throw new Error("runGroupBattle: both sides need at least one fighter");
  if (matchups.length !== sideA.length || matchups.length !== sideB.length) {
    throw new Error("runGroupBattle: matchups must pair every fighter on both sides exactly once");
  }

  const aById = new Map(sideA.map((f) => [f.id, f.combatant]));
  const bById = new Map(sideB.map((f) => [f.id, f.combatant]));

  const seenA = new Set<string>();
  const seenB = new Set<string>();
  const duels: DuelState[] = matchups.map((m) => {
    const aBase = aById.get(m.aId);
    const bBase = bById.get(m.bId);
    if (!aBase) throw new Error(`runGroupBattle: unknown fighter on side A: ${m.aId}`);
    if (!bBase) throw new Error(`runGroupBattle: unknown fighter on side B: ${m.bId}`);
    if (seenA.has(m.aId)) throw new Error(`runGroupBattle: ${m.aId} appears in more than one matchup`);
    if (seenB.has(m.bId)) throw new Error(`runGroupBattle: ${m.bId} appears in more than one matchup`);
    seenA.add(m.aId);
    seenB.add(m.bId);
    return { aId: m.aId, bId: m.bId, aBase, bBase, aHp: aBase.hp, bHp: bBase.hp, aAssists: 0, bAssists: 0, concluded: false, freedThisWave: null };
  });
  if (seenA.size !== sideA.length || seenB.size !== sideB.length) {
    throw new Error("runGroupBattle: matchups must cover every fighter on both sides");
  }

  const log: CombatRoundLog[] = [];
  const assists: AssistEvent[] = [];

  for (let wave = 1; wave <= MAX_WAVES; wave++) {
    const active = duels.filter((d) => !d.concluded);
    if (active.length === 0) break;

    for (const duel of active) {
      duel.freedThisWave = null;
      const a = withAtkBonus(duel.aBase, duel.aAssists);
      const b = withAtkBonus(duel.bBase, duel.bAssists);
      const { aHpAfter, bHpAfter, log: exchangeLog } = resolveExchange(rng, wave, a, duel.aHp, b, duel.bHp);
      duel.aHp = aHpAfter;
      duel.bHp = bHpAfter;
      log.push(...exchangeLog);

      if (duel.aHp <= 0 || duel.bHp <= 0) {
        duel.concluded = true;
        if (duel.aHp > 0 && duel.aHp / duel.aBase.maxHp > FREE_TO_ASSIST_HP_FRACTION) duel.freedThisWave = "a";
        else if (duel.bHp > 0 && duel.bHp / duel.bBase.maxHp > FREE_TO_ASSIST_HP_FRACTION) duel.freedThisWave = "b";
      }
    }

    // Freed winners reinforce whichever ally on their side is worst off in an ongoing duel.
    for (const duel of active) {
      if (!duel.freedThisWave) continue;
      const side = duel.freedThisWave;
      const freedId = side === "a" ? duel.aId : duel.bId;
      const ongoing = duels.filter((d) => !d.concluded);
      const targets = ongoing
        .map((d) => ({ duel: d, hpFraction: side === "a" ? d.aHp / d.aBase.maxHp : d.bHp / d.bBase.maxHp, assists: side === "a" ? d.aAssists : d.bAssists }))
        .filter((t) => t.assists < MAX_ASSISTERS_PER_DUEL)
        .sort((x, y) => x.hpFraction - y.hpFraction);

      if (targets.length === 0) continue;
      const best = targets[0];
      if (side === "a") best.duel.aAssists += 1;
      else best.duel.bAssists += 1;
      assists.push({ assisterId: freedId, assistedId: side === "a" ? best.duel.aId : best.duel.bId, wave });
    }
  }

  const duelOutcomes: DuelOutcome[] = duels.map((d) => {
    let winner: DuelOutcome["winner"];
    if (d.aHp <= 0 && d.bHp <= 0) winner = "draw";
    else if (d.bHp <= 0) winner = "a";
    else if (d.aHp <= 0) winner = "b";
    else winner = d.aHp === d.bHp ? "draw" : d.aHp > d.bHp ? "a" : "b"; // wave cap hit: healthier fighter takes it
    return { aId: d.aId, bId: d.bId, winner, aHpLeft: d.aHp, bHpLeft: d.bHp };
  });

  const aWins = duelOutcomes.filter((d) => d.winner === "a").length;
  const bWins = duelOutcomes.filter((d) => d.winner === "b").length;
  const victor: GroupBattleResult["victor"] = aWins === bWins ? "draw" : aWins > bWins ? "a" : "b";

  return { victor, duels: duelOutcomes, log, assists };
}
