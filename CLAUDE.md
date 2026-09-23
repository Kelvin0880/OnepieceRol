# Grand Line RPG — project notes for Claude

A text-based, multiplayer One Piece RPG. Full random resolution (dice/skill
checks, never scripted outcomes), real permadeath, a world that keeps
moving on its own, and a final endgame built around the 4 Road Poneglyphs
leading to Laugh Tale / becoming Pirate King. This file exists so a future
session with zero conversation history can pick up exactly where the last
one left off — read this before touching anything.

## The user, in one paragraph

Wants "absolutely everything" One Piece has — every fruit, every faction,
a living world, real stakes — but has explicitly agreed to a phased
approach: build a solid, extensible engine + a strong initial content set
(East Blue) first, expand content later. Cares enormously about things
actually working: **every engine mechanic needs real unit tests, and every
user-facing flow needs to be driven in an actual browser (Playwright) and
screenshotted before being called done** — not just typechecked. Wants
future expansions to never destroy existing characters' progress. Full
creative license on lore/content specifics.

## Stack & critical gotchas

- Next.js 16 (App Router) + TypeScript + Tailwind v4, React 19.
- **Prisma is pinned to v6** (`prisma@6`, `@prisma/client@6`). Do **not**
  let it upgrade to v8 — v8 is a totally different CLI aimed at Prisma's
  cloud platform (`prisma deploy`, `prisma postgres`, no `generate`/`db
  push`) and will break every workflow here. If `npx prisma` starts
  talking about "The Prisma Developer Platform," you're on v8 by mistake.
- `prisma.config.ts` needs `import "dotenv/config"` at the very top, or
  `DATABASE_URL` won't load and every command fails with
  `Environment variable not found`.
- SQLite in dev (`prisma/dev.db`, gitignored). Swap `provider` in
  `prisma/schema.prisma` to `"postgresql"` + a real `DATABASE_URL` for
  production (Supabase/Neon free tier both work).
- **Windows file lock gotcha**: the dev server holds a lock on both the
  Prisma query engine `.dll` and the SQLite file itself. Any
  `prisma db push` while `npm run dev` is running fails with
  `EPERM ... query_engine-windows.dll.node.tmp...`, and `npm run db:reset`
  fails with `EBUSY ... unlink 'prisma\dev.db'`. Always stop the dev
  server first:
  `powershell -Command "Get-NetTCPConnection -LocalPort 3000 -State Listen -ErrorAction SilentlyContinue | ForEach-Object { Stop-Process -Id \$_.OwningProcess -Force }"`
- Auth is custom: `iron-session` (v9 API —
  `getIronSession(await cookies(), sessionOptions)`) plus `bcryptjs`. No
  NextAuth, no third-party provider.
- The folder name has a space (`rol one piece`), which `create-next-app`
  and npm package names reject — that's why the npm package is named
  `one-piece-rol` internally. Harmless, just don't be confused by the
  mismatch.
- `playwright` is a devDependency specifically for browser-driven
  verification (see Testing below), not for anything in the app itself.

## Architecture

- `src/lib/engine/*` — **pure, framework-free, seeded-RNG TypeScript.**
  No Prisma, no Next imports. Every file has a `.test.ts` sibling. This is
  where game rules live: dice (`rng.ts`), skill checks (`checks.ts`),
  solo combat (`combat.ts`), group battles (`group-battle.ts`), death
  (`death.ts`), fight-or-flee (`encounter.ts`), devil fruits (`fruits.ts`),
  haki (`haki.ts`), economy (`economy.ts`), faction titles
  (`progression.ts`), narrative event resolution (`events.ts`), physical
  condition labels (`condition.ts`), background world sim
  (`world.ts`), crew nouns (`crew-noun.ts`). **New mechanic → new file
  here first, with tests, before any DB/API code.**
- `src/lib/game/*` — orchestration layer: DB reads/writes + calls into
  `engine/*`. Not unit tested directly (too much Prisma coupling); instead
  verified via the Playwright smoke scripts. Key files:
  `perform-action.ts` (explore/train/rest/travel/engage/flee/mercy),
  `group-battle.ts` (propose/respond to crew battles), `crew.ts`
  (create/join/leave), `create-character.ts`, `world-tick.ts` (lazy
  background sim, runs every ~5 real minutes off the back of any request),
  `death-resolution.ts` (shared `handleDeathCheck`/`postNews` — the one
  place permadeath and companion deaths actually happen), `reputation.ts`
  (shared `applyBountyOrNotoriety` — the one place bounty/notoriety and
  their milestone news posts happen), `derive.ts` (Character row →
  `Combatant` for the engine), `common-gear.ts` (starter/shop weapon
  catalog — see note below on why this isn't in Prisma).
- `src/app/api/**/route.ts` — thin: parse with `zod`, call `lib/game`,
  catch typed errors (`GameActionError`, `CrewError`, `BattleError`,
  `UnauthorizedError`) into proper status codes, `logError()` everything
  else to the `ErrorLog` table (see Logging below).
- `src/app/{page.tsx,create,play/[id],news}` — client components, fetch
  the API directly, no server actions. `play/[id]/page.tsx` is the big
  one (character sheet, actions, crew panel, battle challenge builder).

## Data model gotchas worth knowing before you touch the schema

- **`Weapon.name` is NOT `@unique`.** It used to be, which caused a real
  bug: two players picking the same starter archetype (e.g. both
  "Espadachín") would fight over the single seeded "Espada de acero" row,
  and the second one would silently get no weapon. Fix was: common/starter
  gear lives in `src/lib/game/common-gear.ts` as a **plain TS catalog**,
  and a fresh `Weapon` row is created per character on demand. Only truly
  1-of-1 named meito (Wado Ichimonji, Enma, Shusui, Sandai Kitetsu,
  Yubashiri, Kabuto) are seeded as singleton DB rows, and nothing else
  ever creates a second row with those names. **If you add new "common"
  equipment, put it in `common-gear.ts`, not the Prisma seed.**
- `Crew.captainId` and `GroupBattle.crewAId`/`crewBId` are **plain
  strings, not enforced FKs** — deliberate, to avoid Prisma relation
  ambiguity headaches; validated in application code instead.
- `PendingEncounter` has a `phase` field (`"threat"` | `"victory"`) that
  the fight-or-flee → win → mercy-choice flow depends on. Don't collapse
  this back into a single boolean — the UI needs to distinguish "choose
  fight or flee" from "you won, choose spare or finish."
- `Character.notoriety` is the generic reputation number for every
  non-pirate faction (marine merit, revolutionary standing, bounty-hunter
  guild reputation); `Character.bounty` is pirate-only. `progression.ts`
  (`factionTitle`) reads whichever one applies.
- `Imprisonment` model exists in the schema but **as of the last session
  had no game logic or UI wired up yet** — check the Roadmap section
  below before assuming it's live.
- Every schema change so far has been additive (new optional
  fields/models with defaults). **Keep it that way — the user explicitly
  wants future expansions to never wipe or reset an existing character's
  progress.** Never write a destructive migration without asking first.

## Testing — this is not optional, the user checks

1. New engine function → new/updated `*.test.ts` in the same folder,
   covering the happy path, edge cases, and (if it validates input) a
   "throws" case. Run `npx vitest run` (whole suite, not just the new
   file) before moving on.
2. `npx tsc --noEmit` clean before calling anything done.
3. Any UI-facing change → actually run it. Stop the port-3000 listener if
   a schema change happened, `npm run dev` in the background
   (`(npm run dev > /tmp/nextdev.log 2>&1 &)` then poll
   `curl -sf http://localhost:3000`), then drive it with Playwright:
   `npx playwright install chromium` once, then `node scripts/*.mjs`.
   There is no `chromium-cli` on this machine — use raw
   `import { chromium } from "playwright"` scripts instead. Screenshots
   go to `./shots/` (gitignored) — actually look at them, don't just
   check for zero console errors.
4. Existing smoke scripts to copy/extend rather than rewrite from
   scratch: `scripts/e2e-smoke.mjs` (register → create character →
   explore → fight → mercy choice → news), `scripts/crew-smoke.mjs` (two
   accounts, found/join a crew, verify mutual presence),
   `scripts/battle-smoke.mjs` (four accounts, two crews of two, full
   N-vs-N challenge → matchup builder → accept → resolved outcome on both
   sides). All three require `npm run dev` already running and print
   `PASS`/`FAIL` plus screenshot paths.
5. **After verification, reset the dev DB to a clean seeded state** so
   the user's next look isn't full of test accounts: `npm run db:reset`
   (cross-platform — deletes the SQLite file, re-pushes the schema,
   re-seeds).

## Logging

`src/lib/log-error.ts` → `logError(context, err, meta?)`. Every API
route's catch-all calls this instead of bare `console.error` — it logs to
console AND persists to the `ErrorLog` table (best-effort; a logging
failure never masks the original error). Query `ErrorLog` directly via
Prisma/`prisma studio` to see history across restarts — there's no admin
UI for it yet.

## World content so far

13 islands: the original 9-island East Blue set (Pueblo Foosha/pirate
start, Cuartel Marine G-5/marine start, Isla Baltigo/revolutionary start,
Isla Gecko/bounty-hunter start, Villa Shimotsuki, Restaurante Baratie,
Isla Conomi/Arlong, Loguetown, Reverse Mountain as the Grand Line
gateway), plus a 4-island Paradise/New World chain hanging off Reverse
Mountain: Whisky Peak (danger 6, `minLevelToEnter` 8, Baroque Works
ambush flavor) → Little Garden (7, 10) → Alabasta (8, 12) → **Isla
Cementerio** (10, **30** — genuine end-game, Marshall D. Teach's own
stronghold). `Island.minLevelToEnter` (checked in `travelCharacter`,
`src/lib/engine/travel.ts`'s `canEnterIsland`) refuses travel outright
below the requirement — the Grand Line doesn't ease you in.

27 devil fruits across every rarity tier, 6 named meito + 5 common
starter weapons, 10 world actors (3 Yonko, 3 Admirals, 1 Warlord, 1
Revolutionary commander, 1 Cipher Pol agent) who act independently via
the lazy world-tick, 4 Road Poneglyphs — **one placed** (Fragmento del
Alba: the boss loot of "La guardia personal de Barbanegra" on Isla
Cementerio, `EventBody.poneglyphId` → granted via `resolveMercyChoice` in
`perform-action.ts` regardless of spare-or-finish, appended to
`Character.poneglyphsRead`), the other 3 stay lore-only/unplaced per the
user's explicit request that they be scattered and genuinely
hard — canonically held by other major powers (another Yonko, the World
Government directly, Cipher Pol), not just sitting in a dungeon.
`prisma/seed.ts` is the single source of truth for all of this — extend
it, don't hand-write data elsewhere.

## Roadmap (what's explicitly NOT done yet, roughly in likely priority order)

1. Deploying to Render + a real Postgres instance. `render.yaml` and
   `.env.example` already exist — this needs the user's own accounts, so
   walk them through it rather than doing it unattended:
   1. Create a free Postgres instance (Supabase or Neon both work) and
      copy its connection string.
   2. In `prisma/schema.prisma`, change `provider = "sqlite"` to
      `provider = "postgresql"` in the `datasource db` block.
   3. `git push` this repo somewhere Render can see it (a GitHub repo —
      there's no git remote configured yet, this hasn't been pushed
      anywhere).
   4. In the Render dashboard: "New +" → "Blueprint", point it at the
      repo — it reads `render.yaml`. Set the real `DATABASE_URL` env var
      to the Postgres connection string from step 1 (`render.yaml` leaves
      it `sync: false` on purpose, so it's not committed).
   5. Once the first deploy is live, run `npx prisma db push` and
      `npx tsx prisma/seed.ts` **against the production `DATABASE_URL`**
      (e.g. from a local shell with that env var set) to create the
      schema and seed the world content — the app has no auto-migrate
      step.
2. Expanding Grand Line/New World past the current 4-island chain (see
   "World content" below).
3. Placing the remaining 3 Road Poneglyphs (Fragmento del Alba is placed;
   see "World content" below) — stays hard/scattered on purpose, each
   ideally held by a different major power (another Yonko, the World
   Government directly, possibly the Revolutionary Army).
4. More canon devil fruits/characters/weapons.
5. Island lore/conflict intro shown before a player first enters (the
   island `description` fields already carry some of this narratively,
   but there's no dedicated "intro" UI moment).
6. Kill-vs-spare consequence questlines deeper than the current one-off
   news-flavor hooks (`resolveMercyChoice` in `perform-action.ts`).

### The endgame — explicitly discussed, NOT designed or built yet

The user wants an actual answer to "what is One Piece, in this world's
lore" and a final arc built around it: gathering all 4 Road Poneglyphs to
reach Laugh Tale, claiming the treasure, and a climactic confrontation
that topples the World Government — including its true hidden ruler
(this world's answer to canon's Imu). The user explicitly said this needs
heavy design help before it's buildable and asked that it just be written
down for now, not implemented:

- What "One Piece" the treasure actually **is** in this original lore
  (not a copy of canon's unrevealed answer) — open question, ours to
  invent.
- The final confrontation is expected to be a genuine raid: something no
  single player can do alone. That means it needs both **real multiplayer
  coordination at a scale bigger than the current 1-crew-vs-1-crew group
  battles** (alliances of multiple crews? a full server-wide event?) and
  **recruitable/ally NPCs** fighting alongside players (something like the
  companion-assist mechanic in group battles, but for a raid boss).
- Whatever the hidden ruler/government structure is, it should tie back
  into the world-actor system (`WorldActor`, `world-tick.ts`) rather than
  being a one-off scripted boss — it's the ceiling the whole faction
  reputation/world-heat system has been building toward.
- Nothing here has an architecture yet. Before touching it: sit down with
  the user and actually design (a) the lore answer, (b) the raid mechanic,
  (c) the NPC-ally recruitment system, as their own conversation — this
  is bigger than a normal feature-sized session.

### Done since the first session

**Prison/rescue system** (`src/lib/game/prison.ts`, engine bits in
`src/lib/engine/rescue.ts` + `combatPower` in `encounter.ts`): losing a
group battle duel to a MARINE-faction crew has a 55% chance
(`MARINE_CAPTURE_CHANCE` in `group-battle.ts`) to capture instead of just
leaving the loser hurt — sets `Character.status = IMPRISONED`, creates an
`Imprisonment` row with `minRescueLevel` (the captor's `combatPower`) and
`bailBerries` (`computeBailBerries` in `economy.ts`). An imprisoned
character can't act (blocked by the existing ALIVE-only gate in
`loadCharacterOrThrow`). Two ways out: `POST .../prison {op:"bail"}` pays
`bailBerries` outright; `POST .../prison {op:"rescue", targetCharacterId}`
from an ALLY standing on the same island runs a `skillCheck` of the
rescuer's `combatPower` against `minRescueLevel` — success frees the
prisoner, a `critical_fail` gets the rescuer captured too (real stakes on
rescue attempts, not a free action). UI: `play/[id]/page.tsx` shows a
distinct jail view (reason, required rescue power, bail button) when
`status === "IMPRISONED"`, and a "Prisioneros en esta isla" panel with a
Rescatar button for free characters sharing that island. Verified via
`scripts/prison-logic-check.ts` (direct function calls, deterministic)
and `scripts/prison-ui-check.mjs` (real browser + real HTTP route, uses
`scripts/force-capture.ts` to jump straight to the interesting state
since triggering a Marine capture through actual combat RNG is too slow
to rely on for testing). `scripts/boost-character.ts` and
`scripts/check-character.ts` are small reusable test helpers — boost a
character's stats for deterministic combat tests, or dump one row's
state — use them instead of writing new one-off DB scripts.

**World expansion + level-gated travel + first Poneglyph placement**
(same session as the prison system) — see "World content so far" above
for the details. Verified live via curl (register → travel the full East
Blue chain → confirm Whisky Peak refuses entry at level 1 → boost level →
confirm entry succeeds), not just typechecked.

**Poneglyph pursuit system** (`src/lib/engine/pursuit.ts`,
`Character.poneglyphHeat`): reading a Poneglyph doesn't just grant lore —
Poneglyphs are stone, so nobody steals them back, but the power that lost
the secret wants the reader silenced. `heatAfterReadingPoneglyph` spikes
`poneglyphHeat` by 50 (capped at 150) each time `resolveMercyChoice` in
`perform-action.ts` grants one. From then on, every `exploreCharacter`
call rolls `rollHunterAmbush` (chance scales with heat, capped at 35%)
*before* picking a normal event — a hit short-circuits straight into a
`PendingEncounter` against a "Cazador de Poneglifos" whose stats are
derived from the player's own current combatant (so it's dangerous at
any stage, not a fixed-tier fight), tagged `isBoss: true` so victory pays
out through the normal boss reward path. Heat decays by 3 on every
explore (ambush or not) via `decayPursuitHeat`, so it's real pressure,
not a permanent debuff. UI: a "Perseguido" meter in the stats panel and a
"Poneglifos descifrados: N/4" line in the equipment panel, both in
`play/[id]/page.tsx`. Verified live via curl (force `poneglyphHeat` to
150 with `scripts/set-poneglyph-heat.ts`, explore until the ambush fires,
fight it, confirm heat decayed and boss rewards applied) — not just
typechecked. Only wired to the one placed Poneglyph so far; when the
other 3 get placed, granting them already runs through this same path
for free.

## Conventions to keep matching

- All player-facing text is in Spanish (the user writes in Spanish).
  Code, comments, commit messages: English.
- No comments explaining *what* code does — only non-obvious *why*
  (see the existing engine files for the target density: about one
  comment per function, max, only when there's a real hidden constraint).
- Dark pirate/parchment theme, `font-display` (Cinzel) for headings,
  `font-body` (Crimson Pro) for text — see `globals.css` for the token
  palette (`--gold`, `--sea-deep`, `--blood`, etc.) before inventing new
  colors.
