# Kiragen — In-Game Characters

Character definitions for both Kiragen types used in the demo campaign.
Kiragen appear exclusively in Stage 3.

---

## Kiragen Combatant (`kiragen_combatant_001`)

### Identity

| Field | Value |
|---|---|
| Species | Kiragen |
| Role | Tech-integrated direct combat soldier |
| Combat identity | Adaptive threat — becomes exponentially more dangerous the longer the fight runs |
| Class | TBD |
| Rarity | 3 |
| Data ID | `kiragen_combatant_001` |

### Passive — Tactical Scan

> *Every move the opposition makes is data. The longer the Kiragen
> watches, the less it misses.*

The Kiragen combatant maintains a **Context Bar** that fills as the
opposing team acts. It never empties mid-fight — each threshold reached
is permanent for that battle.

**Fill rate:** 4–8% per opponent action (random per action). All
player-side units contribute — Hugo, Husty, and Tara each fill the
bar independently on their turns.

**Threshold timing** (approximate, with all 3 player units acting):

| Threshold | Approx. player actions to reach |
|---|---|
| 30% | 4–8 actions |
| 70% | 9–18 actions |
| 100% | 13–25 actions |

The 4–8% randomisation means the player cannot calculate exactly when
the Kiragen tips over a threshold. They know the pressure is building —
they don't know how fast.

**Thresholds:**

| Context Bar | Effect |
|---|---|
| 30%+ | Dodge chance → 40% |
| 70%+ | Dodge chance → 55% · Deflect 30% of incoming damage (blocked) at 15% chance |
| 100% | Dodge chance → 60% · Deflect 35% of incoming damage (blocked) at 18% chance · Critical chance 10% at 300% of own skill base damage |

**Deflect** blocks a portion of incoming damage — it is not reflected
back to the attacker. The Kiragen simply absorbs less.

**Critical** at 100% applies to the Kiragen's own skill actions only —
10% chance any of their attacks deals 300% of that skill's base damage.

### Stats

TBD

### Skills

TBD

---

## Kiragen Controller (`kiragen_controller_001`)

### Identity

| Field | Value |
|---|---|
| Species | Kiragen |
| Role | Signal operator — maintains Netrolume frequency lock |
| Combat identity | TBD |
| Class | TBD |
| Rarity | 3 |
| Data ID | `kiragen_controller_001` |

### Passive

TBD

### Stats

TBD

### Skills

TBD

---

## Design Notes

- Both Kiragen types are human-looking with greyish-green skin. No
  visual tells that distinguish them from a distance except context.
- Tech integration is internal — they carry no visible weapons or
  equipment. Everything they do comes from within.
- **Tactical Scan** rewards aggressive play: burst the combatant down
  before 70% Context Bar if possible. A combatant that reaches 100%
  in a 3v1 is a genuine crisis — 60% dodge, deflect on top, and a
  10% chance of triple damage on every swing.
- Stage 3 will typically feature both a combatant and a controller
  in the same encounter. The correct priority target order is a key
  tactical decision the player has to make.
