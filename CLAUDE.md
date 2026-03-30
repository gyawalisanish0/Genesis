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
│   │   └── ...
│   └── utils/               # Pure helper functions, no side effects
│       ├── __init__.py
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

### utils/
- Pure functions only — no state, no side effects, no Kivy imports

---

## Mobile-First Rules

- **Always use `dp()` / `sp()` units** — never hardcode pixel values
- **Minimum touch target**: 48dp × 48dp
- **Design for portrait at 360×640dp first**, then scale up and handle landscape
- **Asset optimization**: compressed PNGs, compressed audio — keep APK size minimal
- **No hover-dependent interactions** — assume touch only

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
