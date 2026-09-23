// Escape from inside Impel Down + the Buster Call siege (2026-09-24). Direct
// calls against the dev DB; free-text plans/moves use the real AI classifier.
// Usage: npx tsx scripts/escape-buster-check.ts
import "dotenv/config";
import { prisma } from "../src/lib/db";
import { createCharacter } from "../src/lib/game/create-character";
import { captureCharacter, attemptPrisonEscape, PrisonError } from "../src/lib/game/prison";
import { startBusterCall, refreshBusterCall, musterBusterCall, defendAgainstWave, getBusterCallState } from "../src/lib/game/buster-call";
import { submitJointAction, getOpenJointFightFor } from "../src/lib/game/joint-fight";

function assert(cond: boolean, label: string) {
  if (!cond) throw new Error(`FAIL: ${label}`);
  console.log(`PASS: ${label}`);
}

const load = (id: string) => prisma.character.findUniqueOrThrow({ where: { id }, include: { currentIsland: true, companions: true } });

async function mkPirate(tag: string, bounty: number, boost: number) {
  const u = await prisma.user.create({ data: { username: `eb${tag}${Date.now() % 1_000_000}`, passwordHash: "x" } });
  const c = await createCharacter(u.id, `${tag}${Date.now() % 100000}`, "PIRATE", "swordsman");
  await prisma.character.update({ where: { id: c.id }, data: { bounty, level: 20, strength: boost, agility: boost, durability: boost, willpower: boost, intellect: boost, maxHp: 400, hp: 400 } });
  return { user: u, id: c.id };
}

async function fightThrough(chars: { id: string; userId: string }[]) {
  for (let i = 0; i < 14; i++) {
    const open = await getOpenJointFightFor(chars[0].id);
    if (!open) return;
    for (const c of chars) {
      const p = await prisma.jointFightParticipant.findFirst({ where: { fightId: open.id, characterId: c.id } });
      if (p?.status === "FIGHTING" && !p.action) await submitJointAction(c.id, c.userId, "Cargo contra la flota, cubriendo a mis compañeros.");
    }
  }
}

async function main() {
  const impelIsland = await prisma.island.findUniqueOrThrow({ where: { name: "Impel Down" } });
  await prisma.busterCall.updateMany({ where: { status: "ACTIVE" }, data: { status: "REPELLED" } });

  // --- Escape from a deep cell, one level at a time ---
  const p = await mkPirate("Evadido", 1_100_000_000, 900);
  await captureCharacter(await load(p.id), 120, "Capturado por la Marina.", []);
  let jail = await prisma.imprisonment.findUniqueOrThrow({ where: { characterId: p.id } });
  assert(jail.cellLevel === 4, "1.1B bounty is held in cell 4");

  const first = await attemptPrisonEscape(p.id, p.user.id, "Aflojo un barrote con la cuchara y espero a que cambie la ronda.");
  assert(first.log.length > 0, "an attempt is narrated");
  let blocked = false;
  try {
    await attemptPrisonEscape(p.id, p.user.id, "Otra vez.");
  } catch (e) {
    blocked = e instanceof PrisonError && /Espera/.test(e.message);
  }
  assert(blocked, "guards' alertness imposes a cooldown between attempts");

  let freed = !!first.free;
  for (let i = 0; i < 40 && !freed; i++) {
    await prisma.imprisonment.updateMany({ where: { characterId: p.id }, data: { lastEscapeAttemptAt: null } });
    const r = await attemptPrisonEscape(p.id, p.user.id, "Sigo el plan: me deslizo por los conductos hacia el nivel siguiente.");
    freed = !!r.free;
  }
  assert(freed, "a very capable prisoner eventually climbs out");
  const out = await load(p.id);
  assert(out.status === "ALIVE" && out.currentIsland.name === "Loguetown", "the escapee ends up free in Loguetown");
  assert(out.bounty > 1_100_000_000, "a jailbreak raises the bounty");
  assert((await prisma.newsItem.count({ where: { headline: { contains: "se fuga de Impel Down" } } })) > 0, "the breakout makes major news");
  assert(!(await prisma.imprisonment.findUnique({ where: { characterId: p.id } })), "the imprisonment record is gone");

  // --- Deepest cell: the Buster Call is certain ---
  const deep = await mkPirate("Abismo", 2_050_000_000, 900);
  await captureCharacter(await load(deep.id), 120, "Capturado por la Marina.", []);
  const deepJail = await prisma.imprisonment.findUniqueOrThrow({ where: { characterId: deep.id } });
  assert(deepJail.cellLevel === 6, "2.05B bounty is held in the deepest cell");
  let free2 = false;
  for (let i = 0; i < 60 && !free2; i++) {
    await prisma.imprisonment.updateMany({ where: { characterId: deep.id }, data: { lastEscapeAttemptAt: null } });
    free2 = !!(await attemptPrisonEscape(deep.id, deep.user.id, "Empujo la puerta cuando los guardias miran hacia otro lado.")).free;
  }
  assert(free2, "even the deepest cell can be escaped");
  const bc = await prisma.busterCall.findFirst({ where: { islandId: impelIsland.id, status: "ACTIVE" } });
  assert(!!bc, "escaping the deepest level brings the Buster Call down on Impel Down");

  // --- Defending: three waves, then repelled ---
  const d1 = await mkPirate("Defensor", 0, 900);
  const d2 = await mkPirate("Apoyo", 0, 900);
  await prisma.character.updateMany({ where: { id: { in: [d1.id, d2.id] } }, data: { currentIslandId: impelIsland.id } });
  const st = await getBusterCallState(d1.id);
  assert(!!st && st.wave === 1, "defenders on the island see the siege at wave 1");
  await musterBusterCall(d1.id, d1.user.id, true);
  await musterBusterCall(d2.id, d2.user.id, true);
  for (let wave = 1; wave <= 3; wave++) {
    await defendAgainstWave(d1.id, d1.user.id);
    await fightThrough([d1, d2].map((x) => ({ id: x.id, userId: x.user.id })));
    const cur = await prisma.busterCall.findUniqueOrThrow({ where: { id: bc!.id } });
    assert(cur.wavesBroken === wave || cur.status === "REPELLED", `wave ${wave} broken`);
  }
  assert((await prisma.busterCall.findUniqueOrThrow({ where: { id: bc!.id } })).status === "REPELLED", "three broken waves repel the Buster Call");

  // --- Ignored: the fleet bombards whoever stayed ---
  const stayer = await mkPirate("Rezagado", 0, 5);
  await prisma.character.update({ where: { id: stayer.id }, data: { currentIslandId: impelIsland.id, hp: 400, maxHp: 400 } });
  const late = await startBusterCall(impelIsland.id, "Prueba de bombardeo.");
  await prisma.busterCall.update({ where: { id: late!.id }, data: { endsAt: new Date(Date.now() - 1000) } });
  const fallen = await refreshBusterCall(await prisma.busterCall.findUniqueOrThrow({ where: { id: late!.id } }));
  assert(fallen.status === "FALLEN", "a siege that runs out of time falls");
  const hit = await prisma.character.findUniqueOrThrow({ where: { id: stayer.id } });
  assert(hit.status === "DEAD" || hit.hp <= 400 * 0.31, `everyone left on the island is bombarded (status ${hit.status}, hp ${hit.hp})`);
  assert((await prisma.newsItem.count({ where: { headline: { contains: "es bombardeada" } } })) > 0, "the bombardment makes news");

  console.log("ALL PASS");
  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
