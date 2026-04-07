# CLAUDE.md — Genesis

This file defines the core rules for this repository. All contributors and AI assistants must follow these rules in every session.

---

## Project Overview

Genesis is a turn-based tactical mobile game.

- **Target platforms**: Android and iOS first; desktop browser is secondary
- **UI paradigm**: Mobile-first, touch-native, portrait-only
- **Philosophy**: Modular, robust, human-readable code above all else — prefer smaller focused modules over large monolithic files

---

## Game Design Principles

These principles come from `CONCEPT.md` and are **load-bearing** for the
architecture. Any code in `core/` that violates them is wrong by definition,
even if it compiles and passes tests.

### 1. The system is dynamic, not absolute

The framework provides **hooks**, not behaviour. The Tick stream, dice table,
AP economy, stats, and status slots are scaffolding — *what actually happens
on the battlefield is defined by the skill, item, or passive itself*.

- `core/` must never hardcode what a skill "is allowed to do"
- The dice resolver must expose alteration hooks (probability shifts, rerolls,
  outcome overrides) so skill/item definitions can drive resolution
- Status effects must carry an open payload (stat mods, tick-interval effects,
  custom hooks) — not a fixed enum of effect types
- Skill `effectType` is declared on the skill, not constrained by the framework
- New mechanics should be expressible by adding a JSON definition, **not** by
  editing `core/` — if `core/` needs a code change to support a new skill,
  the hook is in the wrong place

### 2. No fixed character or team count

Just like the Tick stream is unbounded in time, the unit roster is unbounded
in count. The combat framework treats units as an open collection.

- **Never** hardcode a team-size constant in `core/` (no `TEAM_SIZE_MAX`,
  no `MAX_PLAYERS`, no fixed-length arrays for units)
- Combat math, AI lookahead, and timeline rendering must scale to arbitrary
  unit counts
- **Modes are the only layer allowed to impose a cap** — via an optional
  `maxTeamSize?: number` (or similar) field on `ModeDef`. Absent = unlimited
- A mode-imposed limit is an exception applied at the mode boundary, not a
  property of the combat system

### 3. Tick stream is continuous and infinite

- No rounds, no turns, no global turn counter — `core/` must not contain a
  `currentRound` or `turnNumber` variable
- `BattleResult` and similar records use `ticksElapsed`, never `turns`
- Every unit owns its own `tickPosition`; battle state is the set of all
  positions on a shared infinite stream

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
│       │   ├── screen-types.ts
│       │   ├── unit.ts
│       │   ├── GameContext.ts    # Zustand store
│       │   ├── combat/
│       │   │   ├── TickCalculator.ts
│       │   │   ├── HitChanceEvaluator.ts
│       │   │   ├── DiceResolver.ts
│       │   │   └── index.ts
│       │   └── __tests__/
│       ├── navigation/           # Screen routing, safe-area, back-button
│       │   ├── screenRegistry.ts
│       │   ├── ScreenContext.tsx
│       │   ├── ScreenShell.tsx
│       │   └── useScreen.ts
│       ├── services/             # (planned) Side-effectful singletons; Capacitor allowed
│       │   ├── DataService.ts    # (planned) JSON loader + Zod validation
│       │   └── DisplayService.ts # (planned) StatusBar / fullscreen control
│       ├── scenes/               # (planned) Phaser scenes — Phaser imports only
│       │   └── BattleScene.ts    # (planned)
│       ├── screens/              # React screen components
│       │   ├── SplashScreen.tsx
│       │   ├── MainMenuScreen.tsx
│       │   ├── PreBattleScreen.tsx  # split into PreBattleStep{Mode,Team,Items}
│       │   ├── BattleScreen.tsx
│       │   ├── BattleResultScreen.tsx
│       │   ├── RosterScreen.tsx
│       │   └── SettingsScreen.tsx
│       ├── components/           # Reusable React widgets
│       ├── styles/
│       │   └── tokens.css        # CSS custom properties (design system)
│       ├── App.tsx               # React Router root + ScreenProvider
│       └── main.tsx              # Vite entry point
```

> **Note:** `services/` and `scenes/` are reserved directories — the architecture
> depends on them but they have not yet been created. Any code requiring a
> service or Phaser scene must add the directory and module rather than
> bypassing the layer. The legacy Python/Kivy prototype has been removed from
> this repository.

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
- **Android back button**: handled by `ScreenProvider` via Capacitor — one listener, never re-registered
- All timing thresholds (long-press, double-tap, swipe) are constants in `src/core/constants.ts`

---

## Screen System

All screen routing, lifecycle, safe-area padding, and back-button behaviour flows through the screen handling system in `src/navigation/`.

### Key files

| File | Purpose |
|---|---|
| `src/core/screen-types.ts` | Pure TS types: `ScreenId`, `ScreenConfig`, `SafeAreaMode`, `ScreenLifecycleHooks` |
| `src/navigation/screenRegistry.ts` | `SCREEN_IDS` constants + `SCREEN_REGISTRY` map |
| `src/navigation/ScreenContext.tsx` | React context + `ScreenProvider` |
| `src/navigation/useScreen.ts` | Hook for all screens |
| `src/navigation/ScreenShell.tsx` | Safe-area wrapper component |

### Rules

- **Always use `SCREEN_IDS`** for navigation targets — never string literals for routes
- **Every screen must render `<ScreenShell>` as its outermost element** — this applies the correct safe-area padding automatically
- **Use `useScreen(hooks?)` inside every screen** — it returns `{ screen, safeInsets, navigateTo }`
- **`ScreenProvider` must be a direct child of `<HashRouter>`** in `App.tsx` (it calls `useLocation`)
- **Back-button override**: pass `onBack: () => boolean` in the hooks argument to `useScreen()`; return `true` to consume the event, `false` to fall through to the default

### `SafeAreaMode` values

| Value | When to use |
|---|---|
| `'full'` | All 4 edges inset — menus, roster, settings, battle-result |
| `'top-only'` | Top edge only — battle screen (game canvas fills the bottom) |
| `'none'` | No insets — splash or full-bleed decorative screens |

### `ScreenConfig` fields

| Field | Purpose |
|---|---|
| `canGoBack` | `true` → default back = `history.back()` |
| `exitAppOnBack` | `true` → back exits the app (used for splash, main-menu) |
| `safeAreaMode` | Controls `ScreenShell` padding |

### Example: screen with a back override

```tsx
export function PreBattleScreen() {
  const { navigateTo } = useScreen({
    onEnter: () => { /* load roster data */ },
    onBack:  () => {
      if (stepIndex > 0) { setStepIndex(s => s - 1); return true }
      return false  // let default handler navigate back
    },
  })
  return <ScreenShell>…</ScreenShell>
}
```

### In-screen coordination

Complex screens with multiple coordinating children (e.g. BattleScreen: Phaser canvas + timeline + skill buttons) must use a **screen-local context** rather than prop drilling or the global Zustand store.

- Define `src/screens/<Name>Context.tsx` — a React context + `use<Name>Screen()` hook scoped to that screen
- Child components read from the screen context, never from props or global Zustand directly
- Screen contexts hold **ephemeral within-session state** (active turn, animation locks, selected targets) — things that don't survive navigation
- The global Zustand store (`GameContext`) is for **cross-screen persistent state only**: team selection, battle result, settings
- Phaser scenes communicate with React via a typed callback ref stored in the screen context (e.g. `onBattleEvent`) — never via direct Zustand writes during a Phaser frame
- **Rule of thumb**: if two sibling components need the same piece of state, lift it to the screen context, not to Zustand

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
