import { describe, expect, it } from "vitest";
import fs from "fs";
import path from "path";

/**
 * The owner ordered dice out of the whole game: results are judged by the AI (ai/judge.ts, refereeExchange) or follow
 * fixed rules. This test fails if any dice primitive comes back, or if seeded "variety" spreads to places where it
 * could decide the result of an action.
 */
const SRC = path.resolve(__dirname, "..");

function walk(dir: string, out: string[] = []): string[] {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (/\.(ts|tsx)$/.test(e.name) && !/\.test\.ts$/.test(e.name)) out.push(p);
  }
  return out;
}

const files = walk(SRC).filter((f) => !f.endsWith(path.join("lib", "engine", "rng.ts")));
const rel = (f: string) => path.relative(SRC, f).replace(/\\/g, "/");

const FORBIDDEN = [
  "Math.random",
  "liveRng",
  "skillCheck",
  "rollD100",
  "attackOnce",
  "resolveExchange",
  "runCombat",
  "runBout",
  "resolveJointRound",
  "resolveDuelRound",
  "runGroupBattle",
  "rollDeath",
  "attemptFlee",
  "attemptEscape",
  "attemptPrisonRescue",
  "attemptStealthRead",
  "rollRecruit",
  "rollLoot",
  "rollSting",
  "rollFakeFruit",
  "rollBusterCall",
  "rollHunterAmbush",
  "rollConquerorsHakiAwakening",
  "rollConsequenceTrigger",
  "rollSeaAmbush",
];

// Where seeded variety (which flavour text, which rumour, which stock) may be used. Never for the result of an action.
const VARIETY_ALLOWED = new Set([
  "lib/game/perform-action.ts", // which event beat is shown, flavour of the news, which item/ambusher among equivalents
  "lib/game/coliseum.ts", // bracket order and prize among equivalents
  "lib/game/missions.ts", // which optional goal is offered
  "lib/game/world-arcs.ts", // which actor moves in the living world
  "lib/game/admiral-dispatch.ts", // when and where the Government sends an admiral (an ambient world event, no player outcome)
  "lib/game/world-tick.ts", // which ambient headline
  "lib/game/world-happenings.ts", // which island/idea when the AI is offline
  "lib/game/player-events.ts", // which unique fruit an event offers among equivalents
  "lib/engine/inventory.ts", // which catalogue item among equivalents (lootFor)
]);

describe("no dice anywhere", () => {
  it("no dice primitive exists in the game code", () => {
    const hits: string[] = [];
    for (const f of files) {
      const text = fs.readFileSync(f, "utf8");
      for (const word of FORBIDDEN) if (new RegExp(`\\b${word}\\b`).test(text)) hits.push(`${rel(f)}: ${word}`);
    }
    expect(hits).toEqual([]);
  });

  it("seeded variety is only used where it picks between equivalent things", () => {
    const hits: string[] = [];
    for (const f of files) {
      const r = rel(f);
      if (VARIETY_ALLOWED.has(r)) continue;
      const text = fs.readFileSync(f, "utf8");
      if (/\bvarietyRng\(/.test(text)) hits.push(r);
    }
    expect(hits).toEqual([]);
  });

  it("the engine has no function that takes a random generator to decide an outcome of a player action", () => {
    // The only engine modules allowed to still take an Rng are variety pickers (world, coliseum bracket, missions, event picking).
    const allowed = new Set([
      "lib/engine/actor-movement.ts",
      "lib/engine/black-market.ts",
      "lib/engine/coliseum.ts",
      "lib/engine/events.ts",
      "lib/engine/missions.ts",
      "lib/engine/world-arcs.ts",
      "lib/engine/admiral-dispatch.ts",
      "lib/engine/world-happenings.ts",
      "lib/engine/world.ts",
      "lib/engine/voyage.ts",
      "lib/engine/rng.ts",
    ]);
    const hits: string[] = [];
    for (const f of files.concat(path.join(SRC, "lib/engine/rng.ts"))) {
      const r = rel(f);
      if (!r.startsWith("lib/engine/") || allowed.has(r)) continue;
      const text = fs.readFileSync(f, "utf8");
      if (/\bRng\b/.test(text) && !/^\s*\/\//m.test("")) hits.push(r);
    }
    expect(hits).toEqual([]);
  });
});
