# Roleplay, combat and progression — design brief (2026-09-23)

Captured from the user's own words so it is never lost. Each item has a
status: **DONE** (built + verified), **PLANNED** (agreed, not built yet).
Update the status here when something ships. Dev-facing, English (same
register as CLAUDE.md); player-facing text stays Spanish.

## 0. The bug that triggered this

A player in a bar wrote a long, in-character line ending in "…sacaría mi
katana y le intentaría cortar todo el pecho… si logra impactar miraría a
todos y diría…". The classifier read it as `explore`, which **ignores the
text entirely** and rolls a random event template — the game answered with
"Un grupo de maleantes de poca monta te cierra el paso… El enfrentamiento
se decide rápido a tu favor." Nothing to do with what the player did.

**Rule going forward:** the player's text is the source of truth for *what
happens*. The engine only decides *whether it works* (dice) — never
*what the player tried*. A hostile act against someone in the scene must be
answered by that someone, with the engine's real roll deciding hit/block.

- DONE: new `attack` action — classifier extracts `target` (who), `target_tier`
  (weak/average/tough/elite, code maps it to stats), `technique`, `tactic_modifier`.
  `attackCharacter` spawns the named target as a real enemy and resolves round 1
  *with the player's own move*, narrated as a direct answer to it.
- DONE: `explore` is reserved for "go look for trouble/opportunity" with no
  specific target. Anything aimed at a present person is never `explore`.
- DONE: `freeText` limit raised 500 → 2000 chars (real roleplay posts are long).
- DONE: Enter inserts a newline (mobile needs it to separate speech from action);
  sending is the button or Ctrl/Cmd+Enter.

## 1. Fundamental combat / survival rules

- Hostile world: enemies fight with lethal intent proportional to their rank.
- **No "mano negra"**: the narrator never controls the player's actions,
  reactions or damage, and never decides an outcome the engine did not roll.
  Every dodge/block/technique is justified by stats, terrain and abilities.
- Dynamic difficulty: key rivals sit slightly *above* the player's current
  level (`engine/scene-enemy.ts`), capped by island danger.
- DONE: combat prompt receives every roll (hits **and** misses/blocks/crits),
  in order, and must narrate them exactly. Enemy acts on its own initiative
  after each player move ("IA actúa → yo respondo → IA actúa…") and the turn
  always ends handing the initiative back to the player.

## 2. Resources, stamina, devil-fruit progression

- Stamina: every technique costs stamina; at low stamina the character is
  fatigued (atk/def penalties), at zero exhausted. Recovery: resting, and
  slow passive regen over real time. Peaceful phases (navigation/exploration)
  allow no heavy fights.  — DONE (`engine/stamina.ts`, `Character.stamina`).
- Devil fruits do not give full power at once — three phases:
  1. **Inicial** — basic mastery, limited output, high stamina cost.
  2. **Avanzada** — variants/combos, lower cost.
  3. **Despertar** — ultimate; needs a "breaking point" event (mastery maxed +
     beating a boss / winning near death).
  — DONE (`engine/fruit-mastery.ts`, `Character.fruitMastery`/`fruitAwakened`;
  replaces the old "awakened at level 40" proxy).
- Haki is used *inside* combat, chosen by what the player describes
  (armament / observation / conqueror), scales with the trained level, costs
  stamina, and also grows from use — not only from the training button.
  — DONE (`engine/techniques.ts`).

## 3. Faction ladders (every faction has an equally hard path to the top)

| Pirates | Marine | World Government | Revolutionary Army | Bounty hunters |
|---|---|---|---|---|
| Recruit/Novice | Recruit/Officer | CP10 → CP8 | Infiltrator/Cell | Local hunter |
| Supernova/Captain | Captain/Vice Admiral | CP7 → CP1 | Regional commander | Elite hunter |
| Yonko | Admiral | CP0 / Divine Knight | Chief commander | Underworld guild |
| Pirate King | Fleet Admiral | Gorosei | Revolutionary leader | King of the Underworld |

Apex conditions (lore, not all enforced by mechanics yet): Pirate King =
4 Road Poneglyphs + Laugh Tale; Fleet Admiral = beat rival candidates + spotless
capture record; Gorosei/Divine Knight = purge undercover agents, CP10→CP0,
advanced Rokushiki + Haki, black ops; Revolutionary leader = liberate key
territories, sabotage Celestial Dragon tribute, unify cells; Bounty hunter king
= deliver notable pirates alive, control smuggling routes.

- DONE: **new player faction CP-0** (`Faction.CP0`, ladder in `progression.ts`).
- PLANNED: enforce apex conditions as real quests (Fleet Admiral duel, Gorosei
  purge, etc.). Titles/ladders exist; the *gates* do not yet.

## 4. Capture, prisons, Impel Down

- Losing to the Marine/Government captures instead of killing (exists; extended
  so CP-0 also captures).
- DONE: **no bail for the highly wanted** — pirates/hunters with a bounty >= 10M and
  established revolutionaries cannot buy their freedom; Impel Down never allows bail.
- DONE: **Impel Down** as a real island (level 45, via Enies Lobby) with cell level 1-6 from bounty/notoriety, no bail, and a rescue wall that grows with depth (`engine/impel-down.ts`).
- PLANNED: rescue by crew triggering a large siege / Buster Call / Marineford-
  style war. Individual escape by stealth or inner rebellion.

## 5. AI-guided exploration and economy

- PLANNED: procedural island events (masters teaching techniques, local
  mysteries, archaeology), black market (information, special weapons, dials,
  unidentified fruits), loot fruits with "eat blind or auction".

## 6. Multiplayer / PvP

- **PvP between users is strictly 1 vs 1**: both fighters submit their move,
  the *engine* resolves both, the AI only narrates the result and who won.
  — DONE (`Duel` model, `game/duel.ts`). Duels are **non-lethal** (loser is
  knocked out; duel HP is a copy of maxHp so `Character.hp` is never touched, no permadeath) — deliberate default; a to-the-death
  toggle is PLANNED.
- The AI answers *each character's action, by turn*, in the same shared scene
  when several players are online (party turn order already exists).
- PLANNED: Coliseum tournament (no permadeath), meeting zones (Sabaody,
  Loguetown) where opposing factions can negotiate, spare or fight.
- PLANNED: crew cannot sail until every member has finished pending
  interactions/fights.
- DONE: silent auto-compaction of scene context (`game/scene-compaction.ts`); travel
  cooldown + crew-busy rule (`engine/travel.ts`).
- DONE: **real PvP to the death / hunts** — Marines and CP-0 hunt pirates and revolutionaries etc. (`engine/hostility.ts`, lethal `Duel`). Consent-free between enemy factions, with online/novice/repeat protections and an escape attempt for the hunted.

## 7. Narration style the user expects

The reference is a real freeform roleplay transcript: the AI plays the world
and its NPCs (with names, motives, dialogue), reacts to *exactly* what was
done, acts back, and hands the turn over. Text inside quotes is what the
character *says*; the rest is action — the UI keeps line breaks so players can
separate them, and every prompt tells the model to treat them differently.

## 8. Implementation map (what exists and where)

**Rule of the house (unchanged): the AI narrates, the code decides.** The
classifier only *proposes* (who, how tough, which technique, how clever); every
number, hit and miss comes from `src/lib/engine/*`.

| Concern | Where |
|---|---|
| Mano Negra / Mano Blanca rules, injected into **every** narrator prompt | `ROLE_RULES` in `src/lib/ai/narrate-prompt.ts` (source: `Reglasrol.txt`) |
| Free text → action (`attack`, target, tier, technique, tactic, train focus) | `src/lib/ai/classify-action.ts` (gets the last narrator message so "el primero que se me acerque" resolves) |
| Attack a scene target → real fight | `attackCharacter` in `src/lib/game/perform-action.ts` → `buildSceneEnemy` (`engine/scene-enemy.ts`) → `engageCharacter` round 1 |
| Threat intro tied to what the player was doing | `narrateEncounterIntro` (explore-triggered fights) |
| Every roll narrated in order, misses/blocks included | `describeRound` + `buildCombatNarrationPrompt` |
| Stamina, fatigue | `engine/stamina.ts`, `Character.stamina/maxStamina/staminaUpdatedAt`, lazy regen in `game/combat-prep.ts` `currentStamina` |
| Techniques (haki/fruit) with cost, downgrade, growth | `engine/techniques.ts` + `game/combat-prep.ts` (`prepareFighter`, `combatProgressData`) |
| Fruit phases, mastery, Awakening, Conqueror's Haki roll | `engine/fruit-mastery.ts`, `Character.fruitMastery/fruitAwakened`, victory branch of `engageCharacter` |
| Passive-vs-active split of haki/fruit bonuses | `engine/character-stats.ts` (passive half) + `techniques.ts` (active half) |
| CP-0 player faction | `Faction.CP0`, `CP0_TIERS` in `engine/progression.ts`, start island Loguetown |
| 1-vs-1 duels | `engine/duel.ts`, `game/duel.ts`, `Duel`/`DuelMessage`, `POST /api/characters/[id]/duel`, panel in `play/[id]/page.tsx`; text input is routed to the duel while one is ACTIVE |
| No bail for the highly wanted / Impel Down | `isBailAllowed` in `engine/economy.ts`, wired in `game/prison.ts` `captureCharacter` (null bail → UI shows "no admite fianza") |
| Crewmates read a member's fight live | `resolveFreeTextAction` echoes each round to the `Party` feed |

Known gaps (deliberate, tracked): a crewmate can't yet *join* another's
ongoing fight (needs multi-actor exchange resolution — Roadmap 1); to-the-death
PvP toggle; Impel Down as a real island/facility (the bail rule is ready for it
via `facility: "impel_down"`); apex-rank quests; black market; coliseum.
