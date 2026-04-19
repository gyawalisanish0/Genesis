# Genesis

A turn-based tactical mobile game built with React, TypeScript, and Capacitor.

**Target platforms:** Android and iOS (primary), desktop browser (secondary)  
**UI paradigm:** Mobile-first, touch-native, portrait-only  
**Version:** 0.1.0

---

## Quick Start

```bash
cd genesis-web
npm install
npm run dev       # dev server at http://localhost:5173
npm run build     # production build
npm test          # run test suite (Vitest)
```

---

## Tech Stack

| Layer | Tool |
|---|---|
| Language | TypeScript 5.x |
| UI Framework | React 18 + React Router v6 (HashRouter) |
| State | Zustand 4 |
| Build Tool | Vite 5 |
| Styling | CSS Modules + CSS custom properties |
| Schema Validation | Zod 3 |
| Native Bridge | Capacitor 6 (Android / iOS packaging) |
| Testing | Vitest + React Testing Library |
| Game Content | JSON files in `public/data/` |

---

## Repository Structure

```
Genesis/
├── README.md
├── CLAUDE.md                   # Contributor + AI rules
├── CONCEPT.md                  # Game design principles
└── genesis-web/
    ├── public/data/            # JSON game content
    │   ├── characters/         # CharacterDef + SkillDef per character
    │   └── modes/              # ModeDef files
    └── src/
        ├── core/               # Pure TS game logic (no UI)
        │   ├── combat/         # Tick calculator, hit-chance, dice resolver
        │   ├── effects/        # Open effect engine + builtin handlers
        │   └── engines/skill/  # SkillInstance lifecycle
        ├── navigation/         # Screen routing, safe-area, back-button
        ├── input/              # Back-button registry + useBackButton hook
        ├── services/           # DataService (JSON loader + cache)
        ├── utils/              # useScrollAwarePointer gesture hook
        ├── screens/            # One .tsx + .module.css per screen
        ├── components/         # Reusable widgets
        └── styles/             # tokens.css design system
```

---

## Architecture Overview

### Layer ordering (no circular imports)

```
core → services → components → screens → App
```

- **`core/`** — Zero UI imports. Pure TypeScript: types, combat math, effects engine, Zustand store.
- **`services/`** — Side-effectful singletons. DataService fetches, validates (Zod), and caches JSON.
- **`components/`** — Reusable React widgets (ResourceBar, UnitPortrait, PrimaryButton).
- **`screens/`** — One `.tsx` + one `.module.css` per screen. Screen-local context for complex state.
- **`App.tsx`** — HashRouter + ScreenProvider root; declares all routes.

### Key design principles

1. **Tick stream is the only source of action ordering.** Every unit owns a `tickPosition`; the lowest tick acts next. No round counter.
2. **The system is dynamic, not absolute.** `core/` provides hooks; skills, items, and passives define what actually happens.
3. **No fixed team size.** Combat math scales to arbitrary unit counts; mode configs impose caps.

---

## Implemented Features

### Screens

| Screen | Status | Description |
|---|---|---|
| Splash | ✅ | Simulated load progress bar → auto-navigates to main menu |
| Main Menu | ✅ | PLAY / ROSTER / SETTINGS navigation; quit confirm on back |
| Pre-Battle Wizard | ✅ | 3-step flow: Mode → Team → Items (stub) |
| Battle | ✅ | Full turn loop, timeline, skill grid, dice, AI, overlays |
| Battle Result | ✅ | Victory/defeat banner, XP, unit results, battle stats |
| Roster | ✅ | Character grid; class + rarity + name filters |
| Settings | ✅ | Audio, display, notification, account sections |

### Combat System

**Tick-based turn order**
- Each unit has a `tickPosition`. The unit with the lowest tick acts next.
- `calculateStartingTick` uses class-specific ranges (Hunter 1–6 → Guardian 10–20) and a speed stat to set opening position.
- `advanceTick(fromTick, tuCost)` queues the unit's next action after skill use.

**Dice resolution — 5 outcomes**
| Outcome | Effect |
|---|---|
| Boosted | Damage × 1.5 |
| Success | Damage × 1.0 |
| Tumbling | Damage × 0.5 + attacker delayed 1–5 ticks |
| GuardUp | Full damage + 10% converted to mitigation |
| Evasion | 0 damage; evasion counter chain (15% base, diminishing) |

Outcome probabilities shift based on caster `precision` and skill `baseChance`.

**Sequential AI timing**
1. Player dice plays (4 s animation).
2. Enemy telegraph appears (stays visible 6 s total).
3. After 2 s, enemy fires → enemy dice plays (4 s).
4. HP / tick state commits only after enemy dice ends.

**Roll button UX**
- Tap a skill to select it (genesis-accent highlight border).
- Tap again to deselect.
- ROLL button appears above the player portrait while a skill is selected.
- Tapping ROLL triggers a 500 ms "Rolling…" pulse, then fires the attack.
- Selection auto-clears after rolling; End/Skip also clears selection.

### Effects Engine

Open hook system — skills drive behaviour, `core/` provides scaffolding.

**15 effect primitives:** `damage`, `heal`, `tickShove`, `gainAp`, `spendAp`, `modifyStat`, `applyStatus`, `removeStatus`, `shiftProbability`, `rerollDice`, `forceOutcome`, `triggerSkill`, `secondaryResource` + 2 reserved.

**ValueExpr mini-syntax:** flat number | `{ stat, percent, of? }` | `{ sum: […] }`

**Condition gates (recursive):** `chance`, HP/AP thresholds, `hasStatus`, `hasTag`, `diceOutcome`, `not` / `all` / `any`.

**Level upgrade patching:** Dot-delimited named-key patches per level (e.g. `"effects.dmg.amount.percent"`) applied at cache-build time — no new effects needed to express progression.

**6 builtin handlers** registered at startup: damage, heal, gainAp, spendAp, tickShove, modifyStat.

### Navigation & Back Button

- `SCREEN_IDS` constants + `SCREEN_REGISTRY` map for all 7 screens.
- `ScreenShell` applies safe-area padding (`full` / `top-only` / `none`) from screen config.
- `ScreenProvider` reads `env(safe-area-inset-*)` once after first paint.
- **Native back (Android/iOS):** Capacitor listener → `backButtonRegistry` → screen handler.
- **Web back (browser):** `popstate` capture-phase interceptor + URL-stable sentinel prevents React Router from seeing the event when a handler is registered.
- **In-battle back:** bounded pause loop — back → pause overlay, back again → resume. 300 ms debounce guard.

### No-Team Guard

If the player navigates directly to the battle URL without completing pre-battle team selection, `BattleContext` skips data loading and `BattleScreen` shows a "NO TEAM SELECTED" overlay with a "SELECT TEAM" button.

### Game Content

| Character | Class | Rarity | Skill |
|---|---|---|---|
| warrior_001 — Iron Warden | Warrior | ★★★ | Slash (physical, melee, TU 8) |
| hunter_001 — Swift Veil | Hunter | ★★ | Arcane Bolt (energy, ranged, TU 10) |

Modes: `story` (narrative, no respawn), `ranked` (competitive).

### Components

| Component | Description |
|---|---|
| `ResourceBar` | Animated HP / AP / XP bar with 400 ms tween; `hp` / `ap` / `xp` variants |
| `UnitPortrait` | Portrait circle with rarity-coloured border; 4 sizes; greyscale for defeated |
| `PrimaryButton` | `primary` / `secondary` / `danger` / `ghost` variants |

### Design System (`tokens.css`)

- **Backgrounds:** `--bg-deep` → `--bg-elevated` (4 levels) + `--bg-overlay`
- **Accents:** genesis (purple), gold, info (blue), heal (green), warn (orange), danger (red), evasion (cyan)
- **Typography:** 6 scale steps — display (36sp) → micro (10sp)
- **Spacing:** xs 4dp → 2xl 48dp
- **Motion:** screen 300ms, modal 250ms, bar 400ms, button 80ms, timeline 200ms
- **Touch minimum:** `--touch-min` = 3rem (48 dp)

---

## Game Content

All content lives in `public/data/` as JSON. Nothing is hardcoded in TypeScript.

| File pattern | Schema |
|---|---|
| `characters/index.json` | `string[]` — discovery list |
| `characters/{id}/main.json` | `CharacterDef` |
| `characters/{id}/skills.json` | `SkillDef[]` |
| `modes/{id}.json` | `ModeDef` |
