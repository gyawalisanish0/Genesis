# Genesis

> A turn-based tactical mobile RPG built with React, TypeScript, and Capacitor.

![TypeScript](https://img.shields.io/badge/TypeScript-5.x-3178C6?logo=typescript&logoColor=white)
![React](https://img.shields.io/badge/React-18-61DAFB?logo=react&logoColor=black)
![Vite](https://img.shields.io/badge/Vite-5-646CFF?logo=vite&logoColor=white)
![Capacitor](https://img.shields.io/badge/Capacitor-6-119EFF?logo=capacitor&logoColor=white)
![Vitest](https://img.shields.io/badge/Tested_with-Vitest-6E9F18?logo=vitest&logoColor=white)

**Target platforms:** Android and iOS (primary) · Desktop browser (secondary)  
**UI paradigm:** Mobile-first · Touch-native · Portrait-only · 9:16 locked  
**Physical resolution:** 1080 × 1920 px (Full HD, xxhdpi) — CSS viewport 360 × 640 dp at 3× DPR  
**Version:** 0.1.0

---

## Quick Start

```bash
cd genesis-web
npm install
npm run dev       # dev server → http://localhost:5173
npm run build     # production build
npm test          # run test suite (Vitest)
```

---

## Tech Stack

| Layer | Tool | Purpose |
|---|---|---|
| Language | TypeScript 5.x | Type-safe logic across the entire stack |
| UI Framework | React 18 + React Router v6 | Component tree + client-side routing (HashRouter) |
| State | Zustand 4 | Cross-screen persistent state (team, battle result, settings) |
| Build Tool | Vite 5 | Fast HMR in dev; tree-shaken ESM bundle in prod |
| Styling | CSS Modules + custom properties | Zero runtime overhead; scoped styles + design tokens |
| Schema Validation | Zod 3 | Strict JSON validation at DataService load time |
| Game Canvas | Phaser 3 | Battle arena rendering (dice, unit figures, particles) |
| Native Bridge | Capacitor 6 | Android / iOS packaging + status-bar API |
| Testing | Vitest + React Testing Library | Unit tests for core logic + component rendering |
| Game Content | JSON in `public/data/` | All characters, skills, maps, narrative — zero hardcoding |

---

## Repository Structure

```
Genesis/
├── README.md
├── CLAUDE.md                       # Contributor + AI assistant rules
├── CONCEPT.md                      # Game design principles
└── genesis-web/
    ├── public/
    │   ├── manifest.json           # PWA: standalone mode, portrait lock, theme colour
    │   └── data/
    │       ├── characters/         # CharacterDef + SkillDef + DialogueDef per character
    │       ├── campaign/           # StageDef + MapDef + LevelNarrativeDef per stage
    │       └── modes/              # ModeDef files (story, ranked)
    └── src/
        ├── core/                   # Pure TS game logic — zero UI imports
        │   ├── combat/             # Tick calculator · hit-chance · dice resolver · counter
        │   ├── effects/            # Open effect engine + 6 builtin handlers
        │   ├── narrative/          # Narrative types + resolver (NarrativeResolver.ts)
        │   └── engines/skill/      # SkillInstance lifecycle + level-up cache
        ├── navigation/             # Screen routing, safe-area, back-button system
        ├── input/                  # Back-button registry + useBackButton hook
        ├── services/               # Side-effectful singletons (DataService, NarrativeService, …)
        ├── hooks/                  # Shared React hooks (useRosterData, …)
        ├── utils/                  # useScrollAwarePointer · useViewportScale
        ├── screens/                # One .tsx + .module.css per screen
        ├── components/             # Reusable widgets (ResourceBar, UnitPortrait, HintToaster, …)
        └── styles/
            └── tokens.css          # Full design-token set (colours, typography, spacing, motion)
```

---

## Architecture Overview

### Layer Ordering (no circular imports)

```
core  →  services  →  components / scenes  →  screens  →  App
```

| Layer | Constraint | Key modules |
|---|---|---|
| `core/` | Zero UI imports | Combat math, effects engine, narrative types, Zustand store |
| `services/` | No React imports | DataService (fetch + cache), NarrativeService (event bus) |
| `components/` | React + CSS Modules only | ResourceBar, UnitPortrait, HintToaster, NarrativeLayer |
| `scenes/` | Phaser 3 only — no React | BattleScene + helper modules (DicePanel, UnitStage, …) |
| `screens/` | One screen per file | Screen-local contexts for ephemeral state |
| `App.tsx` | Root only | HashRouter + ScreenProvider + route declarations |

### Core Design Principles

1. **Tick stream is the sole action-order source.** Each unit owns a `tickPosition`; the lowest tick acts next. No round counter anywhere in `core/`.
2. **The system is dynamic, not absolute.** `core/` provides hooks — skills, items, and passives define what happens. New mechanics require only JSON, not code changes.
3. **No fixed team size.** Combat math scales to arbitrary unit counts; mode configs impose caps at the mode boundary only.
4. **Single controlled unit by default.** The party leader is the only HUD-bound unit; AI allies auto-fight on the tick stream.

---

## Implemented Screens

| Screen | Description |
|---|---|
| **Splash** | DataService preloads characters, campaign, and narrative data → auto-navigates to main menu |
| **Main Menu** | PLAY / ROSTER / SETTINGS navigation; quit-confirm on back |
| **Campaign** | Stage select with difficulty rating and unlock progression |
| **Dungeon** | Turn-based grid exploration — party movement, enemy patrols, fog of war, wave encounters |
| **Pre-Battle Wizard** | 3-step flow: Mode → Team (5×4 paged grid) → Items (stub) |
| **Battle** | Full tick-based combat — timeline, skill grid, dice, AI, overlays |
| **Battle Result** | Victory/defeat banner, XP earned, unit results, battle stats |
| **Roster** | 3×3 paged grid; compact cards; class + rarity + name filters |
| **Settings** | Audio, display, notification, and account sections |

---

## Combat System

### Tick-Based Turn Order

Every unit has a `tickPosition`. The unit with the lowest tick acts next. After acting, its position advances by the skill's TU cost. No round counter — the tick stream is infinite and shared.

```
Hunter   [1–6  ticks to start]   fastest initiative
Ranger   [3–9 ]
Caster   [5–12]
Warrior  [6–14]
Enchanter[7–15]
Guardian [10–20]                  most durable opener
```

### Dice Resolution — 6 Outcomes

| Outcome | Base % | Effect |
|---|---|---|
| **Boosted** | 10% | +50% skill value until next turn — shown in gold |
| **Success** | 40% | Clean hit — shown in green |
| **GuardUp** | 20% | Hit + 35% damage reduction on next incoming attack — shown in blue |
| **Evasion** | 10% | Target evades — triggers counter chain check — shown in cyan |
| **Tumbling** | 10% | Hit at half effectiveness + attacker delayed 1–5 ticks — shown in red |
| **Fail** | 10% | Miss — shown in muted grey |

Higher caster `precision` + skill `baseChance` shifts probability toward Boosted/Success. Table always sums to 1.0.

**Tap the arena during the 4-second dice animation to skip it** and resolve immediately.

### Counter Chain

When a single-target skill is evaded, the defender may counter-attack:

- Base counter chance: **15%** at chain depth 0, −2% per depth, minimum 1%
- **Player counters** show a `[COUNTER]` / `[SKIP]` prompt — a deliberate choice
- **Enemy AI** counters only if remaining AP after cost ≥ 20 (strategic reserve)
- Counter skills bypass cooldowns when used reactively

### Effects Engine

An open hook system — skills drive behaviour, `core/` provides scaffolding.

- **15 effect primitives:** `damage`, `heal`, `tickShove`, `gainAp`, `spendAp`, `modifyStat`, `applyStatus`, `removeStatus`, `shiftProbability`, `rerollDice`, `forceOutcome`, `triggerSkill`, `secondaryResource` + 2 reserved
- **ValueExpr mini-syntax:** flat number | `{ stat, percent, of? }` | `{ sum: […] }`
- **Condition gates (recursive):** `chance`, HP/AP thresholds, `hasStatus`, `hasTag`, `diceOutcome`, `not` / `all` / `any`
- **Level upgrade patching:** dot-delimited named-key patches per level (e.g. `"effects.dmg.amount.percent"`) — no new effect definitions needed for progression

---

## Battle UX Features

| Feature | Description |
|---|---|
| **Tap-to-skip dice** | Pointer-down on the arena during the 4 s dice animation cancels it early and resolves immediately |
| **Player-turn pulse** | The action grid breathes with a soft purple inner-ring animation while it's the player's turn |
| **Skill info overlay** | Long-press any skill button (even on cooldown) to open a centered modal with full stats, description, effects, and cooldown breakdown |
| **Cooldown badges** | Two distinct chips: amber ⏳ for tick cooldown, indigo ↻ for turn cooldown — never conflated |
| **Battle log** | Full combat history in a slide-up overlay; tap BATTLE LOG to open, ✕ or back to close |
| **Narrative dialogue** | Character-driven dialogue box slides up from the bottom — skill cries, death words, story cutscenes |
| **First-time hints** | One-shot contextual hints (localStorage-backed) guide new players through dice, skills, and movement |

---

## Dungeon UX Features

| Feature | Description |
|---|---|
| **Encounter banner** | 1.2 s "ENCOUNTER!" slide-in with enemy name telegraphs combat before the battle screen loads |
| **Stage objective pill** | Header shows defeated/total enemy count; turns green when the stage is cleared |
| **Party HP pill** | Leader HP bar always visible at the top of the dungeon — pulses red at ≤ 30% HP |
| **D-pad controls** | Four directional buttons for grid movement during exploration |
| **Wave phase UI** | When multiple enemies are adjacent, tap one to engage |
| **Fog of war** | Chebyshev-radius reveal around the party; unexplored tiles are hidden |

---

## Narrative System

Story beats and character reactions live entirely in JSON — no code changes needed for new dialogue.

```
public/data/
├── characters/{id}/dialogue.json    # Universal reactions: skill cries, counters, death words
└── campaign/{stageId}/narrative.json # Story beats: cutscenes, intro, victory dialogue
```

- **`NarrativeService.emit(event)`** — fire from any layer; `NarrativeLayer` resolves and plays the match
- **`NarrativeService.play(narrativeId)`** — trigger a specific entry directly (cutscenes, boss taunts)
- **`once: true`** — entry fires at most once per session
- **`sequence: true`** — all lines play in order (cutscene mode); otherwise one line is picked randomly
- **Dialogue freezes battle** — enemy AI, player actions, and phase derivation pause while a dialogue box is visible
- **Animation types:** `dialogue` · `screen_flash` · `portrait_fly` · `floating_text` (play simultaneously)

### Standard Event Strings

| String | When emitted |
|---|---|
| `battle_start` | Battle initialises, units placed |
| `battle_victory` | All enemies defeated |
| `battle_defeat` | Player unit dies |
| `skill_used` | Any skill fires after dice resolves |
| `unit_death` | Any unit HP reaches 0 |
| `counter` | Counter reaction fires |
| `clash_resolved` | Cross-team clash winner determined |

---

## Characters (Live Content)

| Character | Class | Rarity | Skill | Tags |
|---|---|---|---|---|
| **Iron Warden** (`warrior_001`) | Warrior | ★★★ | Slash — physical melee, TU 8 | `counter` |
| **Swift Veil** (`hunter_001`) | Hunter | ★★ | Arcane Bolt — energy ranged, TU 10 | — |

Both characters have `dialogue.json` entries for skill cries, counter lines, and death words.

---

## Navigation & Back Button

- `SCREEN_IDS` constants + `SCREEN_REGISTRY` map for all 9 screens — never string literals
- `ScreenShell` applies safe-area padding (`full` / `top-only` / `none`) from screen config
- **Native back (Android/iOS):** Capacitor listener → `backButtonRegistry` → screen handler
- **Web back (browser):** `popstate` capture-phase interceptor + URL-stable sentinel prevents React Router from seeing the event
- **In-battle back:** strict bounded pause loop — back → pause overlay, back again → resume; 300 ms debounce guard
- **Skill info overlay:** back button closes the overlay first before reaching the pause loop

---

## Game Content Format

All content lives in `public/data/` as JSON. Nothing is hardcoded in TypeScript.

| File pattern | Schema |
|---|---|
| `characters/index.json` | `string[]` — character discovery list |
| `characters/{id}/main.json` | `CharacterDef` — stats, class, rarity |
| `characters/{id}/skills.json` | `SkillDef[]` — skill definitions |
| `characters/{id}/dialogue.json` | `CharacterDialogueDef` — universal reactions |
| `campaign/index.json` | `string[]` — stage discovery list |
| `campaign/{stageId}/stage.json` | `StageDef` — team, move range, AI settings |
| `campaign/{stageId}/map.json` | `MapDef` — tilemap, entities, wave phase |
| `campaign/{stageId}/narrative.json` | `LevelNarrativeDef` — story beats |
| `modes/{id}.json` | `ModeDef` — mode-level settings |

---

## Design System (`tokens.css`)

| Category | Tokens |
|---|---|
| Backgrounds | `--bg-deep` → `--bg-elevated` (4 levels) + `--bg-overlay` |
| Accents | `--accent-genesis` (purple) · `--accent-gold` · `--accent-info` (blue) · `--accent-heal` (green) · `--accent-warn` (orange) · `--accent-danger` (red) · `--accent-evasion` (cyan) |
| Typography | 6 scale steps — display (36sp) → micro (10sp) |
| Spacing | xs 4dp → 2xl 48dp |
| Motion | screen 300ms · modal 250ms · bar 400ms · button 80ms · timeline 200ms |
| Touch minimum | `--touch-min` = 3rem (48 dp) |
| Rarity colours | `--rarity-1` … `--rarity-6` (rarity-7 is a gradient, applied inline) |

---

## Fullscreen Delivery

| Context | Mechanism |
|---|---|
| Capacitor native | `StatusBar.hide()` + `StatusBar.setOverlaysWebView(true)` on mount |
| PWA installed | `manifest.json` `display: standalone` — browser chrome absent |
| Plain browser tab | First-tap gate on SplashScreen defers navigation until user gesture unlocks the Fullscreen API |
