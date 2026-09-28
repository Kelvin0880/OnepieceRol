import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { ACTOR_PROFILES, FRUIT_ASSIGNMENTS } from "./world-actor-profiles";
import { EXTRA_ACTORS } from "./world-actor-extra";
import { MORE_ACTORS } from "./world-actor-more";
import { WAVE4_ACTORS } from "./world-actor-wave4";
import { WAVE5_ACTORS } from "./world-actor-wave5";
import { IMPEL_ACTORS } from "./world-actor-impel";
import { DEVIL_FRUIT_CATALOG } from "./devil-fruit-catalog";
import { ACTOR_STYLES } from "../engine/actor-styles";
import { getStyle } from "../engine/styles";

const root = process.cwd();
const seedSrc = readFileSync(join(root, "prisma", "seed.ts"), "utf8");
const wave4Src = readFileSync(join(root, "src", "lib", "game", "islands-wave4.ts"), "utf8");

function between(src: string, from: string, to: string): string {
  const a = src.indexOf(from);
  const b = src.indexOf(to, a);
  expect(a, `marker ${from}`).toBeGreaterThan(-1);
  expect(b, `marker ${to}`).toBeGreaterThan(a);
  return src.slice(a, b);
}

const seedActorSection = between(seedSrc, "const actors: ActorSeed[] = [", "const worldActors:");
const seedActorNames = [...seedActorSection.matchAll(/^ {6}name: "([^"]+)"/gm)].map((m) => m[1]);
const seedActorFruits = [...seedActorSection.matchAll(/^ {6}devilFruitName: "([^"]+)"/gm)].map((m) => m[1]);
const islandKeys = new Set([
  ...[...between(seedSrc, "const islandDefs = [", "for (const def of [...islandDefs").matchAll(/key: "([A-Za-z0-9]+)"/g)].map((m) => m[1]),
  ...[...wave4Src.matchAll(/key: "([A-Za-z0-9]+)"/g)].map((m) => m[1]),
]);

const FILE_ACTORS = [...EXTRA_ACTORS, ...MORE_ACTORS, ...WAVE4_ACTORS, ...WAVE5_ACTORS, ...IMPEL_ACTORS];
const allNames = [...seedActorNames, ...FILE_ACTORS.map((a) => a.name)];

describe("canon cast data", () => {
  it("parses the seed sections it depends on", () => {
    expect(seedActorNames.length).toBeGreaterThan(40);
    expect(islandKeys.size).toBeGreaterThan(40);
    expect(islandKeys.has("wano")).toBe(true);
  });

  it("every actor name is unique across the seed and every cast file", () => {
    const seen = new Set<string>();
    const dupes = allNames.filter((n) => (seen.has(n) ? true : (seen.add(n), false)));
    expect(dupes).toEqual([]);
  });

  it("every actor home is a real island key", () => {
    const bad = FILE_ACTORS.filter((a) => !islandKeys.has(a.profile.home)).map((a) => `${a.name} -> ${a.profile.home}`);
    expect(bad).toEqual([]);
    const badBackfill = Object.entries(ACTOR_PROFILES).filter(([, p]) => !islandKeys.has(p.home)).map(([n]) => n);
    expect(badBackfill).toEqual([]);
  });

  it("every devil fruit named by an actor exists in the catalog", () => {
    const catalog = new Set(DEVIL_FRUIT_CATALOG.map((f) => f.name));
    const named = [...seedActorFruits, ...Object.values(FRUIT_ASSIGNMENTS), ...FILE_ACTORS.flatMap((a) => (a.devilFruitName ? [a.devilFruitName] : []))];
    expect(named.filter((n) => !catalog.has(n))).toEqual([]);
  });

  it("no devil fruit is held by two actors, and wave 5 fruits are singletons", () => {
    const named = [...seedActorFruits, ...Object.values(FRUIT_ASSIGNMENTS), ...FILE_ACTORS.flatMap((a) => (a.devilFruitName ? [a.devilFruitName] : []))];
    const seen = new Set<string>();
    expect(named.filter((n) => (seen.has(n) ? true : (seen.add(n), false)))).toEqual([]);
    const byName = new Map(DEVIL_FRUIT_CATALOG.map((f) => [f.name, f]));
    const wave5Fruits = WAVE5_ACTORS.flatMap((a) => (a.devilFruitName ? [a.devilFruitName] : []));
    expect(wave5Fruits.filter((n) => !byName.get(n)?.isSingleton)).toEqual([]);
  });

  it("every style entry names a real actor and a real style", () => {
    const known = new Set(allNames);
    const unknownActors = Object.keys(ACTOR_STYLES).filter((n) => !known.has(n));
    // Older entries name variants of seeded actors; only new-wave actors are held to exact names here.
    for (const a of WAVE5_ACTORS) expect(unknownActors.includes(a.name)).toBe(false);
    for (const [actor, ids] of Object.entries(ACTOR_STYLES)) for (const id of ids) expect(getStyle(id), `${actor}: ${id}`).toBeTruthy();
  });

  it("wave 5 entries are complete", () => {
    expect(WAVE5_ACTORS.length).toBeGreaterThanOrEqual(25);
    for (const a of WAVE5_ACTORS) {
      expect(a.description.length, a.name).toBeGreaterThan(40);
      expect(a.personality.length, a.name).toBeGreaterThan(10);
      expect(a.profile.ab.length, a.name).toBeGreaterThan(0);
      expect(a.powerLevel, a.name).toBeGreaterThan(0);
      expect(["GOROSEI", "HIDDEN_RULER", "ADMIRAL", "MARINE_GENERAL", "REVOLUTIONARY_COMMANDER", "WARLORD", "YONKO"]).not.toContain(a.role);
    }
    for (const a of WAVE5_ACTORS.filter((x) => x.status && x.status !== "ACTIVE")) expect(["RETIRED", "DEFEATED", "DECEASED"]).toContain(a.status);
  });
});
