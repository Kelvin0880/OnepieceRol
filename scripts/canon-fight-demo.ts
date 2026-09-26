// Live demo (real AI, no stubs): a strong player fights a canon admiral with long actions, to see how he uses his fruit, Haki and kit.
// Usage: npx tsx scripts/canon-fight-demo.ts [actorName]
import "dotenv/config";
import { prisma } from "../src/lib/db";
import { createCharacter } from "../src/lib/game/create-character";
import { startJointFight, submitJointAction } from "../src/lib/game/joint-fight";
import { actorCombatStats } from "../src/lib/engine/guardian";
import { admiralOpening } from "../src/lib/engine/admiral-dispatch";

const ACTIONS = [
  "Kirito clava un pie en el suelo y expande su Haki de Observación al máximo para leer el primer movimiento del almirante; cuando el magma se abalanza sobre él, recubre su katana Elucidator con Haki de Armadura hasta que la hoja se vuelve negra y, en lugar de esquivar, corta en diagonal descendente el brazo de magma, aprovechando el impulso para deslizarse por debajo y quedar a su espalda. Desde ahí, con la mano izquierda libre, intenta soltar una onda de Haki del Rey dirigida solo a él para desestabilizar su postura y abrir una brecha en su guardia, sin bajar su propia defensa.",
  "Sin darle respiro, Kirito usa el impulso del giro para encadenar una segunda estocada horizontal, esta vez apuntando a las articulaciones del brazo con el que el almirante canaliza el magma, con la idea de cortar la conexión antes de que forme el siguiente golpe. Mantiene el Haki de Observación activo para adelantarse a su respuesta y, si ve que carga un puñetazo de magma, planea saltar hacia atrás y tirar su vaina como distracción para ganar un segundo de espacio.",
  "Kirito respira hondo, envaina a medias y adopta su postura de dos espadas: desenvaina la segunda hoja y ataca con un cruce en X cargado de Haki de Armadura hacia el pecho del almirante, con la intención de romper su defensa aunque tenga que aceptar un golpe de magma en el hombro izquierdo a cambio de acercarse. Si consigue conectar, remata con un pomo directo a la mandíbula.",
];

async function main() {
  const actorName = process.argv[2] ?? "Sakazuki";
  const actor = await prisma.worldActor.findFirstOrThrow({ where: { name: actorName } });
  const stamp = Date.now() % 100000;
  const u = await prisma.user.create({ data: { username: `demo${stamp}`, passwordHash: "x" } });
  const c = await createCharacter(u.id, `Kirito${stamp}`, "PIRATE", "swordsman");
  const island = await prisma.island.findFirstOrThrow({ where: { name: "Jaya" } });
  await prisma.character.update({ where: { id: c.id }, data: { level: 45, armamentHaki: 85, observationHaki: 90, conquerorsHaki: true, currentIslandId: island.id, hp: 526, maxHp: 526, maxStamina: 340, stamina: 340 } });
  console.log(`Rival: ${actor.name} (poder ${actor.powerLevel}). Kit: ${actor.abilitiesJson}`);
  const stats = actorCombatStats(actor.powerLevel);
  const started = await startJointFight({
    kind: "arc",
    characterIds: [c.id],
    enemy: { name: actor.name, ...stats, isBoss: true, personality: actor.personality ?? undefined, worldActorId: actor.id, isActor: true },
    rewards: { berries: 1000, xp: 100, bounty: 0, islandDanger: 10 },
    stakes: `${actor.name} ha desembarcado en Jaya para erradicar a los piratas.`,
  });
  const abilities = actor.abilitiesJson ? (JSON.parse(actor.abilitiesJson) as string[]) : [];
  await prisma.jointFightMessage.create({ data: { fightId: started.fightId, authorCharacterId: null, authorName: "Narrador", text: admiralOpening(actor.name, "Jaya", abilities[0] ?? null) } });
  console.log("\n=== APERTURA\n" + admiralOpening(actor.name, "Jaya", abilities[0] ?? null));

  for (let i = 0; i < ACTIONS.length; i++) {
    console.log(`\n=== RONDA ${i + 1}: acción del jugador\n${ACTIONS[i]}`);
    const t0 = Date.now();
    await submitJointAction(c.id, u.id, ACTIONS[i]);
    const last = await prisma.jointFightMessage.findFirst({ where: { fightId: started.fightId, authorCharacterId: null }, orderBy: { createdAt: "desc" } });
    const p = await prisma.jointFightParticipant.findFirstOrThrow({ where: { fightId: started.fightId, characterId: c.id } });
    console.log(`\n--- Respuesta del árbitro (${Math.round((Date.now() - t0) / 1000)}s) — vida del jugador ${p.hp}/${p.maxHp}\n${last?.text}`);
    const f = await prisma.jointFight.findUniqueOrThrow({ where: { id: started.fightId } });
    if (f.status !== "ACTIVE") { console.log(`\n[pelea terminada: ${f.status}]`); break; }
  }
}
main().finally(() => prisma.$disconnect());
