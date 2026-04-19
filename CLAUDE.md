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

### 3. Tick stream is the only source of action ordering

- **No global round / turn counter** that gates when units act — `core/`
  must not contain a `currentRound` or shared `turnNumber` variable, and
  initiative is never decided by "whose turn it is in the round"
- Every unit owns its own `tickPosition`; battle state is the set of all
  positions on a shared infinite stream
- **Per-character action counters are fine** — counting how many actions
  a unit has taken (for XP scaling, stats, telemetry, `BattleResult.turns`,
  etc.) is a runtime metric, not a round system. The rule is about
  initiative truth, not vocabulary

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
│   │   ├── data/                 # JSON game content
│   │   │   ├── characters/       # index.json + one subfolder per character
│   │   │   │   ├── index.json    # ["warrior_001", "hunter_001"]
│   │   │   │   ├── warrior_001/  # Iron Warden (Warrior, Rarity 3)
│   │   │   │   │   ├── main.json   # CharacterDef
│   │   │   │   │   └── skills.json # SkillDef[] — Slash (physical, melee)
│   │   │   │   └── hunter_001/   # Swift Veil (Hunter, Rarity 2)
│   │   │   │       ├── main.json
│   │   │   │       └── skills.json # Arcane Bolt (energy, ranged)
│   │   │   └── modes/            # story.json, ranked.json
│   │   └── images/               # 3x PNG assets (primary density)
│   └── src/
│       ├── core/                 # Pure TS game logic — zero UI imports
│       │   ├── types.ts          # StatBlockDef, CharacterDef, SkillDef, Unit, ModeDef, AppSettings, BattleResult
│       │   ├── constants.ts      # All numeric constants: tick ranges, dice params, timing thresholds
│       │   ├── screen-types.ts   # ScreenId, ScreenConfig, SafeAreaMode, ScreenLifecycleHooks
│       │   ├── unit.ts           # Immutable Unit factory + mutation helpers (createUnit, takeDamage, healUnit, …)
│       │   ├── battleHistory.ts  # HistoryEntry type + makeHistoryEntry factory
│       │   ├── GameContext.ts    # Zustand store: selectedMode, selectedTeam, selectedTeamIds, enemies, battleResult, settings
│       │   ├── combat/
│       │   │   ├── TickCalculator.ts     # calculateStartingTick, advanceTick, calculateApGained
│       │   │   ├── HitChanceEvaluator.ts # calculateFinalChance, shiftProbabilities (5-outcome table)
│       │   │   ├── DiceResolver.ts       # roll, applyOutcome, calculateTumblingDelay, resolveEvasionCounter
│       │   │   └── index.ts
│       │   ├── effects/          # Effect engine — open hook system for skills/items/passives
│       │   │   ├── types.ts      # 15 effect discriminated union, ValueExpr, WhenClause, EffectContext
│       │   │   ├── applyEffect.ts        # Dispatch: rescope target → evaluate condition → call handler
│       │   │   ├── resolveValue.ts       # ValueExpr → number (flat, stat-%, sum)
│       │   │   ├── conditions.ts         # Recursive boolean gates (chance, HP/AP, status, dice, not/all/any)
│       │   │   ├── patch.ts              # Named-key level-upgrade patching (dot-delimited paths)
│       │   │   ├── targetSelector.ts     # Single/multi/filtered target resolution
│       │   │   └── builtins/     # 6 registered handlers: damage, heal, gainAp, spendAp, tickShove, modifyStat
│       │   └── engines/skill/    # createSkillInstance, getCachedSkill, levelUpSkill, invalidateCache
│       ├── navigation/           # Screen routing, safe-area, back-button
│       │   ├── screenRegistry.ts # SCREEN_IDS constants + SCREEN_REGISTRY map (7 screens)
│       │   ├── ScreenContext.tsx  # ScreenProvider: pathname→config, safe-area env() read, Capacitor + popstate back-button
│       │   ├── ScreenShell.tsx   # Safe-area padding wrapper (full / top-only / none)
│       │   └── useScreen.ts      # Hook: { screen, safeInsets, navigateTo }; registers onEnter/onLeave hooks
│       ├── input/                # Hardware + browser back-button coordination
│       │   ├── backButtonRegistry.ts  # Module-level singleton: register/unregister/invoke one handler at a time
│       │   └── useBackButton.ts       # Hook: registers handler, pushes URL-sentinel for web popstate interception
│       ├── services/             # Side-effectful singletons; Capacitor allowed
│       │   ├── DataService.ts    # JSON loader: loadCharacter, loadCharacterSkillDefs, loadMode, loadCharacterWithSkills (cached)
│       │   └── __tests__/
│       ├── utils/
│       │   └── useScrollAwarePointer.ts  # Tap / hold / scroll gesture discriminator (pointer-delta based)
│       ├── screens/              # React screen components (one .tsx + one .module.css each)
│       │   ├── SplashScreen.tsx          # Simulated load progress → auto-navigate to main menu
│       │   ├── MainMenuScreen.tsx        # PLAY / ROSTER / SETTINGS nav; quit confirm on back
│       │   ├── PreBattleScreen.tsx       # 3-step wizard shell + back button
│       │   ├── PreBattleContext.tsx      # Wizard state: step, selectedModeId, selectedTeam, canContinue
│       │   ├── PreBattleStepMode.tsx     # Step 0 — mode selection (story / ranked / draft)
│       │   ├── PreBattleStepTeam.tsx     # Step 1 — character roster pick (1–2 units)
│       │   ├── PreBattleStepItems.tsx    # Step 2 — equipment slots (stub)
│       │   ├── BattleScreen.tsx          # Battle layout: timeline strip, portrait col, action grid, overlays
│       │   ├── BattleContext.tsx         # Screen-local context: phase, units, timeline, dice/turn display, sequential AI timing, no-team guard
│       │   ├── TurnDisplayPanel.module.css
│       │   ├── DiceResultOverlay.module.css
│       │   ├── BattleResultScreen.tsx    # Victory/defeat banner, rewards, unit results, battle stats
│       │   ├── RosterScreen.tsx          # Character grid with class + rarity + name filters
│       │   └── SettingsScreen.tsx        # Audio / display / notification / account settings
│       ├── components/           # Reusable React widgets
│       │   ├── PrimaryButton.tsx         # Variants: primary / secondary / danger / ghost
│       │   ├── ResourceBar.tsx           # Animated HP / AP / XP bar (400ms tween)
│       │   └── UnitPortrait.tsx          # Portrait circle: rarity-coloured border, 4 sizes, greyscale option
│       ├── styles/
│       │   └── tokens.css        # Full design-token set (colours, typography, spacing, radius, motion, safe-area)
│       ├── App.tsx               # HashRouter + ScreenProvider + 7-route declaration
│       └── main.tsx              # Vite entry: registerBuiltins() → React root
```

> **Planned / not yet created:** `scenes/` (Phaser 3 battle canvas), `services/DisplayService.ts`
> (StatusBar / fullscreen). Any code requiring these must add the directory and module — do not bypass the layer.

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
- **`DataService` path construction** — `import.meta.env.BASE_URL` must be
  normalized to always end with `/` before concatenating data paths. Vite's
  `--base` flag (used in GitHub Pages CI) produces `/RepoName` without a
  trailing slash, which would silently misroute fetches:
  ```typescript
  const BASE = import.meta.env.BASE_URL
  const BASE_NORMALIZED = BASE.endsWith('/') ? BASE : `${BASE}/`
  // fetch: `${BASE_NORMALIZED}data/characters/...`
  ```

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

- **Menus / screens**: standard React `onPointerDown` handlers (via `useScrollAwarePointer`)
- **Battle canvas**: Phaser input system (`this.input.on('pointerdown', ...)`) — planned; not yet wired
- **Back button — native (Android/iOS)**: Capacitor `App.addListener('backButton', …)` in `ScreenProvider`, dispatches to `backButtonRegistry`. One listener, never re-registered.
- **Back button — web browser**: `popstate` capture-phase listener in `ScreenProvider` intercepts browser back before React Router. `useBackButton` pushes a URL-stable sentinel (`window.history.pushState(null, '')` at the current hash) so no `hashchange` fires; only `popstate` fires and is intercepted cleanly.
- **Back button in battle**: `useBackButton` registers a bounded pause loop — back → pause, back → resume. Guards: skip during load, 300 ms debounce, functional `setPaused(prev => !prev)` to avoid stale closure.
- All timing thresholds (long-press, double-tap, swipe, debounce) are constants in `src/core/constants.ts`

### **CRITICAL: Scroll-Aware Pointer Detection (Session Rule)**

**Any interactive element (button, card, clickable row) inside a scrollable container MUST use `useScrollAwarePointer` or risk broken UX.**

#### The Problem
Without scroll detection, scrolling inside a list accidentally triggers button taps — the `onPointerDown` fires even though the user intended to scroll, not select. This breaks immersion and creates rage-quit moments.

#### The Solution
**Use `useScrollAwarePointer` hook** from `src/utils/useScrollAwarePointer.ts`:

```tsx
import { useScrollAwarePointer } from '../utils/useScrollAwarePointer'

export function MyScreen() {
  const createHandler = useScrollAwarePointer()

  return (
    <div style={{ overflowY: 'auto' }}>
      <button onPointerDown={createHandler({
        onTap:   () => doSelect(),           // fires on quick tap, no movement
        onHold:  () => showContextMenu(),    // fires after LONG_PRESS_DURATION_MS
        onScroll: () => cancelSelection(),   // fires if pointer moves >= SCROLL_DETECT_THRESHOLD_PX
      })}>
        Select
      </button>
    </div>
  )
}
```

#### When to Apply
- ✅ **ALWAYS** if your interactive element is inside a scrollable container
- ✅ **ALWAYS** in list/grid screens (PreBattleStepTeam, RosterScreen, SettingsScreen, etc.)
- ❌ **NOT NEEDED** if your element is in a non-scrolling context (menus, fixed nav, overlays)
- ❌ **NOT NEEDED** for sliders, range inputs (they have their own scroll semantics)

The hook detects gesture intent via **pointer movement delta** (not scroll position), so it works
correctly on any element — scrollable container or not. No `ref` is required.

#### Hook Options Breakdown
- `onTap()` — User pressed and released quickly without scrolling. **Most common action.**
- `onHold()` — User held the pointer for `LONG_PRESS_DURATION_MS` (500ms). Use for context menus, long-press effects.
- `onScroll()` — User scrolled the container by ≥`SCROLL_DETECT_THRESHOLD_PX` (8px) during pointer interaction. **Optional; often unused.**

You can pass any subset of these; unused handlers are simply ignored.

#### Backward Compatibility
The hook still accepts the old signature (direct callback):
```tsx
createHandler(() => selectCard())  // equivalent to createHandler({ onTap: () => selectCard() })
```

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
public/data/characters/index.json              # character discovery list
public/data/characters/{id}/main.json          # CharacterDef (stats, class, rarity…)
public/data/characters/{id}/skills.json        # SkillDef[] for that character
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
/* Backgrounds */
--bg-deep, --bg-panel, --bg-card, --bg-elevated, --bg-overlay

/* Accents */
--accent-genesis   /* primary purple — selection, focus, Roll button */
--accent-gold      /* Boosted outcome, legendary rarity */
--accent-info      /* AP bars, ally highlights */
--accent-heal      /* Success outcome, heal effects */
--accent-warn      /* Tumbling / GuardUp outcome */
--accent-danger    /* HP bars, damage, defeat */
--accent-evasion   /* Evasion outcome */

/* Text */
--text-primary, --text-secondary, --text-muted, --text-on-accent

/* Rarity */
--rarity-1 … --rarity-6  /* rarity-7 is a gradient, applied inline */

/* Safe-area insets */
--safe-top, --safe-bottom, --safe-left, --safe-right

/* Touch */
--touch-min   /* 3rem (48 dp) — minimum tap target */

/* Motion */
--motion-screen    /* 300ms ease-out — screen push/pop */
--motion-modal     /* 250ms ease-out — modal slide-up */
--motion-bar       /* 400ms ease-out — HP/AP bar tween */
--motion-button    /* 80ms ease-in  — button press */
--motion-timeline  /* 200ms ease-in-out — timeline marker */
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
