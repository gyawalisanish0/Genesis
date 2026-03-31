# Plan: Genesis Phase 1 — Scaffold + Core Combat Engine

## Context
The Genesis repo currently contains only CLAUDE.md and CONCEPT.md — the design is fully documented but no code exists. Phase 1 builds the project scaffold and the core combat engine in `app/core/` (pure Python, zero Kivy imports, fully testable). This establishes the foundation every future layer builds on.

---

## Scope
1. **Project scaffold** — directory structure, config files, entry point, all `__init__.py` stubs
2. **Core combat engine** — Tick system, dice resolution, hit chance evaluation, unit model
3. **Tests** — pytest coverage for all core formulas

---

## Files to Create

### Scaffold
| File | Purpose |
|---|---|
| `main.py` | Entry point — instantiates Kivy app only |
| `requirements.txt` | kivy, kivymd, pytest, pytest-kivy, pyjnius |
| `buildozer.spec` | Android/iOS build config skeleton |
| `app/__init__.py` | Package marker |
| `app/core/__init__.py` | Package marker |
| `app/screens/__init__.py` | Package marker |
| `app/components/__init__.py` | Package marker |
| `app/services/__init__.py` | Package marker |
| `app/utils/__init__.py` | Package marker |
| `tests/__init__.py` | Package marker |
| `.claude/plans/` | Design and implementation plan files — committed to repo |
| `assets/kv/.gitkeep` | Preserve empty dir |
| `assets/data/characters/.gitkeep` | Preserve |
| `assets/data/skills/.gitkeep` | Preserve |
| `assets/data/items/genesis/.gitkeep` | Preserve |
| `assets/data/items/campaign/.gitkeep` | Preserve |
| `assets/data/quests/.gitkeep` | Preserve |
| `assets/data/modes/.gitkeep` | Preserve |

### `app/core/constants.py`
All named constants — no magic numbers anywhere else in the codebase:
- `CLASS_TICK_RANGES` — dict of (min, max) per class
- `DICE_BASE_PROBABILITIES` — base outcome weights at 100% final chance
- `BOOSTED_MULTIPLIER = 1.5`, `TUMBLING_MULTIPLIER = 0.5`
- `GUARD_UP_MITIGATION = 0.10`
- `TUMBLING_DELAY_MIN = 1`, `TUMBLING_DELAY_MAX = 5`
- `EVASION_COUNTER_BASE = 0.15`, `EVASION_COUNTER_STEP = 0.05`, `EVASION_COUNTER_MIN = 0.01`
- `MAX_SKILL_SLOTS = 4`
- `HOVER_THROTTLE_MS = 100`, `LONG_PRESS_DURATION_MS = 500`, `SWIPE_MIN_DISTANCE_DP = 50`, `DOUBLE_TAP_WINDOW_MS = 300`

### `app/core/characters/`
| File | Class | Responsibility |
|---|---|---|
| `__init__.py` | — | Exposes `Unit`, `StatBlock` |
| `stat_block.py` | `StatBlock` | 6 stats: Strength, Endurance, Power, Resistance, Speed, Precision |
| `unit.py` | `Unit` | HP, AP, ap_regen_rate, tick_position, class_name, rarity, skills (max 4), passive, secondary_resource, status_slots |

### `app/core/combat/`
| File | Class | Responsibility |
|---|---|---|
| `__init__.py` | — | Exposes `TickCalculator`, `DiceResolver`, `HitChanceEvaluator` |
| `tick_calculator.py` | `TickCalculator` | `calculate_starting_tick(speed, class_name)`, `advance_tick(current, tu_cost)`, `calculate_ap_gained(ticks_elapsed, regen_rate)` |
| `dice_resolver.py` | `DiceResolver` + `DiceOutcome` enum | `roll(shifted_probs)`, `apply_outcome(outcome, raw_output)`, `resolve_evasion_counter(depth)`, `calculate_tumbling_delay()` |
| `hit_chance_evaluator.py` | `HitChanceEvaluator` | `calculate_final_chance(precision, base_chance)`, `shift_probabilities(final_chance)` |

### `tests/`
| File | What it tests |
|---|---|
| `tests/test_tick_calculator.py` | Speed 100 → always class_min; Speed 0 → uniform in full range; advance_tick correctness; AP regen calculation |
| `tests/test_dice_resolver.py` | Outcome distribution matches shifted probs; Tumbling delay in [1,5]; Evasion counter recursion decrements correctly; floors at 1% |
| `tests/test_hit_chance_evaluator.py` | Final chance formula; probability shift direction (>100% biases positive, <100% biases negative); shifted probs always sum to 1.0 |
| `tests/test_stat_block.py` | StatBlock construction and field access |

---

## Key Formula Implementations

### TickCalculator.calculate_starting_tick
```python
speed_factor = 1 - (speed / 100)
max_offset = (class_max - class_min) * speed_factor
return class_min + random.randint(0, round(max_offset))
```

### HitChanceEvaluator.shift_probabilities
Strategy: scale positive outcomes (Boosted, Success) up/down proportionally with final_chance, redistribute remainder to negative outcomes (Tumbling, Guard Up, Evasion), always normalise to sum = 1.0.

### DiceResolver.resolve_evasion_counter
Recursive: counter_chance = max(BASE - depth * STEP, MIN); roll random; if triggers, resolve full action (re-enters dice table); depth increments each recursion.

---

## Build Order
1. `app/core/constants.py`
2. `app/core/characters/stat_block.py`
3. `app/core/characters/unit.py`
4. `app/core/characters/__init__.py`
5. `app/core/combat/hit_chance_evaluator.py`
6. `app/core/combat/dice_resolver.py`
7. `app/core/combat/tick_calculator.py`
8. `app/core/combat/__init__.py`
9. All scaffold files
10. Tests

---

## Rules Checklist (from CLAUDE.md)
- Zero Kivy imports in `core/`
- No magic numbers — all constants in `constants.py`
- No function > 30 lines — split into helpers if needed
- No class > 100 lines — extract to helper with numeric suffix if exceeded
- Subfolder `__init__.py` exposes only public interface
- Layer ordering enforced: `core` only, no imports from `services/screens/components`

---

## Verification
- `pytest tests/` passes with no failures
- `python -c "from app.core.combat import TickCalculator, DiceResolver, HitChanceEvaluator"` succeeds with no import errors
- `python -c "from app.core.characters import Unit, StatBlock"` succeeds
- No `import kivy` anywhere under `app/core/`
