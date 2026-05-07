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

Before the demo begins the player sets:

| Field | Purpose |
|---|---|
| Commander name | Used by the Creator in the dream, by the AI assistant throughout |
| Fleet name | Shown on briefing screens, alarm UI, deployment orders |

No other customisation in the demo. Name and fleet are enough to make
the fourth-wall moment land.

---

## Act 1 — The Dream

**Screen: full black. No UI.**

The Creator speaks. Not in a voice — in thoughts that become words
as they reach the player.

The Creator is **curious and chaotic**. It jumps between cosmic scales
and mundane observations without warning. It has never been perceived
before — it is perception itself — and this tiny signal looking back
at it is genuinely new.

It addresses the player **by their commander name**. Not a character.
The player.

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
briefings, status updates, alarms, deployment orders. Functional
by design but with her own voice and personality (TBD).

The dream sits uneasily but there is no time to process it.
KALI has no record of the dream. It did not happen in any system
she can see.

---

## Act 3 — The Alarm

**Sudden alert.**

A threat is detected on Mars. Nature of the threat: TBD by designer.

The Commander does not go to Mars. He is the strategist. He assesses,
decides, and acts through his team.

---

## Act 4 — Preparation

The Commander assembles and briefs the team. This is the pre-battle
wizard moment — team composition, mission parameters.

The deployed team are the playable characters in the dungeon.
Their names, classes, and personalities: TBD by designer.

---

## Act 5 — Mars Campaign

**2–3 dungeon stages on Mars.**

The player controls the deployed team. The Commander's perspective
appears in narrative moments — orders, updates, reactions — but the
ground belongs to the team.

The Creator may surface again during the campaign or at the end.
Frequency and context: TBD.

---

## Open Design Questions

These are confirmed as TBD — to be filled in before implementation:

| Question | Status |
|---|---|
| Nature of the threat on Mars | TBD |
| AI assistant name + personality | TBD |
| Deployed team — names, classes, count | TBD |
| Does the Creator appear again mid-campaign or only at the end? | TBD |
| How does the demo end — victory state, cliffhanger, or loop back to Creator? | TBD |

---

## Tone Reference

- **The Creator**: cosmic, chaotic, curious — thinks in universes, speaks in fragments
- **The Commander**: authoritative, strategic, briefly disoriented by the dream
- **The AI assistant**: TBD
- **The deployed team**: TBD
- **Mars**: hostile, silent, red — something wrong that shouldn't be wrong

---

## Technical Notes

- Commander name and fleet name stored in player profile / GameContext
- The Creator's dream sequence uses the narrative layer (`NarrativeService.play`)
- `blocking: true` on dream entries — full screen, no input during cutscene
- Character creation screen needed before SplashScreen navigates to main menu
- Deployed team defined in `stage.playerUnits` per stage JSON
