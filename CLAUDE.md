# CLAUDE.md — Genesis

This file defines the core rules for this repository. All contributors and AI assistants must follow these rules in every session.

---

## Project Overview

Genesis is a game project built with Python + Kivy.

- **Target platforms**: Android and iOS first; desktop is secondary
- **UI paradigm**: Mobile-first, touch-native
- **Philosophy**: Modular, scalable, human-readable code above all else

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
│   └── utils/               # Pure helper functions, no side effects
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
- Pure functions only — no state, no side effects, no Kivy imports
- `input_helpers.py` provides stateless gesture utilities consumed by `input_service`

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

## Code Readability Rules

- **One function, one responsibility** — aim for ≤30 lines per function
- **No magic numbers** — define all constants in `app/core/constants.py`
- **Descriptive names**: `player_health` not `ph`, `on_attack_pressed` not `oap`
- **Layout lives in `.kv`** — do not set `size_hint`, `pos_hint`, `padding`, or colors in Python unless dynamically required
- **Comments explain *why*, not *what*** — the code explains what; comments explain intent and non-obvious decisions
- **No speculative abstractions** — only abstract when a pattern appears three or more times

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
- Create helpers or abstractions for one-time use
- Add error handling for scenarios that cannot happen
- Introduce features beyond what was explicitly requested
