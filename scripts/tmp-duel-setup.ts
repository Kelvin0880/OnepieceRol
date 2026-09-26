import "dotenv/config";
import { prisma } from "../src/lib/db";
import { actorCombatStats } from "../src/lib/engine/guardian";
(async () => {
  const smoker = await prisma.worldActor.findUniqueOrThrow({ where: { name: "Smoker" } });
  const isl = await prisma.island.findFirstOrThrow({ where: { name: "Loguetown" } });
  const st = actorCombatStats(smoker.powerLevel);
  const u = await prisma.user.create({ data: { username: "pruebaduelo", passwordHash: "x" } });
  const c = await prisma.character.create({ data: {
    name: "Kaito", faction: "PIRATE", userId: u.id, currentIslandId: isl.id, level: 45,
    hp: 520, maxHp: 520, stamina: 250, maxStamina: 250, strength: 55, agility: 55, durability: 55, willpower: 55, intellect: 45,
    armamentHaki: 78, observationHaki: 72, attrLevelGranted: 45, attributePoints: 0, berries: 1000, islandsVisited: JSON.stringify([isl.id]),
  } });
  const w = await prisma.weapon.create({ data: { name: "Sable de acero templado", description: "Sable de batalla de un espadachín veterano", ownerId: c.id, atkBonus: 20, defBonus: 4, spdBonus: 4 } as never }).catch(async () => null);
  if (w) await prisma.character.update({ where: { id: c.id }, data: { equippedWeaponId: w.id } });
  const enemy = { name: "Smoker", hp: st.hp, atk: st.atk, def: st.def, spd: st.spd, isBoss: true, level: 45, personality: smoker.personality ?? undefined, worldActorId: smoker.id };
  await prisma.pendingEncounter.create({ data: { characterId: c.id, enemyJson: JSON.stringify(enemy), rewardsJson: JSON.stringify({ berries: 0, xp: 0, bounty: 0, islandDanger: isl.dangerLevel }), narrative: "Smoker bloquea el paso.", assessment: "even", phase: "fighting", enemyHp: st.hp, roundNumber: 0 } });
  console.log({ char: c.id, user: u.id, smokerPower: smoker.powerLevel, smokerStats: st });
})().finally(() => prisma.$disconnect());
