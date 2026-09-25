process.env.JUDGE_STUB = "1"; // results are judged by the AI; scripted checks use the deterministic stand-in
// Dressrosa Coliseum against the dev DB: announcement, registration rules, the draw, rounds, walkovers,
// prizes into the inventory, news, and the calendar. Uses the real AI for the round stories.
// Usage: npx tsx scripts/coliseum-check.ts
import "dotenv/config";
import { prisma } from "../src/lib/db";
import { announceTournament, coliseumStep, registerForTournament, withdrawFromTournament, submitStrategy, getColiseumState, ColiseumError, startTournament, resolveRound } from "../src/lib/game/coliseum";
import { getInventoryView } from "../src/lib/game/inventory";

function assert(cond: boolean, label: string) {
  if (!cond) throw new Error(`FAIL: ${label}`);
  console.log(`PASS: ${label}`);
}
async function rejects(fn: () => Promise<unknown>) {
  try {
    await fn();
    return false;
  } catch (e) {
    return e instanceof ColiseumError;
  }
}

async function main() {
  const dress = await prisma.island.findFirstOrThrow({ where: { name: "Dressrosa" } });
  const zou = await prisma.island.findFirstOrThrow({ where: { name: "Zou" } });
  const mk = async (name: string, island: string, buff = false) => {
    const u = await prisma.user.create({ data: { username: `co${Math.floor(Math.random() * 1e9)}`, passwordHash: "x" } });
    const c = await prisma.character.create({
      data: { name: `${name}${Date.now() % 10000}`, faction: "PIRATE", userId: u.id, currentIslandId: island, level: 30, hp: 200, maxHp: 200, strength: buff ? 300 : 20, agility: buff ? 300 : 20, durability: buff ? 300 : 20, willpower: 10, intellect: 10 },
    });
    return { u, c };
  };
  await prisma.tournamentEntry.deleteMany({});
  await prisma.tournament.deleteMany({});
  await prisma.worldClock.upsert({ where: { id: 1 }, update: { lastTournamentAt: null }, create: { id: 1 } });

  const hero = await mk("Campeon", dress.id, true);
  const rival = await mk("Rival", dress.id);
  const away = await mk("Lejano", zou.id);

  // ---- the calendar: never announced -> announce, then nothing while it is open
  assert((await getColiseumState(hero.c.id))!.tournament === null, "no tournament at first");
  assert(await coliseumStep(), "the calendar announces the first tournament");
  const open = await prisma.tournament.findFirstOrThrow({ where: { status: "ANNOUNCED" } });
  assert(!(await coliseumStep()), "nothing else is due while registration is open");
  assert((await prisma.tournament.count()) === 1, "only one tournament exists");
  const news = await prisma.newsItem.findFirstOrThrow({ where: { category: "Coliseo" }, orderBy: { createdAt: "desc" } });
  assert(news.locationName === "Dressrosa" && news.severity === "major", "the announcement is a major news item located in Dressrosa");
  const prize = JSON.parse(open.prizeJson) as { label: string; kind: string; fruitName?: string };
  assert(news.body.includes(prize.label), "the news names the prize exactly");
  assert(open.startsAt.getTime() - Date.now() > 2.5 * 3_600_000, "it is announced hours before it starts");

  // ---- registration rules
  assert(await rejects(() => registerForTournament(away.c.id, away.u.id)), "someone outside Dressrosa cannot register");
  assert(await rejects(() => registerForTournament(hero.c.id, "other-user")), "cannot register another account's character");
  await registerForTournament(hero.c.id, hero.u.id);
  assert(await rejects(() => registerForTournament(hero.c.id, hero.u.id)), "no double registration");
  await registerForTournament(rival.c.id, rival.u.id);
  await withdrawFromTournament(rival.c.id, rival.u.id);
  assert(await rejects(() => withdrawFromTournament(rival.c.id, rival.u.id)), "withdrawing twice is refused");
  await registerForTournament(rival.c.id, rival.u.id);
  const st = (await getColiseumState(hero.c.id))!;
  assert(st.tournament!.registered.length === 2 && st.me!.status === "REGISTERED", "the panel state lists both and knows I am in");
  assert(!(await getColiseumState(away.c.id))!.canRegister, "the state tells a distant character why they cannot register");
  assert(await rejects(() => submitStrategy(hero.c.id, hero.u.id, "aguanto y contraataco")), "no strategy before the rounds start");

  // ---- registration closes: the rival left Dressrosa and is dropped
  await prisma.character.update({ where: { id: rival.c.id }, data: { currentIslandId: zou.id } });
  await prisma.tournament.update({ where: { id: open.id }, data: { startsAt: new Date(Date.now() - 1000) } });
  assert(await coliseumStep(), "at the announced time the tournament starts");
  let t = await prisma.tournament.findUniqueOrThrow({ where: { id: open.id }, include: { entries: true } });
  assert(t.status === "RUNNING" && t.size === 4, "one adventurer + gladiators make a 4-player bracket");
  assert(t.entries.filter((e) => e.isNpc).length === 3, "gladiators fill the empty places");
  assert(t.entries.find((e) => e.characterId === rival.c.id)!.status === "WITHDRAWN", "someone who left the island is out");
  const bracket = JSON.parse(t.bracketJson) as { a: string; b: string }[][];
  assert(bracket.length === 1 && bracket[0].length === 2, "round 1 has 2 matches");
  assert(new Set(bracket[0].flatMap((m) => [m.a, m.b])).size === 4, "everyone is drawn exactly once");
  const startNews = await prisma.newsItem.findFirst({ where: { category: "Coliseo", headline: { contains: "Comienza" } } });
  assert(!!startNews && startNews.body.includes("contra"), "the draw is published in the news");

  // ---- strategy, then play every round
  await submitStrategy(hero.c.id, hero.u.id, "aguanto la primera embestida y contraataco");
  assert((await getColiseumState(hero.c.id))!.me!.strategy!.includes("contraataco"), "the strategy is stored");
  assert(await rejects(() => submitStrategy(away.c.id, away.u.id, "hola")), "someone not fighting cannot set a strategy");
  const xpBefore = (await prisma.character.findUniqueOrThrow({ where: { id: hero.c.id } })).experience;
  for (let guard = 0; guard < 4; guard++) {
    t = await prisma.tournament.findUniqueOrThrow({ where: { id: open.id }, include: { entries: true } });
    if (t.status !== "RUNNING") break;
    await prisma.tournament.update({ where: { id: open.id }, data: { roundEndsAt: new Date(Date.now() - 1000) } });
    assert(await coliseumStep(), `round ${t.round} resolves when its time is up`);
  }
  t = await prisma.tournament.findUniqueOrThrow({ where: { id: open.id }, include: { entries: true } });
  assert(t.status === "FINISHED" && !!t.championName, "the tournament finishes with a champion");
  const rounds = JSON.parse(t.bracketJson) as { winner?: string }[][];
  assert(rounds.length === 2 && rounds.every((r) => r.every((m) => !!m.winner)), "both rounds were fully resolved");
  assert(t.entries.filter((e) => e.status === "CHAMPION").length === 1, "exactly one champion");
  assert(t.entries.filter((e) => e.status === "ELIMINATED").length === 3, "everyone else is eliminated");
  const heroAfter = await prisma.character.findUniqueOrThrow({ where: { id: hero.c.id } });
  assert(heroAfter.hp === 200, "the arena is non-lethal: no wounds carried out");
  assert(heroAfter.experience > xpBefore || heroAfter.level > 30, "winning rounds gave experience");
  const log = await prisma.gameLogEntry.findMany({ where: { characterId: hero.c.id, kind: "coliseum" } });
  assert(log.some((l) => l.text.includes("pasas de ronda")), "each round win is recorded in the character's log");
  const roundNews = await prisma.newsItem.findMany({ where: { category: "Coliseo" } });
  assert(roundNews.length >= 4, `every round is reported in the news (${roundNews.length} items)`);
  assert(roundNews.some((n) => n.headline.includes("campeón")), "the champion gets a headline");

  // ---- the prize lands in the inventory when a human wins (the buffed hero should)
  const heroChampion = t.entries.find((e) => e.status === "CHAMPION")!.characterId === hero.c.id;
  assert(heroChampion, "the overwhelmingly stronger adventurer wins");
  const inv = await getInventoryView(hero.c.id, hero.u.id);
  if (prize.kind === "weapon") assert(inv.weapons.some((w) => prize.label.startsWith(w.name)), "the prize weapon is in the inventory, ready to equip");
  else if (prize.kind === "fruit") assert(inv.fruits.some((f) => f.name === prize.fruitName), "the prize fruit is in the bag under its real name (not eaten)");
  else assert(heroAfter.berries > 100_000, "the gold prize was paid");
  if (prize.kind === "fruit") assert(heroAfter.devilFruitId === null, "the fruit was NOT eaten automatically");

  // ---- a second tournament: no humans -> cancelled; and the interval gates the calendar
  assert(!(await coliseumStep()), "right after finishing, the next one is not due yet");
  const second = await announceTournament(Date.now() - 2 * 24 * 3_600_000);
  await prisma.tournament.update({ where: { id: second!.id }, data: { startsAt: new Date(Date.now() - 1000) } });
  await startTournament(second!.id);
  assert((await prisma.tournament.findUniqueOrThrow({ where: { id: second!.id } })).status === "CANCELLED", "with no adventurers the tournament is cancelled instead of wasting AI on gladiators");

  // ---- walkover: a registered player who leaves mid-tournament forfeits
  const third = await announceTournament(Date.now() - 3 * 24 * 3_600_000);
  await registerForTournament(rival.c.id, rival.u.id).catch(() => undefined);
  await prisma.character.update({ where: { id: rival.c.id }, data: { currentIslandId: dress.id } });
  await registerForTournament(rival.c.id, rival.u.id);
  await prisma.tournament.update({ where: { id: third!.id }, data: { startsAt: new Date(Date.now() - 1000) } });
  await startTournament(third!.id);
  await prisma.character.update({ where: { id: rival.c.id }, data: { currentIslandId: zou.id } });
  await resolveRound(third!.id);
  const t3 = await prisma.tournament.findUniqueOrThrow({ where: { id: third!.id }, include: { entries: true } });
  const rivalEntry = t3.entries.find((e) => e.characterId === rival.c.id)!;
  assert(rivalEntry.status === "ELIMINATED", "leaving Dressrosa mid-tournament forfeits the match");
  const r3 = JSON.parse(t3.bracketJson) as { walkover?: boolean }[][];
  assert(r3[0].some((m) => m.walkover), "the forfeit is recorded as a walkover");

  // ---- a tournament of styles: the champion learns the style for free
  await prisma.tournamentEntry.deleteMany({});
  await prisma.tournament.deleteMany({});
  const fourth = await announceTournament(Date.now() - 4 * 24 * 3_600_000, { kind: "styles" });
  const sp = JSON.parse(fourth!.prizeJson) as { kind: string; styleId: string; label: string };
  assert(sp.kind === "style" && sp.label.includes("manual"), "a style tournament announces a style manual as the prize");
  await prisma.character.update({ where: { id: hero.c.id }, data: { currentIslandId: dress.id } });
  await registerForTournament(hero.c.id, hero.u.id);
  await prisma.tournament.update({ where: { id: fourth!.id }, data: { startsAt: new Date(Date.now() - 1000) } });
  await startTournament(fourth!.id);
  for (let g = 0; g < 4; g++) {
    const cur = await prisma.tournament.findUniqueOrThrow({ where: { id: fourth!.id } });
    if (cur.status !== "RUNNING") break;
    await resolveRound(fourth!.id);
  }
  const learned = await prisma.characterStyle.findUnique({ where: { characterId_styleId: { characterId: hero.c.id, styleId: sp.styleId } } });
  assert(!!learned && learned.mastery >= 30, "the champion of the style tournament now knows that style");

  console.log("ALL COLISEUM CHECKS PASSED");
}
main().finally(() => prisma.$disconnect());
