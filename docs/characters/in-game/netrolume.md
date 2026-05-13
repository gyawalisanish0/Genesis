# Netrolume — In-Game Characters

Character definitions for both Netrolume variants used in the demo campaign.

---

## Netrolume Grunt (`netrolume_grunt_001`)

### Identity

| Field | Value |
|---|---|
| Species | Netrolume |
| Role | Pack soldier — most common enemy across all three stages |
| Rarity | 1 |
| Class | Warrior |
| Data ID | `netrolume_grunt_001` |

### Passive — Hertz Beats

> *The signal locks. Every frequency point sharpens the target lock and
> shortens reaction time.*

| Field | Value |
|---|---|
| Trigger | Battle start |
| Effect | Relay 1 frequency point |
| Per point | −3 TU cost on all actions |
| Total reduction | −3 TU (permanent for the fight) |

One point, always active from tick 1. The grunt is always slightly faster
than their base TU costs suggest.

### Stats
TBD

### Skills
TBD

---

## Netrolume Elite (`netrolume_elite_001`)

### Identity

| Field | Value |
|---|---|
| Species | Netrolume |
| Role | Heavy variant — introduced Stage 2, prominent in Stage 3 |
| Rarity | 2 |
| Class | Warrior |
| Data ID | `netrolume_elite_001` |

### Passive — Hertz Beats

> *A tighter frequency lock. Two points means two layers of signal — the
> target is all there is.*

| Field | Value |
|---|---|
| Trigger | Battle start |
| Effect | Relay 2 frequency points |
| Per point | −3 TU cost on all actions |
| Total reduction | −6 TU (permanent for the fight) |

Same passive, higher tuning. The elite acts noticeably faster than the grunt
from the first tick. Kiragen has them locked in harder.

### Stats
TBD

### Skills
TBD

---

## Design Notes

- Hertz Beats is the mechanical representation of the radio frequency signal.
  The longer they fight the same enemy, the more tuned in they become —
  except here it is instant and permanent: they arrive already tuned.
- The TU reduction stacks with any skill-level TU cost reductions.
- Grunt and elite share the same passive name and mechanic — the difference
  is signal intensity, not signal type. Consistent with Kiragen using one
  modification process at different strengths.
- There is no frequency accumulation mid-fight — the relay fires once at
  start and the points are fixed. The passive is not a scaling threat;
  it is a baseline advantage that rewards the player for engaging quickly.
