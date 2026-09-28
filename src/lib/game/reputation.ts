import { prisma } from "../db";
import { crossedPirateTier, crossedMarineTier, crossedTier, CP0_TIERS } from "../engine/progression";
import { postNews } from "./death-resolution";
import { MAX_PLAYER_BOUNTY } from "../engine/impel-down";
import { fameFactor } from "../engine/bounty-impact";
import { Faction } from "@prisma/client";

export interface ReputationCharacter {
  id: string;
  name: string;
  faction: Faction;
  bounty: number;
  notoriety: number;
}

/**
 * The one place bounty (pirates) and notoriety (everyone else) actually get
 * written — both solo actions and group battles route reward deltas through
 * here so the character's displayed reputation, the BountyLogEntry history,
 * and milestone news posts never drift out of sync with each other.
 */
export async function applyBountyOrNotoriety(character: ReputationCharacter, delta: number, newsLog: string[], reason = "Hazaña reciente"): Promise<number> {
  if (delta === 0) return 0;
  if (character.faction === "PIRATE") {
    if (delta > 0) {
      // A Shichibukai's bounty is frozen by the licence: deeds make the news, not the poster.
      const licence = await prisma.character.findUnique({ where: { id: character.id }, select: { warlordSince: true } });
      if (licence?.warlordSince) return 0;
    }
    const before = character.bounty;
    // The more famous, the bigger every gain: a rising poster snowballs.
    const gain = delta > 0 ? Math.round(delta * fameFactor(before)) : delta;
    const after = Math.min(MAX_PLAYER_BOUNTY, Math.max(0, before + gain));
    await prisma.character.update({ where: { id: character.id }, data: { bounty: after } });
    await prisma.bountyLogEntry.create({ data: { characterId: character.id, delta: after - before, reason } });
    const crossed = crossedPirateTier(before, after);
    if (crossed) {
      const headline = `Nueva recompensa: ${character.name} alcanza el rango "${crossed.title}"`;
      const body = `Los periódicos del Gobierno Mundial confirman una recompensa de ${after.toLocaleString("es-ES")} berries sobre la cabeza de ${character.name}.`;
      await postNews(headline, body, "Recompensas", character.id);
      newsLog.push(headline);
    }
    return after - before;
  } else {
    const before = character.notoriety;
    const after = Math.max(0, before + delta);
    await prisma.character.update({ where: { id: character.id }, data: { notoriety: after } });
    await prisma.bountyLogEntry.create({ data: { characterId: character.id, delta, reason } });
    if (character.faction === "MARINE") {
      const crossed = crossedMarineTier(before, after);
      if (crossed) {
        const headline = `${character.name} asciende a ${crossed.title}`;
        await postNews(headline, `La Marina confirma el ascenso de ${character.name} tras sus méritos recientes.`, "Gobierno Mundial", character.id);
        newsLog.push(headline);
      }
    }
    if (character.faction === "CP0") {
      const crossed = crossedTier(before, after, CP0_TIERS);
      if (crossed) {
        // Cipher Pol works in the shadows: promotions never make public news, only the ledger records them.
        newsLog.push(`${character.name} asciende a ${crossed.title} (informe interno de CP-0)`);
      }
    }
  }
  return delta;
}
