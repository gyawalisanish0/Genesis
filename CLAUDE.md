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
- `TICK_MAX_OCCUPANCY` is a **battle-engine** constant (max units per tick
  slot before D8 displacement fires) — architecturally distinct from a
  team-size cap; it applies to the tick stream itself, not to roster size

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

### 4. Reactive mechanics use hooks, not hardcoded branches

The counter mechanic is the canonical example: the framework detects Evasion
and checks for a `counter`/`uniqueCounter`-tagged skill — it does **not**
hardcode "warriors can counter" anywhere. New reactive mechanics follow the
same pattern:

- Tag the skill JSON with the relevant tag (`counter`, `uniqueCounter`, etc.)
- The framework checks for that tag; skills define what happens
- `core/combat/CounterResolver.ts` contains the eligibility helpers
  (`findCounterSkill`, `canCounter`, `isSingleTarget`)
- Counter dice: `max(0.01, 0.15 − depth × 0.02)` — diminishes with chain
  depth but never reaches zero. See `docs/mechanics/counter.md` for full spec.
- **Player counter = active choice** — when counter roll succeeds for the player,
  a prompt appears: [COUNTER] fires the skill, [SKIP] forfeits the opportunity
  (AP conservation, bait avoidance). The decision is always with the player.
- **Enemy AI counter = strategic skip** — the AI fires only if remaining AP
  after cost would be ≥ `AI_COUNTER_AP_RESERVE` (20); otherwise it skips to
  preserve AP for its offensive turn.
- **Counter reactions bypass cooldown** — `counter`/`uniqueCounter` skills are
  never placed on cooldown when used reactively. Cooldown applies only to
  proactive (normal turn) use of those same skills.

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
│   │   ├── manifest.json         # PWA manifest: standalone mode, portrait, theme colour
│   │   ├── data/                 # JSON game content
│   │   │   ├── characters/       # index.json + one subfolder per character
│   │   │   │   ├── index.json    # ["warrior_001", "hunter_001"]
│   │   │   │   ├── warrior_001/  # Iron Warden (Warrior, Rarity 3)
│   │   │   │   │   ├── main.json     # CharacterDef
│   │   │   │   │   ├── skills.json   # SkillDef[] — Slash (physical, melee)
│   │   │   │   │   └── dialogue.json # CharacterDialogueDef — universal reactions
│   │   │   │   └── hunter_001/   # Swift Veil (Hunter, Rarity 2)
│   │   │   │       ├── main.json
│   │   │   │       ├── skills.json   # Arcane Bolt (energy, ranged)
│   │   │   │       └── dialogue.json # CharacterDialogueDef — universal reactions
│   │   │   ├── levels/           # Level-specific narrative (one subfolder per level)
│   │   │   │   └── story_001/
│   │   │   │       └── narrative.json # LevelNarrativeDef — story beats, cutscenes
│   │   │   └── modes/            # story.json, ranked.json
│   │   └── images/               # 3x PNG assets (primary density)
│   └── src/
│       ├── core/                 # Pure TS game logic — zero UI imports
│       │   ├── types.ts          # StatBlockDef, CharacterDef, SkillDef, Unit, ModeDef, AppSettings, BattleResult
│       │   ├── constants.ts      # All numeric constants: tick ranges, dice params, timing thresholds, NARRATIVE_* timings
│       │   ├── screen-types.ts   # ScreenId, ScreenConfig, SafeAreaMode, ScreenLifecycleHooks
│       │   ├── unit.ts           # Immutable Unit factory + mutation helpers (createUnit, takeDamage, healUnit, incrementActionCount, …)
│       │   ├── battleHistory.ts  # HistoryEntry type + makeHistoryEntry factory
│       │   ├── GameContext.ts    # Zustand store: selectedMode, selectedTeam, selectedTeamIds, enemies, battleResult, settings
│       │   ├── combat/
│       │   │   ├── TickCalculator.ts     # calculateStartingTick, advanceTick, calculateApGained
│       │   │   ├── HitChanceEvaluator.ts # calculateFinalChance, shiftProbabilities (6-outcome table)
│       │   │   ├── DiceResolver.ts       # roll, applyOutcome, calculateTumblingDelay, resolveCounterRoll
│       │   │   ├── CounterResolver.ts    # findCounterSkill, canCounter, isSingleTarget
│       │   │   ├── CooldownResolver.ts   # isOnCooldown, ticksRemaining, turnsRemaining, applyCooldown
│       │   │   ├── TickDisplacer.ts      # rollD8Displacement, resolveTickDisplacement (tick occupancy cap)
│       │   │   ├── ClashResolver.ts      # buildFactions, resolveClashOrder, resolveClashWinner (speed/dice)
│       │   │   └── index.ts
│       │   ├── effects/          # Effect engine — open hook system for skills/items/passives
│       │   │   ├── types.ts      # 15 effect discriminated union, ValueExpr, WhenClause, EffectContext
│       │   │   ├── applyEffect.ts        # Dispatch: rescope target → evaluate condition → call handler
│       │   │   ├── resolveValue.ts       # ValueExpr → number (flat, stat-%, sum)
│       │   │   ├── conditions.ts         # Recursive boolean gates (chance, HP/AP, status, dice, not/all/any)
│       │   │   ├── patch.ts              # Named-key level-upgrade patching (dot-delimited paths)
│       │   │   ├── targetSelector.ts     # Single/multi/filtered target resolution
│       │   │   └── builtins/     # 6 registered handlers: damage, heal, gainAp, spendAp, tickShove, modifyStat
│       │   ├── narrative/        # Pure narrative types + resolver — zero UI imports
│       │   │   ├── types.ts      # NarrativeTrigger, NarrativeAnimation, NarrativeEntry, CharacterDialogueDef, LevelNarrativeDef, NarrativeEvent
│       │   │   ├── NarrativeResolver.ts # resolveByEvent, resolveById, pickLine
│       │   │   └── index.ts      # re-exports
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
│       │   ├── DataService.ts    # JSON loader: loadCharacter, loadCharacterSkillDefs, loadMode, loadCharacterWithSkills, loadCharacterDialogue, loadLevelNarrative (all cached)
│       │   ├── DisplayService.ts # Full-screen + StatusBar: Capacitor StatusBar.hide() on native; Fullscreen API on web
│       │   ├── NarrativeService.ts # Global narrative bus: emit(), play(), subscribe(), subscribeDirect(), registerEntries(), unregisterEntries(), getAllEntries()
│       │   └── __tests__/
│       ├── utils/
│       │   ├── useScrollAwarePointer.ts  # Tap / hold / scroll gesture discriminator (pointer-delta based)
│       │   └── useViewportScale.ts       # portrait: scale=w/360; landscape: scale=min(w/360,h/640); innerHeight=h/scale; updates on resize/orientationchange/visualViewport
│       ├── hooks/                # Shared React hooks (data fetching, UI state)
│       │   └── useRosterData.ts          # Loads character index + all CharacterDef via DataService (cached)
│       ├── screens/              # React screen components (one .tsx + one .module.css each)
│       │   ├── SplashScreen.tsx          # Real DataService preload (characters + modes) → auto-navigate to main menu
│       │   ├── MainMenuScreen.tsx        # PLAY / ROSTER / SETTINGS nav; quit confirm on back
│       │   ├── PreBattleScreen.tsx       # 3-step wizard shell + back button
│       │   ├── PreBattleContext.tsx      # Wizard state: step, selectedModeId, selectedTeam, canContinue
│       │   ├── PreBattleStepMode.tsx     # Step 0 — mode selection (story / ranked / draft)
│       │   ├── PreBattleStepTeam.tsx     # Step 1 — character roster pick (1–2 units)
│       │   ├── PreBattleStepItems.tsx    # Step 2 — equipment slots (stub)
│       │   ├── BattleScreen.tsx          # Battle layout: timeline strip, portrait col, action grid, overlays
│       │   ├── BattleContext.tsx         # Screen-local context: phase, units, timeline, DiceResult+message, 6-outcome dice, sequential AI timing, deferred player state apply, skipTurn
│       │   ├── TurnDisplayPanel.module.css
│       │   ├── DiceResultOverlay.module.css
│       │   ├── ClashQteOverlay.tsx       # Cross-team clash QTE: spinning knob + tug-of-war bar
│       │   ├── ClashQteOverlay.module.css
│       │   ├── TeamCollisionOverlay.tsx  # Same-team Now/Later choice prompt for speed-tied allies
│       │   ├── TeamCollisionOverlay.module.css
│       │   ├── BattleResultScreen.tsx    # Victory/defeat banner, rewards, unit results, battle stats
│       │   ├── RosterScreen.tsx          # Character grid with class + rarity + name filters
│       │   └── SettingsScreen.tsx        # Audio / display / notification / account settings
│       ├── components/           # Reusable React widgets
│       │   ├── PrimaryButton.tsx         # Variants: primary / secondary / danger / ghost
│       │   ├── ResourceBar.tsx           # Animated HP / AP / XP bar (400ms tween)
│       │   ├── UnitPortrait.tsx          # Portrait circle: rarity-coloured border, 4 sizes, greyscale option
│       │   ├── PagedGrid.tsx             # Generic paged grid: cols×rows, pointer swipe, arrows, dots, page counter
│       │   ├── NarrativeLayer.tsx        # Global narrative overlay (mounted in App.tsx); exports NarrativeUnits registry
│       │   ├── NarrativeDialogueOverlay.tsx  # Dialogue box: portrait + nameplate + typewriter text
│       │   ├── NarrativeScreenFlash.tsx  # Full-screen colour burst animation
│       │   ├── NarrativePortraitFlyIn.tsx # Character portrait slides in from left/right
│       │   └── NarrativeFloatingText.tsx # Floating impact text (e.g. "CRITICAL!")
│       ├── styles/
│       │   └── tokens.css        # Full design-token set (colours, typography, spacing, radius, motion, safe-area, --app-scale)
│       ├── App.tsx               # Transform-scale viewport + HashRouter + ScreenProvider + 7-route declaration
│       ├── App.module.css        # Outer wrapper (black letterbox); inner container uses CSS transform scale
│       └── main.tsx              # Vite entry: registerBuiltins() → React root
```

> **Planned / not yet created:** `scenes/` (Phaser 3 battle canvas).
> Any code requiring this must add the directory and module — do not bypass the layer.

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
- **Back button in battle**: `useBackButton` registers a strict bounded pause loop — back → pause, back → resume. No navigation escape via back; only the LEAVE BATTLE button in the pause menu exits. Guards: skip during load, 300 ms debounce, functional `setPaused(prev => !prev)` to avoid stale closure.
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
public/data/characters/{id}/dialogue.json      # CharacterDialogueDef — universal battle reactions (optional)
public/data/levels/{levelId}/narrative.json    # LevelNarrativeDef — story beats + cutscenes (optional)
public/data/modes/story.json
```

Each file includes a `type` field identifying its schema.

### Skill tags — reactive mechanics

Skills carry a `tags: string[]` array. Tags that carry framework-level
meaning (i.e. `BattleContext` inspects them) are:

| Tag | Effect |
|---|---|
| `counter` | Standard reactive counter. When the unit evades a single-target attack, this skill may fire as a free action (15% base chance, −2% per chain depth, min 1%). |
| `uniqueCounter` | Same dice and chain rules as `counter`; indicates a character-specific reactive skill with custom effects. |

All other tags (`physical`, `energy`, `melee`, `ranged`, etc.) are
informational — used by the UI and future filter logic, not by the combat
engine.

### Skill cooldown fields

Skills may carry either or both optional cooldown fields:

| Field | Type | Meaning |
|---|---|---|
| `tickCooldown` | `number` (optional) | Ticks that must elapse on the skill owner's `tickPosition` after use. |
| `turnCooldown` | `number` (optional) | Number of the **owner's own actions** (`actionCount`) that must occur after use. |

Both fields are absent by default (no cooldown). Both must clear before a
skill with dual cooldowns is usable again. Values are patchable via
`levelUpgrades`. See `docs/mechanics/cooldown.md` for the full spec.

---

## Narrative Layer

The narrative layer drives immersive dialogue and visual reactions across all
screens. It is globally active — any screen, context, or service can fire an
event and the nearest `NarrativeLayer` component resolves and plays the match.

Full spec: `docs/mechanics/narrative.md`

### Key rules

- **`NarrativeLayer` is mounted once in `App.tsx`** — inside the scale container,
  as a sibling of `<Routes>`. Never mount it inside a screen component.
- **`NarrativeService.emit(event)`** fires a narrative event from any layer
  (`core/` excluded — pass `defId` not `unit.id` so triggers match JSON keys).
- **`NarrativeService.play(narrativeId)`** triggers a specific entry directly
  (cutscene transitions, boss taunts, scripted moments).
- **`NarrativeService.registerEntries(namespace, entries)`** populates the entry
  pool. Call at startup (`SplashScreen`) for persistent character/level data.
- **`NarrativeUnits.register(units)`** — call after battle units load so portrait
  fly-in animations can resolve speaker data. Clear on battle unmount.
- **Character dialogue** lives in `characters/{id}/dialogue.json` — universal,
  mode-independent reactions. Registered under namespace `'characters'`.
- **Level narrative** lives in `levels/{levelId}/narrative.json` — story-specific
  beats. Registered under namespace `'{levelId}'`.
- **`blocking: true`** dims the screen and blocks input — use only for story
  cutscenes, never for frequent reactive lines.
- **`priority`** — higher interrupts lower. Default is `0`; story beats use `20`.
- **`once: true`** — the entry is tracked in a session-scoped Set and will not
  fire again in the same session.
- **`sequence: true`** — all `lines` play in order, one tap (or `NARRATIVE_DISMISS_MS`)
  per line. Without it, one line is picked randomly.

### Animation types (play simultaneously per entry)

| Type             | Visual effect |
|---|---|
| `dialogue`       | Slide-up box: portrait + nameplate + typewriter text |
| `screen_flash`   | Full-screen colour burst; fades out |
| `portrait_fly`   | Character portrait slides in from left or right edge |
| `floating_text`  | Impact text rises from centre and fades |

### Standard event strings

`battle_start` · `battle_victory` · `battle_defeat` · `skill_used` ·
`boosted_hit` · `evaded` · `unit_death` · `counter` · `clash_resolved`

Any string is valid — add new events by adding JSON entries, no code change needed.

---

## Styling Rules

- **All sizes in `rem` or CSS custom properties** — no raw `px` except 1px borders/lines
- **Design tokens in `tokens.css`** — never hardcode colour values inline
- **Minimum touch target**: 48px × 48px (`var(--touch-min)`)
- **Safe-area insets via CSS env()**: `env(safe-area-inset-top)` or `var(--safe-top)`
  — never hardcode inset values
- **Portrait-only** — no landscape media queries; physical target 1080 × 1920 px (Full HD portrait, xxhdpi); CSS viewport 360 × 640 dp at 3× DPR
- **Transform-scale viewport** — `App.module.css` `.viewport` uses `position: fixed; inset: 0` (not `100vw/100vh` — those can diverge from `window.innerWidth/Height` on some browsers via scrollbar width or mobile URL-bar height, creating residual gaps). `useViewportScale` computes scale adaptively: portrait (`w ≤ h`) uses `scale = w/360` (width-first, fills edge-to-edge); landscape (`w > h`) uses `scale = Math.min(w/360, h/640)` (letterbox — prevents an unusably short canvas on desktop). `App.tsx` applies `transform: scale(N)` + `width: 360px` + `height: innerHeightpx` inline on the inner container. The `--app-scale` CSS custom property is set on `documentElement` so tokens.css can divide `env(safe-area-inset-*)` values to keep them physically correct inside the transform.
- **Layout in CSS modules** — do not set layout properties via React `style` prop
  unless the value is dynamic (e.g. calculated from game state — scale, innerHeight)

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

### Three fullscreen delivery paths

| Context | Mechanism |
|---|---|
| Capacitor native | `DisplayService.initFullScreen()` calls `StatusBar.setOverlaysWebView(true)` + `StatusBar.hide()` on mount |
| PWA installed (home screen) | `public/manifest.json` with `display: standalone` — browser chrome absent; no API call needed |
| Plain browser tab | `DisplayService` registers a `{ once: true, capture: true }` `pointerdown` listener; `SplashScreen` holds navigation until that first tap |

### Key rules

- **`DisplayService.initFullScreen()`** is called once in `App.tsx` on mount — it is the **only** module that calls Capacitor display APIs
  - On web, it skips the listener registration if already in standalone/fullscreen mode (`matchMedia` check)
- **`SplashScreen.isBrowserTab()`** detects whether the app is running as a plain browser tab (not native, not PWA standalone). Only in this context does the splash screen show the "TAP ANYWHERE TO ENTER" gate and defer navigation until the tap.
- **`capacitor.config.ts` `StatusBar.overlaysWebView: true`** — applied when native projects are synced; makes the WebView bleed under the status bar before JS runs (prevents cold-launch flash)
- **`public/manifest.json`** — `display: standalone`, `orientation: portrait`, colours match `--bg-deep`. Replace placeholder icon with proper 192×192 + 512×512 square PNGs when assets are ready.
- **`useViewportScale` hook** computes `scale` adaptively (portrait: `w/360`; landscape: `Math.min(w/360, h/640)`) and `innerHeight = h/scale`; listens to `window resize`, `orientationchange`, and `visualViewport resize` (fires when mobile URL bar shows/hides); `App.tsx` applies these as inline `transform: scale(N)` + dimensions on the inner container
- **`--app-scale` CSS custom property** — `App.tsx` writes `document.documentElement.style.setProperty('--app-scale', scale)` after every resize; `tokens.css` divides `env(safe-area-inset-*)` by `var(--app-scale)` so safe-area padding stays physically correct inside the transform
- **`env(safe-area-inset-*)` CSS variables** — always consumed via `var(--safe-top)` etc. from `tokens.css`; never hardcoded
- **Desktop** runs with black letterbox bars filling the unused area; `env()` safe-area insets return zero, layout works identically

### Deferred native steps (after `npx cap add android/ios`)

| Platform | File | Change |
|---|---|---|
| Android | `android/app/src/main/java/.../MainActivity.kt` | `onWindowFocusChanged`: `WindowInsetsControllerCompat.hide(systemBars())` + `BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE` |
| Android | `android/app/src/main/res/values/styles.xml` | `windowTranslucentStatus=true` + `windowLayoutInDisplayCutoutMode=shortEdges` to prevent cold-launch flash |
| iOS | `ios/App/App/Info.plist` | `UIStatusBarHidden=true`, `UIRequiresFullScreen=true`, `UIViewControllerBasedStatusBarAppearance=NO` |

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

## Session Protocol

**Before implementing any task, Claude must ask follow-up questions when requirements are not fully specified.**

This applies to all changes regardless of size — new features, bug fixes, refactors, and doc updates.

### When to ask

- Any UX/UI change where visual outcome, interaction, or layout is not fully described
- Any data or logic change where the expected behaviour has more than one valid interpretation
- Any task involving new files, new components, or new screens
- Any task that touches more than one file and the scope is not fully clear

### What to ask

Use the `AskUserQuestion` tool with targeted multiple-choice options. Good questions surface the key tradeoff or ambiguity — they don't ask "what do you want?" but rather "here are the two valid approaches, which one?".

### What not to ask

- Don't ask about things that are already specified in this file, the README, or the task description
- Don't ask for approval of the implementation plan — propose it, then ask only where there is genuine ambiguity
- Don't ask more than 4 questions per task

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
