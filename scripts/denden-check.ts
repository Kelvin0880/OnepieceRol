process.env.JUDGE_STUB = "1"; // results are judged by the AI; scripted checks use the deterministic stand-in
// Den Den Mushi against the dev DB: a message only reaches its own faction, and abuse is refused.
// Usage: npx tsx scripts/denden-check.ts
import "dotenv/config";
import { prisma } from "../src/lib/db";
import { getDenDen, sendDenDen, DenDenError } from "../src/lib/game/denden";

function assert(cond: boolean, label: string) {
  if (!cond) throw new Error(`FAIL: ${label}`);
  console.log(`PASS: ${label}`);
}
async function rejects(fn: () => Promise<unknown>, part?: string) {
  try {
    await fn();
    return false;
  } catch (e) {
    return e instanceof DenDenError && (!part || e.message.includes(part));
  }
}

async function main() {
  const foosha = await prisma.island.findFirstOrThrow({ where: { name: { contains: "Foosha" } } });
  const stamp = Date.now() % 100000;
  const made: { u: string; c: string }[] = [];
  const mk = async (tag: string, faction: string, extra: Record<string, unknown> = {}) => {
    const u = await prisma.user.create({ data: { username: `dd${tag}${stamp}${Math.floor(Math.random() * 1e6)}`, passwordHash: "x" } });
    const c = await prisma.character.create({ data: { name: `${tag}${stamp}`, faction: faction as never, userId: u.id, currentIslandId: foosha.id, ...extra } });
    made.push({ u: u.id, c: c.id });
    return { u, c };
  };
  try {
    const p1 = await mk("Pirata1", "PIRATE");
    const p2 = await mk("Pirata2", "PIRATE");
    const m1 = await mk("Marino1", "MARINE");
    await prisma.denDenMessage.deleteMany({ where: { authorCharacterId: { in: made.map((x) => x.c) } } });

    await sendDenDen(p1.c.id, p1.u.id, "Reunión en el puerto");
    const seenByPirate = await getDenDen(p2.c.id, p2.u.id);
    assert(seenByPirate.channel === "Piratas" && seenByPirate.messages.some((m) => m.text === "Reunión en el puerto" && !m.mine), "another pirate hears the message");
    assert((await getDenDen(p1.c.id, p1.u.id)).messages.some((m) => m.mine), "the sender sees it as theirs");
    const seenByMarine = await getDenDen(m1.c.id, m1.u.id);
    assert(seenByMarine.channel === "Marina" && !seenByMarine.messages.some((m) => m.text === "Reunión en el puerto"), "a Marine does not hear the pirates");

    await sendDenDen(m1.c.id, m1.u.id, "Patrulla a las seis");
    assert(!(await getDenDen(p2.c.id, p2.u.id)).messages.some((m) => m.text === "Patrulla a las seis"), "and pirates do not hear the Marines");

    assert(await rejects(() => sendDenDen(p1.c.id, p1.u.id, "otra vez enseguida"), "Espera"), "spamming is refused");
    assert(await rejects(() => sendDenDen(p2.c.id, p2.u.id, "   "), "vacío"), "an empty message is refused");
    assert(await rejects(() => sendDenDen(p2.c.id, p2.u.id, "x".repeat(401)), "largo"), "an oversized message is refused");
    assert(await rejects(() => getDenDen(p1.c.id, p2.u.id), "no encontrado"), "nobody can read the line through someone else's character");
    assert(await rejects(() => sendDenDen(p1.c.id, p2.u.id, "suplantando"), "no encontrado"), "nor speak as them");

    await prisma.character.update({ where: { id: p2.c.id }, data: { status: "IMPRISONED" } });
    assert(await rejects(() => sendDenDen(p2.c.id, p2.u.id, "desde la celda"), "vivo"), "a prisoner has no line");
  } finally {
    await prisma.denDenMessage.deleteMany({ where: { authorCharacterId: { in: made.map((x) => x.c) } } });
    for (const x of made) {
      await prisma.character.delete({ where: { id: x.c } }).catch(() => undefined);
      await prisma.user.delete({ where: { id: x.u } }).catch(() => undefined);
    }
  }
  console.log("ALL PASS");
}
main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
