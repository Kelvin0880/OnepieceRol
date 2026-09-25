import { prisma } from "../db";
import {
  STYLES,
  STARTING_MASTERY,
  canLearnStyle,
  getStyle,
  styleTier,
  trainStyleMastery,
  type StyleAttr,
} from "../engine/styles";

export class StyleError extends Error {}

const TRAIN_COOLDOWN_MS = 30 * 60 * 1000;

async function ownedCharacter(characterId: string, userId: string) {
  const c = await prisma.character.findUnique({ where: { id: characterId }, include: { currentIsland: true, styles: true, ownedWeapons: true } });
  if (!c || c.userId !== userId) throw new StyleError("Personaje no encontrado.");
  return c;
}

function attrsOf(c: { strength: number; agility: number; durability: number; willpower: number; intellect: number }): Record<StyleAttr, number> {
  return { strength: c.strength, agility: c.agility, durability: c.durability, willpower: c.willpower, intellect: c.intellect };
}

/** Everything the Styles panel needs: what you know, what this island teaches (and why you can or cannot take it), and where else to look. */
export async function getStylesView(characterId: string, userId: string) {
  const c = await ownedCharacter(characterId, userId);
  const known = c.styles.map((s) => ({ id: s.styleId, mastery: s.mastery }));
  const wielded = (c.equippedWeaponId ? 1 : 0) + c.ownedWeapons.filter((w) => w.wielded && w.id !== c.equippedWeaponId).length;
  const now = Date.now();
  return {
    islandName: c.currentIsland.name,
    focusId: c.styleFocusId,
    wielded,
    known: c.styles.map((s) => {
      const def = getStyle(s.styleId)!;
      const tier = styleTier(s.mastery);
      return {
        id: s.styleId,
        name: def.name,
        category: def.category,
        description: def.description,
        mastery: s.mastery,
        tier: tier.name,
        nextTierAt: tier.next,
        weaponsNeeded: def.weapons,
        applies: wielded >= def.weapons.min && wielded <= def.weapons.max,
        techniques: def.techniques.map((t) => ({ name: t.name, note: t.note, cost: t.cost, minMastery: t.minMastery, unlocked: t.minMastery <= s.mastery })),
        trainReadyInMs: s.lastTrainedAt ? Math.max(0, s.lastTrainedAt.getTime() + TRAIN_COOLDOWN_MS - now) : 0,
      };
    }),
    teachable: STYLES.filter((d) => d.learn && d.learn.islands.includes(c.currentIsland.name) && !known.some((k) => k.id === d.id)).map((d) => {
      const check = canLearnStyle(d, { faction: c.faction, level: c.level, berries: c.berries, islandName: c.currentIsland.name, attrs: attrsOf(c), known });
      return { id: d.id, name: d.name, category: d.category, description: d.description, price: d.learn!.price, minLevel: d.learn!.minLevel, canLearn: check.ok, reason: check.ok ? null : check.reason };
    }),
    elsewhere: STYLES.filter((d) => d.learn && !d.learn.islands.includes(c.currentIsland.name) && !known.some((k) => k.id === d.id)).map((d) => ({
      id: d.id,
      name: d.name,
      category: d.category,
      islands: d.learn!.islands,
      factions: d.learn!.factions,
      minLevel: d.learn!.minLevel,
      price: d.learn!.price,
    })),
    weapons: c.ownedWeapons.map((w) => ({ id: w.id, name: w.name, kind: w.kind, atkBonus: w.atkBonus, equipped: w.id === c.equippedWeaponId, wielded: w.wielded && w.id !== c.equippedWeaponId })),
  };
}

export async function learnStyle(characterId: string, userId: string, styleId: string) {
  const c = await ownedCharacter(characterId, userId);
  if (c.status !== "ALIVE") throw new StyleError("No puedes estudiar en tu estado actual.");
  const def = getStyle(styleId);
  if (!def) throw new StyleError("Estilo desconocido.");
  const known = c.styles.map((s) => ({ id: s.styleId, mastery: s.mastery }));
  const check = canLearnStyle(def, { faction: c.faction, level: c.level, berries: c.berries, islandName: c.currentIsland.name, attrs: attrsOf(c), known });
  if (!check.ok) throw new StyleError(check.reason);
  // The unique (character, style) pair stops a double click from charging twice.
  try {
    await prisma.characterStyle.create({ data: { characterId, styleId, mastery: STARTING_MASTERY } });
  } catch {
    throw new StyleError("Ya conoces este estilo.");
  }
  await prisma.character.update({ where: { id: characterId }, data: { berries: c.berries - def.learn!.price } });
  const message = `Pagas la matrícula (฿ ${def.learn!.price.toLocaleString("es-ES")}) y aprendes los primeros pasos de ${def.name}. Ahora toca entrenar: cada técnica se desbloquea con la maestría.`;
  await prisma.gameLogEntry.create({ data: { characterId, kind: "style", text: message } });
  return { message };
}

export async function trainStyle(characterId: string, userId: string, styleId: string) {
  const c = await ownedCharacter(characterId, userId);
  if (c.status !== "ALIVE") throw new StyleError("No puedes entrenar en tu estado actual.");
  const row = c.styles.find((s) => s.styleId === styleId);
  if (!row) throw new StyleError("Aún no conoces ese estilo.");
  const def = getStyle(styleId)!;
  const { assertCalm } = await import("./perform-action"); // dynamic: perform-action imports the game layer
  await assertCalm(characterId, userId, "usar objetos").catch(() => {
    throw new StyleError("No es momento de entrenar: hay una situación sin resolver a tu alrededor.");
  });
  if (row.mastery >= 100) throw new StyleError(`Ya dominas ${def.name} por completo.`);
  const wait = row.lastTrainedAt ? row.lastTrainedAt.getTime() + TRAIN_COOLDOWN_MS - Date.now() : 0;
  if (wait > 0) throw new StyleError(`Sigues agotado del último entrenamiento: espera ${Math.ceil(wait / 60000)} min.`);
  if (c.stamina < 15) throw new StyleError("No te queda aliento para entrenar: descansa primero.");
  const before = styleTier(row.mastery);
  const gain = trainStyleMastery(row.mastery, c.willpower, c.level);
  // Claiming the row by its old mastery: two simultaneous requests cannot both train.
  const res = await prisma.characterStyle.updateMany({ where: { id: row.id, mastery: row.mastery }, data: { mastery: row.mastery + gain, lastTrainedAt: new Date() } });
  if (res.count === 0) throw new StyleError("Ya estabas entrenando: inténtalo de nuevo.");
  await prisma.character.update({ where: { id: characterId }, data: { stamina: Math.max(0, c.stamina - 15), staminaUpdatedAt: new Date() } });
  const after = styleTier(row.mastery + gain);
  const unlocked = def.techniques.filter((t) => t.minMastery > row.mastery && t.minMastery <= row.mastery + gain).map((t) => t.name);
  let message = `Entrenas ${def.name}: +${gain} de maestría (${row.mastery + gain}/100).`;
  if (after.index > before.index) message += ` ¡Ahora eres ${after.name}!`;
  if (unlocked.length) message += ` Nueva técnica: ${unlocked.join(", ")}.`;
  await prisma.gameLogEntry.create({ data: { characterId, kind: "style", text: message } });
  return { message };
}

export async function setStyleFocus(characterId: string, userId: string, styleId: string | null) {
  const c = await ownedCharacter(characterId, userId);
  if (styleId !== null && !c.styles.some((s) => s.styleId === styleId)) throw new StyleError("Aún no conoces ese estilo.");
  await prisma.character.update({ where: { id: characterId }, data: { styleFocusId: styleId } });
  return { message: styleId ? `${getStyle(styleId)!.name} es ahora tu estilo principal.` : "Volverás a usar el estilo más fuerte que encaje con lo que empuñes." };
}

/** Up to 3 weapons in hand: the equipped main one plus off-hand ones. The style decides how well the extra blades work. */
export async function setWielded(characterId: string, userId: string, weaponId: string, wield: boolean) {
  const c = await ownedCharacter(characterId, userId);
  const w = c.ownedWeapons.find((x) => x.id === weaponId);
  if (!w) throw new StyleError("No posees esa arma.");
  if (w.id === c.equippedWeaponId) throw new StyleError("Esa es tu arma principal: equipa otra para cambiarla.");
  if (wield) {
    const inHand = (c.equippedWeaponId ? 1 : 0) + c.ownedWeapons.filter((x) => x.wielded && x.id !== c.equippedWeaponId).length;
    if (inHand >= 3) throw new StyleError("Solo puedes empuñar 3 armas a la vez (una entre los dientes cuenta).");
  }
  await prisma.weapon.update({ where: { id: weaponId }, data: { wielded: wield } });
  return { message: wield ? `Empuñas también ${w.name}.` : `Guardas ${w.name}.` };
}
