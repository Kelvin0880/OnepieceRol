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
- SQLite in dev (`prisma/dev.db`, gitignored). **Production is live on
  Neon Postgres** (free tier, permanent — not Render's own Postgres,
  which auto-deletes after 30 days). `prisma/schema.prisma` stays sqlite
  for local dev; `scripts/gen-prod-schema.mjs` derives
  `prisma/schema.production.prisma` (postgresql datasource, otherwise
  identical, one source of truth for models) at Render build time —
  never hand-edit the generated file, it's gitignored. See "Deployment"
  below for the full picture.
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

14 islands: the original 9-island East Blue set (Pueblo Foosha/pirate
start, Cuartel Marine G-5/marine start, Isla Baltigo/revolutionary start,
Isla Gecko/bounty-hunter start, Villa Shimotsuki, Restaurante Baratie,
Isla Conomi/Arlong, Loguetown, Reverse Mountain as the Grand Line
gateway), plus a 5-island Paradise/New World spread hanging off Reverse
Mountain: Whisky Peak (danger 6, `minLevelToEnter` 8, Baroque Works
ambush flavor) → Little Garden (7, 10) → Alabasta (8, 12), which branches
into **two separate level-30+ endgame destinations** — Isla Cementerio
(10, **30**, Marshall D. Teach's stronghold) and **Enies Lobby** (10,
**35**, the World Government's own judicial fortress, `factionControl`
"Gobierno Mundial (CP-0)") — deliberately two different major powers, not
a single linear gate. `Island.minLevelToEnter` (checked in
`travelCharacter`, `src/lib/engine/travel.ts`'s `canEnterIsland`) refuses
travel outright below the requirement — the Grand Line doesn't ease you
in.

27 devil fruits across every rarity tier, 6 named meito + 5 common
starter weapons, 10 world actors (3 Yonko, 3 Admirals, 1 Warlord, 1
Revolutionary commander, 1 Cipher Pol agent) who act independently via
the lazy world-tick, 4 Road Poneglyphs — **two placed**:

- Fragmento del Alba: boss loot of "La guardia personal de Barbanegra" on
  Isla Cementerio.
- Fragmento del Ocaso: boss loot of "El escuadrón de CP-0" on Enies
  Lobby — flavor text is explicit that the real CP-0 leadership (Rob
  Lucci) is elsewhere on assignment, so what's actually fought is the
  squad left behind, not the true power. Same "subordinate, not the real
  thing" pattern as Blackbeard's lieutenant, now established twice on
  purpose — this is the pattern the "Poneglyph holders fight back" design
  brief below wants generalized properly.

Both grant via `EventBody.poneglyphId` → `resolveMercyChoice` in
`perform-action.ts` regardless of spare-or-finish, appended to
`Character.poneglyphsRead`, spiking `Character.poneglyphHeat` through the
pursuit system. The other 2 stay lore-only/unplaced per the user's
explicit request that they be scattered and genuinely hard — one is
still literally unplaced lore (Fragmento del Abismo), the other
(Fragmento Final) has a `guardedBy` hint pointing at Cipher Pol but no
island yet. `prisma/seed.ts` is the single source of truth for all of
this — extend it, don't hand-write data elsewhere.

## Deployment — DONE, live in production

Live at **<https://grand-line-rpg-qgkv.onrender.com>** (Render web service
`grand-line-rpg`, `srv-daplt08473hc73c6i8lg`, owner `tea-d17g45ndiees73e6p89g`).
Database is Neon Postgres (free tier, permanent — chosen specifically
*because* Render's own free Postgres auto-deletes after 30 days, which
would have violated the user's "never wipe progress" rule). The whole
setup was scripted end-to-end via Render's REST API using a user-supplied
API token (used only for direct `curl` calls, never written to a file or
committed) rather than the dashboard, since interactive OAuth/login flows
(Neon CLI `neon login`, `npm i -g`) are blocked by this environment's auto
mode classifier — that's a hard wall, don't try to route around it if it
recurs; ask the user to do the login step in their own browser instead,
or use whatever's reachable non-interactively (a REST API + token is
usually fine).

**Gotcha that actually broke the first deploy attempt**: `render.yaml`
originally set `NODE_ENV=production` as a service env var. Since Render
uses the *same* env for the build step, `npm install` interpreted
`NODE_ENV=production` as "skip devDependencies" — silently installing
only 65 packages instead of the full tree, missing `dotenv` (which
`prisma.config.ts` imports), `typescript`, `tailwindcss`, `tsx`. Build
failed on `Cannot find module 'dotenv/config'`. Fixed with
`npm install --include=dev` in the build command, which forces
devDependencies in regardless of `NODE_ENV`. Found via an actual deploy
attempt and its build logs (`GET /v1/logs?...&type=build`), not inferred
— a reminder that "should work" config still needs a real run.

**How production schema/seed updates work now**: `prisma/schema.prisma`
stays sqlite (local dev never changes). `npm run db:prod-schema` (=
`node scripts/gen-prod-schema.mjs`) derives `prisma/schema.production.prisma`
(same file, `provider = "postgresql"`) — this runs automatically in
Render's build command before `prisma generate`, so it's always fresh
and never hand-maintained/gitignored. To push a schema change or reseed
production content directly from a local shell:

```bash
node scripts/gen-prod-schema.mjs
npx prisma generate --schema=prisma/schema.production.prisma   # swaps local @prisma/client to the postgres build
DATABASE_URL="<neon connection string>" npx prisma db push --schema=prisma/schema.production.prisma --skip-generate
DATABASE_URL="<neon connection string>" npx tsx prisma/seed.ts
npx prisma generate   # IMPORTANT: swap the local client back to sqlite when done, or local `npm run dev` breaks
```

Re-running `prisma/seed.ts` against production is safe and idempotent —
every table it touches (islands, fruits, weapons, world actors, event
templates, poneglyphs) is upserted or fully owned by the seed, never
touches `User`/`Character` rows, so it can't destroy anyone's progress.
`scripts/delete-test-account.ts <username>` is the safe way to clean up
a smoke-test account from production afterward (never a blanket
`db:reset` there — that script is dev-only, SQLite-only).

Render service config that matters (set once, don't need to repeat):
`DATABASE_URL` (Neon connection string), `SESSION_SECRET` (random 64-hex,
generated once — rotating it logs everyone out), `NODE_ENV=production`
(fine at *runtime*, only dangerous combined with `npm install` in the
build step), build command
`npm install --include=dev && npm run db:prod-schema && npx prisma generate --schema=prisma/schema.production.prisma && npm run build`,
start command `npm run start`, plan `free`, region `oregon`.

## Roadmap (what's explicitly NOT done yet, roughly in likely priority order)

1. **AI Game Master, Phase 2: multiplayer orchestration.** Phase 1
   (single-player AI narration + free-text actions, then the free-roam
   roleplay pivot — narrate/explore split, round-by-round combat) is
   live. A first multiplayer slice — party presence, one shared scene per
   together crew, turn order, and explicit separation/rejoin — is now
   **also live** (see "Live multiplayer party presence" below). What's
   still not built: real-time push (today's party scene is still the same
   10s poll everything else uses, just now shared — see that entry for
   why this was an acceptable trade this round), and — the harder piece —
   genuine multi-actor combat where more than one player/NPC acts within
   the *same* fight. Right now a party member's own fight always stays
   solo (their own `PendingEncounter`, resolved exactly as in single-player,
   just echoed as a one-liner to the shared scene); an actual joint fight
   still means the existing deterministic `GroupBattle` (crew-vs-crew)
   system, not the AI-narrated round-by-round loop. Needs its own design
   pass if/when wanted: how `resolveExchange` would generalize past one
   attacker + one defender, and how AI narration would coordinate a
   beat where multiple humans are choosing actions inside the same
   exchange instead of one at a time.
2. Expanding Grand Line/New World further (14 islands now — see "World
   content" below).
3. Placing the remaining 2 Road Poneglyphs (Fragmento del Alba and
   Fragmento del Ocaso are placed; see "World content" below) — stays
   hard/scattered on purpose. Natural next holders per the existing
   lore hints: Fragmento Final has a `guardedBy` hint already pointing at
   Cipher Pol (a different island/power than Enies Lobby's CP-0 squad —
   maybe Mary Geoise itself, or a third Yonko); Fragmento del Abismo is
   still a pure mystery, open to invent freely.
4. More canon devil fruits/characters/weapons.
5. Kill-vs-spare consequence questlines deeper than the current one-off
   news-flavor hooks (`resolveMercyChoice` in `perform-action.ts`) — the
   user flagged (2026-09-23) that island lore in general should feel
   slower/richer, not just a first-visit blurb. AI narration + the
   free-roam pivot address the *prose quality* and *pacing* halves of
   that complaint (rich round-by-round combat, pure-roleplay scenes with
   no forced turn cost); deeper branching questlines with actual
   persistent consequences are still a separate, unaddressed ask.
6. **Mitigated (2026-09-23), not eliminated**: OpenRouter free-tier rate
   limits hitting during normal play, not just heavy testing — the user
   reported the dry "(La IA no respondió a tiempo)" fallback live in
   production. Diagnosed with real data, not guessed at: the account's
   OpenRouter key status (`GET /api/v1/auth/key`) showed the earlier
   $10 top-up had already worked exactly as expected
   (`is_free_tier: false`, `free_model_daily_requests` 61/1000 used) — the
   daily cap was never the problem. Production `ErrorLog` rows for
   `ai/narrate-scene` showed a real `429` and two request-aborted
   timeouts: the 4 free `:free`-suffixed models in `models.ts` share
   OpenRouter-wide capacity across *all* users of that model, so they can
   all be briefly saturated together even on a paid, nowhere-near-quota
   account — no amount of this account's own credit fixes that specific
   moment. Fix: `models.ts`'s `DEFAULT_MODELS` gained a 5th, paid,
   last-resort entry (`openai/gpt-4o-mini`, sub-$0.001/call) so that rare
   simultaneous-failure moment degrades to a slightly-paid real narration
   instead of the static fallback text. `openrouter-client.ts`'s
   `callOpenRouter` also now collects and logs *every* model's failure
   reason instead of only the last one, so a future investigation doesn't
   need production credentials pasted fresh into a session to diagnose —
   the old single "Last error" message was hiding which of the earlier
   free models actually failed and why. New `scripts/check-errors.ts`
   (dump the N most recent `ErrorLog` rows) added as a standing debug
   helper alongside `check-character.ts`. Verified: full suite (205
   tests) + `tsc --noEmit` stayed clean, deployed to Render, confirmed
   `live` via the deploy-status API and a `curl` 200 on the production
   URL. **Still not eliminated**: if the free models are saturated
   *and* the paid fallback also fails/is removed, the dry text can still
   appear — this is graceful degradation of a shared external capacity
   constraint, not a guarantee. Revisit if the paid fallback itself starts
   firing often enough to matter cost-wise (unlikely at current usage).

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

### Poneglyph holders fight back — detailed design brief from the user (2026-09-23)

Directly connects to the endgame above and extends what's already built
(`WorldActor.busyUntil`, the pursuit system, group battles). This is the
user's own explanation, captured close to verbatim so nothing gets lost —
**slice 1 (personality + grudge memory) is now DONE, see "NPC personality +
persistent grudge memory" below.** What's still genuinely open is marked
explicitly per bullet:

- **A Poneglyph holder's home turf has real weak points** — **still NOT
  built.** The "Lugarteniente de Barbanegra" fight already placed on Isla
  Cementerio is intentionally *not* a watered-down Yonko fight — it's a
  subordinate, because Blackbeard and his real crew aren't there. That's
  the pattern to generalize: whether a Poneglyph raid meets a lieutenant or
  the full crew should depend on where the `WorldActor` actually is right
  now (`currentFocus`/`busyUntil`), the same mechanic the background
  world-tick already uses. The grudge system below works entirely on top
  of the existing subordinate-only fights — it doesn't yet make "who you
  actually meet" dynamic.
- **Facing the real thing is lethal if you're not ready** — **still NOT
  built**, depends on the above (there's no "real thing" fight yet, only
  the subordinate).
- **NPCs should stay in character and remember specific players** — **DONE**
  (see "NPC personality + persistent grudge memory" below): `WorldActor.
  personality`, a real per-`(WorldActor, Character)` `Grudge` record
  (spike/decay/capped-probability, same shape `pursuit.ts` proved out for
  `poneglyphHeat`) written by real escape/spare/defeat outcomes — not the
  old 10-15% flavor-only news rolls — and read by both combat narration
  (a grudge-holder's dialogue references the specific past incident) and
  by a new explore-time ambush check (biases a specific grudge-holder's
  subordinate toward finding this specific character again). **Scope note
  on where this landed vs. the original ask**: the brief said "read... by
  `runWorldTick`'s actor-selection" — implemented instead as a per-
  character explore-time check (mirroring `pursuit.ts`'s `rollHunterAmbush`
  exactly) rather than touching the global world-tick's news simulation,
  since world-tick fires world-wide headlines, not per-character encounters
  — this achieves the same "grudge biases who comes after you" outcome
  through the architecture the project already uses for exactly this shape
  of problem. Dynamic escalation ("llamar a un almirante si algo se pone
  serio") landed as narration-only flavor at high heat (>100) — the
  trigger and heat math are fully deterministic, the AI only colors the
  prose, never spawns a mechanically different enemy — satisfying the
  "AI narrates, code decides" boundary without inventing a second boss tier.
- **A stealth option should exist**: sneak in, read the Poneglyph, get
  out without ever triggering a fight, for a player who plays it
  cautious instead of strong. **Still NOT built** — deliberately deferred
  out of the grudge-memory slice as an orthogonal new resolution path for
  the guardian events (a real alternative to combat, not a memory feature).
- **Escape should be its own mechanic, not a coin flip. If the player does
  escape, it has to matter** — **DONE**. `fleeCharacter` used to have zero
  consequence on a successful escape from even a boss; now, when the enemy
  is a grudge-linked `WorldActor` subordinate, a successful flee
  unconditionally posts real news, bumps bounty/notoriety, and spikes that
  actor's `Grudge` heat against this specific character (escaping costs
  more heat than losing a clean fight, since the NPC never got closure).
- **Defeating a beaten subordinate is not the same as defeating the
  Yonko** — **DONE, by scale, not by a separate consequence tier**: the
  grudge heat bump for beating the lieutenant (`GRUDGE_HEAT_SUBORDINATE_
  DEFEAT = 20`) is deliberately modest against the 150 cap, leaving real
  room below it for whatever beating the actual `WorldActor` would
  eventually mean once the "who you actually meet" mechanic above exists
  — there's no such fight yet to under- or over-weight.
- **Territory conquest**: beat the Yonko, their commanders, AND their
  army (very plausibly requiring multiple players cooperating), and
  their islands should become conquerable — the player (or players)
  can take over and effectively become the new Yonko. When multiple
  players contributed, who actually keeps the territory/title becomes
  a real in-fiction dispute between them, not something auto-resolved.
  **Still NOT built, needs its own design session**: how ownership
  transfers, what "being a Yonko" mechanically grants, and some fair way
  to arbitrate a multiplayer claim dispute (voting among contributors?
  whoever dealt the final blow? crew reputation split?) — all open
  questions, same as before.

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
typechecked. Only wired to the one placed Poneglyph so far when this was
written; now wired to two (see below) for free, since the grant path is
shared regardless of which Poneglyph it is.

**Second Poneglyph placement (Enies Lobby / CP-0) + production deploy**
(2026-09-23): see "World content" and "Deployment" above for the full
detail. Verified with the same rigor as the first placement, plus one
step further — forced a real character through `POST .../actions
{action:"mercy",spare:true}` (the exact real API route, not a direct
function call) against a manufactured `PendingEncounter` for "El
escuadrón de CP-0" (`scripts/force-poneglyph-encounter.ts` +
`scripts/set-character-island.ts`), confirmed `poneglyphsRead` and
`poneglyphHeat` updated correctly, then repeated the same
register → create → explore flow for real against the live production
URL over Neon Postgres before deleting the smoke-test account
(`scripts/delete-test-account.ts`). Full local Vitest suite (122 tests)
stayed green throughout; local dev DB was reset to clean-seeded state
afterward. Also added `GUIA_DEL_JUGADOR.txt` at the project root — a
Spanish, player-facing (not dev-facing) onboarding doc covering every
mechanic for someone joining to actually play; keep it in sync with new
player-visible systems the way this file stays in sync with the
architecture.

**Devil fruit weaknesses — can't swim + Kairoseki** (2026-09-23): the user
asked directly whether the canon "devil fruit users can't swim" rule was
implemented. It wasn't — flagged and fixed same session, both pieces:
- **Can't swim**: `EventBody.waterHazard` (`src/lib/engine/events.ts`) —
  when true, `resolveEvent`'s new `hasDevilFruit` param (6th, defaults
  `false`, so every old call site kept compiling) subtracts
  `DEVIL_FRUIT_WATER_PENALTY` (60) from the character's effective
  modifier before the skill check. The engine's own critical-roll rule
  (rolls 1-5/96-100 always crit regardless of modifier) means it's never
  a 100% wall either way — a DF user can still get lucky, a swimmer can
  still drown, just at wildly different odds. `perform-action.ts`'s
  `exploreCharacter` passes `!!character.devilFruitId`. One live event
  template, "El mar no perdona" (global, weight 2 — dropped from an initial
  6 after the user found it fired too often, `waterHazard: true`),
  shares its onSuccess/onFail/onCriticalFail text between DF and non-DF
  characters on purpose — the *same* ocean, nothing to a swimmer,
  everything to a fruit user; the asymmetry is entirely the probability
  shift, not different text. Gaining a fruit now also logs "el mar te
  rechaza para siempre" in `exploreCharacter`, and the equipment panel in
  `play/[id]/page.tsx` shows a permanent "No puede nadar" line whenever
  `character.devilFruit` is set.
- **Kairoseki (seastone) neutralizes it during imprisonment**:
  `computeBailBerries` (`economy.ts`) takes an optional `hasDevilFruit`
  param applying a 1.6x premium; `attemptPrisonRescue` (`rescue.ts`)
  takes an optional `prisonerHasDevilFruit` param subtracting
  `KAIROSEKI_RESCUE_PENALTY` (15) from the rescuer's effective modifier —
  a fruit-using prisoner is guarded more heavily. `captureCharacter`
  (`src/lib/game/prison.ts`) now takes an optional `devilFruitId` on the
  captured character and threads `hasDevilFruit` into both the bail
  calculation and the capture news post ("Le colocan grilletes de
  Kairoseki..."). Both existing callers (`group-battle.ts`'s
  `resolveDuelLoss`, and `prison.ts`'s own critical-fail-rescue path)
  updated to pass it through from the already-loaded Character row —
  no new query needed, the scalar was always there.
- NPCs (`WorldActor`) don't have a `devilFruitId` field at all — their
  fruits are flavor text only in `description`, never a tracked game
  object — and `NPCCompanion` never gets a fruit either. So there's
  nothing to enforce on the NPC side yet; if `WorldActor` ever gets a
  real devil fruit field, it should feed the same `waterHazard`/Kairoseki
  logic rather than growing a parallel system.
- Verified: 9 new engine tests (`events.test.ts`, `economy.test.ts`,
  `rescue.test.ts` — 131 total now), plus two live runs against
  `npm run dev`: granted a fruit via the new `scripts/grant-fruit.ts`,
  looped real `explore`/`engage`/`mercy` API calls
  (`scripts/verify-water-hazard.mjs`) until "El mar no perdona" actually
  fired and cost real HP; force-captured the same character and confirmed
  `bailBerries` was exactly the expected ×1.6 and the news post named the
  Kairoseki shackles. Local dev DB reset to clean-seeded state afterward.

**AI Game Master, Phase 1 — narration + free-text actions** (2026-09-23):
the user found explore/combat text "muy seco" (dry) — fixed static flavor
arrays and "X golpea a Y (12 de daño)" combat lines — and shared a
Fate-Core-style AI game-master prompt plus a real freeform roleplay
transcript with friends as the bar for what it should feel like. Also
asked for free-text player actions and directly chose, after being shown
the tradeoff, **text replaces the buttons as the primary input** (not a
safer "buttons decide, text only narrates" design) — meaning
classification is a real-state-changing decision in a permadeath game,
not cosmetic. Hard rule kept throughout: **the engine still computes every
number** (`src/lib/engine/*` untouched) — the AI only turns an
already-resolved outcome into prose, and classifies free text into a
pre-constrained valid-action set; it never invents an outcome.
- **New `src/lib/ai/` layer**, parallel to `engine/` (pure) and `game/`
  (Prisma orchestration): `models.ts` (`OPENROUTER_MODELS`, env-overridable
  via `OPENROUTER_MODELS`, defaults to a handful of OpenRouter free-tier
  models incl. `openrouter/free`, which itself round-robins a random free
  model per call); `openrouter-client.ts` (`callOpenRouter` — plain
  `fetch` against OpenRouter's OpenAI-compatible endpoint, no new
  dependency, loops the model list on failure, throws `AiUnavailableError`
  only once every model's exhausted); `narrate-prompt.ts` (pure prompt
  builders, `buildExploreNarrationPrompt`/`buildCombatNarrationPrompt` —
  unit tested for "the resolved numbers appear" and "the model is told
  never to invent outcomes"); `classify-action.ts` (see below);
  `narrate.ts` (`narrateExplore`/`narrateCombat` — never throw, fall back
  to the exact old static text on any AI failure, log via
  `logError("ai/narrate-explore"|"ai/narrate-combat", err, meta)`; also
  `getRecentMemory(characterId, take=8)` reusing the existing
  `GameLogEntry` query shape as the AI's "remembers character history"
  context — no new memory table needed for this phase).
- **Free-text classification safety** (`classify-action.ts`) — the
  central design concern given the user's "text replaces buttons" choice:
  the caller computes the actual valid action set for the character's
  *current* state first (e.g. only `engage`/`flee` during a
  `pendingEncounter.phase==="threat"`) and the model is only ever offered
  those; whatever it returns is re-validated against that same set in
  code, anything else becomes `"unclear"`; `"unclear"` is a real
  zero-side-effect no-op (never guessed at via keywords) — the player is
  asked to rephrase or fall back to a button; a small keyword heuristic
  (`KEYWORD_RULES`) fires ONLY when the OpenRouter call itself fails
  outright (network/timeout/all models down), never to override a
  model-seen-but-ambiguous `"unclear"`; every response is prefixed with
  `"(interpretado como: X)"` for transparency; the original explicit
  `{action:"..."}` buttons stay in the UI as a smaller secondary path
  that skips classification entirely. One extra hardening found through
  live testing (not assumed): `openrouter/free` picks a random free model
  per call, so quality varies — a weak pick misclassified clearly-phrased
  text in a live run. Fixed with a bounded retry (`MAX_ATTEMPTS = 2` in
  `classifyPlayerAction`) — still purely AI-driven and still only final
  after two genuine attempts, just reduces the false-`"unclear"` rate
  from model-rotation variance.
- **Wiring**: `perform-action.ts`'s `exploreCharacter` (non-combat
  resolution) and `engageCharacter` (combat resolution) now build their
  log via `narrateExplore`/`narrateCombat` instead of static
  arrays/round-by-round string concatenation; both gained an optional
  `intentText?` param carrying the player's free text into the prompt.
  `resolveFreeTextAction(characterId, userId, freeText)` (new, same file)
  computes the valid-action set from the character's pending-encounter
  state, calls `classifyPlayerAction`, throws on `"unclear"`, and
  dispatches to the matching existing action function
  (explore/train/rest/engage/flee/mercy_spare/mercy_finish), prefixing
  the result log with the interpretation line. The API route
  (`actions/route.ts`) accepts a new schema arm,
  `{freeText: string (1-500 chars)}`, alongside the original discriminated
  union, routing to `resolveFreeTextAction`. `play/[id]/page.tsx` now
  shows a prominent free-text `<textarea>` + "Actuar" button (Enter to
  submit) above the existing action buttons, which are kept but restyled
  smaller/secondary under an "O usa los botones:" label. **Scoping note**:
  AI narration was applied to explore/combat *resolution* (the two spots
  matching the "muy seco" complaint most directly) but not yet to the
  combat-trigger/threat-intro moment or to `fleeCharacter`/
  `resolveMercyChoice`'s narrative text, which still use static strings —
  a pragmatic scope cut for this phase, not a design decision; worth
  covering in a follow-up pass if the difference is noticeable in play.
- **Training cooldown** (separate small ask bundled into the same
  session): additive `Character.lastTrainedAt DateTime?` — null reads as
  "eligible now" so no existing character is affected. `trainCharacter`
  checks it against now-minus-30-minutes before calling `trainHaki`,
  throwing the existing `GameActionError` pattern with a Spanish cooldown
  message on a too-soon attempt, and sets it to `new Date()` on success.
  30 minutes was the user's explicit choice among options offered.
- **Enemy `personality`** (`EnemySpec.personality?: string` in
  `engine/events.ts`, purely additive/optional): backfilled on the four
  named/boss enemies in `prisma/seed.ts` (local crime boss, Arlong,
  Blackbeard's lieutenant, the CP-0 squad) so combat narration can stay
  in-character for named fights; minor mooks intentionally left without
  one, narrating competently-generic instead.
- **Bundled balance fix**: "El mar no perdona" (the water-hazard event
  from the devil-fruit-weakness work above) dropped from weight 6 to
  weight 2 in `prisma/seed.ts` — the user found it firing too often once
  it was live.
- **Security housekeeping**: the OpenRouter key the user pasted directly
  in chat now lives only in `.env` (already gitignored) as
  `OPENROUTER_API_KEY`; a second, Gemini-shaped key they also pasted does
  not match Google AI Studio's real key format (`AIzaSy...`) and was
  deliberately not used/built around — flagged to the user as likely the
  wrong artifact type. `.env.example` documents both `OPENROUTER_API_KEY`
  and the optional `OPENROUTER_MODELS` override with comments.
- **Verified**: `models.test.ts` (4), `narrate-prompt.test.ts` (11),
  `classify-action.test.ts` (13, incl. a retry-then-succeed case and a
  gives-up-after-two-attempts case added after the live model-rotation
  finding above) — full suite green, `npx tsc --noEmit` clean. Live,
  against the real OpenRouter API: `scripts/ai-narration-smoke.ts`
  (narration is real prose, not the static fallback; classification picks
  the right action for unambiguous text; a deliberately-bogus API key
  still falls back safely rather than throwing, for both narration and
  classification). Live, real browser: `scripts/ai-e2e-smoke.mjs`
  (register → create character → free-text explore → confirm the
  "(interpretado como: ...)" line and AI prose render → resolve whatever
  combat randomly triggered → train → confirm an immediate second train
  is blocked by the cooldown message → zero unexpected console errors,
  the two expected 400s from the deliberately-triggered
  unclear/cooldown paths filtered out of that check on purpose). Local
  dev DB reset to clean-seeded state afterward.
- **Deferred, not built**: full multiplayer AI orchestration (turn
  order, crew presence panel, same-crew narration sharing, free-text
  separation detection) was part of the user's original ask but
  explicitly deferred to its own phase — see Roadmap item 1.

**Free-roam roleplay pivot — narrate/explore split, round-by-round combat**
(2026-09-24, directly after Phase 1 shipped): live play surfaced two real
gaps in Phase 1's design, both from the user actually using it, not
guessed at. First, ordinary roleplay text that wasn't a clean button
equivalent (e.g. a bar/social scene) got rejected outright with "no
entendí" because the classifier only had `explore`/`train`/`rest` to
offer and `explore`'s keyword set was narrow. Second, the user was
explicit: they want to roleplay a fight gradually — describe one move,
see the AI/enemy respond, describe the next — not get an entire combat
dumped as one resolved paragraph. They also explicitly rejected pure
narrative combat ("nada de dados... derrotarnos entre sí") once shown the
risk it implied for a permadeath game, and picked the safer option: a
real roll still decides every exchange, but the player's described
tactic *biases* that roll.
- **`narrate` is now a first-class action** (`classify-action.ts`):
  pure roleplay/chat, zero engine call, zero stat change. It's the new
  default classification outside combat/training/rest — `explore` is
  reserved for text that reads as a genuine decisive commitment ("me
  interno en la jungla a buscar problemas", "me arriesgo a robar esto"),
  which is the one that still calls the engine and can cost HP/grant
  rewards. This means mechanical resolution only happens when the player
  actually commits to it, not on every conversational beat — matches the
  user's explicit "los datos... es el usuario quien diga después."
  `narrateSceneAction` (`perform-action.ts`) is the pure-roleplay handler;
  `buildSceneNarrationPrompt`/`narrateScene` (`ai/narrate-prompt.ts`,
  `ai/narrate.ts`) is its prompt/caller, with an explicit system rule that
  the AI may never grant/remove berries, XP, items, fruits, or cause
  damage/death in a narrate turn — only the engine can.
- **Combat is round-by-round now**, not resolved in one shot.
  `PendingEncounter` gained a `"fighting"` phase between `"threat"` (the
  original fight-or-flee commitment) and `"victory"`: once the player
  commits to fighting, each further free-text message resolves exactly
  one exchange via `engine/combat.ts`'s `resolveExchange` (exported
  `MAX_ROUNDS` reused as the same termination/tie-break rule `runCombat`
  always had), narrates it, and waits for the next message — continuing
  until someone's HP hits 0. `PendingEncounter` also gained `enemyHp`
  (live remaining HP, separate from the static max in `enemyJson`) and
  `roundNumber` to persist state between messages. `fleeCharacter` now
  accepts phase `"fighting"` too (escape mid-fight), not just the initial
  `"threat"` choice.
- **Tactic quality biases the roll, never decides it** — the answer to
  "nada de dados": the SAME classification call that reads the player's
  combat text also judges (when the action is `engage`) a bounded
  `tactic_modifier` (`MIN_TACTIC_MODIFIER`/`MAX_TACTIC_MODIFIER` = -15/20
  in `classify-action.ts`) reflecting how clever/well-suited the
  described move is, applied to the player's effective atk (full) and def
  (half) for that one exchange before `resolveExchange` rolls. The engine
  still 100% decides who actually lands a hit and who wins — the AI only
  ever shifts the odds, never picks a winner. This was originally a
  separate `assess-tactic.ts` AI call; merged into the same classify call
  after live testing showed 3 AI calls per combat round (classify +
  tactic + narrate) exhausting OpenRouter's free-tier rate limit almost
  every round — cut to 2 calls per round.
- **Combat/mercy-phase classification defaults changed too**: since
  `engage`/`flee` no longer decide a whole fight's *outcome* (just this
  round's roll bias), ambiguous text during an active fight now defaults
  to `"engage"` (keep fighting) instead of a real `"unclear"` no-op, both
  in the keyword fallback and the AI-path give-up-after-two-attempts
  case — reasoning: the engine's dice still protect fairness, so there's
  no reason to block the player mid-fight over phrasing. The
  `mercy_spare`/`mercy_finish` choice (a real, permanent, non-random
  decision) deliberately kept its strict no-default behavior — that one
  still requires an unambiguous read.
- **New `SceneMessage` model + "Escena" chat panel**
  (`play/[id]/page.tsx`): the full back-and-forth transcript (every
  player free-text line + every AI narration reply, in order) as its own
  prominent chat-bubble panel, instead of crammed into the existing
  `GameLogEntry`-backed "Bitácora" (which stays, now relabeled as a
  quick mechanical-summary ticker — "la escena completa está arriba").
  `getRecentScene` (`ai/narrate.ts`) reads this transcript as richer
  short-term context for narration prompts than the old raw
  `GameLogEntry` lines were (includes pure-roleplay turns, not just
  mechanical ones) — `getRecentMemory`/`GameLogEntry`-as-AI-context was
  removed, fully superseded.
- **UI**: the `Explorar`/`Luchar`/`Huir`/`Perdonar`/`Rematar` buttons are
  gone — free text is now the only way to do any of those, per the
  user's explicit "quita esos botones ya." Only `Entrenar`/`Descansar`
  remain as quick buttons (the user's own words: "yo dejaría lo típico de
  entrenar y descansar"), since those aren't roleplay moments. A
  "Pensando..."/"narrando..." spinner shows while an AI call is in
  flight, and the enemy's live HP bar renders during `"threat"`/
  `"fighting"` phases (`pendingEncounter.enemyHp`/`enemyMaxHp`, exposed
  by `api/characters/[id]/route.ts`).
- **Narration output validation** (`openrouter-client.ts`'s new
  `validate` option, `narrate.ts`'s `isValidNarration`): found live — a
  free-tier model's "narration" was literally the string `"User Safety:
  safe"`, a leaked moderation-classifier artifact, shown to the player
  as if it were real prose. Now every narration call rejects
  empty/too-short/refusal/moderation-shaped content and treats it exactly
  like a non-2xx response, moving to the next model in the fallback list
  instead of surfacing garbage.
- **Verified**: `classify-action.test.ts` (23, incl. the full
  narrate-vs-explore default split, the engage-default-during-combat
  behavior, and tactic_modifier extraction/clamping),
  `narrate-prompt.test.ts` (additions for the ongoing-vs-concluded combat
  framing and `buildSceneNarrationPrompt`), `narrate.test.ts` (new,
  `isValidNarration` cases including the exact leaked-artifact string) —
  188 tests total, full suite green, `tsc --noEmit` clean. Live:
  `scripts/ai-e2e-smoke.mjs` (rewritten for the new flow — free-roam bar
  text gets a narrator reply instead of "no entendí", no
  interpreted-as noise on a plain narrate turn, the old action buttons
  are gone) and new `scripts/combat-rounds-check.mjs` (uses new
  `scripts/force-threat-encounter.ts` to force a deterministic
  `"threat"`-phase fight so round-by-round resolution doesn't depend on
  random explore rolls — confirms the enemy HP bar starts full, changes
  after round 1, and combat concludes within `MAX_ROUNDS`), both against
  real `npm run dev` + a real OpenRouter key. Schema changes
  (`PendingEncounter.enemyHp`/`roundNumber`, `SceneMessage`) pushed to
  Neon production the same way as prior schema changes; code deployed to
  Render and confirmed live. Local dev DB reset to clean-seeded state
  afterward.
- **Known real-world constraint, not a bug**: heavy back-to-back testing
  in this session hit OpenRouter's free-tier rate limit outright (`429`
  across all 4 fallback models at once) during the round-by-round combat
  verification — every narration call correctly fell back to the dry
  static line rather than crashing or hanging, so the safety contract
  held, but it's a real reminder that the free tier has a ceiling under
  sustained rapid play (e.g. several fast combat rounds in a row). Not
  addressed further this session (would mean either a paid/higher-limit
  key or further cutting AI-call volume) — worth knowing if narration
  quality seems to degrade during a long play session.

**Live multiplayer party presence — shared scenes, turn order, separation**
(2026-09-23, the first slice of AI Game Master Phase 2): the user reopened
`Sugerencias.txt` and asked to build out the multiplayer piece that Phase 1
explicitly deferred. Re-read in full, it blends two different asks — this
slice covers the first (presence/shared scene/turn order/separation); the
second (NPCs with persistent memory/grudges/dynamic escalation) is written
down as an expansion of "Poneglyph holders fight back" above, not built
this round, to keep this change a shippable, reviewable size. Also
confirmed via `Sugerencias.txt`'s own examples (a bar scene between five
characters who are already crewmates) that "presence" here means **your
own crew**, not a new "private hosted session" concept — two different
crews on the same island stay exactly as before (read-only "Aventureros en
esta isla" list, plus the existing `GroupBattle` challenge system).
- **New `Party`/`PartySceneMessage` models** (`prisma/schema.prisma`):
  crewmates who are `ALIVE`, on the same island, and haven't explicitly
  separated share one `Party` row (`crewId` unique — one active party per
  crew at a time) with a `turnOrder` (captain first, JSON array of
  character ids), a `turnIndex`, and `awaitingNarrator` (true only in the
  narrow window between a human's free text and the AI's reply — blocks
  every other submit meanwhile). `Character` gained `partyId` (null =
  not currently sharing a scene) and `isSeparatedFromParty` (an explicit
  "I stepped away" flag, separate from just "not in a party right now" —
  needed so a character who's still physically on the same island as
  their crew doesn't get silently auto-rejoined; matches the user's own
  words, "uno se puede separar momentáneamente" while staying nominally
  present). `PartySceneMessage` is the shared transcript — distinct from
  the existing per-character `SceneMessage`, which stays exactly as-is
  and is what a character falls back to whenever they aren't in a party.
- **Lazily materialized/dissolved, no cron** — same request-driven style
  `tickWorldIfDue`/`WorldClock` already use. `syncPartyForCharacter`
  (`src/lib/game/party.ts`) runs at the top of every
  `GET /api/characters/[id]` (the existing 10s poll everyone already
  has), scoped to just that one character's own crew — cheap, no
  world-wide scan. It creates a party once 2+ crewmates are together,
  recomputes membership/turn order (restarting the cycle at `turnIndex`
  0) whenever who's actually together changes, and deletes the party
  outright once fewer than 2 remain — eventually consistent across a
  crew purely through each member's own next poll, no push/broadcast
  needed. This means the party feature reuses 100% of the existing
  polling infrastructure — no WebSocket/SSE was introduced, a deliberate
  choice matching the project's "no extra infra" convention and Render's
  single free-tier web service.
- **Turn order is enforced server-side, not just hidden in the UI**:
  `beginPartyTurn` (`party.ts`) checks whose turn it is and locks the
  party (`awaitingNarrator = true`) inside one `prisma.$transaction`
  (same check-then-flip pattern `world-tick.ts` already used) — a
  same-party member submitting free text out of turn gets a clear
  `GameActionError` ("Espera tu turno — le toca a X.") from the API
  itself, not just a disabled button. `advancePartyTurn` unlocks and
  moves to the next member; `releasePartyTurnLock` unlocks *without*
  advancing, used only for the leave_party confirmation step below (a
  cancelled/pending confirmation shouldn't cost the party's turn).
- **Personal combat always bypasses party turn order entirely** — the
  hard scope cut of this slice, matching Roadmap item 1's note above: a
  party member's own fight (`PendingEncounter`) resolves exactly as in
  solo play, immediately, on every message, never gated by whose turn it
  is in the shared scene — you can't be blocked from fighting for your
  life by group chat turn order. `resolveFreeTextAction`
  (`perform-action.ts`) only routes into the party-aware branch
  (`resolvePartyFreeTextAction`) when the character has **no**
  `pendingEncounter`; the moment `explore` (dispatched through the party
  path) triggers a fight, every further message from that character goes
  through the unchanged solo path instead, pulling them into their own
  mini-thread while the party's shared turn moves on to the next member.
  Once that personal fight is no longer "still fighting" (won, lost, or
  fled), a short one-line summary (`summarizeCombatForParty`) is echoed
  into the shared `PartySceneMessage` feed via `echoToParty` — satisfies
  "que puedan leer las acciones del otro" without inventing multi-actor
  dice resolution. A real *joint* fight is still the existing
  deterministic `GroupBattle` (crew-vs-crew) system, completely untouched.
- **One shared AI call per turn, same as solo play** — the user's
  "narrate" default and the tactic-modifier-merge discipline both exist
  specifically to keep AI-call volume low against OpenRouter's free-tier
  rate limit (see the free-roam pivot entry below); a naive multiplayer
  design that classified+narrated once per party member per beat would
  have directly reproduced that same problem, just multiplied by party
  size instead of call type. Instead: `buildPartySceneNarrationPrompt`/
  `narratePartyScene` (`ai/narrate-prompt.ts`/`ai/narrate.ts`) is a single
  call per human turn, addressed to the whole present roster (names,
  factions, levels) rather than one protagonist — exactly one classify +
  one narrate call, identical cost to solo play regardless of how many
  people are in the party. `classify-action.ts` gained one new
  `ActionId`, `"leave_party"` (only ever offered when the acting
  character currently has a `partyId`), classified in the same call as
  everything else — no extra AI call for that either.
- **Separation is a real confirm step, not instant** — per the user's
  explicit ask ("le ponga en pantalla al usuario: ¿te quieres separar de
  tus nakamas?"): free text read as `leave_party` returns
  `ActionResult.confirmRequired: "leave_party"` with **nothing mutated
  yet** — the UI (`play/[id]/page.tsx`) renders an inline Sí/Ño instead of
  appending to the feed; only clicking "Sí, separarme" actually posts
  `{action:"confirm_leave_party"}`, which is what calls `confirmLeaveParty`
  (sets `isSeparatedFromParty`, clears `partyId`, echoes a line, dissolves
  the party if that drops it below 2). A dedicated "Separarte del grupo"
  button offers the same confirm UI without needing to type anything —
  clicking an explicit button *is* the confirmation, same convention as
  the mercy-choice buttons skipping classification entirely. Rejoining
  (`{action:"rejoin_party"}` → `rejoinParty` → clears the flag and calls
  `syncPartyForCharacter` immediately) only appears as a button when
  actually possible — same crew, same island, someone still there.
- **UI**: the solo "Escena" panel is swapped for a "Escena compartida"
  panel whenever `character.party` is set (bubbles gain an author-name
  label so more than two roles can render sensibly; the player's own
  messages stay gold-right-aligned, others' own text left-aligned in a
  bordered bubble, the narrator's stays the existing dark bubble); a turn
  label ("Es tu turno." / "Le toca a X." / "El narrador está
  pensando...") sits next to the "¿Qué haces?" label, and the textarea/
  Actuar button/quick Entrenar/Descansar buttons all disable together
  when it isn't this character's turn (never when they have a
  `pendingEncounter`, matching the bypass rule above). The crew panel
  labels each member "contigo ahora" / "en esta isla, por su cuenta" /
  "en otra isla" using the new `partyId`/`currentIslandId` fields the
  API now exposes on `crew.members`.
- **Verified**: `party-turns.test.ts` (new, pure `buildTurnOrder`/
  `nextTurnIndex`), `classify-action.test.ts` additions (`leave_party`
  valid-set/keyword-fallback cases), `narrate-prompt.test.ts` additions
  (`buildPartySceneNarrationPrompt`) — 205 tests total, full suite green,
  `tsc --noEmit` clean. Live: new `scripts/party-multiplayer-smoke.mjs`
  (two real accounts/characters via two Playwright browser contexts — a
  crew founded and joined, both land on the shared starting island,
  captain's turn goes first, the second member's Actuar button is
  server-and-UI blocked out of turn, both clients see the same
  transcript with both names after each takes a turn, sending
  separation text produces the confirm prompt instead of acting
  immediately, confirming it drops the member to a private scene and
  dissolves the now-too-small party for the remaining member too, and
  rejoining via the button restores the shared scene on both clients) —
  11/11 checks passed against real `npm run dev` + a real OpenRouter key.
  One `429` (all 4 fallback models rate-limited) was hit during this run
  and degraded gracefully to the documented fallback line rather than
  breaking anything — the same known, already-documented free-tier
  ceiling from the free-roam pivot below, not a new issue. Local dev DB
  reset to clean-seeded state afterward. Schema changes need the same
  documented push to Neon production (`gen-prod-schema.mjs` →
  `prisma generate --schema=...production.prisma` → `prisma db push` →
  `prisma generate` back to sqlite) before deploying.

**Interactive route map + player guide on GitHub Pages** (2026-09-23,
same session as the multiplayer party slice): the user said plainly they
genuinely don't know how to progress — what each island requires, how
leveling actually works (they only knew Haki training, not that level
comes from XP via explore/combat), what's currently in the game at all.
Asked for a real interactive route map plus an update to a `guia.html`
they'd made themselves, both hosted on **GitHub Pages** rather than
served by the Next.js app — explicitly to avoid loading Render for
reference material that rarely changes, and because the repo is public
(`Kelvin0880/OnepieceRol`) so Pages is free.
- **New `docs/` folder**, pages-enabled via `gh api repos/.../pages`
  pointing at `main` branch, `/docs` path (no separate `gh-pages` branch,
  no build step — plain static HTML, same self-contained CDN-Tailwind/
  Font-Awesome style as the user's own `guia.html`). Live at
  `https://kelvin0880.github.io/OnepieceRol/`.
  - `docs/mapa.html` — the interactive map: every island's danger,
    minimum level, faction control, description, and connections is
    **hand-transcribed from `prisma/seed.ts`'s `islandDefs`/`adjacency`**
    (not fetched live — this is static reference content, update it by
    hand whenever islands are added/changed there) rendered as an SVG
    node graph the user can click through, plus an explicit "cómo subo
    de nivel" box addressing the exact confusion above (training only
    raises Haki; level comes from `grantXp`, fed by successful
    `explore`/combat outcomes).
  - `docs/guia.html` — the user's own guide, updated with the shared
    party-scene mechanic and the same leveling clarification, kept in
    the same visual style they'd already built.
  - `docs/index.html` — a small landing page linking both.
- **In-app link**: `play/[id]/page.tsx` gained a "Mapa y Guía" button
  (header, next to Noticias) opening a small modal with direct links to
  both pages (`target="_blank"`) — the modal the user explicitly asked
  for, not a full redesign of in-app help.
- Verified: `scripts/check-map-page.mjs` (Playwright against the local
  `file://` HTML — confirms the SVG map renders, node click updates the
  detail panel with the right island data, zero console errors) and
  `scripts/check-guide-modal.mjs` (real browser against `npm run dev`,
  confirms the modal opens and both links point at the live Pages URLs).
  Pages build confirmed live via `gh api .../pages/builds/latest` polling
  (`"status":"built"`) and a `curl` 200 on all three URLs before
  reporting done.
- **Keep in sync**: if `prisma/seed.ts`'s island list, connections, or
  Poneglyph placements change, update the `ISLANDS`/`EDGES` data at the
  top of `docs/mapa.html`'s `<script>` block to match — nothing wires
  this automatically, by design (a static reference page has no server
  to call).

**Let players permanently delete a character** (2026-09-23): a real
row-level delete (`src/lib/game/delete-character.ts`'s `deleteCharacter`),
not a status flip — clears every table that belongs only to the character
(logs, scene transcript, inventory, pending encounter, imprisonment,
companions, battle participations, grudges). Hands off crew captaincy or
dissolves the crew if they were its only member (`Crew.captainId` is a
plain string, not FK-enforced, so it'd otherwise dangle); dissolves their
live `Party` if it drops below 2 members. Deletes instanced common gear
(see the `Weapon.name` uniqueness note above) but returns any 1-of-1 named
meito to the world unclaimed rather than deleting it. World-facing history
(`NewsItem`, `PartySceneMessage` transcripts, old `GroupBattle` records) is
deliberately left as stale non-FK-enforced references — deleting a
character doesn't rewrite the world's past, same as permadeath. UI: a
"Borrar" button + inline Sí/No confirm on each character row on the
character-list page (`src/app/page.tsx`), same confirm convention the
party-leave flow already established. Verified with a deterministic
cascade check (`scripts/delete-character-check.ts`, 13 assertions against
the real dev DB — crew handoff, party dissolution, meito-survives-unclaimed
vs. common-gear-deleted, every dependent table emptied) plus a real-browser
run (`scripts/delete-character-ui-check.mjs`) confirming the character
actually disappears from the list. No schema change.

**OpenRouter narration fallback hardening** (2026-09-23): the user hit the
dry "(La IA no respondió a tiempo)" fallback live in production during
normal play, not just heavy testing — flagged in Roadmap item 6 below as
"not urgent" until this. Diagnosed with real data (the account's
`GET /api/v1/auth/key` status, and production `ErrorLog` rows), not
guessed at: the earlier $10 top-up had already worked exactly as intended
(`free_model_daily_requests` 61/1000 used, nowhere near the cap) — the
actual cause was the 4 free `:free`-suffixed models in `models.ts` sharing
OpenRouter-wide capacity across *all* users of that model, so they can
occasionally all be briefly saturated together regardless of this
account's own headroom. Fix: `models.ts`'s `DEFAULT_MODELS` gained a 5th,
paid, last-resort entry (`openai/gpt-4o-mini`, sub-$0.001/call) so that
rare simultaneous-failure moment degrades to a slightly-paid real
narration instead of the static fallback text; `openrouter-client.ts`'s
`callOpenRouter` now collects and logs every model's failure reason
instead of only the last one, so a future investigation doesn't need
production credentials pasted fresh into a session. New
`scripts/check-errors.ts` (dump the N most recent `ErrorLog` rows) added
as a standing debug helper. No schema change; deployed same day.

**NPC personality + persistent grudge memory — "Poneglyph holders fight
back," slice 1** (2026-09-23): the user reopened `Sugerencias.txt` and
asked to build the piece the multiplayer party slice explicitly deferred —
see the "Poneglyph holders fight back" design brief above for the full
context and which of its bullets this does/doesn't cover (short version:
personality + grudge memory is DONE; dynamic "who you actually fight,"
stealth approach, and territory conquest are still open, deliberately kept
out of this slice's scope).
- **`WorldActor.personality`** (additive `String?`): a short in-character
  voice line, same shape as the existing `EnemySpec.personality` but
  persistent across encounters instead of one-shot. Backfilled on all ~10
  seeded actors (Shanks, Marshall D. Teach, Kizaru, Sakazuki, Rob Lucci,
  etc.) in `prisma/seed.ts` — the upsert's `update` clause was changed from
  `{}` to actually write `personality` on every reseed, so re-running the
  seed against already-existing production `WorldActor` rows backfills it
  instead of silently no-op'ing (a real gotcha caught before it shipped:
  the original upsert only set fields on *create*).
- **New `Grudge` model** (`worldActorId`, `characterId` — plain strings,
  not FK-enforced, matching the existing `Crew.captainId` convention):
  per-(NPC, character) memory of the latest incident, with the same
  spike/decay/capped-probability shape `src/lib/engine/pursuit.ts` already
  proved out for `poneglyphHeat` — new sibling `src/lib/engine/grudge.ts`
  (`heatAfterGrudgeIncident`, `heatAfterMercy`, `decayGrudgeHeat`,
  `rollGrudgeAmbush`, 14 tests). Escaping spikes heat more than losing a
  clean fight (`GRUDGE_HEAT_ESCAPE` 35 vs. `GRUDGE_HEAT_SUBORDINATE_DEFEAT`
  20, out of a 150 cap) — the NPC never got closure; sparing *lowers* heat
  (`heatAfterMercy`) — mercy is remembered too, not just hostility. Each
  row also denormalizes the exact enemy snapshot (`enemySnapshotJson`) and
  a short past-tense note (`lastIncidentNote`) from the incident that last
  touched it, so a future ambush or narration line never has to re-derive
  either from seed data.
- **Wired to the two encounters that already had real lore linkage**:
  `EnemySpec`/`StoredEnemy` gained an optional `worldActorId`, set in
  `prisma/seed.ts` on "Lugarteniente de Barbanegra" (→ Marshall D. Teach)
  and "Agente de CP-0" (→ Rob Lucci) — the two boss fights that were
  already narratively "a subordinate, not the real power" (see "World
  content so far" above), just with nothing in the DB encoding that link
  before now. `src/lib/game/grudges.ts` (`recordGrudgeIncident`,
  `recordMercyIncident`, `decayGrudgesForCharacter`,
  `rollGrudgeAmbushForCharacter`, `getGrudgeContextForNarration`) is the
  Prisma-facing layer `perform-action.ts` calls into:
  - `fleeCharacter`: a successful escape from a grudge-linked enemy used
    to have **zero** consequence, even against a boss — now it always (not
    probabilistically) posts real news, bumps bounty/notoriety, and spikes
    the grudge. This was the literal "it has to matter" gap the design
    brief named.
  - `resolveMercyChoice`: the old 10%/15% `Math.random()` "jura no
    olvidar"/"rumores de venganza" news rolls wrote nothing durable — now
    a real `Grudge` write always happens (spare → relief, finish →
    subordinate-defeat spike) when the enemy is grudge-linked; the flavor
    news post itself stays probabilistic, matching the previous feel.
  - `exploreCharacter`: a new grudge-ambush check sits right next to the
    existing poneglyph hunter-ambush check (same lazy-per-explore shape,
    at most one ambush per explore, unconditional heat decay every
    explore regardless of outcome) — a grudge-holder's subordinate can
    come looking for a specific character again, reusing that grudge's
    denormalized enemy snapshot so it's the *same* fight, not a
    re-rolled one.
  - Combat narration (`engageCharacter` → `narrateCombat`): when the
    enemy is grudge-linked, `getGrudgeContextForNarration` feeds a short
    "remembers this specific history" line into the new
    `CombatNarrationInput.grudgeContext` field — omitted entirely on a
    first meeting. Above `CRITICAL_HEAT_THRESHOLD` (100), an extra
    narration-only hint tells the model the NPC may threaten to call in
    backup — satisfies "llamar a un almirante si algo se pone serio"
    without inventing a second mechanical enemy tier; the trigger
    (heat > threshold) and the actual enemy stats stay fully
    deterministic, the AI only colors the prose.
  - `deleteCharacter` (built earlier this session) gained one more
    cleanup line — `Grudge` rows have no historical value once their
    character is gone, unlike `NewsItem`/scene transcripts, so they're
    deleted rather than left stale.
- **Verified**: `grudge.test.ts` (14, mirrors `pursuit.test.ts`'s
  structure) — 219 tests total, full suite green, `tsc --noEmit` clean.
  Deterministic: `scripts/grudge-check.ts` (12 assertions against the real
  dev DB, direct function calls — forces a lieutenant encounter via a
  self-contained helper that reads the *actual* seeded template body
  instead of hardcoding a copy, unlike the existing
  `force-poneglyph-encounter.ts`; boosts test-character agility so
  `fleeCharacter`'s real skill check succeeds reliably; confirms escape
  news/bounty/grudge-write, defeat raises heat further, mercy lowers it,
  and a grudge-ambush eventually fires at max heat reusing the exact
  denormalized snapshot). Live browser: `scripts/grudge-ui-check.mjs` +
  new `scripts/force-grudge-ambush.ts` helper — confirms a grudge-ambush
  encounter renders the right enemy name and full-HP bar, a combat round
  resolves normally, zero console errors (narration prose itself isn't
  asserted, same scope `combat-rounds-check.mjs` already uses, since it's
  non-deterministic AI text). Schema change (`WorldActor.personality`,
  new `Grudge` model) pushed to Neon production the same documented way as
  every prior schema change; code deployed to Render and confirmed live.
  Local dev DB reset to clean-seeded state afterward.

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
