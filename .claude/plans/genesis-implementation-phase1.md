# Plan: Genesis — Phase 1 Implementation
## Scaffold + Core Combat Engine

---

## What Gets Built

### 1. Project Scaffold
All directory structure, config files, and empty module stubs. No logic yet except `constants.py`.

### 2. Core Combat Engine (`app/core/`)
Pure Python. Zero Kivy imports. Fully testable in isolation.

---

## Files to Create

### Scaffold
| File | Purpose |
|---|---|
| `main.py` | Entry point — launches Kivy app, nothing else |
| `requirements.txt` | Kivy, pytest, pytest-kivy, pyjnius |
| `buildozer.spec` | Android/iOS build config |
| `app/__init__.py` | Empty package marker |
| `app/core/__init__.py` | Empty package marker |
| `app/screens/__init__.py` | Empty package marker |
| `app/components/__init__.py` | Empty package marker |
| `app/services/__init__.py` | Empty package marker |
| `app/utils/__init__.py` | Empty package marker |
| `tests/__init__.py` | Empty package marker |
| `assets/kv/.gitkeep` | Preserve empty dir |
| `assets/data/characters/.gitkeep` | Preserve empty dir |
| `assets/data/skills/.gitkeep` | Preserve empty dir |
| `assets/data/items/genesis/.gitkeep` | Preserve empty dir |
| `assets/data/items/campaign/.gitkeep` | Preserve empty dir |
| `assets/data/quests/.gitkeep` | Preserve empty dir |
| `assets/data/modes/.gitkeep` | Preserve empty dir |

### Core Constants
| File | Contents |
|---|---|
| `app/core/constants.py` | All game constants — class tick ranges, dice table, multipliers, thresholds |

### Core Characters
| File | Class | Purpose |
|---|---|---|
| `app/core/characters/__init__.py` | — | Exposes `Unit`, `StatBlock` |
| `app/core/characters/stat_block.py` | `StatBlock` | 6 stats: Strength, Endurance, Power, Resistance, Speed, Precision |
| `app/core/characters/unit.py` | `Unit` | Base unit model — HP, AP, tick position, skills, passive, status slots |

### Core Combat
| File | Class | Purpose |
|---|---|---|
| `app/core/combat/__init__.py` | — | Exposes `TickCalculator`, `DiceResolver`, `HitChanceEvaluator` |
| `app/core/combat/tick_calculator.py` | `TickCalculator` | Starting tick formula; tick advancement; AP regen per tick |
| `app/core/combat/dice_resolver.py` | `DiceResolver` | 5-outcome dice roll; probability shift; outcome application |
| `app/core/combat/hit_chance_evaluator.py` | `HitChanceEvaluator` | Precision × base_chance; shift probability table |

### Tests
| File | Tests |
|---|---|
| `tests/test_tick_calculator.py` | Speed 100 → class_min; Speed 0 → full range; formula correctness |
| `tests/test_dice_resolver.py` | Outcome distribution; Tumbling delay range; Evasion counter recursion |
| `tests/test_hit_chance_evaluator.py` | Probability shift direction; total probability always = 100% |

---

## Key Designs

### `app/core/constants.py`
```python
# Class tick ranges (working values — confirmed during prototyping)
CLASS_TICK_RANGES = {
    "Hunter":    (1,  6),
    "Ranger":    (3,  9),
    "Caster":    (5,  12),
    "Warrior":   (6,  14),
    "Enchanter": (7,  15),
    "Guardian":  (10, 20),
}

# Dice resolution table (base probabilities at 100% final chance)
DICE_BASE_PROBABILITIES = {
    "Boosted":  0.15,
    "Success":  0.45,
    "Tumbling": 0.10,
    "GuardUp":  0.20,
    "Evasion":  0.10,
}

BOOSTED_MULTIPLIER       = 1.5
TUMBLING_MULTIPLIER      = 0.5
GUARD_UP_MITIGATION      = 0.10   # 10% of output converted to target mitigation
TUMBLING_DELAY_MIN       = 1
TUMBLING_DELAY_MAX       = 5
EVASION_COUNTER_BASE     = 0.15   # 15% initial counter chance
EVASION_COUNTER_STEP     = 0.05   # drops by 5% per recursion
EVASION_COUNTER_MIN      = 0.01   # floor 1%

# AP
MAX_SKILL_SLOTS          = 4

# Input thresholds
HOVER_THROTTLE_MS        = 100
LONG_PRESS_DURATION_MS   = 500
SWIPE_MIN_DISTANCE_DP    = 50
DOUBLE_TAP_WINDOW_MS     = 300
```

### `app/core/combat/tick_calculator.py`
```python
class TickCalculator:
    def calculate_starting_tick(self, speed: int, class_name: str) -> int
    def advance_tick(self, current_tick: int, tu_cost: int) -> int
    def calculate_ap_gained(self, ticks_elapsed: int, ap_regen_rate: float) -> float
```

### `app/core/combat/dice_resolver.py`
```python
from enum import Enum

class DiceOutcome(Enum):
    BOOSTED  = "Boosted"
    SUCCESS  = "Success"
    TUMBLING = "Tumbling"
    GUARD_UP = "GuardUp"
    EVASION  = "Evasion"

class DiceResolver:
    def roll(self, shifted_probabilities: dict) -> DiceOutcome
    def apply_outcome(self, outcome: DiceOutcome, raw_output: int) -> dict
    def resolve_evasion_counter(self, recursion_depth: int) -> bool
    def calculate_tumbling_delay(self) -> int
```

### `app/core/combat/hit_chance_evaluator.py`
```python
class HitChanceEvaluator:
    def calculate_final_chance(self, precision: int, base_chance: float) -> float
    def shift_probabilities(self, final_chance: float) -> dict
```

### `app/core/characters/stat_block.py`
```python
class StatBlock:
    strength:   int
    endurance:  int
    power:      int
    resistance: int
    speed:      int
    precision:  int
```

### `app/core/characters/unit.py`
```python
class Unit:
    name:               str
    class_name:         str
    rarity:             int
    stats:              StatBlock
    hp:                 int
    max_hp:             int
    ap:                 float
    max_ap:             float
    ap_regen_rate:      float
    tick_position:      int
    skills:             list   # max 4
    passive:            object # defined by character
    secondary_resource: object # optional, None if unused
    status_slots:       list
```

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
9. All scaffold files (main.py, requirements.txt, buildozer.spec, __init__.py files, assets dirs)
10. Tests

---

## Branch
`claude/create-claude-docs-WugoI` — same branch, implementation commits on top of design docs.

## Rules Checklist
- [ ] Zero Kivy imports in `core/`
- [ ] No magic numbers — everything references `constants.py`
- [ ] No function exceeds 30 lines
- [ ] No class exceeds 100 lines — split into helpers if needed
- [ ] All classes named after what they do
- [ ] Tests cover formula correctness and edge cases
