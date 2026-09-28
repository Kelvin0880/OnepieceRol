# Grand Line RPG

A multiplayer text roleplay set in the One Piece world, judged by AI with real permadeath and a world that moves on its own. This file is only the shared vocabulary; how things are built is in [CLAUDE.md](./CLAUDE.md), canon data in [WORLD_LORE.md](./WORLD_LORE.md), the whole system in [APLICACION_COMPLETA.md](./APLICACION_COMPLETA.md). Decisions and their reasons are in [docs/adr](./docs/adr).

## Language

### People

**Player character**:
A character controlled by a human. The only kind of person that can be a real player.
_Avoid_: user (that is the account), avatar

**Canon actor**:
A named character from the One Piece story who acts on their own in the world (Shanks, Kizaru, Dragon...). Only the **Owner** decides their death or capture.
_Avoid_: NPC, boss

**Resident**:
A filler character who lives on one island (bartender, guard, thug...) with a live state (free, hurt, captured, dead) and a successor when they die. The only invented people the narrator may present.
_Avoid_: NPC, extra

**Nakama**:
An NPC recruited into a player's crew who fights beside them. Always at the captain's level, at most three.
_Avoid_: companion, follower

**Owner**:
The one account with authority over canon deaths and captures, acting through `/admin`.
_Avoid_: admin (a tool, not a role), GM

### Groups and scenes

**Crew**:
A named group of player characters under one captain. Bounty hunters cannot have one.

**Party**:
The members of a crew who are alive, on the same island and not separated, sharing one scene.
_Avoid_: group, squad

**Party round**:
One lap of the shared scene: every party member acts in turn order, then the narrator answers all of it at once. A round never closes on a timer, only when everyone has acted or someone closes it.
_Avoid_: turn (a turn is one member's action within the round)

### Fighting

**Referee**:
The AI that judges each exchange of a fight: how much life and stamina each fighter loses. Code only bounds and applies its verdict.
_Avoid_: dice, combat roll

**Judge**:
The AI that decides everything else that used to be a roll (outcomes, fates, matches, how a fight ends). Same rule: code bounds and applies.

**Joint fight**:
One fight with several fighters on the allied side (players and nakamas) against one enemy, resolved a round at a time. Its **kind** says what it is for and sets its rules: party, poneglyph, conquest, raid, arc, rescue, canon_vanguard, canon, admiral, seat, sovereign.

**Duel**:
A one-on-one fight between two players. Non-lethal unless one side is hunted by the other's faction.
_Avoid_: PvP fight

**Surrender**:
Closing a fight because the side cannot win, judged like any other ending. Accepted at any health only where fleeing is impossible (an Admiral dispatch).
_Avoid_: give up (in code and news)

**Logia immunity**:
The rule that a Logia body is only hurt by Armament Haki, Conqueror's Haki, seastone or seawater, or a same-element fruit.

### Captivity

**Imprisonment**:
Being held by the Government (Marines, CP-0) in a jail on an island, or in Impel Down when the bounty or notoriety is high enough. May allow **bail** or a rescue.

**Custody**:
Being held by a non-Government winner of a duel: the captive travels with the captor, is only paid out when delivered to a Government island, and escapes after 24 hours.
_Avoid_: prison (that is imprisonment)

**Bail**:
The berries that free a prisoner. Not offered to highly wanted prisoners.

### Power and the world

**Seat**:
A limited position of command (Admiral, Fleet Admiral, Revolutionary Commander, Chief of Staff, Leader, Gorosei) won by beating its holder, not earned by merit alone.
_Avoid_: rank (ranks are the merit titles below a seat)

**Admiral dispatch**:
A rare event in which an Admiral sails to an island and fights every hunted pirate there in one inescapable joint fight; the defeated are captured, never killed.

**Grudge**:
A canon actor's memory of one specific player after an escape, a sparing or a defeat; it decays and can bring their subordinates back to find that player.

**World arc**:
A slow multi-chapter story between canon actors. Nobody dies or is captured during it; only the Owner's verdict at the end can decide that.
_Avoid_: event (world happenings and beginner events are different things)

**World happening**:
A one-off invented event that adds colour to the news and never changes canon.

**Road Poneglyph**:
One of the four stones needed to reach Laugh Tale. Reading one needs the ancient script and raises pursuit heat.

**Historia Poneglyph**:
One of six lore stones, each tied to an island, unlocked earlier than the Road stones.

**Timeline**:
The single line of a character's history. A rollback discards everything after a checkpoint, including the narrator's memory of it.
