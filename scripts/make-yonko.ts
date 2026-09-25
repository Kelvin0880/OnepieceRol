// Owner tool: turns a character into a Yonko (max attributes, all Haki, a copy of the Ope Ope no Mi awakened, a style,
// an island of their own with its garrison, three named commanders). Idempotent. Never touches other characters.
// Usage: npx tsx scripts/make-yonko.ts "<character name>" [crew name]
import "dotenv/config";
import { prisma } from "../src/lib/db";
import { attributeCap, HP_PER_DURABILITY_POINT, STAMINA_PER_WILLPOWER_POINT } from "../src/lib/engine/attributes";
import { DEVIL_FRUIT_CATALOG } from "../src/lib/game/devil-fruit-catalog";
import { GARRISON_MAX } from "../src/lib/engine/territory";
import { companionSheet, MAX_COMPANIONS, type CompanionProfile } from "../src/lib/engine/companions";
import { postNews } from "../src/lib/game/death-resolution";

const LEVEL = 45;
const ISLAND = "Isla del Toro Negro";
const TITLE = `Yonko de ${ISLAND}`;
const BOUNTY = 2_000_000_000;

const COMMANDERS: { name: string; role: string; personality: string; profile: CompanionProfile }[] = [
  {
    name: "Yami Kessen",
    role: "Espadachín",
    personality: "Seco, leal hasta el hueso y dado a resolver todo con un solo corte. Solo sonríe cuando el enemigo merece la pena.",
    profile: {
      epithet: "Corta-Tormentas",
      styleId: "santoryu",
      abilities: ["Corte Tormenta", "Guardia de Acero Negro", "Tajo de Tres Colas", "Rugido de la Hoja Negra"],
      attrs: { strength: 140, agility: 110, durability: 110, willpower: 100, intellect: 60 },
    },
  },
  {
    name: "Noa Marea-Negra",
    role: "Navegante",
    personality: "Irónica y calculadora. Lee el cielo como otros leen un libro y nunca pierde la calma, ni siquiera en mitad de un huracán.",
    profile: {
      epithet: "Ojo del Huracán",
      styleId: "electro",
      abilities: ["Tormenta de Rayo Azul", "Ruta imposible", "Ojo del Huracán", "Descarga en cadena"],
      attrs: { strength: 70, agility: 140, durability: 90, willpower: 100, intellect: 130 },
    },
  },
  {
    name: "Gorn Puño-de-Muralla",
    role: "Guardaespaldas",
    personality: "Enorme, callado y protector. Se planta delante de su capitán antes de que nadie termine de desenvainar.",
    profile: {
      epithet: "Muralla de la tripulación",
      styleId: "battleship_fist",
      abilities: ["Muro Negro", "Impacto Acorazado", "Escudo de la Tripulación", "Placaje del Toro"],
      attrs: { strength: 135, agility: 70, durability: 145, willpower: 110, intellect: 50 },
    },
  },
];

async function main() {
  const [name, crewNameArg] = [process.argv[2], process.argv[3]];
  if (!name) throw new Error('Usage: npx tsx scripts/make-yonko.ts "<character name>" [crew name]');
  const c = await prisma.character.findFirstOrThrow({ where: { name }, include: { devilFruit: true, crew: true, companions: true, ownedWeapons: true, styles: true } });
  if (c.faction !== "PIRATE") throw new Error("A Yonko has to be a pirate.");
  if (c.status !== "ALIVE") throw new Error("The character is not alive.");
  const island = await prisma.island.findFirstOrThrow({ where: { name: ISLAND } });

  // ---- devil fruit: a copy of the Ope Ope no Mi, awakened
  const cat = DEVIL_FRUIT_CATALOG.find((f) => f.name === "Ope Ope no Mi")!;
  let fruitId = c.devilFruitId;
  if (c.devilFruit && c.devilFruit.name !== cat.name) throw new Error(`Already eats ${c.devilFruit.name}; refusing to overwrite it.`);
  if (!fruitId) {
    const f = await prisma.devilFruit.create({
      data: { name: cat.name, englishName: cat.englishName, type: cat.type, rarity: cat.rarity, description: cat.description, effectsJson: JSON.stringify(cat.effects), isSingleton: false },
    });
    fruitId = f.id;
  }

  // ---- weapons: two blades, one in each hand
  const bladeSpecs = [
    { name: "Elucidator", description: "Espada negra de filo imposible, forjada para quien nunca baja la guardia." },
    { name: "Dark Repulsor", description: "Espada clara y ligera, gemela de la primera, hecha para ir en la otra mano." },
  ];
  const blades: string[] = [];
  for (const [i, b] of bladeSpecs.entries()) {
    const have = c.ownedWeapons.find((w) => w.name === b.name);
    const w = have ?? (await prisma.weapon.create({ data: { name: b.name, kind: "Espada", grade: "UNIQUE", description: b.description, atkBonus: 45 - i * 4, basePrice: 5_000_000, ownerId: c.id } }));
    blades.push(w.id);
  }
  await prisma.weapon.update({ where: { id: blades[1] }, data: { wielded: true } });

  // ---- the character
  const cap = attributeCap(LEVEL);
  const maxHp = Math.max(c.maxHp, 100 + (cap - 5) * HP_PER_DURABILITY_POINT);
  const maxStamina = Math.max(c.maxStamina, 100 + (cap - 5) * STAMINA_PER_WILLPOWER_POINT);
  await prisma.character.update({
    where: { id: c.id },
    data: {
      level: Math.max(c.level, LEVEL),
      strength: cap,
      agility: cap,
      durability: cap,
      willpower: cap,
      intellect: cap,
      attrLevelGranted: Math.max(c.level, LEVEL),
      attributePoints: 0,
      maxHp,
      hp: maxHp,
      maxStamina,
      stamina: maxStamina,
      staminaUpdatedAt: new Date(),
      observationHaki: 100,
      armamentHaki: 100,
      conquerorsHaki: true,
      devilFruitId: fruitId,
      fruitMastery: 100,
      fruitAwakened: true,
      equippedWeaponId: blades[0],
      styleFocusId: "nitoryu",
      bounty: BOUNTY,
      berries: Math.max(c.berries, 250_000_000),
      title: TITLE,
      currentIslandId: island.id,
      islandsVisited: JSON.stringify([...new Set([...(JSON.parse(c.islandsVisited) as string[]), island.id])]),
      voyageToIslandId: null,
      voyageFromIslandId: null,
      voyageArrivesAt: null,
      voyageAmbushJson: null,
    },
  });
  await prisma.characterStyle.upsert({ where: { characterId_styleId: { characterId: c.id, styleId: "nitoryu" } }, update: { mastery: 100 }, create: { characterId: c.id, styleId: "nitoryu", mastery: 100 } });

  // ---- crew
  let crewId = c.crewId;
  const wantedName = crewNameArg ?? c.crew?.name ?? "Black Bulls";
  if (!crewId) {
    const clash = await prisma.crew.findFirst({ where: { name: wantedName } });
    const crew = clash ?? (await prisma.crew.create({ data: { name: wantedName, flagDesc: "Un toro negro embistiendo sobre fondo rojo sangre.", captainId: c.id, shipName: "El Coloso Negro", totalBounty: BOUNTY } }));
    crewId = crew.id;
    await prisma.character.update({ where: { id: c.id }, data: { crewId, isCaptain: crew.captainId === c.id } });
  }
  const crew = await prisma.crew.findUniqueOrThrow({ where: { id: crewId } });

  // ---- three commanders (companions keep to MAX_COMPANIONS; older recruits make room)
  const keep = c.companions.filter((n) => COMMANDERS.some((k) => k.name === n.name));
  const others = c.companions.filter((n) => !COMMANDERS.some((k) => k.name === n.name));
  const room = MAX_COMPANIONS - COMMANDERS.length;
  for (const n of others.slice(0, Math.max(0, others.length - room))) await prisma.nPCCompanion.delete({ where: { id: n.id } });
  const level = Math.max(c.level, LEVEL);
  for (const k of COMMANDERS) {
    const sheet = companionSheet(k.role, level, 90, k.profile);
    const data = { role: k.role, personality: k.personality, profileJson: JSON.stringify(k.profile), loyalty: 90, maxHp: sheet.maxHp, hp: sheet.maxHp, status: "ALIVE" as const };
    const have = keep.find((n) => n.name === k.name);
    if (have) await prisma.nPCCompanion.update({ where: { id: have.id }, data });
    else await prisma.nPCCompanion.create({ data: { characterId: c.id, name: k.name, ...data } });
  }

  // ---- territory: the island is theirs
  const territory = {
    ownerActorId: null,
    ownerCharacterId: c.id,
    ownerCrewId: crewId,
    ownerName: `${crew.name} (${c.name})`,
    title: TITLE,
    status: "HELD",
    stage: "ARMY",
    garrison: GARRISON_MAX,
    homeActorId: null,
  };
  const existingTerritory = await prisma.territory.findUnique({ where: { islandId: island.id } });
  if (existingTerritory) await prisma.territory.update({ where: { id: existingTerritory.id }, data: territory });
  else await prisma.territory.create({ data: { islandId: island.id, ...territory } });

  const already = await prisma.newsItem.findFirst({ where: { characterId: c.id, headline: { contains: "nuevo Yonko" } } });
  if (!already) {
    await postNews(
      `${c.name} es reconocido como el nuevo Yonko`,
      `Los Black Bulls han levantado su bandera sobre ${ISLAND}, en el Nuevo Mundo. Con una recompensa de ฿ ${BOUNTY.toLocaleString("es-ES")}, ${c.name} pasa a contarse entre los Emperadores del mar, y sus tres comandantes (${COMMANDERS.map((k) => k.name).join(", ")}) ya patrullan las aguas de la isla.`,
      "Guerra",
      c.id,
      "major",
      { locationName: ISLAND, islandId: island.id }
    );
  }
  console.log(`${c.name}: Yonko of ${ISLAND}, level ${level}, attributes ${cap}, crew ${crew.name}, ${COMMANDERS.length} commanders.`);
}
main().finally(() => prisma.$disconnect());
