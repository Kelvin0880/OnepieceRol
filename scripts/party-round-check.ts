// Shared crew scene in rounds: everyone acts, then ONE narrator answer covers all actions. Real AI narrator. Usage: npx tsx scripts/party-round-check.ts
import "dotenv/config";
import { prisma } from "../src/lib/db";
import { createCharacter } from "../src/lib/game/create-character";
import { createCrew, joinCrew } from "../src/lib/game/crew";
import { syncPartyForCharacter, getPartyStateForCharacter } from "../src/lib/game/party";
import { PartyRoundError, closePartyRound, resolvePartyRound, submitRoundAction } from "../src/lib/game/party-round";

function assert(c: boolean, l: string) {
  if (!c) throw new Error(`FAIL: ${l}`);
  console.log(`PASS: ${l}`);
}

async function main() {
  const stamp = Date.now() % 1000000;
  const mk = async (n: string) => {
    const u = await prisma.user.create({ data: { username: `${n}${stamp}`, passwordHash: "x" } });
    return { u, c: await createCharacter(u.id, `${n}${stamp}`, "PIRATE", "swordsman") };
  };
  const a = await mk("Rondaa");
  const b = await mk("Rondab");
  const c3 = await mk("Rondac");
  const crew = await createCrew(a.c.id, a.u.id, `Ronda ${stamp}`, "Un reloj de arena.");
  await joinCrew(b.c.id, b.u.id, crew.inviteCode);
  await joinCrew(c3.c.id, c3.u.id, crew.inviteCode);
  await syncPartyForCharacter(a.c.id);
  const partyId = (await prisma.character.findUniqueOrThrow({ where: { id: a.c.id } })).partyId!;
  assert(!!partyId, "the crew shares a scene");

  const st0 = await getPartyStateForCharacter(a.c.id);
  assert(st0!.actedIds.length === 0 && !st0!.awaitingNarrator, "a round starts empty and open to everyone");
  const narratorRows = () => prisma.partySceneMessage.count({ where: { partyId, authorCharacterId: null, authorName: "Narrador" } });
  const before = await narratorRows();

  const r1 = await submitRoundAction({ id: a.c.id, name: a.c.name }, partyId, "Saludo a la tabernera y le pido tres jarras para mi tripulación.");
  assert(!r1.allIn && r1.waitingFor.length === 2, "the first action does not trigger the narrator; two members are still pending");
  assert((await narratorRows()) === before, "no narrator answer yet");
  let dup = "";
  try { await submitRoundAction({ id: a.c.id, name: a.c.name }, partyId, "otra"); } catch (e) { dup = e instanceof PartyRoundError ? e.message : "OTHER"; }
  assert(dup.includes("Ya has enviado"), "you cannot act twice in a round");
  const st1 = await getPartyStateForCharacter(b.c.id);
  assert(st1!.actedIds.includes(a.c.id), "everyone can see who already acted");
  assert((await prisma.partySceneMessage.count({ where: { partyId, authorCharacterId: a.c.id } })) === 1, "the action is in the shared feed at once");

  const r2 = await submitRoundAction({ id: b.c.id, name: b.c.name }, partyId, "Me siento junto a la ventana y vigilo la puerta con la mano en la espada.");
  assert(!r2.allIn && r2.waitingFor.length === 1, "two of three acted");
  const r3 = await submitRoundAction({ id: c3.c.id, name: c3.c.name }, partyId, "Reviso el mapa de la barra buscando la ruta más corta al muelle.");
  assert(r3.allIn, "the last action completes the round");

  const text = await resolvePartyRound(partyId);
  assert(!!text && text.length > 40, "the narrator answered");
  assert((await narratorRows()) === before + 1, "exactly ONE narrator message covers the whole round");
  const after = await prisma.party.findUniqueOrThrow({ where: { id: partyId } });
  assert(after.roundActionsJson === "{}" && !after.awaitingNarrator && after.roundStartedAt === null, "the round is cleared for the next one");
  for (const m of [a, b, c3]) assert((await prisma.sceneMessage.count({ where: { characterId: m.c.id, role: "narrator" } })) >= 1, `${m.c.name} keeps the exchange in their own memory`);
  assert((await resolvePartyRound(partyId)) === null, "nothing to answer twice");

  // Closing a round with only some actions in.
  await submitRoundAction({ id: b.c.id, name: b.c.name }, partyId, "Pregunto en voz baja a un marinero si sabe de barcos que zarpen esta noche.");
  const closed = await closePartyRound(a.c.id, a.u.id);
  assert(closed.log.length === 1 && closed.log[0].length > 40, "any member can close the round: the narrator answers whoever acted");
  let empty = "";
  try { await closePartyRound(a.c.id, a.u.id); } catch (e) { empty = e instanceof PartyRoundError ? e.message : "OTHER"; }
  assert(empty.includes("nadie ha escrito"), "closing an empty round is refused");

  console.log("ALL PASS");
}
main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
