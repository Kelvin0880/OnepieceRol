# Grand Line RPG — project notes for Claude

A text-based, multiplayer One Piece RPG. AI-judged resolution (NO dice anywhere: an AI referee/judge decides, code only bounds and applies; never scripted outcomes), real permadeath, a world that keeps
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
   scratch: `scripts/ai-e2e-smoke.mjs` (register → create character →
   explore → fight → mercy choice → news), `scripts/crew-smoke.mjs` (two
   accounts, found/join a crew, verify mutual presence),
   `scripts/battle-smoke.mjs` (four accounts, two crews of two, full
   N-vs-N challenge → matchup builder → accept → resolved outcome on both
   sides). All three require `npm run dev` already running and print
   `PASS`/`FAIL` plus screenshot paths.
5. Full regression: `node scripts/run-all-checks.mjs` (unit tests, tsc, every DB check and browser check; resets the dev DB where a script needs a clean world; summary in `shots/regression.log`). Slow: many scripts call the real AI.
6. **After verification, reset the dev DB to a clean seeded state** so
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

**47 islands** today (single source of truth: `prisma/seed.ts` plus the wave files it imports, e.g.
`src/lib/game/islands-wave4.ts`). The original East Blue starts (Pueblo Foosha/pirate, Cuartel Marine
G-5/marine, Isla Baltigo/revolutionary, Isla Gecko/bounty hunter, **Tequila Wolf/CP-0** since 2026-09-25),
the Paradise chain from Reverse Mountain, and the New World up to Laugh Tale. `Island.minLevelToEnter`
(checked in `travelCharacter` via `engine/travel.ts`'s `canEnterIsland`) refuses travel below the
requirement. Later waves only ADD islands and routes (the seed links each new island both ways); keep
`docs/mapa.html` in sync (its ISLANDS/EDGES data block).

**Full canon character roster + devil fruit catalog now live in
`WORLD_LORE.md`** (2026-09-23) — read it before touching `WorldActor`,
`DevilFruit`, or the news system; it's the durable source of truth for
faction/rank/canon bounty/canon fruit data, same role `prisma/seed.ts`
plays for islands. Short version: 35+ devil fruits (some now
`isSingleton`-locked to a specific canon character, duplicable otherwise
— see WORLD_LORE.md's "Devil fruit duplication rules"), 6 named meito + 5
common starter weapons, ~41 world actors across every faction (Yonko,
Admirals, Warlords, Revolutionary command, Cipher Pol, and the full Straw
Hat crew) who act independently via the lazy world-tick — now
faction-gated (see Roadmap's "Faction-aware world news" entry) instead of
picking a random actor for any event. 4 Road Poneglyphs — **two placed**:

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
2. Expanding Grand Line/New World further (26 islands now — see "World
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
   **Follow-up found the same day, 34 minutes after that fix went live**:
   a real request hit 4-of-5 models failing in a row (three timeouts, one
   429) — caught live by re-checking `ErrorLog` right after deploying,
   not assumed fixed just because the deploy succeeded. The bug wasn't
   the model list itself; it was that `callOpenRouter` gave *every*
   attempt its own full fresh `timeoutMs` regardless of how many earlier
   ones had already burned theirs — a run of slow/hanging models could
   make the player wait `models.length * timeoutMs` (up to ~50s for the
   5-model list) before ever seeing the fallback line. Fixed by giving
   the whole fallback loop one overall wall-clock budget (2x the
   per-model timeout) instead: each attempt gets whatever's left, and one
   with under a second left is skipped outright rather than fired with a
   doomed near-zero timeout. Caps the worst case at ~20s instead of ~50s.
   New `openrouter-client.test.ts` (4 tests, mocks `fetch` directly —
   first file in `ai/` to do this) covers the fallthrough-on-failure
   behavior and, with a simulated hang, asserts the budget actually cuts
   the loop short instead of trying all 5 models to completion.
   `check-errors.ts` gained an optional `[count]` arg and stopped
   truncating the message to 250 chars — that truncation is exactly what
   hid this bug's real shape (`openai/gpt-4o-mini: This operation was
   aborted`) on the first read. 223 tests total, `tsc --noEmit` clean,
   deployed and confirmed live the same way as every other change here.
   **Second follow-up, same day**: the user hit the fallback again right
   after that deploy and asked directly whether the paid model had also
   run out of quota. Checked with real data, not assumed: OpenRouter's own
   `GET /api/v1/auth/key` showed `limit_remaining: 4.998` of a `$5` limit
   and `free_model_daily_requests` 88/1000 — nowhere close to any cap. The
   actual bug was an interaction between the two fixes above:
   `models.ts`'s `DEFAULT_MODELS` still had `openai/gpt-4o-mini` *last*,
   behind 3 free named models, so once the time-budget fix existed, a bad
   stretch of those 3 being slow could burn the whole shared budget before
   the paid model was ever attempted — logged as "skipped, narration time
   budget exhausted." Fixed by moving it to 2nd position (right after
   `openrouter/free`), so it's one of only two attempts that reliably get
   a real timeout slice instead of the last of five competing for
   dwindling leftover time. No test asserts list order, so this was a
   pure reorder — full suite (223) and `tsc --noEmit` still clean,
   deployed and confirmed live.
   **Third follow-up, same day, same hour**: the reorder fixed the
   "skipped" case but not the underlying shape of the bug — a request
   right after that deploy logged BOTH the free router and the paid model
   as "This operation was aborted." Re-testing OpenRouter directly a few
   minutes later showed both responding fast and normally (gpt-4o-mini
   ~3.2s, the free router ~0.7s) — genuinely transient upstream
   congestion in that moment, not a code bug, but it exposed the real
   structural gap: the two were still tried strictly *sequentially*, so a
   hanging free-router call fully blocked the paid model from even
   starting until the free one had already burned its whole timeout.
   Reordering it to 2nd place didn't help if it never got a turn. Fixed
   properly this time: `callOpenRouter` now fires the first two models
   (free router + paid backup) at once and races them — whichever answers
   first wins, the loser is aborted immediately (negligible extra cost,
   an aborted request generates ~no tokens). Any models beyond the first
   two are still only tried sequentially afterward, if both raced
   attempts fail. New test asserts the fix directly (a hanging first
   model no longer blocks a fast second one from succeeding quickly) —
   224 tests total, `tsc --noEmit` clean, deployed and confirmed live.
   This is the actual structural fix; the previous two entries were real
   but incomplete steps toward it.
7. **DONE 2026-09-23 (see "Second pass" above).** ~~Silent auto-compaction of scene/AI context~~ (flagged by the user
   2026-09-23, explicitly deferred — "esto lo harás después"). Right now
   `getRecentScene`/`memorySummary` bound context by a fixed recent-message
   count (see `narrate.ts`), not by actually summarizing older history —
   the user wants the AI to compact long-running scene context
   automatically and invisibly (no player-visible interruption, no
   perceptible pause) so it keeps full effective context without token
   growth being unbounded. Likely builds on the existing
   `updateCharacterMemory`/`memorySummary` mechanism (already does
   AI-driven compaction on combat/mercy beats) rather than a new system —
   probably needs it to also fire for long pure-`narrate` scene stretches,
   which today never touch `memorySummary` at all.
8. **DONE 2026-09-23 (see "Second pass" above).** ~~Travel needs real limitations, not unlimited free hops.~~ Flagged by
   the user in the same message as #7, same "later" status. Today
   `travelCharacter` (`src/lib/game/perform-action.ts`) has zero rate
   limiting — a character can hop island to island as many times as they
   want, back to back. The user wants a cooldown (shape TBD: fixed real-
   time cooldown like `lastTrainedAt`'s 30 minutes, a berries/stamina
   cost, or danger-scaled) so travel becomes a real decision, not a free
   action.

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

**Faction-aware world news + canon character codex + devil fruit
duplication** (2026-09-23): the user hit a real logic bug live in
production — "Kizaru es visto reclutando nuevos aliados," an Admiral doing
something only a pirate would plausibly do — and asked for the news system
to be genuinely faction/rank-aware, not just fixed for that one case. Full
detail and the actual roster/fruit data live in `WORLD_LORE.md` (new,
project root) — read it before touching `WorldActor`, `DevilFruit`, or the
news system. Summary of what changed:
- **Root cause, confirmed by reading the code, not guessed**:
  `runWorldTick` (`src/lib/engine/world.ts`) picked a random available
  `WorldActor` for ANY event template with zero regard for
  category/faction — any of the 10 then-seeded actors could star in any
  event, including ones that only made sense for one faction.
- **New `FactionType` enum** (`PIRATE`/`MARINE`/`REVOLUTIONARY`/
  `CIPHER_POL`/`BOUNTY_HUNTER`/`CIVILIAN`/`UNAFFILIATED`) on `WorldActor`,
  distinct from `Character`'s existing `Faction` enum (that one only
  covers what a player can pick, not the full canon cast).
  `WorldEventTemplate.allowedFactionTypes` (JSON array, nullable) gates
  which actors are eligible per template; `runWorldTick` now filters
  strictly — a faction-gated template with no eligible actor available
  skips the tick entirely (`null`) rather than either faking a
  wrong-faction actor or firing with nobody to name. `WorldActor` also
  gained `factionName` (display label), `rankLabel` (free-text override
  for `role`'s coarser enum), `canonBounty` (`BigInt` — real canon
  numbers like Shanks' 4,048,900,000 overflow `Character.bounty`'s
  Int32), and `canonWeapon` (flavor text).
- **~11 old hand-written templates → ~16 faction-specific ones**
  (`prisma/seed.ts`), each now just a short **event shape**
  (`promptHint`) instead of full prose — MARINE-only (patrols,
  deployments, Buster Calls), PIRATE-only (recruiting, territory wars,
  Poneglyph hunts, mutinies, skirmishes), BOUNTY_HUNTER-only (collecting a
  bounty), REVOLUTIONARY-only (sabotage, liberating settlements),
  CIPHER_POL-only (covert ops), and a few no-actor-required government
  announcements. Old hand-written `bodyJson` variants are kept, but now
  purely as the **offline fallback** if the AI call below fails.
- **AI-generated news prose** — `ai/narrate-prompt.ts`'s
  `buildNewsNarrationPrompt`/`buildBountyDigestPrompt` +
  `ai/narrate.ts`'s `narrateNews`/`narrateBountyDigest`, following the
  exact established "pure prompt builder + never-throws caller + static
  fallback" pattern every other narration type uses. The news-specific
  hard rule directly answers the user's other worry ("no puedes poner
  noticias graves a la ligera de muerte... o captura"): the AI is
  explicitly forbidden from narrating the death, permanent capture, or
  dethroning of a named canon actor as an accomplished fact, since no
  such mechanic exists yet — it can narrate skirmishes/near-misses/
  deployments freely, just never a confirmed permanent outcome the engine
  never actually applied. `world-tick.ts` calls this once per ~30-minute
  ambient tick (unchanged interval — the bug was content quality, not
  frequency) with the real actor's faction/rank/bounty/personality as
  context.
- **New, much rarer periodic bounty digest** (`tickBountyDigestIfDue`,
  `WorldClock.lastDigestAt`, 6-hour interval, own `severity: "digest"`
  news item) — satisfies "cada intervalo se publica recompensas de los
  piratas importantes" as an actual roundup of real canon bounties,
  without adding noise to the ambient tick.
- **`NewsItem.severity`** (`"normal"`/`"digest"`/`"major"`) added and set
  explicitly at every `postNews` call site — player
  death/capture/poneglyph-reads/group-battle outcomes are `"major"`,
  giving the news UI real visual hierarchy immediately, independent of
  any canon-actor mechanic.
- **News UI redesign** (`src/app/news/page.tsx`,
  `src/app/api/news/route.ts`): real cursor pagination (`?cursor=&limit=`,
  was a hardcoded `take: 40` with none) and `?category=` filtering;
  day-grouped sections ("Hoy"/"Ayer"/dated), category filter chips,
  severity-based card treatment (bordered/larger for `"major"`, a
  distinct roundup style for `"digest"`), "Cargar más" button.
- **Devil fruit duplication — a real mechanic, not just a rule tweak**:
  found live that `DevilFruit.name` was `@unique` (plus
  `Character.devilFruitId` `@unique`), so EVERY fruit — not just the
  "main" ones — was already a hard DB singleton; "fruits can repeat
  except the main ones" wasn't implementable without a real schema
  change. Fixed: `name` lost `@unique`; new `isSingleton Boolean`; the
  full 27→35-entry catalog moved out of `prisma/seed.ts` into new
  `src/lib/game/devil-fruit-catalog.ts` (single source of truth, shared
  by the seed and by drop logic — same principle as `common-gear.ts`).
  `tryDropFruit` (`perform-action.ts`) now creates a **fresh row** per
  common-fruit grant (mirrors `Weapon`'s non-unique-name/fresh-instance
  pattern exactly) instead of picking from a DB "unclaimed" pool;
  singleton fruits are filtered out of that pool entirely and only exist
  as the one seeded row, linked to their canon `WorldActor` via the new
  `WorldActor.devilFruitId`. A found-live gotcha worth remembering: on a
  reseed against an already-seeded dev DB, the fruit-seed loop originally
  did `findFirst ?? create`, which silently left a pre-existing row's
  `isSingleton` at the schema default (`false`) forever since it never
  updated an already-found row — fixed by always `update`-ing the found
  row's fields to match the catalog, not just create-if-missing.
- **~31 new `WorldActor` rows** (full Straw Hat crew incl. Luffy as a 4th
  active Yonko, ex-Warlords, Revolutionary leadership, more Cipher Pol,
  several Worst-Generation captains) on top of the 10 already seeded —
  full table in `WORLD_LORE.md`. Deliberately excluded: historically
  inactive canon figures (Kaido, Big Mom, Whitebeard, Ace — the existing
  roster already implies a post-their-fall timeline, and `WorldActor` has
  no deceased/retired status field yet).
- **Verified**: `world.test.ts` gained faction-gating cases (a
  MARINE-only template never resolves to a PIRATE actor across 100+ seeded
  runs; an empty-eligible-actor tick returns `null` gracefully;
  `promptHint` carries through) — 227 tests total, full suite green,
  `tsc --noEmit` clean. Deterministic: new `scripts/world-news-check.ts`
  (confirms two `DevilFruit` rows can share a name now; singleton fruits
  are correctly linked to their `WorldActor`; 300 simulated ticks never
  once picked a faction-incompatible actor; the digest produces exactly
  one new item citing a real canon bounty). Live, real OpenRouter API:
  new `scripts/world-news-ai-smoke.ts` — confirmed a MARINE-context call
  actually narrates Kizaru running a patrol (not recruiting), a
  PIRATE-context call narrates Buggy recruiting crew, and the bounty
  digest cites the real supplied canon figures, none of the three ever
  claiming a death/execution/permanent capture. Schema changes (`WorldActor`
  faction/rank/bounty/fruit fields, `DevilFruit.isSingleton` +
  non-unique `name`, `WorldEventTemplate.allowedFactionTypes`/
  `promptHint`, `NewsItem.severity`, `WorldClock.lastDigestAt`, new
  `FactionType`/`NOTABLE_PIRATE` enum values) pushed to Neon production
  the same documented way as every prior schema change; code deployed to
  Render and confirmed live. Local dev DB reset to clean-seeded state
  afterward.

**Roleplay-first combat, stamina, fruit evolution, CP-0, 1v1 duels**
(2026-09-23): triggered by a live bug — a player attacked a bar patron in
free text and the classifier read it as `explore`, which ignores the text and
rolled an unrelated random encounter. Full brief, status per item and an
implementation map live in **`ROLEPLAY_DESIGN.md`** (read it before touching
combat/narration); the user's roleplay etiquette (Mano Negra / Mano Blanca)
is in `Reglasrol.txt` and is injected into every narrator prompt as
`ROLE_RULES`. Summary:
- New `attack` action: classifier returns target/tier/technique/tactic;
  `attackCharacter` builds the named target as a real enemy from the player's
  own stats (`engine/scene-enemy.ts`) and resolves round 1 with the player's
  move. Combat narration now gets every roll (misses/blocks too) in order.
  `narrateEncounterIntro` ties explore-triggered threats to what the player wrote.
- Stamina/fatigue (`engine/stamina.ts`), techniques (haki/fruit, cost, silent
  downgrade, growth from use: `engine/techniques.ts`), fruit phases +
  Awakening (`engine/fruit-mastery.ts`, replaces "awakened at level 40"),
  Conqueror's Haki now actually rolls after a breaking-point win. Glue in
  `game/combat-prep.ts`. Passive bonuses were halved in `character-stats.ts`;
  the other half is earned by describing the technique.
- New player faction **CP-0** (`Faction.CP0`, Loguetown start, CP10→Gorosei ladder, captures like Marines).
- **1v1 duels** (`Duel`, `game/duel.ts`): simultaneous moves, engine resolves,
  AI narrates; non-lethal, copy-of-maxHp. While a duel is ACTIVE the free-text
  box IS the duel move. Race-safe round claim (`updateMany` clears actions).
- No bail for highly wanted prisoners / Impel Down (`isBailAllowed`).
- UI: Enter = newline (send = button or Ctrl+Enter), `freeText` max 2000,
  stamina bar, fruit-mastery bar, duel panel, `whitespace-pre-line` bubbles.
- Party: a crewmate's personal fight is echoed round by round to the shared feed.
- Gotchas found while building it: a `python` heredoc turned `\b` into a raw
  backspace byte inside a regex (keyword fallback silently dead — grep for
  control chars after scripted edits); `beforeEach(() => mock.mockReset())`
  returns the mock, which vitest then CALLS as a cleanup hook — use braces.
- Verified: 259 unit tests, `tsc` clean; live (real browser + real OpenRouter):
  `scripts/roleplay-attack-check.mjs`, `scripts/duel-smoke.mjs`,
  plus the older combat/e2e/party smokes.
- NOT deployed at the time of writing: needs the usual schema push to Neon
  (new `Faction.CP0` enum value, `Character` stamina/fruit columns, `Duel`/`DuelMessage`).

**Second pass, same day: real PvP, Impel Down, silent compaction, travel
limits, longer scenes** (2026-09-23): the user asked for (1) real to-the-death
PvP so Marine players can hunt pirate/revolutionary players, (2) much longer
input and AI output, (3) a truly hard Impel Down, (4) the two previously
deferred items (roadmap 7 & 8 below are now DONE), and (5) one document with
absolutely everything: **`APLICACION_COMPLETA.md`** — keep it in sync.
- **Lethal duels/hunts** (`engine/hostility.ts`, `game/duel.ts`, `Duel.lethal/hostile`,
  `Character.lastSeenAt`): hostile faction pairs need no consent; the hunted may
  flee (speed check) instead of accepting; only online (`lastSeenAt` < 3 min),
  level >= 3 targets; 30-min repeat cooldown; 5-min response window. Loser goes
  through the SAME `resolveDuelLoss` (death roll / Marine-CP0 capture) as group
  battles (exported from `group-battle.ts`); in lethal duels "yield" = flee attempt.
- **Impel Down** is a real island (level 45, only via Enies Lobby). `impelDownCell`
  (`engine/impel-down.ts`) sends pirate bounty >= 100M / revolutionary or hunter
  notoriety >= 700 there; `Imprisonment.cellLevel`; no bail; rescue wall
  `captorPower*(1+0.3*cell)+15*cell`; a plain failed rescue costs 40% HP; freed
  prisoners are moved to Loguetown. Needs a reseed (new island + adjacency).
- **Silent compaction** (`game/scene-compaction.ts`): fire-and-forget after each turn,
  folds messages older than the last 12 into `memorySummary` / `Party.memorySummary`
  once >= 22 are uncompacted. **Travel** (`engine/travel.ts`): cooldown 6+2*danger min,
  10 stamina, crew can't sail with a crewmate mid-fight/duel.
- **Length:** freeText max 6000; narrator max_tokens up to 2500, per-model timeout 30s,
  `LENGTH_RULE` asks for 5-8 paragraphs when the scene deserves it.
- Verified with `scripts/hunt-check.ts`, `impel-check.ts`, `compaction-travel-check.ts`.

**Phase 2 complete — the whole universe (2026-09-24)**: joint multi-actor fights, guardians + stealth, territory conquest and the Yonko claim vote, Impel Down escape + Buster Call, SSE real-time push, 26 islands with all 4 Road Poneglyphs placed, the endgame raid, kill/spare consequence threads, a black market, and AI island briefings + level-scaled missions. The Roadmap items above that describe these as "NOT built" are historical; the durable description is in `APLICACION_COMPLETA.md` section 4.15. Where things live:
- Engine (pure + tests): `joint-fight`, `guardian`, `territory`, `escape`, `buster-call`, `raid`, `consequence`, `black-market`, `missions`, plus `travel` (tides, `knowsTheRoad`).
- Game layer: `joint-fight` (kinds party/poneglyph/conquest/raid; NPC ally ids `npc:<companionId>` or `npc:ally:<actorId>` with `npcStatsJson`; settle hooks use dynamic `import()` to avoid circular imports), `guardian`, `territory`, `buster-call`, `raid`, `alliance`, `endgame-lore`, `consequences`, `black-market`, `missions`, `notify` (+ `src/lib/realtime.ts` hub, `stream` route).
- Routes under `api/characters/[id]/`: `territory`, `buster-call`, `raid`, `black-market`, `stream`, and `prison` op "escape". `GET` returns `jointFight`, `territory`, `busterCall`, `raid`, `blackMarket`, `missions`.
- Wrappers: `exploreCharacter`/`resolveMercyChoice`/`trainCharacter`/`travelCharacter` wrap `*Inner` functions to feed mission progress (`withMissions`).
- Schema additions (all additive): JointFight*, Territory, BusterCall, Raid, Alliance, Consequence, Mission, IslandBriefing; `Character.title/knowsTruth`, `Island.tidal/requiresRoadPoneglyphs`, `WorldClock.era`, `Imprisonment.escape*`, `ActorRole.GOROSEI/HIDDEN_RULER`. Production needs the documented Neon push before deploying.
- Verification scripts: `joint-fight-check`, `guardian-check`, `territory-check`, `escape-buster-check`, `raid-check`, `consequence-check`, `black-market-check`, `missions-check`, `verify-world-expansion` (DB) and `*-ui-check.mjs` / `missions-ui-check.mjs` / `realtime-check.mjs` (browser); also `ai-e2e-smoke.mjs` and `roleplay-attack-check.mjs`.
- Keep `docs/mapa.html` in sync via `npx tsx scripts/gen-map-islands.ts` (prints ISLANDS entries from the seeded DB).

**Phase 3 — out-of-role tools, real fatigue, living world, world events, codex (2026-09-24)**: everything below is live in code, unit-tested and driven in a real browser. Full player-facing description: `GUIA_DEL_JUGADOR.txt`; cast/lore data: `WORLD_LORE.md`; the whole system in one place: `APLICACION_COMPLETA.md` section 4.16.
- **Why it started — a real account's history (Neon, "Yeah D Kirito")**: three identical messages re-sent 1-2 min apart. The browser gave up while the server kept going and saved the turn (uncaught `res.json()` in `doAction`), so the player re-sent and burned a combat round unseen; that is also why "I beat the bearded man and don't know how". Fixes: `src/lib/idempotency.ts` (one in-flight action per character, retry with the same `requestId` returns the cached result, different id while running -> 409), client keeps the same `requestId` on retry and shows a real error + reloads the scene; party turn lock now released when an action throws (was stuck "narrator thinking"); explore narration puts the player's thread first and the random event second; the narrator never repeats the player's own message (`ROLE_RULES` "NO REPITAS AL JUGADOR" + last-line reminder) and always gives invented NPCs proper names.
- **Out-of-role panel ("Fuera de rol")** — `game/ooc.ts`, `ai/ooc*.ts`, `engine/ooc.ts`, `play/[id]/OocPanel.tsx`, `api/characters/[id]/ooc`. Ephemeral AI chat (nothing stored; the client sends the last 6 turns; it also answers "how does X work" via `GAME_HELP`), the AI can only *propose* one action from a closed list (rename, rename_crew, undo_last, rollback, repair, set_tone, add_note, clear_notes, report, set_pact, clear_pact) and the player confirms; every proposal is re-validated server-side (`sanitizeProposal` + game layer). Narrator tone (`Character.narratorTone` balanced/lethal/story) and standing notes (`oocNotes`) reach every narrator prompt through `loadDirectives`. Scene pacts (`Party.scenePact`) make the narrator stage agreements ("4 vs 4") in-story.
- **Rollback = ONE timeline.** Checkpoints (`Checkpoint`, auto every >=10 min + one at character creation, max 8 auto / 10 manual; snapshot holds stats, location, narrator memory, compaction pointer, missions, companions). Rollback needs an explicit warning first (`rollback_preview` op counts what will be erased and lists the stat changes; the API rejects `rollback` without `acknowledged: true`), then restores numbers AND the narrator memory (`memorySummary`, `sceneCompactedUntil`), deletes later scene messages, log, bounty log, the character's own later news, later companions/missions, bumps `Character.timelineEpoch`. Every fire-and-forget memory writer (`updateCharacterMemory`, `maybeCompactCharacterScene`) writes with `updateMany where timelineEpoch = <epoch it started with>`, so an AI summary still in flight cannot resurrect the discarded timeline. Rules: dead characters never (permadeath), prisoners never, not mid duel/joint fight, max 3/24h; gear/fruit/inventory are NOT rolled back and berries are only restored when the gear signature is unchanged (no buy-then-rollback refunds). `scripts/ooc-rollback-check.ts` (39 checks) is the proof; it also caught a real bug (a prisoner was told "muerto").
- **Base HP is 100** (characters `@default(100)`, companions 60, every seeded enemy hp x2, `actorCombatStats` hp = power x16); round caps rose (`MAX_ROUNDS` 14, duel/joint 20). `scripts/migrate-hp-100.ts` (idempotent) migrated existing rows, run against Neon too.
- **Level-based resilience** (`engine/resilience.ts`): `levelResilience(level)` = 1/(1+0.02*(L-1)), floor 0.5. Applied in `attackOnce` (damage soaked by the DEFENDER's level) and to every stamina price (`staminaCostAtLevel`), for players, allies and enemies alike; `Combatant.level` optional (absent = no change), enemies without a level get `estimateLevel(atk,def)`. Enemies and NPC allies now tire too (`PendingEncounter.enemyStamina`, `JointFight.enemyStamina`, `JointFightParticipant.stamina`; `applyFatigueToCombatant`, `npcStaminaAfterExchange`).
- **Effort/fatigue in combat** (`engine/stamina.ts`): the classifier returns `effort` 0-3 in the same call (never a number of stamina); code prices it (`effortStaminaCost`), being hit costs stamina (`staminaLossFromDamage`), and pushing hard on an empty tank strains HP (`overexertionHpLoss`, never lethal alone). The narrator is told the player's fatigue ("everything comes out worse") and the enemy's (a fresh enemy may counter clearly). Combat that ends by the round cap says so (`endedByExhaustion`).
- **Rest/train only when safe** (`engine/safety.ts` `dangerBlockReason`, `assertSafeToRecover`): blocked with a pending encounter, active duel, joint fight, pending hostile hunt or a Buster Call on the island.
- **The narrator knows what everyone can really do**: `engine/capabilities.ts` (player sheet: Haki, fruit + phase, weapon, fatigue, allies) via `loadDirectives`; `engine/enemy-kit.ts` (`EnemyKit`: Haki, fruit + phase, weapon, abilities; canon actors declare theirs in `WorldActor.statsJson/abilitiesJson/canonWeapon/devilFruit`, random enemies get a deterministic kit that grows with level incl. fruits) via `game/enemy-kit.ts`; `PLAY_TO_WIN_RULE` for every combatant the AI voices (enemies AND allied NPCs fight to win, use their whole kit, invent nothing outside it). Duels and joint fights get each side's kit too.
- **NPC nakamas are real** (`engine/companions.ts`, `game/companions.ts`): recruiting is the classifier action `recruit` ("Jorge, únete a mi tripulación"), decided by a persuasion roll (`recruitChance`), narrated by `narrateRecruit`, max 3, always at the captain's level (`companionSheet`), role archetypes with abilities unlocked at levels 1/5/12, `NPCCompanion.personality`.
- **Crew panel** (`play/[id]/CrewPanel.tsx`, `game/crew.ts`, `CrewInvite`): members with live HP/stamina/Haki/fruit/weapon, NPC nakamas, invitations (candidates on the island or by exact name, accept/decline/cancel, 24h TTL), join by code, kick, leave. Bounty hunters work alone (`factionCanHaveCrew`: no create/join/invite). The crew flag is an image (`Crew.flagImage` bytes, `engine/crew-emblem.ts` validates PNG/JPEG/WebP/GIF by magic bytes, max 200 KB, never SVG; the browser shrinks to 256px; served by `api/crews/[id]/emblem`; the state poll uses `omit: { flagImage: true }` so image bytes never ride the 10 s poll).
- **XP bar and rank progress** in the sheet (`xpToNextLevel`; `rankProgress` in `engine/progression.ts` = current title, next title, fraction, what is missing — the same thresholds that fire the promotion news). A pirate with 0 < bounty < 1,000,000 reads "Aún sin cartel oficial" (never "Sin recompensa"); the character list shows the title and a mini bar too; the narrator is told the rank (`describeCapabilities.rank`). The owner gets an "Administración" link with a badge on the play screen when a verdict is waiting (`admin.pending` in the character GET).
- **AI robustness**: memory summaries are validated as JSON with a real `summary` (`isValidSummaryJson`), so a free model answering "User Safety: safe" counts as a failed model instead of losing the summary (found by the regression run).
- **Living world**: every canon actor always has a place (`WorldActor.currentIslandId/locationHidden/locationUpdatedAt`; `engine/actor-movement.ts` moves a few per tick to neighbouring islands, Yonko are anchored, spies/revolutionaries often move hidden) and the narrator reads "who is where" for the island + neighbours + running world events on every scene (`worldPresenceFor`, dynamic import to avoid a cycle). Players are always located (`currentIslandId`), companions follow their owner. Every news item carries `locationName`, always exact and single-sourced (`whereLabel` in `engine/actor-movement.ts`): an island name, **"En el mar, entre X y Y"** (`WorldActor.locationKind = "sea"` with `seaFromIslandId/seaToIslandId`; pirates often sail, arriving on a later tick; the escalation chapter of a world event is a fight at sea), or **"Ubicación desconocida"** (hidden actors, or nothing known). `postNews` defaults to the character's island, or "Ubicación desconocida" when no place is known — callers that know the place (Buster Call, territories, guardians, raid) pass it explicitly.
- **World events ("Eventos mundiales")** (`engine/world-arcs.ts`, `game/world-arcs.ts`, `WorldArc`, `/news` section, `/admin`): a slow 6-chapter arc (rumor -> mobilization -> clash -> escalation -> siege -> ultimatum, hours apart) between a credible target and rival, each chapter a news item with a location and the story-so-far as narrator memory. Until the verdict NOBODY dies or is captured (enforced in the prompt and asserted by tests); at the last chapter the arc stops (`AWAITING_CONSENT`) and only the owner decides at `/admin` ("¿Permites que X sea CAPTURADO/MUERA?", double confirmation): approve -> the actor becomes DECEASED / CAPTURED (held in Impel Down), deny -> survives in hiding; either way the ending is narrated as a major news item. Admin = usernames in the `ADMIN_USERNAMES` env var, EXACT match (case-sensitive) and lookalike names differing only by case are refused at signup — otherwise anyone could register "KELVIN". Players can intervene (`engine/arc-intervention.ts`): at the place, from chapter 3, level >= a third of the weaker side's power; they fight a *vanguard* (never the canon in person) as a joint fight of kind `arc`; enough winning defenders (3, more than the aggressor's helpers) save the target with no verdict. Ticks are fire-and-forget and guarded (one at a time per process; `/api/news` no longer waits for the AI).
- **Codex** (`/codex`, `api/codex`): ~126 canon characters with bounty, fruit + phase, weapon, stats, Haki, abilities, personality, location; lore-only (`status` DECEASED/DEFEATED/RETIRED) live under "historia" and never act. Data: `game/world-actor-profiles.ts` (backfill of the original cast + `FRUIT_ASSIGNMENTS`), `game/world-actor-extra.ts` (the rest), `game/devil-fruit-extra.ts` (24 new canon 1-of-1 fruits + `SINGLETON_OVERRIDES`). 7 new islands: Orange Town, Villa Syrup, Ohara, Marineford, Dressrosa, Zou, Isla Egghead (33 total).
- **Standing rules added this phase**: (1) the user is the only authority over canon deaths/captures — never let code or the AI do it without the `/admin` verdict; (2) every mechanic that touches the AI's memory must respect `timelineEpoch`; (3) never store credentials the user pastes (Neon URL, Render token, the admin password) — pass them inline to a command, and recommend rotating them; (4) shell gotcha: the Bash tool chokes on heredocs that contain some quotes/backslashes — write scripts/patches with the Write tool and run them; never run prettier on a whole existing file (it reformatted `perform-action.ts`, noisy diff, harmless).
- **Verification**: 484+ unit tests; DB checks `ooc-rollback-check.ts`, `world-arcs-check.ts` (76 assertions) plus all the older ones; browser checks `ooc-crew-ui-check.mjs`, `world-ui-check.mjs` (news/admin verdict/intervention gate/flag upload/solo hunter/codex); `node scripts/run-all-checks.mjs` runs everything (resets the dev DB where needed, log in `shots/regression.log`). The older crew smokes now use `scripts/lib/crew-ui.mjs` because the crew UI moved from the sidebar to its own panel.
- **Deploy notes**: additive schema only, but one drop: `OocMessage` was created and removed in the same session (the chat is ephemeral) so Neon needs `prisma db push --accept-data-loss` once for that empty table. New env var on Render: `ADMIN_USERNAMES` (owner's exact username). Reseed after deploy (idempotent; reseeds never move an actor that already has a location).

**Narrator polish (2026-09-24)** — see `APLICACION_COMPLETA.md` section 4.17. Why it happened: the owner's account report ("El narrador no continuó con la acción...") showed the narrator answering the PREVIOUS message. Root causes were code, not the model: equal `createdAt` on a player/narrator pair (fixed with `exchangeRows` in `perform-action.ts`), a weak "context only" framing of the current action (now `currentActionBlock`, always last in the prompt), and `GET /api/characters/[id]` loading the 60 OLDEST scene messages. Also: dynamic reply length (`engine/narration-length.ts`, `planLength` + `maxTokens` from every prompt builder via `PromptOut`), paid model first with hedged free backups (`hedgeDelayMs` in `openrouter-client.ts`), "Limpiar escena" out-of-role action (`Character.sceneClearedAt`, additive; production needs the usual Neon push), joint-fight rounds no longer time out, live fights have no round cap (only the automatic no-player simulation keeps `MAX_ROUNDS` = 60), mobile fixes (`[&>*]:shrink-0` on scrolling flex modals, wrapping header). Gotcha: a scrolling `flex flex-col` modal shrinks its children and overlaps them unless children are `shrink-0`; and mobile emulation hides page overflow because `innerWidth` grows with the widest element — measure against 390, not `innerWidth`. Verified by `scripts/polish-ui-check.mjs`.

**Phase 3.1 — attributes, inventory, styles, coliseum, new canon wave (2026-09-24)** — full description in `APLICACION_COMPLETA.md` section 4.18 and `GUIA_DEL_JUGADOR.txt`. What to remember before touching it:
- Attribute points are granted lazily (`syncAttributePoints` in the character GET, keyed on `Character.attrLevelGranted`), never in the level-up code paths; spending uses `updateMany` on the observed balance (double-submit safe).
- Fruits are inventory items, never auto-eaten (`eatFruit`, `storeFruitInBag`, `grantCatalogFruit`); `saveStacks` only rewrites catalog rows so fruit rows survive. Every prize/loot path should go through `game/inventory.ts` (`grantItem`, `grantWeapon`, `grantCatalogFruit`).
- `Weapon.ownerId` is NOT unique any more (Neon push drops the unique index, no data loss). `Weapon.wielded` marks off-hand weapons (max 3 in hand with the equipped one).
- Combat styles: `toCombatant` (game/derive.ts) reads `styles` and `ownedWeapons: { where: { wielded: true } }` when the loader includes them (perform-action, duel, joint-fight, group-battle do; anything else silently has no styles). `prepareFighter(..., styleText)` takes the player's text to pick the technique. To add a style: `engine/styles.ts` (+ test), map it to canon characters in `engine/actor-styles.ts`; the seed appends "Estilo: ..." lines to `abilitiesJson` so enemy kits know them.
- Coliseum: `tickColiseum()` is called fire-and-forget from `tickWorldIfDueInner`; `coliseumStep` does at most one due transition. Delete `TournamentEntry` rows before `Tournament` in scripts (FK). Test with `scripts/coliseum-check.ts` and `scripts/features-setup.ts`.
- New content lives in `game/world-actor-more.ts` (+ `RELOCATIONS`), 6 islands in `prisma/seed.ts`. Kaido and Big Mom are ACTIVE on purpose (the owner wants them kept for later); canon death/capture still needs the `/admin` verdict.
- Tooling gotcha: a Bash heredoc that contains Python with `\n` inside strings can turn those into real newlines (broke two files this session); write patch scripts with the Write tool, or build backslashes with `chr(92)`.
- Verified by `scripts/attributes-inventory-check.ts`, `styles-check.ts`, `coliseum-check.ts` (DB) and `features-ui-check.mjs` (390 px browser), all part of `run-all-checks.mjs`.

**Long voyages, player Yonko, named commanders (2026-09-24)** — see `APLICACION_COMPLETA.md` section 4.19. Remember: from level 20 any island is reachable by a timed crossing (`engine/voyage.ts`; arrival settled lazily in `loadCharacterOrThrow` + the character GET; at-sea characters stay on the origin island in the DB and `assertNotAtSea` blocks explore/train/rest/travel); ambushes are rolled at departure and sprung at arrival. `scripts/make-yonko.ts` is the owner tool that made "Kirito" a Yonko (run against prod with an inline `DATABASE_URL`, never store it). `NPCCompanion.profileJson` gives commanders hand-written abilities/style/attributes. Coliseum interval is now 48 h. Checks: `voyage-check.ts`, `voyage-ui-check.mjs`.
Then: the "Imperio" panel + nakama errands (`engine/empire.ts`, `game/empire.ts`; errand stored inside `NPCCompanion.profileJson.errand`, no schema change; busy nakamas are excluded from joint fights and personal combat). Checks: `empire-check.ts`, `empire-ui-check.mjs`, helper `empire-setup.ts`.

**Combat without dice — the AI referee (2026-09-25)**: the owner ordered dice out of combat ("todo lo decide la IA"). Live combat (solo `engageCharacter`/`attackCharacter`, 1v1 duels, joint fights) no longer calls `resolveExchange`/`attackOnce`/`resolveDuelRound`/`resolveJointRound`. Instead `refereeExchange` (`ai/narrate.ts`, prompt in `ai/referee-prompt.ts`, pure parsing/bounds in `engine/referee.ts`) judges each exchange from level, HP, stamina, fatigue, kit (Haki/fruit/weapon/style/abilities) and the described move, and answers JSON `{narracion, cambios:[{nombre,vida,aguante}], golpe_final?}` (losses). Code only bounds and applies it (`applyVerdict`: max 50% of max HP per exchange, so only someone already under half can be finished; stamina cap 45; a `protectedThisExchange` fighter, e.g. the one who opened the fight, cannot be hurt). Fair-play design: the rival's NEW attack is announced but never resolved in the same verdict; the player's next message is how they receive it (the referee gets the last narrator message as `pendingThreat`). Each narration must show the rival's reaction/state and end with its next announced attack; only real attacks hurt (hitting the ground hurts nobody). If no model gives a valid verdict nothing changes (`NO_VERDICT_TEXT`, the joint-fight round counter and duel actions are handed back). Stamina from effort is still code-priced (`prepareFighter`); stamina from being hit is the referee's (`combatProgressData(..., staminaLoss)`). STILL random on purpose/for now: fleeing (`attemptFlee`), the death roll after 0 HP (`handleDeathCheck`), the automatic no-player simulations (group battles, coliseum tournaments, world ticks), loot/explore events. Scripted checks that drive fights set `REFEREE_STUB=1` (`stubVerdict`, deterministic by relative strength); browser checks use the real AI. `scripts/referee-live-check.ts` reproduces two real reports against the real model. The unused dice narrators (`narrateCombat`, `narrateDuel`, `narrateJointFight`) remain only as fallbacks for flee/yield beats.

**Player-vs-player duels and the Den Den Mushi (2026-09-25)**: between players the AI is only a fair referee of life and stamina (duel mode of `referee-prompt.ts`: 2-4 neutral sentences, no story, no deciding for anyone; both moves must be in before a round resolves; each player is responsible for how they receive an attack). Ending a duel is now the players' call, not dice (`game/duel-resolution.ts`, `engine/duel-outcome.ts`): every duel has a **Perdí** button; friendly = the other wins and nothing else happens; a fight to the death adds **Intentar huir** (the fugitive writes how, the other side sees it and allows/refuses; `Duel.resolution = FLEE_PLEA`, `pleaText`) and, when someone is down or gives up, the winner chooses **kill / capture / spare** (`resolution = VERDICT`). Capture: Marine/CP-0 winners imprison (Impel Down by bounty via `captureCharacter`), everyone else hands the captive to the Marines and is paid (`captureReward`); Marine/CP-0 losers cannot be captured. Killing is real permadeath, no death roll. Every ended duel posts an AI-written news report with the place (`postDuelReport`, `narrateDuelReport`). Additive schema: `Duel.resolution/pleaById/pleaText`, `DenDenMessage`. **Den Den Mushi** (`engine/denden.ts`, `game/denden.ts`, `api/characters/[id]/denden`, `DenDenPanel.tsx`): one chat channel per faction, the channel always comes from the character (never the request), 400 chars, 2 s gap, prisoners/dead cannot use it. NOT done: the automatic crew-vs-crew `GroupBattle` (2v2, 4v4) is still the old dice simulation and the hunt-evasion at the PROPOSED stage still rolls; both are the next steps. Checks: `duel-resolution-check.ts`, `denden-check.ts`, `duel-ui-check.mjs` (390 px), `referee-live-check.ts`.

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

**No dice anywhere (2026-09-25, supersedes every "random/dice/roll" statement above)**: `engine/rng.ts` keeps only seeded *variety* helpers (which flavour text, which stock, bracket order); `src/lib/no-dice.test.ts` fails if any dice primitive returns or if `varietyRng` spreads beyond its allowlist. Results are decided by `ai/judge.ts` (`judgeOutcome`, `judgeFate`, `judgeMatch`, `judgeChoice`; pure parsing + stubs in `engine/judge.ts`, deterministic stand-ins active with `JUDGE_STUB=1`, which every scripted `*-check.ts` sets) and by `refereeExchange` (fights). Flight, the death check at 0 HP, stealth, prison escape, recruiting, explore events, Buster Call triggers and the sims are all judged or fixed-rule now; training, Conqueror's Haki and ambush cadences are deterministic. Coliseum rounds wait (max 24 h) while a competitor is in a live fight of their own (`postponeWhileFighting`). The referee's `RIVAL_CRAFT` rule makes the rival's announced attack a varied 3-5 sentence sequence that adapts to repeated tricks.

**Owner rules added 2026-09-25 (see PENDIENTES.md for the live to-do list)**: (1) PAID OpenRouter models only (`ai/models.ts`: DeepSeek V3.2 first, gpt-4o-mini hedged backup after 40 s; a test forbids free models); (2) the enemy's/NPC's life is never shown in the UI nor written as figures in the story (API no longer sends `enemyHp`; joint-fight NPC allies show no bar) — only players' life and fatigue are visible, the referee holds the rival's state internally and narrates it physically; (3) response windows are 24 h (Coliseum round postponement `postponeWhileFighting`, stale duel/joint fight, hunt response; Coliseum rounds every 60 min); (4) the referee receives `getFightLog` (the whole fight so far) and a MEMORY rule; (5) Marshall D. Teach's kit lists both fruits (Yami Yami + Gura Gura) in `world-actor-profiles.ts` (prod row already updated).

**Finalizar pelea (2026-09-25)**: `closeFight` (game/perform-action.ts, action `close_fight` on the actions route, `judgeFightEnd` in ai/judge.ts, pure parse + `clampFightEnd` in engine/judge.ts). A "fighting" solo encounter against an NPC can be closed by the player from a link in the fight panel; the judge reads `getFightLog` and answers won/lost/ended; code only accepts a win or loss when the loser is at <= half life, else "ended". Follows the normal endings (victory -> mercy choice, loss -> `handleDeathCheck`, ended -> encounter deleted) and writes a narrator line to the scene. Not for duels (they have Perdí) nor joint fights. Checks: `close-fight-check.ts`, `close-fight-ui-check.mjs`. NPC life is not shown anywhere any more (fight panel, joint fight, NPC nakamas, empire commanders). The referee's `RIVAL_CRAFT` now demands strategist-level sequences with continuity, and a too-short rival intention triggers the corrective retry (`checkConsistency`, MIN_INTENT_CHARS).

**World happenings (2026-09-25)**: `Sucesos del mundo` = one AI-invented, self-contained event every 24 h (`engine/world-happenings.ts`, `ai/world-happening.ts`, `game/world-happenings.ts`; `tickWorldHappenings` is fire-and-forget from the world tick, the newest news item of that category is the clock so no schema). Colour only: never kills/captures canon actors and never hands out items. The narrator sees the last 3 days of happenings of the current island (`worldPresenceFor`). Death/capture arcs (Eventos mundiales) keep the owner's verdict; their cooldown dropped 72 h -> 24 h. Check: `scripts/happenings-check.ts`.

**Crew chat (2026-09-25)**: the Den Den Mushi panel has a "Tripulación" tab (only for characters with a crew). Same `DenDenMessage` table, channel key `CREW:<crewId>` (`crewChannelKey`); the channel always derives from the character's own crew/faction, never the request (`?scope=crew` / `{scope}`). Checks: `denden-check.ts`, `crew-chat-ui-check.mjs`.

**Design pass, sovereign powers, world figures, wave 4 (2026-09-25)** — full description in `APLICACION_COMPLETA.md` (last section) and `GUIA_DEL_JUGADOR.txt` ("PODER"). What to remember:
- UI kit lives in `src/components/ui/` (Modal, StatBar, ChatFeed, Toasts, WantedPoster, BackToCharacter, SeaBackground) with pure helpers in `src/lib/ui/format.ts` (tested). New panels go through `Modal` (bottom sheet on phones). The play page is split into components under `play/[id]/` (types in `types.ts`, labels in `labels.ts`). Tailwind v4 gotcha: `border-[--line]` is v3 syntax and silently does nothing; use the `line` color token (`border-line`). `devIndicators: false` in `next.config.ts`, because the dev "N" badge covered bottom sheets and broke browser checks.
- Sovereignty: `engine/sovereignty.ts` (rules + tests) and `game/sovereignty.ts` (Yonko challenge = joint fight kind `sovereign`, settled by `handleSovereignFightSettled`; the dethroned canon gets role NOTABLE_PIRATE + "Ex-Yonko"; kill/capture only via a `WorldArc` in AWAITING_CONSENT for `/admin`). `isEmperor` also accepts a title containing "Yonko" (the owner's `make-yonko.ts` characters). Warlords: frozen bounty (`reputation.ts`), no Government hunts (`duel.ts` + `governmentSparesWarlord`), no Government arrest (`verdictOptions(..., loserIsWarlord)`), revoked on killing a Marine/CP-0 player.
- World figures: `reportFigure` (throttled via `Character.lastFigureNewsAt`) runs on hop travel and voyage arrival; category "Figuras del mundo".
- Checks: `sovereignty-check.ts`, `sovereignty-ui-check.mjs`, `design-tour.mjs` (both widths). In an environment without `OPENROUTER_API_KEY` the AI-dependent browser checks fail by design (ai-e2e, duel-smoke narration, party, joint-fight UI, polish, ooc how-to, compaction, happenings); everything else passes.
- Schema (additive): six `Character` sovereignty columns + `War`. Production needs the documented Neon push plus a reseed (new islands, actors, stories, territories; idempotent).
- Playwright in cloud sessions: the preinstalled browser is 1194 while the npm package wants 1243; point `PLAYWRIGHT_BROWSERS_PATH` at a folder that symlinks `chromium_headless_shell-1243/chrome-headless-shell-linux64/chrome-headless-shell` to the 1194 `headless_shell`. On Linux, stop the dev server with `pkill -f "[n]ext dev"` (the brackets stop pkill from matching its own shell).

**Beginner events, badges, admin tools, players codex (2026-09-25)**:
- `PlayerEvent` / `PlayerEventEntry` (additive): AI-invented trials for low levels (`engine/player-events.ts`, `ai/player-event.ts`, `game/player-events.ts`, `EventsPanel.tsx`, route `characters/[id]/events`). Announced in the news (category `Eventos`); registration window >= 6 h, NO time limit to finish; when every human entrant has submitted (or withdrawn) the AI judge scores everyone (`judgeTrial`, stub with `JUDGE_STUB=1`), CODE picks the winner (`pickWinner`), prize = system-fixed berries/xp (+ a unique fruit), consolation for the rest, result posted with the full ranking. 12 original 1-of-1 fruits live in `game/devil-fruit-events.ts` (isSingleton: never dropped, never in shops); an event reserves one; a full bag pays berries instead. `tickPlayerEvents` runs from the world tick (max 3 open, one new per 24 h). Admin can cancel/force-close.
- Header badges (`useBadges`, `api/characters/[id]/badges`): news / Den Den / events counts since the last time the player opened each; inventory badge compares item names with what was last seen (localStorage, nothing stored server-side).
- Admin tools (`/admin`, `game/admin-tools.ts`, `api/admin/tools`): dashboard numbers, player reports (archive), announcements, propose a happening to the AI, create/cancel/force events, start a world event (arc) between two named canon actors. Owner only (`requireAdminUserId`).
- Public players registry: Códice -> "Jugadores" (`api/codex/players`), no account names.
- Narrator now always sees bagged devil fruits (`inventoryLineForNarrator`) and may never narrate an item handover as done.
- Checks: `player-events-check.ts`, `events-ui-check.mjs`, `admin-tools-ui-check.mjs`, `codex-players-ui-check.mjs`. Prod needed `prisma db push` (two new tables) + reseed for the fruits; done.

**Nakama controls (2026-09-25)**: the crew panel's "Nakamas NPC" tab now lets you choose who comes along ("Que se quede en el barco", "Solo este me acompaña": `stay` flag stored in `NPCCompanion.profileJson`, `engine/empire.ts` `readStay/writeStay/isWithPlayer/focusPlan`) and send any nakama on a mission (patrol/tribute/scout via the empire errand API). Staying/away nakamas do not appear in joint fights nor in the narrator's "a su lado" list. The Imperio panel now explains why patrol is unavailable. Check: `nakama-ui-check.mjs`.

**World state, admirals, custody, rescue, merchants (2026-09-26)**: what to remember before touching it.
- The AI always gets the world facts: `engine/world-state.ts` + `game/world-state.ts` (`worldStateBlock`, cached 60 s, `invalidateWorldState()` after any change) list sitting Yonko, PRESOS with Impel Down level, defeated, fallen and running events; `loadDirectives` (ai/narrate.ts) adds it plus real berries, current island, active missions, the local merchant stock and the list of real players (`engine/real-players.ts`: the narrator may never voice/move another player's character; `narrationValidatorFor` rejects such answers and fake system announcements like "misión completada"). Any new world state that changes canon must call `invalidateWorldState()` and be described there.
- Captured canon actors: `WorldActor.prisonLevel/capturedAt`, codex location "Impel Down, Nivel N" (Prisioneros tab), rescue raid = joint fight kind `rescue` (`engine/rescue-raid.ts`, `game/rescue-raid.ts`, panel on Impel Down). Kaido and Big Mom are DEFEATED ex-Yonko: world arcs of kind `reclaim` (they attack a sitting Yonko; win = title + territory, loss = arc turns `reclaim_lost` and ONLY the owner decides capture/death/mercy in /admin). The admin picks actors/islands from selects.
- Admiral dispatch (`engine/admiral-dispatch.ts`, `game/admiral-dispatch.ts`, model `AdmiralDispatch`, joint fight kind `admiral`): rare (2 % per world tick, 12 h cooldown), never starter/revolutionary/pirate-held islands, pirates level 2+ only, 20-60 min crossing with a countdown alert, fight inescapable (no flee, no sailing mid-fight), defeated are captured (no death roll), empty island = he sails home in the same time. Owner launcher in /admin.
- Player captures by non-Government winners are custody (`Imprisonment.custodianId`, `engine/custody.ts`, `game/custody.ts`): the captive travels with the captor, is paid only when delivered on a Government island, escapes after 24 h.
- Island merchants (`engine/merchant.ts`): stock per island, weapons via `buy_weapon`, no shop sells den den mushi. Island mission XP x2.5 (`MISSION_XP_BOOST`); the referee (`judgeAndRecordMissions`) advances story goals from what the narration shows.
- Checks: `reclaim-check`, `admiral-dispatch-check`, `custody-check`, `rescue-raid-check`, `world-systems-ui-check.mjs`, live `real-players-live-check`, `mission-judge-live-check`.

**Island residents — the filler cast (2026-09-26)**: the AI may no longer invent named characters. Every island has a roster of `IslandNpc` rows (~8 each, 378 total: bartenders, guards, thugs, marines, merchants...; data in `game/island-npc-data.ts`, generated from each island's lore by `scripts/gen-island-rosters.ts`, seeded by `seedIslandRoster`, idempotent, never revives the dead). Impel Down has 12 rank-and-file jailers plus the canon chiefs of each level (`game/world-actor-impel.ts`, `IMPEL_LEVEL_GUARD`; the rescue raid fights the chief of the cell's level). What to remember:
- Pure rules in `engine/island-npc.ts` (state, matching by name/job, stats, rewards, loot, replacement, `inventedNames`); Prisma glue in `game/island-npcs.ts`; AI successor/roster writers in `ai/island-npc.ts`.
- The narrator and referee get `HABITANTES DE <isla>` (`rosterBlockFor`, in `loadDirectives`) with each resident's live state and memory; `narrationValidatorFor` and the referee retry reject text that presents a named character outside roster/canon/players/places (`inventedNames`: "llamado X", "Es X, la...", "X, el guardia"); the referee returns no verdict rather than accept invented names.
- Live state (`npcState`): ALIVE free / engaged (a `PendingEncounter` or active `JointFight` whose enemyJson has `islandNpcId`; nobody else can talk to or fight them, computed by `engagedNpcIds`, no lock to release) / hurt (`recoversAt`, 3 h after being spared) / CAPTURED (24 h, when Marine/CP-0/hunter beat a thug or pirate and spare them) / DEAD. Codex tab "Habitantes" (`api/codex/residents`, `codex/ResidentsSection.tsx`) shows it live.
- Fights bind to residents: `attackCharacter` (named target), random explore encounters (`bindRandomFighter`), joint fights (`islandNpcId` in `JointEnemy`, fate judged with `judgeFate`). Killing = `killIslandNpc` (news category Muertes, mission credit); the tick (`tickIslandNpcs`) writes a successor with the same `slot` after 6 h (AI, offline fallback `fallbackSuccessor`) and retargets missions.
- Not every resident fights (`isFighter`: guard/thug/marine/pirate). Bystanders are frail and pay no experience; fighters pay `npcRewards` and may drop `npcLoot` items when killed.
- Island main mission is now `defeat_npc` (kind added; `Mission.giverNpcId/targetNpcId`): it names a real resident, credited through `recordMissionEvent({kind:"npc"})`.
- Scene messages have a "Copiar" button (`ui/ChatFeed.tsx`).
- Checks: `island-npc-check.ts` (DB), `residents-ui-check.mjs` (390 px), live `roster-live-check.ts` (real AI, prints invented names).
- Still open: canon characters present on the island as a panel with "mission with / against" (owner's idea), recruiting nakamas from residents, sceneless party narrator does not yet get the roster.
