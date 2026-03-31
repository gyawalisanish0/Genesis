# CLAUDE.md — Genesis

This file defines the core rules for this repository. All contributors and AI assistants must follow these rules in every session.

---

## Project Overview

Genesis is a game project built with Python + Kivy.

- **Target platforms**: Android and iOS first; desktop is secondary
- **UI paradigm**: Mobile-first, touch-native
- **Philosophy**: Modular, robust, human-readable code above all else — prefer smaller focused modules over large monolithic files

---

## Tech Stack

| Layer | Tool |
|---|---|
| Language | Python 3.11+ |
| UI Framework | Kivy (KivyMD optional for Material widgets) |
| Packaging | Buildozer (Android/iOS) |
| State | Lightweight observable pattern — no heavy frameworks |
| Testing | pytest + pytest-kivy |

---

## Repository Structure

```
Genesis/
├── CLAUDE.md
├── README.md
├── buildozer.spec
├── requirements.txt
├── main.py                  # Entry point only — no logic here
├── app/
│   ├── __init__.py
│   ├── core/                # Pure Python game logic (zero Kivy imports)
│   │   ├── __init__.py
│   │   └── ...
│   ├── screens/             # One file per screen
│   │   ├── __init__.py
│   │   └── ...
│   ├── components/          # Reusable Kivy widgets
│   │   ├── __init__.py
│   │   └── ...
│   ├── services/            # APIs, persistence, audio, analytics, etc.
│   │   ├── __init__.py
│   │   ├── input_service.py # Global input handler — single source of truth for input events
│   │   └── ...
│   └── utils/               # Helper functions and classes — stateless preferred, no Kivy imports
│       ├── __init__.py
│       ├── input_helpers.py # Stateless helpers: gesture detection, hold timing, swipe math
│       └── ...
├── assets/
│   ├── images/
│   ├── fonts/
│   ├── audio/
│   └── kv/                  # .kv layout files — mirror app/ structure
└── tests/
    └── ...
```

---

## Architecture Rules

### Layer Ordering (no circular imports)
```
core → services → components → screens → main
```
Each layer may only import from layers to its left.

### core/
- **Zero Kivy imports** — game logic must be framework-agnostic and independently testable
- Contains entities, game state, rules, and algorithms

### screens/
- One screen = one `.py` file in `screens/` + one matching `.kv` in `assets/kv/`
- Screens orchestrate components; they do not contain raw game logic

### components/
- Self-contained reusable widgets
- Communicate upward via Kivy events (`dispatch`) — never call parent methods directly

### services/
- Accessed as module-level singletons or via a simple `ServiceLocator`
- Examples: `audio_service.py`, `save_service.py`, `analytics_service.py`
- `input_service.py` is the **single global input handler** — all raw Kivy touch/keyboard events are funnelled here first

### utils/
- Helper functions and helper classes — no Kivy imports
- Stateless pure functions are preferred; stateful helper classes are allowed when logic is complex enough to warrant it
- `input_helpers.py` provides stateless gesture utilities consumed by `input_service`
- Each helper module has a single clear responsibility — split by domain, not by file size

---

## Input Handling

### Global Input Service (`app/services/input_service.py`)
- Single module-level singleton — instantiated once in `main.py`
- Binds to Kivy's `Window` for keyboard events and wraps `on_touch_*` for touch events
- Translates raw Kivy events into named game-level actions (e.g. `"confirm"`, `"attack"`, `"drag"`)
- Dispatches named Kivy events that components and screens subscribe to — no direct calls into game objects
- Holds the minimal state required for gesture recognition (touch start position, timestamp); all detection logic lives in `input_helpers.py`

### Input Helpers (`app/utils/input_helpers.py`)
Pure, stateless functions. Each helper receives raw touch/event data and returns a result; no side effects.

| Helper | What it detects |
|---|---|
| `is_tap(touch)` | Quick press-and-release within a small movement radius |
| `is_long_press(touch, duration)` | Touch held beyond a configurable threshold (default 500 ms) |
| `is_swipe(touch, min_distance)` | Directional movement past a distance threshold; returns direction enum |
| `is_pinch(touches)` | Two-finger spread or squeeze; returns scale delta |
| `is_double_tap(touch)` | Two taps in quick succession (uses Kivy's built-in `is_double_tap`) |
| `is_hover(motion_event)` | Pointer/finger dwelling over a target with no active press; behaviour varies by platform (see below) |

### Hover — Universal Behaviour
Hover is supported on **all platforms** but is expressed differently per input device:

| Platform | Hover source | Kivy event |
|---|---|---|
| Android / iOS | Finger held still over a target (no movement, no lift) | `on_touch_move` with near-zero delta |
| Desktop (mouse) | Mouse pointer over a target with no button pressed | `on_mouse_pos` |
| Desktop (touch/stylus) | Same as mobile — stationary contact | `on_touch_move` with near-zero delta |

`is_hover` normalises these into a single boolean result so callers need no platform checks.
`input_service` tracks the last pointer position and emits a `"hover"` named event at a throttled rate (defined by `HOVER_THROTTLE_MS` in `constants.py`).

### Rules
- **`input_service` is the only place** that binds to raw Kivy touch/keyboard events
- Components and screens **never** bind `on_touch_down` directly for game actions — they subscribe to named events from `input_service`
- All timing thresholds (long-press duration, double-tap window, swipe distance, hover throttle) are constants defined in `app/core/constants.py`

---

## Mobile-First Rules

- **Always use `dp()` / `sp()` units** — never hardcode pixel values
- **Minimum touch target**: 48dp × 48dp
- **Design for portrait at 360×640dp first**, then scale up and handle landscape
- **Asset optimization**: compressed PNGs, compressed audio — keep APK size minimal

---

## Modular Design Rules

Genesis is a complex system — combat, ticks, dice, progression, and UI all interact. Modularity is the primary defence against unmaintainable code.

### Universal rule — applies to every layer, every file
**Any code that becomes large or messy must be broken into helper classes or submodules.** This is not optional and has no exceptions — it applies equally to `core/`, `services/`, `components/`, `screens/`, and `utils/`.

### When to create a helper class or module
- A function exceeds ~30 lines and has clearly separable concerns
- A module is growing beyond ~150 lines
- A concept appears in more than one place and could be encapsulated
- A data structure and the logic that operates on it naturally belong together
- Code is becoming hard to read or follow — **this alone is sufficient reason to extract a helper**
- **When in doubt, split it out** — a well-named helper class is always clearer than a large monolithic function

### Helper class rules
- One responsibility per class — name it after what it does (`TickCalculator`, `DiceResolver`, `HitChanceEvaluator`)
- Helper classes live in the same layer as the code that needs them — a `core/` helper stays in `core/`, a `components/` helper stays in `components/`
- Helper classes in `core/` and `utils/` must not import Kivy
- Helper classes in `components/`, `services/`, or `screens/` may import Kivy where necessary
- Layer ordering still applies — helpers cannot import from layers to their right
- Prefer composition over inheritance — small focused helpers composed together beat deep class hierarchies

### File size guidelines

| Layer | Soft limit | Action when exceeded |
|---|---|---|
| Any module | 150 lines | Consider splitting into focused submodules |
| Any function / method | 30 lines | Extract sub-responsibilities into helper methods or classes |
| Any class | 100 lines | Extract grouped behaviour into a dedicated helper class |

These are guides, not hard rules — split when it improves clarity, not just to hit a number.

---

## Code Readability Rules

- **One function, one responsibility** — aim for ≤30 lines per function
- **No magic numbers** — define all constants in `app/core/constants.py`
- **Descriptive names**: `player_health` not `ph`, `on_attack_pressed` not `oap`
- **Layout lives in `.kv`** — do not set `size_hint`, `pos_hint`, `padding`, or colors in Python unless dynamically required
- **Comments explain *why*, not *what*** — the code explains what; comments explain intent and non-obvious decisions
- **Prefer explicit over clever** — readable code beats concise code that requires thought to parse

---

## Commit & Branch Conventions

| Type | Branch name |
|---|---|
| New feature | `feature/<short-name>` |
| Bug fix | `fix/<short-name>` |
| Refactor | `refactor/<short-name>` |
| Assets/content | `content/<short-name>` |

**Commit messages**: imperative mood, present tense, concise.
- Good: `Add health bar component`
- Bad: `added healthbar stuff`

---

## What Claude Should Never Do

- Import Kivy inside `core/`
- Hardcode pixel values
- Put layout properties in Python when they belong in `.kv`
- Write a function or class that does more than one thing — split it instead
- Leave any code large or messy when a helper class would make it clean — this applies everywhere, no exceptions
- Leave a module growing beyond ~150 lines without evaluating whether to split it
- Create deeply nested logic that could be flattened with a helper class
- Add error handling for scenarios that cannot happen
- Introduce features beyond what was explicitly requested
