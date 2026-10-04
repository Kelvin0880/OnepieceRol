process.env.REFEREE_STUB = "1";
process.env.JUDGE_STUB = "1";
// Level caps on Haki / fruit mastery / style mastery (2026-10-04), against the dev DB: the reserve keeps what was
// above the cap (Sebastian's real numbers), a level up gives it back, training and fight growth stop at the cap,
// styles too, and the rollout gift is paid exactly once. Usage: npx tsx scripts/level-caps-check.ts
import "dotenv/config";
import { prisma } from "../src/lib/db";
import { syncProgressionCaps, grantCapRolloutGift, CAP_GIFT_BERRIES } from "../src/lib/game/progression-caps";
import { trainCharacter } from "../src/lib/game/perform-action";
import { combatProgressData, type PreparedFighter } from "../src/lib/game/combat-prep";
import { trainStyle, StyleError } from "../src/lib/game/styles";
import { levelCap } from "../src/lib/engine/training";

function assert(cond: boolean, label: string) {
  if (!cond) throw new Error(`FAIL: ${label}`);
  console.log(`PASS: ${label}`);
}
const get = (id: string) => prisma.character.findUniqueOrThrow({ where: { id }, include: { styles: true } });
const prepared = (used: string, styleId?: string) =>
  ({ staminaAfter: 100, effect: { used, styleUse: styleId ? { styleId, technique: null } : undefined } }) as unknown as PreparedFighter;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function main() {
  const island = await prisma.island.findFirstOrThrow({ where: { name: "Pueblo Foosha" } });
  const u = await prisma.user.create({ data: { username: `cap${Date.now() % 1_000_000}`, passwordHash: "x" } });
  const fruit = await prisma.devilFruit.findFirstOrThrow({ where: { isSingleton: false, claimedBy: { is: null } } });
  const c = await prisma.character.create({
    data: { name: `Tope${Date.now() % 10000}`, faction: "PIRATE", userId: u.id, currentIslandId: island.id, level: 7, hp: 100, maxHp: 100, stamina: 100, maxStamina: 100, berries: 1000, willpower: 10, intellect: 10, devilFruitId: fruit.id, armamentHaki: 71, observationHaki: 71, fruitMastery: 72 },
  });

  // ---- Sebastian's real case: level 7 with 71 / 71 / 72
  await syncProgressionCaps(c.id);
  let s = await get(c.id);
  assert(levelCap(7) === 34, "the cap at level 7 is 34");
  assert(s.armamentHaki === 34 && s.observationHaki === 34 && s.fruitMastery === 34, "everything above the cap is taken down to it");
  assert(s.bankedArmament === 37 && s.bankedObservation === 37 && s.bankedFruit === 38, "and kept in the reserve, not erased (37 / 37 / 38)");
  await syncProgressionCaps(c.id);
  s = await get(c.id);
  assert(s.armamentHaki === 34 && s.bankedArmament === 37, "syncing again changes nothing (idempotent)");

  // ---- a level up gives part of it back by itself
  await prisma.character.update({ where: { id: c.id }, data: { level: 8 } });
  await syncProgressionCaps(c.id);
  s = await get(c.id);
  assert(s.armamentHaki === 38 && s.bankedArmament === 33 && s.fruitMastery === 38 && s.bankedFruit === 34, "level 8 opens 4 more points from the reserve");

  // ---- training at the cap gains nothing and says why
  const capped = await trainCharacter(c.id, u.id, "armament");
  s = await get(c.id);
  assert(s.armamentHaki === 38, "training Armament at the cap does not raise it");
  assert(capped.log.join(" ").includes("tope que tu nivel permite"), "and the message explains it is the level's cap");

  // ---- training below the cap stops exactly at it
  await prisma.character.update({ where: { id: c.id }, data: { observationHaki: 37, bankedObservation: 0, lastTrainedAt: null, stamina: 100, staminaUpdatedAt: new Date() } });
  await trainCharacter(c.id, u.id, "observation");
  s = await get(c.id);
  assert(s.observationHaki === 38, "a session one point under the cap gains exactly one point");

  // ---- growth from use in fights respects the cap (solo, joint and duels all write through combatProgressData)
  const atCap = combatProgressData(s, prepared("armament"));
  assert(atCap.armamentHaki === undefined, "using Armament in a fight at the cap does not raise it");
  const fruitAtCap = combatProgressData(s, prepared("fruit"));
  assert(fruitAtCap.fruitMastery === undefined, "using the fruit in a fight at the cap does not raise it");
  await prisma.character.update({ where: { id: c.id }, data: { armamentHaki: 37, bankedArmament: 0 } });
  s = await get(c.id);
  const below = combatProgressData(s, prepared("armament"));
  assert(below.armamentHaki === 38, "one point under the cap, a fight can still take it up to the cap, never past it");

  // ---- styles: training and use both stop at the cap
  await prisma.characterStyle.create({ data: { characterId: c.id, styleId: "ittoryu", mastery: 38 } });
  let styleError = "";
  try {
    await trainStyle(c.id, u.id, "ittoryu");
  } catch (e) {
    styleError = e instanceof StyleError ? e.message : String(e);
  }
  assert(styleError.includes("tope"), `training a style at the cap is refused with a clear reason (${styleError})`);
  s = await get(c.id);
  combatProgressData(s, prepared("style", "ittoryu"));
  await sleep(400);
  assert((await get(c.id)).styles[0].mastery === 38, "using a style in a fight at the cap does not raise it");
  await prisma.characterStyle.updateMany({ where: { characterId: c.id }, data: { mastery: 37 } });
  s = await get(c.id);
  combatProgressData(s, prepared("style", "ittoryu"));
  await sleep(400);
  assert((await get(c.id)).styles[0].mastery === 38, "one under the cap, fight use takes it to the cap");

  // ---- the rollout gift: once, and the new level gives back reserve at once
  await prisma.character.update({ where: { id: c.id }, data: { level: 7, armamentHaki: 71, observationHaki: 71, fruitMastery: 72, bankedArmament: 0, bankedObservation: 0, bankedFruit: 0, hp: 40 } });
  const berriesBefore = (await get(c.id)).berries;
  const gift = await grantCapRolloutGift(c.id);
  s = await get(c.id);
  assert(gift.granted && s.level === 8, "the gift gives one full level");
  assert(s.berries === berriesBefore + CAP_GIFT_BERRIES, "and the berries");
  assert(s.hp === s.maxHp, "and full life");
  assert(s.armamentHaki === 38 && s.bankedArmament === 33, "and its new level gives back reserve straight away");
  assert(gift.text.includes("reserva"), "the log entry tells the player nothing was lost");
  const again = await grantCapRolloutGift(c.id);
  assert(!again.granted && (await get(c.id)).berries === berriesBefore + CAP_GIFT_BERRIES && (await get(c.id)).level === 8, "a second rollout never pays twice");

  console.log("ALL PASS");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
