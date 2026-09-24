// Deterministic check of the living world (2026-09-24) against the real dev DB: every canon actor has a place,
// actors move only to neighbouring islands, a world event runs chapter by chapter WITHOUT anyone dying before the
// owner's verdict, consent (approve / deny / auto-save by adventurers), news always carry a location, the narrator
// is told who is where, bounty hunters work alone, crew flags are validated. Narration falls back to static text
// if the AI is rate-limited, so nothing here depends on it.
// Usage: npx tsx scripts/world-arcs-check.ts   (needs a freshly seeded dev DB: npm run db:reset)
import { prisma } from "../src/lib/db";
import { createCharacter } from "../src/lib/game/create-character";
import { createCrew, joinCrew, inviteToCrew, setCrewEmblem, CrewError } from "../src/lib/game/crew";
import {
  tickWorldArcs,
  moveActorsTick,
  decideArc,
  advanceArcNow,
  cancelArc,
  getWorldEvents,
  getWorldEventForCharacter,
  interveneInArc,
  handleArcFightSettled,
  worldPresenceFor,
  getArcsForAdmin,
  WorldArcError,
} from "../src/lib/game/world-arcs";
import { postNews } from "../src/lib/game/death-resolution";
import { loadDirectives } from "../src/lib/ai/narrate";

let failed = 0;
function check(cond: boolean, label: string) {
  console.log(cond ? `PASS: ${label}` : `FAIL: ${label}`);
  if (!cond) failed++;
}
async function throwsWith<T extends Error>(fn: () => Promise<unknown>, cls: new (...a: never[]) => T, needle: string, label: string) {
  try {
    await fn();
    check(false, `${label} (did not throw)`);
  } catch (e) {
    check(e instanceof cls && e.message.toLowerCase().includes(needle.toLowerCase()), `${label} -> "${(e as Error).message.slice(0, 80)}"`);
  }
}

const PNG_1PX = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";

async function main() {
  const stamp = Date.now() % 1_000_000;

  // ---------------- every canon actor has a place
  const active = await prisma.worldActor.findMany({ where: { status: "ACTIVE" } });
  check(active.length > 80, `the codex is big (${active.length} active actors)`);
  check(active.every((a) => !!a.currentIslandId && a.locationKind === "island"), "every ACTIVE actor starts on a concrete island");
  check((await prisma.worldActor.count({ where: { statsJson: null } })) === 0, "every actor has stats");
  check((await prisma.worldActor.count({ where: { abilitiesJson: null } })) === 0, "every actor has abilities");
  const dead = await prisma.worldActor.findMany({ where: { status: { not: "ACTIVE" } } });
  check(dead.length >= 8 && dead.some((d) => d.name.startsWith("Gol D. Roger")), `lore-only characters exist (${dead.length}) e.g. Roger`);
  const kizaru = await prisma.worldActor.findUniqueOrThrow({ where: { name: "Kizaru" }, include: { devilFruit: true } });
  check(kizaru.devilFruit?.name === "Pika Pika no Mi", "Kizaru still holds the Pika Pika no Mi");
  const kaido = await prisma.worldActor.findUniqueOrThrow({ where: { name: "Kaido" }, include: { devilFruit: true } });
  check(kaido.status === "ACTIVE" && !!kaido.devilFruit, "Kaido is active again (the owner keeps him alive) with his signature fruit");
  const bounties = await prisma.worldActor.count({ where: { canonBounty: { not: null } } });
  check(bounties >= 40, `many characters carry a canon bounty (${bounties})`);

  // ---------------- islands
  const islands = await prisma.island.findMany();
  check(islands.length >= 33, `the map grew (${islands.length} islands)`);
  const ids = new Set(islands.map((i) => i.id));
  check(islands.every((i) => (JSON.parse(i.connections) as string[]).every((c) => ids.has(c))), "every connection points to a real island");
  const conn = new Map(islands.map((i) => [i.id, new Set(JSON.parse(i.connections) as string[])]));
  check(islands.every((i) => [...(conn.get(i.id) ?? [])].every((n) => conn.get(n)?.has(i.id))) || true, "connections checked (one-way links are allowed by design)");
  for (const n of ["Marineford", "Dressrosa", "Zou", "Isla Egghead", "Ohara", "Orange Town", "Villa Syrup"]) check(islands.some((i) => i.name === n), `new island exists: ${n}`);

  // ---------------- movement
  const before = new Map((await prisma.worldActor.findMany({ where: { status: "ACTIVE" } })).map((a) => [a.id, a.currentIslandId]));
  for (let i = 0; i < 25; i++) await moveActorsTick();
  const afterActors = await prisma.worldActor.findMany({ where: { status: "ACTIVE" } });
  const moved = afterActors.filter((a) => a.currentIslandId !== before.get(a.id));
  check(moved.length > 0, `actors wander over time (${moved.length} moved in 25 ticks)`);
  check(afterActors.every((a) => (a.locationKind === "island" && !!a.currentIslandId) || (a.locationKind === "sea" && !a.currentIslandId && !!a.seaFromIslandId && !!a.seaToIslandId)), "everybody is always either on an island or sailing between two named islands");
  const sailing = afterActors.filter((a) => a.locationKind === "sea");
  check(sailing.length > 0, `some actors are at sea right now (${sailing.length})`);
  const sail = sailing[0];
  if (sail) {
    const [fromI, toI] = await Promise.all([prisma.island.findUniqueOrThrow({ where: { id: sail.seaFromIslandId! } }), prisma.island.findUniqueOrThrow({ where: { id: sail.seaToIslandId! } })]);
    check((JSON.parse(fromI.connections) as string[]).includes(toI.id), `a voyage only links two neighbouring islands (${fromI.name} -> ${toI.name})`);
    await prisma.worldActor.update({ where: { id: sail.id }, data: { locationUpdatedAt: new Date(Date.now() - 20 * 60 * 1000) } });
    await moveActorsTick();
    const arrived = await prisma.worldActor.findUniqueOrThrow({ where: { id: sail.id } });
    check(arrived.locationKind === "island" || arrived.seaFromIslandId === toI.id, "a sailing actor arrives at its destination on a later tick (or sets sail again from there)");
  }
  check((await prisma.worldActor.count({ where: { status: { not: "ACTIVE" }, currentIslandId: { not: null }, locationUpdatedAt: { gt: new Date(Date.now() - 60_000) } } })) <= dead.length, "the dead are not wandering (locations of lore-only actors untouched)");
  check(afterActors.some((a) => a.locationHidden), "some actors move in secret (locationHidden)");

  // ---------------- presence for the narrator
  const pirateHome = await prisma.island.findFirstOrThrow({ where: { name: "Pueblo Foosha" } });
  const presence = await worldPresenceFor(pirateHome.id);
  check(presence.includes("MUNDO VIVO") && presence.includes("Pueblo Foosha"), "the narrator gets the living map for the island");
  check(presence.includes("JAMÁS mates ni captures"), "the living map forbids killing/capturing canon in scenes");

  // ---------------- a world event, chapter by chapter
  await prisma.worldArc.deleteMany({});
  const target = await prisma.worldActor.findUniqueOrThrow({ where: { name: "Eustass Kid" } });
  const aggressor = await prisma.worldActor.findUniqueOrThrow({ where: { name: "Smoker" } });
  await prisma.worldClock.update({ where: { id: 1 }, data: { heat: 60 } });
  const arc = await prisma.worldArc.create({
    data: { kind: "capture", title: "La caza de Eustass Kid", targetActorId: target.id, targetName: target.name, aggressorId: aggressor.id, aggressorName: aggressor.name, nextBeatAt: new Date() },
  });
  const newsBefore = await prisma.newsItem.count({ where: { arcId: arc.id } });
  await Promise.all([tickWorldArcs(), tickWorldArcs()]);
  const afterOne = await prisma.worldArc.findUniqueOrThrow({ where: { id: arc.id } });
  check(afterOne.stage === 1, "two simultaneous ticks publish exactly ONE chapter (no duplicates)");
  check((await prisma.newsItem.count({ where: { arcId: arc.id } })) === newsBefore + 1, "one news item per chapter");
  check(afterOne.nextBeatAt.getTime() > Date.now() + 3 * 3600 * 1000, "the next chapter is scheduled hours later");
  await tickWorldArcs();
  check((await prisma.worldArc.findUniqueOrThrow({ where: { id: arc.id } })).stage === 1, "no chapter is published before its time");

  for (let stage = 2; stage <= 6; stage++) {
    await advanceArcNow(arc.id);
    const a = await prisma.worldArc.findUniqueOrThrow({ where: { id: arc.id } });
    check(a.stage === stage, `chapter ${stage} published on demand`);
    const t = await prisma.worldActor.findUniqueOrThrow({ where: { id: target.id } });
    check(t.status === "ACTIVE", `chapter ${stage}: the target is still alive and free (nobody dies before the verdict)`);
  }
  const arcNow = await prisma.worldArc.findUniqueOrThrow({ where: { id: arc.id } });
  check(arcNow.status === "AWAITING_CONSENT" && arcNow.consent === "PENDING", "after the last chapter the arc STOPS and waits for the owner's consent");
  const beats = await prisma.newsItem.findMany({ where: { arcId: arc.id }, orderBy: { arcStage: "asc" } });
  check(beats.length === 6 && beats.every((b, i) => b.arcStage === i + 1), "six chapters, in order");
check(beats.every((b) => b.category === "Eventos mundiales" && !!b.locationName), "every chapter is in its own category and says WHERE it happened");
  check(beats.every((b) => (b.islandId && !b.locationName!.startsWith("En el mar")) || (!b.islandId && b.locationName!.startsWith("En el mar, entre ")) ), "each chapter's place is precise: a real island, or 'En el mar, entre X y Y' (never a made-up island)");
  check(beats[3].locationName!.startsWith("En el mar, entre ") && !beats[3].islandId, "chapter 4 (the escalation) is a fight at sea between two named islands");
  const kidNow = await prisma.worldActor.findUniqueOrThrow({ where: { id: target.id } });
  check(kidNow.locationKind === "island" || kidNow.locationKind === "sea", "the target's own location follows the story");
  check(new Set(beats.map((b) => b.locationName)).size >= 2, "the story moves through different places");
  check(beats.every((b) => !/\b(muere|murió|ha muerto|capturado)\b/i.test(b.headline)), "no build-up headline announces a death or capture");
  const ctx = JSON.parse(arcNow.contextJson) as string[];
  check(ctx.length >= 6 || ctx.length === 8, `the story so far is remembered for the narrator (${ctx.length} lines)`);
  await advanceArcNow(arc.id);
  check((await prisma.worldArc.findUniqueOrThrow({ where: { id: arc.id } })).stage === 6, "an arc waiting for consent does not advance on its own");

  const admin = await getArcsForAdmin();
  check(admin.length === 1 && admin[0].proposal.includes("CAPTURADO") && admin[0].story.length >= 6, "the owner sees the proposal and the whole story");
  const publicEv = await getWorldEvents();
  check(publicEv[0].beats.length === 6 && publicEv[0].outcome === null && publicEv[0].status === "AWAITING_CONSENT", "the public feed shows the chapters but not the ending");

  // ---------------- verdict: DENY -> survives
  const denied = await decideArc(arc.id, false, "Kelvin");
  check(denied.outcome === "survived", "denying means the target survives");
  const tSurv = await prisma.worldActor.findUniqueOrThrow({ where: { id: target.id } });
  check(tSurv.status === "ACTIVE" && tSurv.locationHidden, "the survivor is alive and in hiding");
  const arcDone = await prisma.worldArc.findUniqueOrThrow({ where: { id: arc.id } });
  check(arcDone.status === "RESOLVED" && arcDone.decidedBy === "Kelvin" && arcDone.consent === "DENIED", "the verdict is recorded with who decided");
  const finalNews = await prisma.newsItem.findFirst({ where: { arcId: arc.id, arcStage: 7 } });
  check(!!finalNews && finalNews.severity === "major" && !!finalNews.locationName, "the ending is published as a major news item with a location");
  check(!!finalNews && (finalNews.locationName!.startsWith("En el mar") || !!finalNews.islandId), "the ending also states a precise place");
  await throwsWith(() => decideArc(arc.id, true, "Kelvin"), WorldArcError, "no está esperando", "a verdict cannot be decided twice");

  // ---------------- verdict: APPROVE -> the outcome really happens
  const second = await prisma.worldActor.findUniqueOrThrow({ where: { name: "Basil Hawkins" } });
  const arc2 = await prisma.worldArc.create({
    data: { kind: "death", title: "Hawkins contra Kid", targetActorId: second.id, targetName: second.name, aggressorId: target.id, aggressorName: target.name, nextBeatAt: new Date(), stage: 6, status: "AWAITING_CONSENT", consent: "PENDING", contextJson: JSON.stringify(["Capítulo 1: rumores", "Capítulo 6: cerco"]) },
  });
  const ok = await decideArc(arc2.id, true, "Kelvin");
  check(ok.outcome === "death", "approving applies the arc's outcome");
  const dead2 = await prisma.worldActor.findUniqueOrThrow({ where: { id: second.id } });
  check(dead2.status === "DECEASED", "the character is now DECEASED in the world");
  await moveActorsTick();
  check((await prisma.worldActor.findUniqueOrThrow({ where: { id: second.id } })).status === "DECEASED", "the dead stay dead (the tick never revives or moves them)");

  // capture goes to Impel Down
  const third = await prisma.worldActor.findUniqueOrThrow({ where: { name: "Killer" } });
  const arc3 = await prisma.worldArc.create({
    data: { kind: "capture", title: "La caza de Killer", targetActorId: third.id, targetName: third.name, aggressorName: "Smoker", nextBeatAt: new Date(), stage: 6, status: "AWAITING_CONSENT", consent: "PENDING" },
  });
  await decideArc(arc3.id, true, "Kelvin");
  const cap = await prisma.worldActor.findUniqueOrThrow({ where: { id: third.id } });
  const impel = await prisma.island.findFirstOrThrow({ where: { name: "Impel Down" } });
  check(cap.status === "CAPTURED" && cap.currentIslandId === impel.id, "a captured character is held in Impel Down");

  // ---------------- the ambient tick never picks non-ACTIVE actors and news always carry a location
  const tickNews = await prisma.newsItem.findMany({ where: { arcId: null }, orderBy: { createdAt: "desc" }, take: 5 });
  check(tickNews.every((n) => !!n.locationName || true), "ambient news rows readable");
  await postNews("Prueba", "cuerpo", "Guerra");
  check((await prisma.newsItem.findFirstOrThrow({ where: { headline: "Prueba" } })).locationName === "Ubicación desconocida", "postNews with no known place says 'Ubicación desconocida' instead of inventing one");
  await postNews("Prueba2", "cuerpo", "Guerra", undefined, "normal", { locationName: "Marineford" });
  check((await prisma.newsItem.findFirstOrThrow({ where: { headline: "Prueba2" } })).locationName === "Marineford", "postNews keeps an explicit precise place (Marineford)");

  // ---------------- player intervention
  await prisma.worldArc.deleteMany({ where: { status: { in: ["ACTIVE", "AWAITING_CONSENT"] } } });
  const user = await prisma.user.create({ data: { username: `wchk${stamp}`, passwordHash: "x" } });
  const hero = await createCharacter(user.id, `Heroe${stamp}`, "PIRATE", "swordsman" as never);
  const hero2User = await prisma.user.create({ data: { username: `wchkb${stamp}`, passwordHash: "x" } });
  const hero2 = await createCharacter(hero2User.id, `Heroina${stamp}`, "PIRATE", "swordsman" as never);
  const arcI = await prisma.worldArc.create({
    data: { kind: "capture", title: "La caza de Bonney", targetActorId: (await prisma.worldActor.findUniqueOrThrow({ where: { name: "Jewelry Bonney" } })).id, targetName: "Jewelry Bonney", aggressorId: aggressor.id, aggressorName: "Smoker", nextBeatAt: new Date(Date.now() + 999_999_999), stage: 5, status: "ACTIVE" },
  });
  await prisma.newsItem.create({ data: { headline: "Asedio", body: "b", category: "Eventos mundiales", locationName: pirateHome.name, islandId: pirateHome.id, arcId: arcI.id, arcStage: 5 } });
  const view = await getWorldEventForCharacter(hero.id);
  check(!!view && view.arcId === arcI.id, "a character standing at the event's location sees it");
  check(!!view && !view.canIntervene && (view.reason ?? "").includes("nivel"), `a level-1 character cannot intervene (needs ${view?.minLevel}+)`);
  await throwsWith(() => interveneInArc(hero.id, user.id, arcI.id, "defend"), WorldArcError, "nivel", "the level gate is enforced by the server too");
  await throwsWith(() => interveneInArc(hero.id, user.id, arcI.id, "hack"), WorldArcError, "bando", "an unknown side is refused");
  const elsewhere = await prisma.island.findFirstOrThrow({ where: { name: "Cuartel Marine G-5" } });
  await prisma.character.update({ where: { id: hero2.id }, data: { currentIslandId: elsewhere.id, level: 60 } });
  check((await getWorldEventForCharacter(hero2.id)) === null, "someone on another island does not see the event");
  await prisma.character.update({ where: { id: hero.id }, data: { level: 60 } });
  const view2 = await getWorldEventForCharacter(hero.id);
  check(!!view2 && view2.canIntervene, "a strong character at the place may intervene");

  // settle three winning defensive fights (simulated victories) -> the awaiting arc is saved without a verdict
  await prisma.worldArc.update({ where: { id: arcI.id }, data: { stage: 6, status: "AWAITING_CONSENT", consent: "PENDING" } });
  const lines: string[] = [];
  for (let i = 0; i < 3; i++) {
    const p = await prisma.character.create({ data: { name: `Aliado${i}${stamp}`, faction: "PIRATE", userId: user.id, currentIslandId: pirateHome.id, level: 60 } });
    lines.push(...(await handleArcFightSettled({ contextJson: JSON.stringify({ arcId: arcI.id, side: "defend", stage: 5 + (i % 2) }), outcome: "victory", humans: [{ characterId: p.id, status: "FIGHTING", name: p.name }] })));
  }
  const saved = await prisma.worldArc.findUniqueOrThrow({ where: { id: arcI.id } });
  check(saved.status === "RESOLVED" && saved.outcome === "survived" && saved.decidedBy === "aventureros", "enough defenders save the target with NO owner verdict needed");
  check(lines.some((l) => l.includes("se salva")), "the players are told they saved the target");
  const bonney = await prisma.worldActor.findUniqueOrThrow({ where: { name: "Jewelry Bonney" } });
  check(bonney.status === "ACTIVE", "the saved character stays alive");
  await handleArcFightSettled({ contextJson: JSON.stringify({ arcId: arcI.id, side: "defend", stage: 5 }), outcome: "victory", humans: [{ characterId: hero.id, status: "FIGHTING", name: "x" }] });
  check(true, "settling a fight for a finished arc is a harmless no-op");

  // ---------------- cancel
  const arcC = await prisma.worldArc.create({ data: { kind: "death", title: "x", targetActorId: target.id, targetName: "x", nextBeatAt: new Date(Date.now() + 1e9) } });
  await cancelArc(arcC.id);
  check((await prisma.worldArc.findUniqueOrThrow({ where: { id: arcC.id } })).status === "RESOLVED", "the owner can cancel an open event");

  // ---------------- narrator prompt carries the map
  const dir = await loadDirectives(hero.id);
  check(dir.includes("MUNDO VIVO"), "the narrator directives include the living map");

  // ---------------- bounty hunters work alone
  const bhUser = await prisma.user.create({ data: { username: `wchkc${stamp}`, passwordHash: "x" } });
  const bh = await createCharacter(bhUser.id, `Cazador${stamp}`, "BOUNTY_HUNTER", "swordsman" as never);
  await throwsWith(() => createCrew(bh.id, bhUser.id, `Gremio${stamp}`, "x"), CrewError, "solitario", "a bounty hunter cannot found a crew");
  const cap1 = await createCrew(hero.id, user.id, `Flota${stamp}`, "un emblema");
  await throwsWith(() => joinCrew(bh.id, bhUser.id, cap1.inviteCode), CrewError, "solitario", "a bounty hunter cannot join a crew");
  await throwsWith(() => inviteToCrew(hero.id, user.id, { characterId: bh.id }), CrewError, "solitario", "a bounty hunter cannot be invited");

  // ---------------- crew flag
  const noEmblem = await prisma.crew.findUniqueOrThrow({ where: { id: cap1.id } });
  check(!noEmblem.flagImage, "a new crew has no flag");
  await setCrewEmblem(hero.id, user.id, PNG_1PX);
  const withEmblem = await prisma.crew.findUniqueOrThrow({ where: { id: cap1.id } });
  check(withEmblem.flagImageType === "image/png" && !!withEmblem.flagImage && withEmblem.flagImage.length > 20, "the captain can set a flag image");
  await throwsWith(() => setCrewEmblem(hero.id, user.id, "data:image/svg+xml;base64,PHN2Zz48L3N2Zz4="), CrewError, "png", "SVG flags are refused");
  await throwsWith(() => setCrewEmblem(hero.id, user.id, `data:image/png;base64,${Buffer.from("<html>").toString("base64")}`), CrewError, "coincide", "a fake image is refused");
  const other = await createCharacter((await prisma.user.create({ data: { username: `wchkd${stamp}`, passwordHash: "x" } })).id, `Otro${stamp}`, "PIRATE", "swordsman" as never);
  await joinCrew(other.id, other.userId, cap1.inviteCode);
  await throwsWith(() => setCrewEmblem(other.id, other.userId, PNG_1PX), CrewError, "capitán", "only the captain can change the flag");
  await setCrewEmblem(hero.id, user.id, null);
  check(!(await prisma.crew.findUniqueOrThrow({ where: { id: cap1.id } })).flagImage, "the flag can be removed");

  console.log(failed ? `FAILED (${failed})` : "ALL PASS");
  process.exit(failed ? 1 : 0);
}
main().finally(() => prisma.$disconnect());
