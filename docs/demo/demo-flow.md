# Genesis — Demo Flow

## Overview

A short campaign of 2–3 stages on Mars. The player is themselves — the
Commander — with a custom name and fleet name set at the start. The
demo opens in a dream, escalates to a threat, and ends with the
Commander's team deployed to Mars.

The player never controls the Commander directly on the battlefield.
The Commander is the strategist. The deployed team is the player's
instrument on the ground.

**The dream is not an introduction. It is a sign of something untold.**
The Creator finding the player is not a random curiosity — it matters
in ways neither the Creator nor the player understands yet. The threat
on Mars and the dream are connected. The demo is chapter one of
something that began before the player pressed play.

---

## Character Creation

Character creation happens **after the dream** — not before it.

The dream plays with no name, no identity. Then the player wakes into
the character creation screen. Entering a name is the moment identity
crystallises out of the dream. KALI greets the Commander by name
immediately after — the world snaps into focus.

| Field | Purpose |
|---|---|
| Commander name | Set after the dream — KALI uses it from this point forward |
| Fleet name | Shown on briefing screens, alarm UI, deployment orders |

The Creator never learns the name in the demo. That may matter later.

---

## Act 1 — The Dream

**Screen: full black. No UI.**

The Creator speaks. Not in a voice — in thoughts that become words
as they reach the player.

The Creator is **curious and chaotic**. It jumps between cosmic scales
and mundane observations without warning. It has never been perceived
before — it is perception itself — and this tiny signal looking back
at it is genuinely new.

Neither presence has a name yet. The Creator is **???**. The player
is **???**. Two unknown consciousnesses in the dark finding each other.
The Creator does not know what the player is. The player does not know
where they are. Names do not exist here yet.

The tone is not horror. Not religious awe. Something quieter — two
consciousnesses at completely different scales trying to make sense of
each other.

**The Creator's voice:**
- Jumps between ideas without transition
- Profound one moment, almost playful the next
- Genuinely curious, not threatening
- Chaotic but not cruel — just operating beyond normal conversational rules

The player is confused. The Creator is confused. Neither has words for
what is happening.

The dream ends. No explanation. No resolution.

**Design note:** The dream is a foreshadowing beat — not flavour, not
tutorial. Its true meaning is understood only later. On a first
playthrough it feels like a strange opening. On a second it feels like
a warning that was always there. Write the Creator's lines with this
double meaning in mind — they must hold up to retrospection.

---

## Act 2 — The Wake

**Screen: Commander's quarters / command deck.**

The Commander wakes. Talks to **KALI** to get bearings.

> **KALI** — Kinetic Autonomous Learning Intelligence, v1.1.2
> Developed by Kognitive Tech Limited

KALI is the Commander's primary interface throughout the demo —
briefings, status updates, alarms, deployment orders.

**KALI's voice:** Precise, professional, clinical. No small talk.
Every word is the right word. She does not speculate — she reports.
She does not comfort — she informs. Not cold, just exact.
A deliberate contrast to the Creator's chaos.

The dream sits uneasily but there is no time to process it.
KALI has no record of the dream. It did not happen in any system
she can see.

---

## Act 3 — The Alarm

**Sudden alert.**

KALI reports a threat detected on Mars. The threat is an **intergalactic
faction** — an organised force with reach beyond the solar system.
Their presence on Mars is deliberate, not accidental.

Their name, motivation, and connection to the Creator's dream are
intentionally withheld in the demo. Details are revealed progressively
as the story unfolds across worlds and chapters. The demo establishes
their existence — nothing more.

The Commander does not go to Mars. He assesses, decides, acts through
his team.

---

## Act 4 — Preparation

The Commander assembles and briefs the team. This is the pre-battle
wizard moment — team composition, mission parameters.

The deployed team are the playable characters in the dungeon.
Their names, classes, and personalities: TBD by designer.

---

## Act 5 — Mars Campaign

**3 dungeon stages on Mars.**

The player controls the deployed team. The Commander's perspective
appears in narrative moments — orders, updates, reactions — but the
ground belongs to the team.

The Creator may surface again during the campaign or at the end.
Frequency and context: TBD.

---

## Deployed Team

Fixed across all three stages:

| Character | Role | Control |
|---|---|---|
| Hugo Rekrot (`hugo_001`) | Leader — front-line suit fighter | Player-controlled |
| Husty (`husty_001`) | AI ally — control-and-burst caster | AI-controlled |
| Tara Kuronage (`tara_001`) | AI ally — tempo caster | AI-controlled |

`playerControl: 'single'` — only Hugo receives the player HUD.
Husty and Tara fight on their own ticks as AI allies.

---

## Enemy Roster

Four enemy types across the three stages. All are characters in the engine —
same `CharacterDef` structure as player characters. `type: 'enemy'` is
assigned by the map entity, not the character definition.

| ID | Name | Type | Stages |
|---|---|---|---|
| `netrolume_grunt_001` | Netrolume Grunt | Netrolume (pack soldier) | 1, 2, 3 |
| `netrolume_elite_001` | Netrolume Elite | Netrolume (heavy variant) | 2, 3 |
| `kiragen_combatant_001` | Kiragen Combatant | Kiragen (tech-integrated soldier) | 3 |
| `kiragen_controller_001` | Kiragen Controller | Kiragen (signal operator) | 3 |

See `docs/characters/civilizations/netrolume.md` and
`docs/characters/civilizations/kiragen.md` for species profiles.

Stats and skill kits for each: TBD during character design phase.

---

## Stage Arc (Confirmed)

| Stage | Name | Grid | Patrols | New enemies |
|---|---|---|---|---|
| `stage_001` | The Outpost | 8×8 | 2 | Netrolume grunt |
| `stage_002` | TBD | 10×10 | 4 | + Netrolume elite |
| `stage_003` | TBD | 12×12 | 6 | + Kiragen combatant + controller |

Objective across all stages: reach the exit.
Escalation: bigger maps, more patrols, new enemy types per stage.

---

## Open Design Questions

| Question | Status |
|---|---|
| Nature of the threat on Mars | ✅ Kiragen, deploying Netrolume |
| Deployed team | ✅ Hugo (leader) + Husty + Tara |
| Stage count | ✅ 3 stages |
| Stage 2 name and narrative beats | TBD |
| Stage 3 name and narrative beats | TBD |
| Kiragen controller — mechanic when neutralised | TBD |
| Netrolume grunt stats and skill kit | ✅ Done — STR 55 END 30 SPD 45 HP 280; Hertz Beats + Basic Attack / Clawd / Quick Charge |
| Netrolume elite stats and skill kit | ✅ Done — STR 70 END 50 SPD 40 HP 380; Hertz Beats + same 3 skills + Great Growl |
| Kiragen combatant stats and skill kit | TBD |
| Kiragen controller stats and skill kit | TBD |
| Does the Creator appear again mid-campaign or only at the end? | TBD |
| How does the demo end — victory state, cliffhanger, or loop back to Creator? | TBD |
| KALI personality | TBD |

---

## Tone Reference

- **The Creator**: cosmic, chaotic, curious — thinks in universes, speaks in fragments
- **The Commander**: authoritative, strategic, briefly disoriented by the dream
- **KALI**: precise, professional, clinical — no speculation, only reporting
- **Hugo**: last-stand fighter, defensive by default, precise language as shield
- **Husty**: physicist, IQ 300+, has already reviewed everything before you ask
- **Tara**: slowest to build, most dangerous when running — senses things others don't
- **Netrolume**: not hostile by nature — the signal is hostile
- **Kiragen**: measured, deliberate, system-like — they don't brawl
- **Mars**: hostile, silent, red — something wrong that shouldn't be wrong

---

## Technical Notes

- Commander name and fleet name stored in player profile / GameContext
- The Creator's dream sequence uses the narrative layer (`NarrativeService.play`)
- `blocking: true` on dream entries — full screen, no input during cutscene
- Character creation screen needed before SplashScreen navigates to main menu
- Deployed team defined in `stage.playerUnits` per stage JSON
