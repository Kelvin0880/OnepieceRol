// Combat styles against the dev DB: learning rules, training, weapons in hand, the effect on the real combatant,
// technique use, and the canon cast's styles. Usage: npx tsx scripts/styles-check.ts
import "dotenv/config";
import { prisma } from "../src/lib/db";
import { getStylesView, learnStyle, trainStyle, setStyleFocus, setWielded, StyleError } from "../src/lib/game/styles";
import { toCombatant } from "../src/lib/game/derive";
import { prepareFighter } from "../src/lib/game/combat-prep";
import { resolveFreeTextAction } from "../src/lib/game/perform-action";

function assert(cond: boolean, label: string) {
  if (!cond) throw new Error(`FAIL: ${label}`);
  console.log(`PASS: ${label}`);
}
async function rejects(fn: () => Promise<unknown>) {
  try {
    await fn();
    return false;
  } catch (e) {
    return e instanceof StyleError;
  }
}
const load = (id: string) => prisma.character.findUniqueOrThrow({ where: { id }, include: { devilFruit: true, equippedWeapon: true, styles: true, ownedWeapons: { where: { wielded: true } } } });

async function main() {
  const dojo = await prisma.island.findFirstOrThrow({ where: { name: "Villa Shimotsuki" } });
  const baratie = await prisma.island.findFirstOrThrow({ where: { name: "Restaurante Baratie" } });
  const u = await prisma.user.create({ data: { username: `st${Date.now() % 1_000_000}`, passwordHash: "x" } });
  const c = await prisma.character.create({
    data: { name: `Estilo${Date.now() % 10000}`, faction: "PIRATE", userId: u.id, currentIslandId: dojo.id, level: 12, hp: 100, maxHp: 100, berries: 200_000, strength: 12, agility: 15, durability: 8, willpower: 10, intellect: 8 },
  });
  const swordA = await prisma.weapon.create({ data: { name: "Katana A", kind: "Katana", grade: "NONE", description: "a", atkBonus: 10, basePrice: 1, ownerId: c.id } });
  const swordB = await prisma.weapon.create({ data: { name: "Katana B", kind: "Katana", grade: "NONE", description: "b", atkBonus: 10, basePrice: 1, ownerId: c.id } });
  const swordC = await prisma.weapon.create({ data: { name: "Katana C", kind: "Katana", grade: "NONE", description: "c", atkBonus: 10, basePrice: 1, ownerId: c.id } });
  await prisma.character.update({ where: { id: c.id }, data: { equippedWeaponId: swordA.id } });

  // ---- what the panel offers
  let view = await getStylesView(c.id, u.id);
  assert(view.teachable.some((t) => t.id === "ittoryu" && t.canLearn), "the dojo teaches Ittoryu to a beginner with the money");
  assert(view.teachable.find((t) => t.id === "nitoryu")!.canLearn === false, "Nitoryu is offered but locked behind Ittoryu");
  assert(view.elsewhere.some((e) => e.id === "rokushiki" && e.factions?.includes("CP0")), "other islands' schools are listed with their faction limits");

  // ---- learning
  const base = toCombatant(await load(c.id));
  const before = (await prisma.character.findUniqueOrThrow({ where: { id: c.id } })).berries;
  await learnStyle(c.id, u.id, "ittoryu");
  assert((await prisma.character.findUniqueOrThrow({ where: { id: c.id } })).berries === before - 2000, "the tuition is charged");
  assert(await rejects(() => learnStyle(c.id, u.id, "ittoryu")), "a style cannot be bought twice");
  assert((await prisma.character.findUniqueOrThrow({ where: { id: c.id } })).berries === before - 2000, "the refused second purchase charged nothing");
  const dupes = await Promise.allSettled([learnStyle(c.id, u.id, "nitoryu"), learnStyle(c.id, u.id, "nitoryu")]);
  assert(dupes.every((d) => d.status === "rejected"), "Nitoryu is refused (needs Ittoryu at 30%) even when spammed");
  assert(await rejects(() => learnStyle(c.id, u.id, "rokushiki")), "Rokushiki is refused here (wrong island and faction)");
  assert(await rejects(() => learnStyle(c.id, u.id, "hachi_ryu")), "character-only styles cannot be learned");
  assert(await rejects(() => learnStyle(c.id, "somebody-else", "ittoryu")), "another account cannot use my character");

  // ---- passive effect on the real combatant
  const withStyle = toCombatant(await load(c.id));
  assert(withStyle.atk >= base.atk, "a known style with one sword never lowers attack");
  await prisma.characterStyle.updateMany({ where: { characterId: c.id, styleId: "ittoryu" }, data: { mastery: 100 } });
  const master = toCombatant(await load(c.id));
  assert(master.atk > withStyle.atk, "mastering the style raises the combatant's attack");

  // ---- training
  await prisma.characterStyle.updateMany({ where: { characterId: c.id, styleId: "ittoryu" }, data: { mastery: 30, lastTrainedAt: null } });
  await prisma.character.update({ where: { id: c.id }, data: { stamina: 100 } });
  const t1 = await trainStyle(c.id, u.id, "ittoryu");
  assert(t1.message.includes("maestría"), "training reports the gain");
  assert(await rejects(() => trainStyle(c.id, u.id, "ittoryu")), "training has a cooldown");
  const after = (await prisma.characterStyle.findFirstOrThrow({ where: { characterId: c.id, styleId: "ittoryu" } })).mastery;
  assert(after > 30, "mastery went up");
  assert(await rejects(() => trainStyle(c.id, u.id, "black_leg")), "cannot train a style you do not know");

  // ---- nitoryu becomes learnable once ittoryu is at 30+, and needs two swords
  await prisma.characterStyle.updateMany({ where: { characterId: c.id, styleId: "ittoryu" }, data: { mastery: 35 } });
  await learnStyle(c.id, u.id, "nitoryu");
  const oneSword = toCombatant(await load(c.id));
  assert(oneSword.atk > 0, "Nitoryu learned");
  await setWielded(c.id, u.id, swordB.id, true);
  const two = await load(c.id);
  assert(two.ownedWeapons.length === 1, "a second weapon is now wielded");
  await prisma.characterStyle.updateMany({ where: { characterId: c.id, styleId: "nitoryu" }, data: { mastery: 100 } });
  const dual = toCombatant(await load(c.id));
  await prisma.characterStyle.updateMany({ where: { characterId: c.id, styleId: "nitoryu" }, data: { mastery: 0 } });
  const clumsy = toCombatant(await load(c.id));
  assert(dual.atk > clumsy.atk, "two swords are worth more with a mastered two-sword style than without training");
  assert(dual.atk > oneSword.atk, "two blades with the style beat one blade");
  await setWielded(c.id, u.id, swordC.id, true);
  assert(await rejects(() => setWielded(c.id, u.id, swordA.id, true)), "the main weapon cannot be wielded twice");
  const fourth = await prisma.weapon.create({ data: { name: "Katana D", kind: "Katana", grade: "NONE", description: "d", atkBonus: 10, basePrice: 1, ownerId: c.id } });
  assert(await rejects(() => setWielded(c.id, u.id, fourth.id, true)), "no more than three weapons in hand");
  await setWielded(c.id, u.id, swordC.id, false);
  await setWielded(c.id, u.id, swordB.id, false);

  // ---- focus + technique
  await setStyleFocus(c.id, u.id, "ittoryu");
  assert((await prisma.character.findUniqueOrThrow({ where: { id: c.id } })).styleFocusId === "ittoryu", "the main style can be chosen");
  assert(await rejects(() => setStyleFocus(c.id, u.id, "santoryu")), "cannot focus an unknown style");
  await prisma.characterStyle.updateMany({ where: { characterId: c.id, styleId: "ittoryu" }, data: { mastery: 50 } });
  await prisma.character.update({ where: { id: c.id }, data: { stamina: 100, staminaUpdatedAt: new Date() } });
  const prep = prepareFighter(await load(c.id), "style", 0, 100, undefined, "uso el Iai Giri contra el enemigo");
  assert(prep.effect.used === "style" && !!prep.effect.styleUse?.technique.startsWith("Iai"), "naming a technique uses it");
  assert(prep.effect.staminaCost > 0 && prep.staminaAfter < prep.staminaBefore, "the technique costs stamina");
  const nothing = prepareFighter(await load(c.id), "none", 0, 100);
  assert(prep.combatant.atk > nothing.combatant.atk, "the technique adds power on top of a basic attack");
  await prisma.character.update({ where: { id: c.id }, data: { equippedWeaponId: null } });
  const unarmed = prepareFighter(await load(c.id), "style", 0, 100, undefined, "uso Iai Giri");
  assert(unarmed.effect.downgraded, "a sword style without a sword falls back to plain fighting");

  // ---- faction school + Baratie
  await prisma.character.update({ where: { id: c.id }, data: { currentIslandId: baratie.id } });
  await learnStyle(c.id, u.id, "black_leg");
  assert((await load(c.id)).styles.some((s) => s.styleId === "black_leg"), "Pierna Negra is taught at the Baratie");

  // ---- the canon cast
  const zoro = await prisma.worldActor.findUniqueOrThrow({ where: { name: "Roronoa Zoro" } });
  assert(zoro.abilitiesJson!.includes("Santoryu") && zoro.abilitiesJson!.includes("Oni Giri"), "Zoro's kit names Santoryu and its techniques");
  const lucci = await prisma.worldActor.findUniqueOrThrow({ where: { name: "Rob Lucci" } });
  assert(lucci.abilitiesJson!.includes("Rokushiki"), "Lucci's kit names Rokushiki");
  const sanji = await prisma.worldActor.findUniqueOrThrow({ where: { name: "Vinsmoke Sanji" } });
  assert(sanji.abilitiesJson!.includes("Pierna Negra"), "Sanji's kit names Pierna Negra");
  const withStyles = await prisma.worldActor.count({ where: { abilitiesJson: { contains: "Estilo:" } } });
  assert(withStyles >= 45, `at least 45 canon characters have a combat style (${withStyles})`);

  // ---- asking a master for lessons in the scene
  const pupil = await prisma.character.create({
    data: { name: `Alumno${Date.now() % 10000}`, faction: "PIRATE", userId: u.id, currentIslandId: dojo.id, level: 12, hp: 100, maxHp: 100, berries: 200_000 },
  });
  const lesson = await resolveFreeTextAction(pupil.id, u.id, "Maestro, quiero aprender Ittoryu");
  assert(lesson.log.join(" ").includes("Ittoryu"), "asking for lessons in the scene enrols the character");
  assert(!!(await prisma.characterStyle.findUnique({ where: { characterId_styleId: { characterId: pupil.id, styleId: "ittoryu" } } })), "the style is learned and the fee charged");
  const refused = await resolveFreeTextAction(pupil.id, u.id, "Enséñame el Santoryu");
  assert(refused.log.join(" ").includes("todavía") && !(await prisma.characterStyle.findFirst({ where: { characterId: pupil.id, styleId: "santoryu" } })), "a lesson you do not qualify for is refused with the reason, nothing charged");

  console.log("ALL STYLE CHECKS PASSED");
}
main().finally(() => prisma.$disconnect());
