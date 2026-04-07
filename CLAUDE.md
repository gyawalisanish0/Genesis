# CLAUDE.md — Genesis

This file defines the core rules for this repository. All contributors and AI assistants must follow these rules in every session.

---

## Project Overview

Genesis is a turn-based tactical mobile game.

- **Target platforms**: Android and iOS first; desktop browser is secondary
- **UI paradigm**: Mobile-first, touch-native, portrait-only
- **Philosophy**: Modular, robust, human-readable code above all else — prefer smaller focused modules over large monolithic files

---

## Tech Stack

| Layer | Tool |
|---|---|
| Language | TypeScript 5.x |
| UI Framework | React 18 + React Router v6 |
| Game Canvas | Phaser 3 (battle rendering only) |
| Build Tool | Vite 5 |
| State | Zustand 4 |
| Schema Validation | Zod 3 |
| Styling | CSS Modules + CSS custom properties |
| Native Bridge | Capacitor 6 (Android / iOS packaging) |
| Native Plugins | @capacitor/app, @capacitor/status-bar |
| Testing | Vitest + React Testing Library |
| Data | JSON files — all game content definitions |

---

## Repository Structure

```
Genesis/
├── CLAUDE.md
├── README.md
├── genesis-web/                  # Web project root (Vite + React + Capacitor)
│   ├── index.html
│   ├── package.json
│   ├── vite.config.ts
│   ├── tsconfig.json
│   ├── capacitor.config.ts
│   ├── android/                  # Capacitor-generated Android project
│   ├── public/
│   │   ├── data/                 # JSON game content (characters, skills, modes…)
│   │   └── images/               # 3x PNG assets (primary density)
│   └── src/
│       ├── core/                 # Pure TS game logic — zero UI imports
│       │   ├── types.ts
│       │   ├── constants.ts
│       │   ├── unit.ts
│       │   ├── GameContext.ts    # Zustand store
│       │   ├── combat/
│       │   │   ├── TickCalculator.ts
│       │   │   ├── HitChanceEvaluator.ts
│       │   │   ├── DiceResolver.ts
│       │   │   └── index.ts
│       │   └── __tests__/
│       ├── services/             # Side-effectful singletons; Capacitor allowed
│       │   ├── DataService.ts
│       │   └── DisplayService.ts
│       ├── scenes/               # Phaser scenes — Phaser imports only
│       │   └── BattleScene.ts
│       ├── screens/              # React screen components
│       │   ├── SplashScreen.tsx
│       │   ├── MainMenuScreen.tsx
│       │   ├── PreBattleScreen.tsx
│       │   ├── BattleScreen.tsx
│       │   ├── BattleResultScreen.tsx
│       │   ├── RosterScreen.tsx
│       │   └── SettingsScreen.tsx
│       ├── components/           # Reusable React widgets
│       ├── styles/
│       │   └── tokens.css        # CSS custom properties (design system)
│       ├── App.tsx               # React Router root + Capacitor back-button
│       └── main.tsx              # Vite entry point
└── app/                          # Legacy Python/Kivy tree (archived, do not modify)
```

---

## Architecture Rules

### Layer Ordering (no circular imports)
```
core → services → components/scenes → screens → App
```
Each layer may only import from layers to its left.

### `core/`
- **Zero UI imports** — no React, no Phaser, no Capacitor
- Pure TypeScript functions and interfaces
- Unit is an **immutable value object** — mutation functions return a new object

### `services/`
- No React imports
- Capacitor plugin imports allowed, always guarded by platform check:
  ```typescript
  import { Capacitor } from '@capacitor/core'
  if (Capacitor.isNativePlatform()) { /* native-only code */ }
  ```
- Accessed as module-level singletons

### `scenes/`
- Phaser 3 scenes only — no React imports
- Receives data from React via a typed interface passed at scene start
- Communicates results back to React via a callback or Zustand store write

### `components/`
- React + CSS Modules only — no Phaser
- Communicate upward via props/callbacks — never reach into parent state directly

### `screens/`
- One screen = one `.tsx` file in `screens/` + one `.module.css` alongside it
- Screens read Zustand store and navigate via `useNavigate()`
- No raw game logic — delegate to `core/` functions

---

## Input Handling

- **Menus / screens**: standard React `onClick` / `onPointerDown` handlers
- **Battle canvas**: Phaser input system (`this.input.on('pointerdown', ...)`)
- **Android back button**: one global listener in `App.tsx` via Capacitor `@capacitor/app`
  ```typescript
  App.addListener('backButton', ({ canGoBack }) => {
    if (canGoBack) window.history.back()
    else App.exitApp()
  })
  ```
- All timing thresholds (long-press, double-tap, swipe) are constants in `src/core/constants.ts`

---

## Data Architecture

### JSON Definition Files
All game content is in `public/data/`. No content is hardcoded in TypeScript.

- **One file per entity** — one JSON per character, skill, mode, item
- **Loaded by `DataService`** — fetches, validates with Zod, caches at startup
- **`core/` never fetches** — it receives plain objects from `DataService`
- **Schema is strict** — every JSON file must conform to its Zod schema

### Path convention
```
public/data/characters/warrior_001.json
public/data/skills/slash_001.json
public/data/modes/story.json
```

Each file includes a `type` field identifying its schema.

---

## Styling Rules

- **All sizes in `rem` or CSS custom properties** — no raw `px` except 1px borders/lines
- **Design tokens in `tokens.css`** — never hardcode colour values inline
- **Minimum touch target**: 48px × 48px (`var(--touch-min)`)
- **Safe-area insets via CSS env()**: `env(safe-area-inset-top)` or `var(--safe-top)`
  — never hardcode inset values
- **Portrait-only** — no landscape media queries; layout targets 360 × 640 px viewport
- **Layout in CSS modules** — do not set layout properties via React `style` prop
  unless the value is dynamic (e.g. calculated from game state)

### Design tokens (defined in `tokens.css`)
```css
--bg-deep, --bg-panel, --bg-card, --bg-elevated
--accent-genesis, --accent-gold, --accent-danger, --accent-heal
--text-primary, --text-secondary, --text-muted
--rarity-1 … --rarity-5
--safe-top, --safe-bottom, --safe-left, --safe-right
--touch-min
```

---

## Display & Full-Screen Rules

Genesis runs edge-to-edge on mobile — system bars are hidden during gameplay.

- **Capacitor StatusBar plugin** hides the status bar on app launch
- **`DisplayService`** is the only module that calls Capacitor display APIs
- **`env(safe-area-inset-*)` CSS variables** provide notch / gesture bar offsets
- **Desktop** runs in a 360 × 640 browser window; `env()` returns zero, layout works identically

---

## Modular Design Rules

### Universal rule
**Any code that becomes large or messy must be broken into helper functions or submodules.** No exceptions.

### When to split
- A function exceeds ~30 lines and has separable concerns
- A module grows beyond ~150 lines
- A concept appears in more than one place and could be encapsulated
- Code is hard to follow — **this alone is sufficient reason to extract a helper**

### File size guidelines

| Layer | Soft limit | Action when exceeded |
|---|---|---|
| Any module | 150 lines | Split into focused submodules |
| Any function | 30 lines | Extract sub-responsibilities |
| Any component | 100 lines | Extract child components |

### Naming convention
When a screen or service is split, use a numeric suffix for helpers:
```
PreBattleScreen.tsx  →  PreBattleScreen.tsx  +  PreBattleStepMode.tsx
                                              +  PreBattleStepTeam.tsx
```

---

## Code Readability Rules

- **One function, one responsibility** — ≤30 lines per function
- **No magic numbers** — all constants in `src/core/constants.ts`
- **Descriptive names**: `playerUnit` not `pu`, `onAttackPressed` not `oap`
- **Comments explain *why***, not *what* — the code explains what
- **Prefer explicit over clever** — readable beats concise

---

## Commit & Branch Conventions

| Type | Branch name |
|---|---|
| New feature | `feature/<short-name>` |
| Bug fix | `fix/<short-name>` |
| Refactor | `refactor/<short-name>` |
| Assets/content | `content/<short-name>` |

**Commit messages**: imperative mood, present tense.
- Good: `Add TickCalculator port`
- Bad: `added tick stuff`

---

## What Claude Should Never Do

- Import React, Phaser, or Capacitor inside `core/`
- Import Phaser inside `components/` or `screens/`
- Import React inside `scenes/`
- Hardcode colour values — use CSS custom properties from `tokens.css`
- Hardcode safe-area inset values — use `env(safe-area-inset-*)` or `var(--safe-*)`
- Set layout properties via React `style` prop when they belong in a CSS module
- Call Capacitor display/native APIs outside `services/`
- Write a function that does more than one thing — split it
- Leave any module beyond ~150 lines without evaluating a split
- Add error handling for scenarios that cannot happen
- Introduce features beyond what was explicitly requested
