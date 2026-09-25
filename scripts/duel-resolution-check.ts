process.env.REFEREE_STUB = "1"; // the AI referee is replaced by the deterministic stand-in
process.env.JUDGE_STUB = "1"; // results are judged by the AI; scripted checks use the deterministic stand-in
// Player duels: friendly surrender, fights to the death, kill / capture / spare, fleeing and the news reports (dev DB, seeded).
// Usage: npx tsx scripts/duel-resolution-check.ts
import "dotenv/config";
import { prisma } from "../src/lib/db";
import { challengeDuel, respondToDuel, submitDuelAction, getDuelStateForCharacter } from "../src/lib/game/duel";
import { yieldDuel, pleaToFlee, decideFlee, decideVerdict, DuelError } from "../src/lib/game/duel-resolution";

function assert(cond: boolean, label: string) {
  if (!cond) throw new Error(`FAIL: ${label}`);
  console.log(`PASS: ${label}`);
}
async function rejects(fn: () => Promise<unknown>, part?: string) {
  try {
    await fn();
    return false;
  } catch (e) {
    return e instanceof DuelError && (!part || e.message.includes(part));
  }
}

const stamp = Date.now() % 100000;
const island = async (name: string) => prisma.island.findFirstOrThrow({ where: { name: { contains: name } } });

async function mk(tag: string, faction: string, extra: Record<string, unknown> = {}) {
  const foosha = await island("Foosha");
  const u = await prisma.user.create({ data: { username: `dr${tag}${stamp}${Math.floor(Math.random() * 1e6)}`, passwordHash: "x" } });
  const c = await prisma.character.create({
    data: { name: `${tag}${stamp}`, faction: faction as never, userId: u.id, currentIslandId: foosha.id, level: 10, hp: 120, maxHp: 120, strength: 30, durability: 30, lastSeenAt: new Date(), ...extra },
  });
  return { u, c };
}

async function startDuel(a: Awaited<ReturnType<typeof mk>>, b: Awaited<ReturnType<typeof mk>>, lethal: boolean) {
  const { duelId } = await challengeDuel(a.c.id, a.u.id, b.c.id, lethal);
  await respondToDuel(b.c.id, b.u.id, duelId, true);
  return duelId;
}

async function main() {
  const made: { u: { id: string }; c: { id: string } }[] = [];
  const track = <T extends { u: { id: string }; c: { id: string } }>(x: T) => (made.push(x), x);
  try {
    // ---- friendly: "Perdí" ends it, nothing else happens
    const a = track(await mk("Amigo", "PIRATE"));
    const b = track(await mk("Rival", "PIRATE"));
    const d1 = await startDuel(a, b, false);
    assert(await rejects(() => yieldDuel(a.c.id, "someone-else", d1), "no es tuyo"), "only a duelist can give up");
    const r = await yieldDuel(a.c.id, a.u.id, d1);
    assert(r.finished, "giving up a friendly duel ends it at once");
    const f1 = await prisma.duel.findUniqueOrThrow({ where: { id: d1 } });
    assert(f1.status === "FINISHED" && f1.winnerId === b.c.id && f1.resolution === null, "the other side wins and nothing is left pending");
    const untouched = await prisma.character.findUniqueOrThrow({ where: { id: a.c.id } });
    assert(untouched.status === "ALIVE" && untouched.hp === 120, "a friendly loss costs nothing");
    const news1 = await prisma.newsItem.findFirst({ where: { headline: { contains: a.c.name } }, orderBy: { createdAt: "desc" } });
    assert(!!news1 && !!news1.locationName?.includes("Foosha") && news1.body.length > 20, "the duel report reaches the news with its place");
    assert(!(await getDuelStateForCharacter(a.c.id))?.resolution, "the finished duel shows no pending decision");

    // ---- both must move: a round resolves only when both have answered
    const c = track(await mk("Cazador", "PIRATE"));
    const e = track(await mk("Presa", "PIRATE"));
    const d2 = await startDuel(c, e, true);
    const first = await submitDuelAction(c.c.id, c.u.id, "Ataco con mi espada y me cubro con el brazo.");
    assert(first.waiting === true, "the first move waits for the rival");
    assert((await prisma.duel.findUniqueOrThrow({ where: { id: d2 } })).round === 1, "the round has not advanced yet");
    await submitDuelAction(e.c.id, e.u.id, "Esquivo y contraataco al costado.");
    const afterRound = await prisma.duel.findUniqueOrThrow({ where: { id: d2 } });
    assert(afterRound.round === 2 && (afterRound.challengerHp < 120 || afterRound.opponentHp < 120), "when both moved, the referee took life from someone");

    // ---- fight to the death: the loser gives up, the winner decides
    await yieldDuel(e.c.id, e.u.id, d2);
    const st = await prisma.duel.findUniqueOrThrow({ where: { id: d2 } });
    assert(st.resolution === "VERDICT" && st.winnerId === c.c.id && st.status === "ACTIVE", "in a lethal duel giving up waits for the winner's verdict");
    assert(await rejects(() => submitDuelAction(c.c.id, c.u.id, "sigo"), "decisión pendiente"), "no moves while a decision is pending");
    assert(await rejects(() => decideVerdict(e.c.id, e.u.id, d2, "spare"), "No te toca"), "the loser cannot decide their own fate");
    const view = await getDuelStateForCharacter(c.c.id);
    assert(!!view?.verdict?.canCapture && view.verdict.captureLabel!.includes("Marina"), "a pirate winner is offered to hand the captive to the Marines");
    const beforeBerries = (await prisma.character.findUniqueOrThrow({ where: { id: c.c.id } })).berries;
    await prisma.character.update({ where: { id: e.c.id }, data: { bounty: 50_000_000 } });
    await decideVerdict(c.c.id, c.u.id, d2, "capture");
    const captured = await prisma.character.findUniqueOrThrow({ where: { id: e.c.id } });
    assert(captured.status === "IMPRISONED", "the captive is imprisoned");
    assert((await prisma.character.findUniqueOrThrow({ where: { id: c.c.id } })).berries > beforeBerries, "the winner collects the bounty");
    assert((await prisma.duel.findUniqueOrThrow({ where: { id: d2 } })).status === "FINISHED", "the duel closes after the verdict");

    // ---- kill
    const g = track(await mk("Verdugo", "PIRATE"));
    const h = track(await mk("Condenado", "PIRATE"));
    const d3 = await startDuel(g, h, true);
    await yieldDuel(h.c.id, h.u.id, d3);
    await decideVerdict(g.c.id, g.u.id, d3, "kill");
    const dead = await prisma.character.findUniqueOrThrow({ where: { id: h.c.id } });
    assert(dead.status === "DEAD" && !!dead.deathCause, "the winner can kill: real permadeath");
    const deathNews = await prisma.newsItem.findFirst({ where: { category: "Muertes", headline: { contains: h.c.name } } });
    assert(!!deathNews && deathNews.severity === "major" && !!deathNews.locationName?.includes("Foosha"), "the kill is major news with its place");

    // ---- spare
    const i = track(await mk("Piadoso", "PIRATE"));
    const j = track(await mk("Perdonado", "PIRATE"));
    const d4 = await startDuel(i, j, true);
    await yieldDuel(j.c.id, j.u.id, d4);
    await decideVerdict(i.c.id, i.u.id, d4, "spare");
    const spared = await prisma.character.findUniqueOrThrow({ where: { id: j.c.id } });
    assert(spared.status === "ALIVE" && spared.hp >= 1, "sparing leaves the loser alive");

    // ---- a Marine cannot be captured by a pirate, only killed or spared
    const k = track(await mk("Pirata", "PIRATE"));
    const m = track(await mk("Soldado", "MARINE"));
    const d5 = await startDuel(k, m, true);
    await yieldDuel(m.c.id, m.u.id, d5);
    const v5 = await getDuelStateForCharacter(k.c.id);
    assert(v5?.verdict?.canCapture === false, "capturing a Marine is not offered");
    assert(await rejects(() => decideVerdict(k.c.id, k.u.id, d5, "capture"), "Marina"), "and it is refused server-side too");
    await decideVerdict(k.c.id, k.u.id, d5, "spare");

    // ---- a Marine winner sends a wanted pirate to prison
    const n = track(await mk("Capitan", "MARINE"));
    const o = track(await mk("Forajido", "PIRATE", { bounty: 300_000_000 }));
    const d6 = await startDuel(n, o, true);
    await yieldDuel(o.c.id, o.u.id, d6);
    assert((await getDuelStateForCharacter(n.c.id))?.verdict?.captureLabel?.includes("Impel Down") === true, "a Marine is offered to imprison");
    await decideVerdict(n.c.id, n.u.id, d6, "capture");
    const jailed = await prisma.character.findUniqueOrThrow({ where: { id: o.c.id }, include: { imprisonment: true, currentIsland: true } });
    assert(jailed.status === "IMPRISONED" && jailed.currentIsland.name === "Impel Down", "a very wanted pirate goes to Impel Down");

    // ---- fleeing: described, then the other side allows or refuses
    const p = track(await mk("Perseguidor", "PIRATE"));
    const q = track(await mk("Fugitivo", "PIRATE"));
    const d7 = await startDuel(p, q, true);
    assert(await rejects(() => pleaToFlee(q.c.id, q.u.id, d7, "ya"), "Describe"), "a flight needs a real description");
    await pleaToFlee(q.c.id, q.u.id, d7, "Lanzo humo y me lanzo al mar por el muelle.");
    assert(await rejects(() => decideFlee(q.c.id, q.u.id, d7, true), "tu rival"), "the fugitive cannot allow their own escape");
    const plea = await getDuelStateForCharacter(p.c.id);
    assert(plea?.resolution === "FLEE_PLEA" && !!plea.pleaText?.includes("humo"), "the other side sees what the fugitive wrote");
    await decideFlee(p.c.id, p.u.id, d7, false);
    assert((await prisma.duel.findUniqueOrThrow({ where: { id: d7 } })).resolution === null, "refusing the escape lets the fight go on");
    await pleaToFlee(q.c.id, q.u.id, d7, "Me cuelo entre la multitud y desaparezco.");
    await decideFlee(p.c.id, p.u.id, d7, true);
    const fled = await prisma.duel.findUniqueOrThrow({ where: { id: d7 } });
    assert(fled.status === "FINISHED" && fled.winnerId === null, "allowing the escape ends the duel with no winner");
    assert((await prisma.character.findUniqueOrThrow({ where: { id: q.c.id } })).status === "ALIVE", "and nobody dies");
    assert(await rejects(() => pleaToFlee(a.c.id, a.u.id, d1, "intento huir de un duelo ya cerrado"), "en marcha"), "no flight from a finished duel");
    const friendlyFlee = await startDuel(track(await mk("Amigo2", "PIRATE")), track(await mk("Amigo3", "PIRATE")), false);
    const fa = made[made.length - 2];
    assert(await rejects(() => pleaToFlee(fa.c.id, fa.u.id, friendlyFlee, "intento huir de un duelo amistoso"), "a muerte"), "fleeing exists only in fights to the death");

    // ---- a hunt: the hunted describes an escape BEFORE the fight, and the hunter decides
    const h1 = track(await mk("Sabueso", "MARINE"));
    const h2 = track(await mk("Huido", "PIRATE"));
    const huntA = (await challengeDuel(h1.c.id, h1.u.id, h2.c.id, true)).duelId;
    assert(await rejects(() => respondToDuel(h2.c.id, h2.u.id, huntA, false), "Intentar huir"), "declining a hunt with a roll no longer exists: the escape must be written");
    await pleaToFlee(h2.c.id, h2.u.id, huntA, "Me mezclo con la multitud del mercado y salto a un barco que zarpa.");
    const huntView = await getDuelStateForCharacter(h1.c.id);
    assert(huntView?.status === "PROPOSED" && huntView.resolution === "FLEE_PLEA", "the hunter sees the plea while the hunt is still a proposal");
    await decideFlee(h1.c.id, h1.u.id, huntA, false);
    assert((await prisma.duel.findUniqueOrThrow({ where: { id: huntA } })).status === "ACTIVE", "if the hunter refuses, the fight starts");
    await pleaToFlee(h2.c.id, h2.u.id, huntA, "Vuelvo a intentarlo por los tejados mientras suelto humo.");
    await decideFlee(h1.c.id, h1.u.id, huntA, true);
    assert((await prisma.duel.findUniqueOrThrow({ where: { id: huntA } })).status === "FINISHED", "if the hunter allows it, the hunt ends with no winner");
  } finally {
    for (const x of made) {
      await prisma.imprisonment.deleteMany({ where: { characterId: x.c.id } });
      await prisma.duel.deleteMany({ where: { OR: [{ challengerId: x.c.id }, { opponentId: x.c.id }] } });
      await prisma.character.delete({ where: { id: x.c.id } }).catch(() => undefined);
      await prisma.user.delete({ where: { id: x.u.id } }).catch(() => undefined);
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
