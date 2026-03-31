# Plan: Speed → Starting Tick Formula

## Context
Each character's starting position on the infinite Tick stream is not fixed — it is determined by their Speed stat combined with their class's defined Tick range. Higher Speed biases the character toward the minimum of their class range (acts sooner), with a Speed-weighted random roll determining the final value. This makes initiative dynamic per fight while keeping Speed meaningful without being deterministic.

---

## Confirmed Design Inputs

| Input | Source | Description |
|---|---|---|
| `class_min` | Class constant | Lowest possible starting Tick for this class |
| `class_max` | Class constant | Highest possible starting Tick for this class |
| `Speed` | Character stat | Normalized 0–100; higher = biases toward `class_min` |

---

## Proposed Formula

```
speed_factor = 1 - (Speed / 100)           # 0.0 at max Speed, 1.0 at min Speed
max_offset   = (class_max - class_min) × speed_factor
starting_tick = class_min + randint(0, round(max_offset))
```

### Behaviour at Key Speed Values

| Speed | speed_factor | Effective range | Result |
|---|---|---|---|
| 100 (max) | 0.0 | [min, min] | Always starts at class_min |
| 75 | 0.25 | [min, min + 25% of range] | Strongly biased to min |
| 50 | 0.50 | [min, min + 50% of range] | Balanced |
| 25 | 0.75 | [min, min + 75% of range] | Likely toward mid–max |
| 0 (min) | 1.0 | [min, max] | Full class range, no bias |

**Intuition**: Speed does not guarantee a fixed Tick — it *compresses the ceiling* of the random roll toward the class minimum. Max Speed characters always act at the fastest possible position for their class. Min Speed characters roll across the full class range.

---

## Class Range Values (TBD — needs user confirmation)

Suggested starting ranges based on class archetype. These become constants in `app/core/constants.py`:

| Class | Suggested min | Suggested max | Notes |
|---|---|---|---|
| Hunter | 1 | 6 | Fastest class — Speed maximises this |
| Ranger | 3 | 9 | Fast, precise |
| Caster | 5 | 12 | Mid-speed; compensates with Power |
| Warrior | 6 | 14 | Tanky, slower to open |
| Enchanter | 7 | 15 | Support — acts after faster units |
| Guardian | 10 | 20 | Slowest — built to absorb, not race |

> **These values need user confirmation before they are locked.**

---

## Where This Gets Documented / Implemented

1. **`CONCEPT.md`** — add Speed formula and class range table under the Character System section
2. **`app/core/constants.py`** (future) — `CLASS_TICK_RANGES = { "Hunter": (1, 6), ... }`
3. **`app/core/`** (future) — `combat_init.py` or similar — `calculate_starting_tick(speed, class_name)` pure function, no Kivy imports

---

## Verification
- Formula is deterministic given seed → testable with pytest
- At Speed 100: `starting_tick == class_min` always
- At Speed 0: `starting_tick` is uniformly distributed in `[class_min, class_max]`
- All class ranges are stored as named constants, no magic numbers
