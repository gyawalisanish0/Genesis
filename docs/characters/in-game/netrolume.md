# Netrolume — In-Game Characters

Character definitions for both Netrolume variants used in the demo campaign.

---

## Netrolume Grunt (`netrolume_grunt_001`)

### Identity

| Field | Value |
|---|---|
| Species | Netrolume |
| Role | Pack soldier — most common enemy across all three stages |
| Combat identity | Hit hard, die fast — glass cannon |
| Class | Warrior |
| Rarity | 1 |
| Data ID | `netrolume_grunt_001` |

### Passive — Hertz Beats

> *The signal locks. The frequency sharpens reaction time — every action
> comes a beat faster than it should.*

| Field | Value |
|---|---|
| Trigger | Battle start |
| Effect | Relay 1 frequency point |
| Per point | −10% of each skill's base TU cost |
| Total reduction | −10% TU on all actions (permanent for the fight) |

### Stats

| Stat | Value |
|---|---|
| STR | 55 |
| END | 30 |
| PWR | 5 |
| RES | 25 |
| SPD | 45 |
| PRC | 40 |
| HP | 280 |
| AP | 80 |
| AP Regen | 0.5 / tick |

### Skills

#### Basic Attack
| Field | Value |
|---|---|
| AP Cost | 8 |
| TU Cost | 10 → effective **9** (after Hertz Beats) |
| Damage | 20% STR (physical, melee) |
| Base Chance | 0.95 |
| Tags | `physical`, `melee` |

Low-damage AP-conservation option. Near-reliable — barely a threat on its
own but chips AP down and keeps pressure on.

#### Clawd
| Field | Value |
|---|---|
| AP Cost | 12 |
| TU Cost | 19 → effective **17** (after Hertz Beats) |
| Damage | 60% STR (physical, melee) |
| Base Chance | 0.82 |
| Tags | `physical`, `melee` |

The primary threat. Heavy, telegraphed — the lunge is readable but
devastating if it lands. Lower accuracy reflects the feral aggression
over precision.

#### Quick Charge
| Field | Value |
|---|---|
| AP Cost | 18 |
| TU Cost | 16 → effective **14** (after Hertz Beats) |
| Damage | 10 + 45% STR (physical, melee) |
| Base Chance | 0.90 |
| Tags | `physical`, `melee` |

Fast burst that drains AP quickly. Lower TU than Clawd but higher AP cost
— trades sustainability for speed. Harder to read than the heavy swing so
higher accuracy than Clawd.

---

## Netrolume Elite (`netrolume_elite_001`)

### Identity

| Field | Value |
|---|---|
| Species | Netrolume |
| Role | Heavy variant — introduced Stage 2, prominent in Stage 3 |
| Combat identity | Danger window fighter — baseline even with grunt, devastating during Great Growl |
| Class | Warrior |
| Rarity | 2 |
| Data ID | `netrolume_elite_001` |

### Passive — Hertz Beats

> *Two frequency points. The target lock is total — no hesitation, no
> noise between signal and action.*

| Field | Value |
|---|---|
| Trigger | Battle start |
| Effect | Relay 2 frequency points |
| Per point | −10% of each skill's base TU cost |
| Total reduction | −20% TU on all actions (permanent for the fight) |

Elite skill base costs are 20% higher than grunt versions. The 20% cost
increase and 20% Hertz Beats reduction roughly cancel — the elite operates
at similar effective TU to the grunt at baseline. The real threat is
Great Growl.

### Stats

| Stat | Value |
|---|---|
| STR | 70 |
| END | 50 |
| PWR | 5 |
| RES | 40 |
| SPD | 40 |
| PRC | 48 |
| HP | 380 |
| AP | 90 |
| AP Regen | 0.55 / tick |

### Skills

#### Basic Attack
| Field | Value |
|---|---|
| AP Cost | 10 |
| TU Cost | 12 → effective **10** (after Hertz Beats) |
| Damage | 20% STR (physical, melee) |
| Base Chance | 0.95 |
| Tags | `physical`, `melee` |

#### Clawd
| Field | Value |
|---|---|
| AP Cost | 14 |
| TU Cost | 23 → effective **18** (after Hertz Beats) |
| Damage | 60% STR (physical, melee) |
| Base Chance | 0.82 |
| Tags | `physical`, `melee` |

#### Quick Charge
| Field | Value |
|---|---|
| AP Cost | 22 |
| TU Cost | 19 → effective **15** (after Hertz Beats) |
| Damage | 10 + 45% STR (physical, melee) |
| Base Chance | 0.90 |
| Tags | `physical`, `melee` |

#### Great Growl
| Field | Value |
|---|---|
| AP Cost | 11 |
| TU Cost | 12 → effective **10** (after Hertz Beats) |
| Effect | +2 frequency points (stacks with Hertz Beats) for 8 global battle ticks |
| Base Chance | — (self-buff, no accuracy roll) |
| Cooldown | 4 turns |
| Tags | `buff`, `self` |

During the Great Growl window the elite reaches **4 total frequency points**
(−40% TU on all actions):

| Skill | Base TU | Great Growl effective TU |
|---|---|---|
| Basic Attack | 12 | 7 |
| Clawd | 23 | 14 |
| Quick Charge | 19 | 11 |
| Great Growl | 12 | 7 |

This is the danger window. An elite mid-Great Growl acts significantly faster
than any grunt and hits as hard. Killing or debuffing the elite before it
can use Great Growl again is the correct strategic response.

---

## Effective TU Reference

Full comparison at each frequency state:

| Skill | Grunt (1pt) | Elite baseline (2pt) | Elite + Great Growl (4pt) |
|---|---|---|---|
| Basic Attack | 9 | 10 | 7 |
| Clawd | 17 | 18 | 14 |
| Quick Charge | 14 | 15 | 11 |
| Great Growl | — | 10 | 7 |

---

## Design Notes

- **Hertz Beats** is percentage-based on each skill's own base TU cost —
  it scales naturally with any future skill added to either character
  without needing adjustment.
- The elite's 20% cost inflation and 20% Hertz Beats reduction are
  intentionally near-neutral at baseline. The elite is not just a
  faster grunt — it is a grunt with a danger window.
- Great Growl duration is measured in **global battle ticks**, not
  the elite's own action count. At fast effective TU speeds the elite
  may act 3–4 times inside one Great Growl window.
- **Clawd** is an intentional character name — not a typo of Claw.
