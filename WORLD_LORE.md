# World Lore & Canon Character Codex

This file exists because the user explicitly asked for it (2026-09-23):
world data — who exists, what faction they belong to, their rank, their
canon bounty, their canon devil fruit/weapon — needs to be recorded
permanently so it's never re-derived from scratch or forgotten in a future
session. It's the content counterpart to CLAUDE.md's architecture notes;
read both before touching the news system, `WorldActor`, or `DevilFruit`.

## Why this exists

The user found a real bug while playing: the background news ticker
posted "Kizaru es visto reclutando nuevos aliados" — an Admiral doing
something only a pirate would plausibly do. The root cause was that
`WorldActor` selection for news events was fully random, with zero
relationship between an actor's faction/rank and the kind of event they
could star in. Fixing that properly required building out a real faction
system, which in turn meant it was time to actually populate the world
with its canon cast — even though this game has only built the East
Blue → Grand Line chain (14 islands) so far, and most of the characters
below have nowhere to physically go yet.

**The explicit design intent**: every canon character below is real world
data used by the news system and available to AI narration for lore
consistency — NOT necessarily a character the player can currently travel
to or fight. See "Scope: what's real vs. lore-only" below.

## The roster

All `WorldActor` rows, grouped by `factionType` (the field
`WorldEventTemplate.allowedFactionTypes` gates news-event eligibility on).
`factionName` is the specific in-fiction label shown in news/narration.
Canon bounties are real canon numbers (approximate where the exact figure
is disputed across arcs) — stored as `BigInt` (`WorldActor.canonBounty`)
because several exceed `Character.bounty`'s `Int32` range (e.g. Shanks'
4,048,900,000 overflows 2,147,483,647). Marines/Revolutionaries/Cipher Pol
don't have bounties in-world, so `canonBounty` is null for them.

### PIRATE

| Name | Role | Faction name | Canon bounty | Devil fruit |
|---|---|---|---|---|
| Shanks | YONKO | Piratas Pelirrojos | 4,048,900,000 | — |
| Marshall D. Teach | YONKO | Piratas de Barbanegra | 3,996,000,000 | Yami Yami no Mi (singleton) |
| Buggy | YONKO | Cross Guild | 3,189,000,000 | Bara Bara no Mi (singleton) |
| Monkey D. Luffy | YONKO | Piratas de Sombrero de Paja | 3,000,000,000 | Hito Hito no Mi: Modelo Nika (singleton) |
| Boa Hancock | WARLORD | Piratas Kuja | 1,658,000,000 | Mero Mero no Mi (singleton) |
| Crocodile | WARLORD | Cross Guild | 1,965,000,000 | Suna Suna no Mi (singleton) |
| Donquixote Doflamingo | WARLORD | Familia Donquixote (encarcelado) | 3,000,000,000 | Ito Ito no Mi (singleton) |
| Trafalgar D. Water Law | NOTABLE_PIRATE (Capitán) | Piratas Heart | 3,000,000,000 | Ope Ope no Mi (singleton) |
| Eustass Kid | NOTABLE_PIRATE (Capitán) | Piratas Kid | 3,000,000,000 | Jiki Jiki no Mi (singleton) |
| Basil Hawkins | NOTABLE_PIRATE (Capitán) | Piratas Hawkins | 320,000,000 | — |
| Killer | NOTABLE_PIRATE (Primer oficial) | Piratas Kid | 1,057,000,000 | — |
| Charlotte Katakuri | NOTABLE_PIRATE (Comandante Dulce) | Piratas de Big Mom | 1,057,000,000 | Mochi Mochi no Mi (singleton) |
| Jewelry Bonney | NOTABLE_PIRATE (Capitana) | Piratas de Bonney | 1,390,000,000 | Toshi Toshi no Mi (singleton) |
| Roronoa Zoro | NOTABLE_PIRATE (Primer oficial) | Piratas de Sombrero de Paja | 1,111,000,000 | — (weapon: Santoryu, incl. Enma) |
| Nami | NOTABLE_PIRATE (Navegante) | Piratas de Sombrero de Paja | 366,000,000 | — |
| Usopp | NOTABLE_PIRATE (Francotirador) | Piratas de Sombrero de Paja | 500,000,000 | — |
| Vinsmoke Sanji | NOTABLE_PIRATE (Cocinero) | Piratas de Sombrero de Paja | 1,032,000,000 | — |
| Tony Tony Chopper | NOTABLE_PIRATE (Médico) | Piratas de Sombrero de Paja | 1,000 | Hito Hito no Mi (plain, singleton — distinct from Luffy's Nika model) |
| Nico Robin | NOTABLE_PIRATE (Arqueóloga) | Piratas de Sombrero de Paja | 930,000,000 | Hana Hana no Mi (singleton) |
| Franky | NOTABLE_PIRATE (Carpintero) | Piratas de Sombrero de Paja | 394,000,000 | — |
| Brook | NOTABLE_PIRATE (Músico) | Piratas de Sombrero de Paja | 383,000,000 | Yomi Yomi no Mi (singleton) |
| Jinbe | NOTABLE_PIRATE (Timonel) | Piratas de Sombrero de Paja | 1,100,000,000 | — |

### MARINE

| Name | Role | Rank label | Devil fruit |
|---|---|---|---|
| Kizaru | ADMIRAL | Almirante | Pika Pika no Mi (singleton) |
| Fujitora | ADMIRAL | Almirante | Zushi Zushi no Mi (singleton) |
| Ryokugyu | ADMIRAL | Almirante | Mori Mori no Mi (singleton) |
| Sakazuki | ADMIRAL | Almirante de Flota | Magu Magu no Mi (singleton) |
| Monkey D. Garp | MARINE_GENERAL | Vicealmirante (Héroe de la Marina) | — |
| Sengoku | MARINE_GENERAL | Almirante de Flota (retirado) | Hito Hito no Mi: Modelo Daibutsu (singleton) |
| Smoker | MARINE_GENERAL | Vicealmirante | Moku Moku no Mi (singleton) |
| X Drake | MARINE_GENERAL | Comodoro (encubierto, SWORD) | — |

### CIPHER_POL

| Name | Faction name | Devil fruit |
|---|---|---|
| Rob Lucci | CP-0 | Neko Neko no Mi: Modelo Leopardo (singleton) |
| Kaku | CP-0 | — (weapon: Kabutowari) |
| Kalifa | CP-0 | — |
| Spandam | Cipher Pol / Gobierno Mundial | — |
| Stussy | CP-0 (lealtad incierta) | — |

### REVOLUTIONARY

| Name | Rank label |
|---|---|
| Sabo | Jefe de Estado Mayor (fruit: Mera Mera no Mi, singleton) |
| Monkey D. Dragon | Comandante en Jefe |
| Emporio Ivankov | — |
| Koala | — |

### BOUNTY_HUNTER

| Name | Faction name | Weapon |
|---|---|---|
| Dracule Mihawk | Cross Guild | Kokuto Yoru |

## Devil fruit duplication rules (implemented, not just documented)

Catalog lives in `src/lib/game/devil-fruit-catalog.ts` — the single source
of truth, imported by both `prisma/seed.ts` and `tryDropFruit`
(`src/lib/game/perform-action.ts`).

- **Common fruits** (`isSingleton: false`, the majority — ~19 of the 35
  cataloged fruits): can be duplicated across characters. `tryDropFruit`
  creates a **fresh `DevilFruit` row** per grant instead of reassigning a
  shared row — the exact same pattern already proven for `Weapon`/
  `common-gear.ts` (non-unique `name`, new instance per grant).
- **Singleton fruits** (`isSingleton: true`): the "main" canon fruits —
  every fruit formally linked to a named `WorldActor` via
  `WorldActor.devilFruitId`, plus the two Mythical Zoans without an active
  seeded holder yet (Uo Uo no Mi, historically Kaido's — see "Deliberately
  excluded" below). These are **never** in `tryDropFruit`'s random pool.
  They only ever exist as the single row the seed creates, and stay
  permanently linked to their canon `WorldActor` — there is currently **no
  way for a player to obtain one**. That requires a real "defeat the actual
  canon character" combat system, which is explicitly future work (see
  below).
- A nice side effect: this also fixes a latent bug where a permadead
  player used to silently lock their fruit out of the drop pool forever
  (`Character.devilFruitId` was never cleared on death). Under the new
  model that only matters for singleton fruits (which were never droppable
  anyway), so it's no longer a real problem for common fruits.

## Scope: what's real vs. lore-only

- **Real/mechanical today**: every `WorldActor`'s faction/rank/personality/
  canon bounty/canon fruit feeds the news system (faction-gated event
  selection, AI-narrated prose, the periodic bounty digest) and combat
  narration (for the two existing lore-linked subordinate fights — see
  CLAUDE.md's "Poneglyph holders fight back"). This is genuinely used by
  live game systems, not just flavor text sitting unused.
- **Lore-only, not yet actionable**: almost none of these characters have
  a real in-game location. Only two (`Marshall D. Teach`, `Rob Lucci`) are
  linked to an actual fightable encounter today, and even then only
  through a subordinate stand-in on an island that already exists (Isla
  Cementerio, Enies Lobby) — the named `WorldActor` themselves is never
  the thing you fight. Everyone else exists purely as a name/faction/
  bounty the news system can reference — there is no island to sail to
  and meet Shanks, Luffy, or any of the Straw Hats yet. This is
  intentional, matching the project's own "only East Blue/Grand Line is
  built so far" scope, not a bug.
- **`WorldActor.homeIslandId`/`currentFocus`** exist in the schema but are
  still dormant (declared, never set/read) — same as before this pass.
  Wiring real locations to these characters is future work, listed below.

## Deliberately excluded / simplified (so nothing here is assumed done by accident)

- **Historically inactive/deceased canon figures** (Kaido, Big Mom,
  Whitebeard, Ace, etc.) are NOT seeded. The existing roster already
  implies a timeline where they're gone (Buggy's promotion to Yonko only
  makes sense post-Kaido/Big Mom), and `WorldActor` has no
  `status: deceased/retired` field to represent them correctly yet. If the
  user wants historical figures referenced in lore text, that field needs
  to be added first.
- **Marshall D. Teach's second fruit** (canonically he also holds Gura
  Gura no Mi, Whitebeard's) is not modeled — `WorldActor.devilFruitId` is
  a single relation, one fruit per actor. A minor, deliberate
  simplification.
- Several roster members who do have a canon devil fruit were left
  unassigned for scope (e.g. Kuzan/Aokiji's Hie Hie no Mi, Marco's Tori
  Tori: Modelo Fénix — neither Kuzan nor Marco are seeded at all yet; Kaku,
  X Drake, Dragon, Ivankov, Hawkins are seeded but without their canon
  fruit modeled). Their catalog fruits (Hie Hie, Tori Tori: Fénix) remain
  in `devil-fruit-catalog.ts` as common/duplicable rather than locked,
  since nothing in-world currently "owns" them.
- Canon bounty figures are approximate/era-flattened, not tied to a
  specific manga chapter's exact number — acceptable given every other
  numeric value in this game (starting berries, weapon prices) is already
  "canon-flavored," not a precise simulation.

## Explicitly future work (NOT built this pass)

- **Real combat against the actual canon character**, not a subordinate
  stand-in — directly extends CLAUDE.md's existing "Poneglyph holders
  fight back" design brief (`WorldActor.busyUntil`/`currentFocus` deciding
  who you actually meet). Needed before any "kill a Yonko for their fruit"
  mechanic can exist.
- **Obtaining a singleton fruit** — depends entirely on the above. Until
  then, all singleton fruits are permanently reserved/unobtainable by
  design, not a bug.
- **Real capture/death of a named canon actor**, with rescue-mission
  consequences (find their location, decide whether to intervene) — the
  news AI is explicitly instructed (`ai/narrate-prompt.ts`'s
  `NEWS_HARD_RULE`) to never narrate this as an accomplished fact,
  specifically because no such mechanic exists yet. This was the user's
  own worry ("no puedes poner noticias graves a la ligera de muerte...
  o captura") — the fix here is the AI simply can't invent it; building
  the real mechanic is separate, larger work.
- **Wiring `WorldActor` to real islands/travel** once new regions beyond
  the current 14-island Grand Line chain are built — `homeIslandId`
  exists in the schema for exactly this, still unused.
- **A `status: deceased/retired` field** on `WorldActor`, if historical
  figures (Kaido, Big Mom, Whitebeard, ...) are ever wanted for lore
  purposes without implying they're currently active.
- Expanding the roster further (there are dozens more canon characters not
  listed here) — this pass covered ~41 total `WorldActor` rows (roughly
  the "amplio" tier the user chose among a few size options), not an
  exhaustive canon cast.
