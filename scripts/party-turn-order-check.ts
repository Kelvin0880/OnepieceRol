// The shared crew scene is a strict loop: the narrator opens (or answers), then every member acts once in join
// order — mechanical or free narration, doesn't matter which — then the narrator answers the whole lap, and it
// loops. Usage: npx tsx scripts/party-turn-order-check.ts
import "dotenv/config";
import { prisma } from "../src/lib/db";
import { createCharacter } from "../src/lib/game/create-character";
import { createCrew, joinCrew } from "../src/lib/game/crew";
import { syncPartyForCharacter } from "../src/lib/game/party";
import { resolveFreeTextAction, GameActionError } from "../src/lib/game/perform-action";

function assert(c: boolean, l: string) {
  if (!c) throw new Error(`FAIL: ${l}`);
  console.log(`PASS: ${l}`);
}

async function main() {
  const stamp = Date.now() % 1_000_000;
  const mk = async (n: string) => {
    const u = await prisma.user.create({ data: { username: `${n}${stamp}`, passwordHash: "x" } });
    return { u, c: await createCharacter(u.id, `${n}${stamp}`, "PIRATE", "swordsman") };
  };
  const a = await mk("Turna");
  const b = await mk("Turnb");
  const crew = await createCrew(a.c.id, a.u.id, `Turno ${stamp}`, "Un reloj de arena.");
  await joinCrew(b.c.id, b.u.id, crew.inviteCode);
  await syncPartyForCharacter(a.c.id);
  const partyId = (await prisma.character.findUniqueOrThrow({ where: { id: a.c.id } })).partyId!;
  assert(!!partyId, "the crew shares a scene");

  // b tries to act before a (the captain, first in turnOrder): rejected, no engine effect fires.
  const bBefore = await prisma.character.findUniqueOrThrow({ where: { id: b.c.id } });
  let blocked = "";
  try {
    await resolveFreeTextAction(b.c.id, b.u.id, "Me pongo a entrenar un rato.");
  } catch (e) {
    blocked = e instanceof GameActionError ? e.message : "OTHER";
  }
  assert(blocked.includes("Espera tu turno") && blocked.includes(a.c.name), `acting out of turn is rejected (${blocked})`);
  const bAfter = await prisma.character.findUniqueOrThrow({ where: { id: b.c.id } });
  assert(bAfter.lastTrainedAt?.getTime() === bBefore.lastTrainedAt?.getTime(), "a rejected out-of-turn action never touched the character (no free training)");

  const totalRows = () => prisma.partySceneMessage.count({ where: { partyId } });
  const before = await totalRows();

  // a (the captain) goes first with a MECHANICAL action: it resolves for real and echoes instantly (deterministic,
  // no AI), but that is not the lap's narrator wrap-up — it's only one of two turns.
  const r1 = await resolveFreeTextAction(a.c.id, a.u.id, "Me pongo a entrenar un rato.");
  assert(r1.log.some((l) => l.includes("Entrenar")), "a's mechanical action resolved for real (training)");
  assert((await totalRows()) === before + 2, "a's own line plus its instant deterministic echo land in the feed (2 rows), nothing more");
  const midParty = await prisma.party.findUniqueOrThrow({ where: { id: partyId } });
  assert(JSON.parse(midParty.roundActionsJson)[a.c.id] === "Me pongo a entrenar un rato." && !midParty.awaitingNarrator, "the lap is NOT resolved yet: only a is recorded, b hasn't gone");

  const aBefore = await prisma.character.findUniqueOrThrow({ where: { id: a.c.id } });
  let aTwice = "";
  try {
    await resolveFreeTextAction(a.c.id, a.u.id, "Me pongo a entrenar otra vez.");
  } catch (e) {
    aTwice = e instanceof GameActionError ? e.message : "OTHER";
  }
  assert(aTwice.length > 0, `a cannot act twice in the same lap — it's b's turn now (${aTwice})`);
  const aAfter = await prisma.character.findUniqueOrThrow({ where: { id: a.c.id } });
  assert(aAfter.lastTrainedAt?.getTime() === aBefore.lastTrainedAt?.getTime(), "the rejected second attempt trained nothing twice");

  // b closes the lap with a pure narrate line — this is the second of two turns, so the narrator must answer once, now.
  const r2 = await resolveFreeTextAction(b.c.id, b.u.id, "Miro alrededor de la taberna, atento a cualquier cosa rara.");
  assert(r2.log.length === 1 && r2.log[0].length > 20, "closing the lap hands the narrator's single wrap-up straight back to the member who completed it");
  assert((await totalRows()) === before + 4, "b's own line plus exactly one AI wrap-up land in the feed (no per-member narrator spam)");

  const party = await prisma.party.findUniqueOrThrow({ where: { id: partyId } });
  assert(party.roundActionsJson === "{}" && !party.awaitingNarrator, "the lap is cleared, ready to loop back to a's turn again");

  // The loop actually loops: a can act again immediately (it's their turn once more, not stuck waiting for b again).
  const r3 = await resolveFreeTextAction(a.c.id, a.u.id, "Miro el horizonte pensando en el próximo golpe.");
  assert(!!r3, "the loop restarts: a's turn again in the next lap, not blocked");
  const party3 = await prisma.party.findUniqueOrThrow({ where: { id: partyId } });
  assert(JSON.parse(party3.roundActionsJson)[a.c.id] !== undefined, "a's new-lap action is recorded as this lap's first turn");

  console.log("\nALL PASS");
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
