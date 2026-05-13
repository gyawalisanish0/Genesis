# Genesis

> A turn-based tactical mobile RPG where the battlefield is a living machine —
> infinite tick stream, open effect hooks, characters that react, and a story
> told through dialogue woven into combat.

[![TypeScript](https://img.shields.io/badge/TypeScript-6.x-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=black)](https://react.dev/)
[![Phaser](https://img.shields.io/badge/Phaser-3-8B0000?logo=phaser&logoColor=white)](https://phaser.io/)
[![Vite](https://img.shields.io/badge/Vite-8-646CFF?logo=vite&logoColor=white)](https://vitejs.dev/)
[![Capacitor](https://img.shields.io/badge/Capacitor-8-119EFF?logo=capacitor&logoColor=white)](https://capacitorjs.com/)
[![Vitest](https://img.shields.io/badge/Tested_with-Vitest-6E9F18?logo=vitest&logoColor=white)](https://vitest.dev/)

**Target platforms:** Android and iOS (primary) · Desktop browser (secondary)  
**UI paradigm:** Mobile-first · Touch-native · Portrait-only · 9:16 locked  
**Physical resolution:** 1080 × 1920 px (Full HD, xxhdpi) — CSS viewport 360 × 640 dp at 3× DPR

---

## Quick Start

```bash
cd genesis-web
npm install
npm run dev       # dev server → http://localhost:5173
npm run build     # production build
npm test          # Vitest unit suite
```

---

## What's Built

This is a functioning combat game with a complete tick-based battle engine, animated
Phaser 3 arena, reactive AI, counter chains, a status effect system, a narrative layer,
and dungeon exploration — all data-driven from JSON.

### Milestone: Demo 1 (`demo-1`)

| Area | What's in |
|---|---|
| **Combat engine** | Tick stream · dice resolver (4 outcomes) · effects engine (15 primitives) · counter chain · AP/HP economy · cooldown system |
| **Phaser arena** | 7 stages complete: unit figures · dice spin · attack animation · particles + shake · death collapse · TurnDisplayPanel · AnimationManifest system (sprite frames, aura glows, projectiles) |
| **Characters** | 3 playable characters with full skill kits and passives |
| **Status effects** | 14 status definitions across 3 characters — dodge stacks, AP freezes, HP/AP swap, shields, burns, buffs |
| **Narrative layer** | Event bus + JSON dialogue · character reactions · story cutscenes · screen flash · portrait fly-in |
| **Dungeon mode** | Grid exploration · fog of war · patrol enemies · wave encounters · encounter banner |
| **Screens** | 9 screens: Splash · Main Menu · Campaign · Dungeon · Pre-Battle · Battle · Battle Result · Roster · Settings |

---

## Tech Stack

| Layer | Tool | Purpose |
|---|---|---|
| Language | TypeScript 6.x | Type-safe logic across the entire stack |
| UI Framework | React 19 + React Router v7 | Component tree + client-side routing (HashRouter) |
| State | Zustand 5 | Cross-screen persistent state (team, battle result, settings) |
| Build Tool | Vite 8 | Fast HMR in dev; tree-shaken ESM bundle in prod |
| Styling | CSS Modules + custom properties | Zero runtime overhead; scoped styles + design tokens |
| Schema Validation | Zod 4 | Strict JSON validation at DataService load time |
| Game Canvas | Phaser 3 | Battle arena: unit figures, dice, particles, shake, death |
| Native Bridge | Capacitor 8 | Android / iOS packaging + status-bar API |
| Testing | Vitest + React Testing Library | Unit tests for core logic + component rendering |
| Game Content | JSON in `public/data/` | All characters, skills, statuses, maps, narrative — zero hardcoding |

---

## Combat System

### The Tick Stream

Every unit has a `tickPosition`. The unit with the lowest position acts next.
After acting, its position advances by the skill's TU cost. There is no round
counter — the tick stream is infinite and shared by every unit on the field.

```
Hunter    [ 1–6  ticks ]   fastest to act
Ranger    [ 3–9  ticks ]
Caster    [ 5–12 ticks ]
Warrior   [ 6–14 ticks ]
Enchanter [ 7–15 ticks ]
Guardian  [10–20 ticks ]   most durable opener
```

Starting tick is drawn from a class-specific range — no two units ever land on
exactly the same tick without triggering the displacement or collision system.

### Dice Resolution — 4 Outcomes

Every attack rolls through a probability table built from caster precision, skill
`baseChance`, and any probability-shift effects active on either unit.

| Outcome | Base % | Effect |
|---|---|---|
| **Boosted** | 10% | ×1.5 skill value · gold particles · heavy camera shake |
| **Hit** | 40% | Clean hit · red particles · standard shake |
| **Evade** | 20% | Target evades · cyan particles · triggers counter chain check |
| **Fail** | 30% | Miss · no particles |

The table always sums to 1.0. Higher caster precision and skill `baseChance`
scale the positive pool (Boosted + Hit) up and compress the negative pool
(Evade + Fail) proportionally — the ratio between Boosted and Hit, and between
Evade and Fail, stays fixed. Probability-shift effects (`shiftProbability`) and
forced outcomes (`forceOutcome`) can bend the table further.

**Tap the arena during the dice animation to skip it** — the outcome resolves
immediately and all animations catch up in under 100 ms.

### Counter Chain

When a single-target skill is evaded the defender may counter-attack:

- Base chance: **15%** at depth 0 · −2% per depth · minimum 1%
- **Player counters** — a `[COUNTER]` / `[SKIP]` prompt appears; you choose
- **Enemy AI counters** — only if remaining AP after cost ≥ 20 (strategic reserve)
- Counter skills bypass cooldowns when used reactively

The counter mechanic is tag-driven. Tag a skill `counter` or `uniqueCounter` in
its JSON and the engine picks it up automatically — no character-specific code.

### Effects Engine

An open hook system — skills, items, and passives define what happens; `core/`
provides the infrastructure.

```
15 effect primitives
  damage          heal            tickShove
  gainAp          spendAp         modifyStat
  applyStatus     removeStatus    shiftProbability
  rerollDice      forceOutcome    triggerSkill
  secondaryResource  + 2 reserved
```

**ValueExpr mini-syntax** — amounts can be:
- Flat: `42`
- Stat-scaled: `{ "stat": "power", "percent": 150, "of": "caster" }`
- Caster stat (shield): `{ "stat": "maxHp", "percent": 20, "of": "caster" }`
- Global AP pool: `{ "globalApSpentPercent": 10 }` (Twilight Order passive)
- Sum of expressions: `{ "sum": [ … ] }`

**Condition gates** — recursive boolean guards on any effect:
`chance` · HP/AP thresholds · `hasStatus` · `hasTag` · `diceOutcome` · `not` / `all` / `any`

**Level upgrade patching** — dot-delimited named-key patches per level
(e.g. `"effects.dmg.amount.percent"`) — no new definitions needed for progression.

### Status Effect System

Statuses carry an open payload set at apply time — the engine never checks
character IDs. Any future character that needs the same mechanic reuses the
same payload flag with no engine changes.

| Payload flag | What it enables |
|---|---|
| `dodgeConfig` | Per-attack dodge logic: `allChance`, `meleeChance`, `rangedChance`, `consumeOnAttempt`, `consumeOnSuccess` |
| `freezesApRegen` | AP stops regenerating for the status duration |
| `doublesShieldOverflow` | Overflow from a broken shield deals double damage |
| `hpApSwapped` | Incoming damage hits AP; skill costs drain HP |
| `onBreakTickCooldown` | Tick cooldown applied to a skill when a shield breaks |
| `blocksRecastOfSkill` | Prevents the owner from recasting a specific skill |
| `companionStatus` | A companion status applied/removed with the parent |

### Passive System

Passives fire on engine events — not in the normal turn loop. Supported triggers:

| Trigger | Description |
|---|---|
| `onEvade` | Fires when the owner evades a single-target attack |
| `onTickInterval` | Fires every N ticks of the owner's own action count |
| `onBattleTickInterval` | Fires every N cumulative battle ticks (global clock) |

`onBattleTickInterval` drives Tara's Twilight Order — every 25 global battle ticks
she gains AP proportional to all AP spent by every unit since the last trigger.

---

## Phaser Battle Arena

The arena is a Phaser 3 canvas embedded inside React's `BattleScreen`. It owns
every visual storytelling moment of a turn — unit entrances, dice spins, attack
animations, particles, screen shake, death collapses. React owns all interaction
(skill buttons, overlays, HUD, battle log).

### Arena layout

```
┌──────────────────────────────────────┐
│ ┌────────────────────────────────┐   │  TurnDisplayPanel — slides in from top
│ │  Arcane Bolt  ·  TU 18  AP 10  │   │  Shows actor (enemy turns), skill,
│ │  Target: Iron Warden  ████░░   │   │  target with live HP/AP bars +
│ └────────────────────────────────┘   │  status chips — no canvas resize
│─────────────── 160 px ───────────────│
│                                      │
│   ▲ ACTING           ◎ TARGET        │  Unit Stage — slides in from both sides
│                                      │  with Back.easeOut on turn start;
│        ┌──────────┐                  │  collapses with tilt + fade on death
│        │ ★ BOOSTED│                  │  Dice Panel — face spins, lands on outcome
│        └──────────┘                  │
│             ✦ ✦ ✦                    │  Particles burst from target centre
│          −293 HP ↑                   │  Feedback text rises and fades
│                                      │
└──────────────────────────────────────┘
```

### Arena stages (all complete)

| Stage | What it delivers |
|---|---|
| 2 | Unit figure containers — placeholder rectangles with name + role label; slide in/out per turn with 150 ms between-turn pause |
| 3 | Dice Panel (face-spin → outcome landing) → Attack Panel (shove tween + target flash) → Feedback Panel (rising damage text); fully phase-gated |
| 4 | `ParticleEmitter` one-shot bursts per outcome · camera shake on hit · evasion dodge tween · death collapse (tilt + fade + destroy) |
| 5 | `TurnDisplayPanel` overlaid at top of canvas — actor/target rows with Phaser `Graphics` HP/AP bars and status chips; rarity-coloured nameplates |
| 6 | Battle log promoted to React `BattleLogOverlay` slide-up panel; `BATTLE LOG` button below arena |
| 7 | `AnimationManifest` system — per-character `animations.json`; `AnimationPlayer` sprite loops; `AnimationResolver` fallback chain; `ProjectilePanel` for ranged attacks; `AuraPanel` radial glow; `isDamaged` idle swap; `tokens.ts` extracted to break circular dependency |

### Phase-gated animation chain

```
Player / AI executes skill
  │
  ├── React: dice result overlay (4 s auto-dismiss)
  │
  └── arena.playDice(outcome, () => {        ← ~2.8 s die spin
        arena.playAttack(…, () => {          ← ~0.5 s shove + flash + particles
          arena.playFeedback(text, colour)   ← fire-and-forget rising text
          setTimeout(applyState, holdMs)     ← HP/AP applied; timeline advances
        })
      })
```

`playDice`, `playAttack`, and `playDeath` are phase-gated: battle logic does
not apply HP changes or advance the tick stream until `onDone` fires.
If the canvas is unmounted the handle calls `onDone` immediately — battle logic
is never blocked by the visual layer.

### Design tokens in Phaser

CSS custom properties are not readable by Phaser's canvas context.
`tokenToHex()` and `tokenToInt()` in `src/scenes/battle/tokens.ts` map every
design token to its hex string / integer value:

```ts
import { tokenToHex, tokenToInt } from './battle/tokens'

tokenToHex('var(--accent-danger)')   // → '#ef4444'
tokenToInt('var(--accent-gold)')     // → 0xf59e0b  (Phaser tint / setTint format)
tokenToHex('var(--accent-genesis)')  // → '#8b5cf6'
```

Particle colours, HP bar fills, rarity nameplate tints, aura hues, and camera shake
intensities all pull from the same token map — one source of truth across
React and the canvas. `BattleScene.ts` re-exports `tokenToHex` for backward compat.

### Art upgrade path

Art is fully manifest-driven. Three pieces are needed per character:

**1. Animation manifest** — `public/data/characters/{defId}/animations.json`

Declares every animation state (idle, idle_damaged, melee_attack, hurt, dodge,
per-skill states), frame counts, frame rates, repeat behaviour, and optional
per-state aura definitions. `DataService.loadAnimationManifest(defId)` fetches
and caches it; returns `null` silently when absent (falls back to placeholder
rectangle — no code change required).

**2. Frame PNGs** — one folder per state

```
public/images/characters/{defId}/
  idle/               0.png 1.png … (N-1).png
  idle_damaged/       0.png …
  melee_attack/       0.png …
  skills/
    {skillId}/        0.png …
```

`AnimationPlayer` drives a `Phaser.Time.TimerEvent` loop that swaps
`sprite.setTexture()` each frame — no Phaser animation manager needed.

**3. Projectile frames** (optional)

`public/images/characters/{defId}/projectile/{i}.png` — only needed when
`manifest.projectile` is non-null. Absent → runtime purple orb fallback.

No architecture changes required at any step.

---

## Characters

### Hugo Rekrot — Warrior · Rarity ★★★★ (Epic)

```
STR 65  END 75  PWR 20  RES 60  SPD 30  PRC 50
HP 500  AP 100  Regen 0.6/tick  Starting AP 15
```

Last-stand fighter. His companion ANBOT — a nanite mass that reshapes itself
into weapons and armour on command — grows harder to stop the closer Hugo
gets to death. The passive is the kit's engine: survive to 10% HP and the
whole threat profile changes.

| Skill | AP | TU | Notes |
|---|---|---|---|
| Basic Attack | 0 | 11 | 45% STR physical melee |
| Nanites Slash | 12 | 8 | 60% STR physical melee |
| Hammer Bash | 25 | 13 | 125% STR physical melee · 0.9 baseChance · 2-turn CD |
| Shelling Point | 20 | 6 | Shield = 25% max HP · on break: 48-tick CD + double overflow · blocks recast · 9-turn penalty window |
| Hyper Sense | 10 | 7 | Normal: +30% ranged dodge 15 ticks · 20-tick CD · Hyper (Primal Awareness active): 90% melee / 50% ranged dodge for passive duration |

**Passive — Primal Awareness:** When HP drops below 10% and AP ≥ 80% — ANBOT
emergency-reroutes all power into evasion: 5 dodge points at 70% each
(consumed per hit attempt), AP regen freezes for 3 turns. Cannot reactivate
until AP returns to 80%+.

---

### Husty — Caster · Rarity ★★★ (Super)

```
STR 20  END 50  PWR 75  RES 45  SPD 45  PRC 65
HP 336  AP 100  Regen 0.7/tick  Starting AP 10
```

Control-and-burst caster. Wins through resource management and a single
high-power window earned by patient play. Power Surge accumulates silently
every turn — Cached Shockwave dumps it all at once. Precise Calibration turns
AP discipline into a near-accuracy guarantee for the whole party, and that
window is when the Shockwave lands hardest.

| Skill | AP | TU | Notes |
|---|---|---|---|
| Basic Attack | 0 | 11 | 40% PWR energy ranged |
| Disruption | 16 | 12 | AoE — 15 flat + 20% PWR energy · on hit: movement block all enemies 15 ticks |
| Cached Shockwave | 25 | 16 | Single target · on hit: 250% surge + 15% PWR · on evade: 125% surge + 15% PWR · resets surge · 25-tick CD |
| Neural Barrier | 14 | 12 | On hit: 20 HP shield (self) + neural disruption all enemies · 5-turn CD |

**Passive — Precise Calibration:** Applies Power Surge at battle start — gains
+1–5 per own turn (cap 45), fuelling Cached Shockwave. After spending 60 AP
total: all allies gain +0.8 ranged `baseChance` for 4 turns (near-guarantees
hits); accumulator resets and the cycle repeats.

---

### Tara Kuronage — Caster · Rarity ★★★★★★ (Legend)

```
STR 15  END 62  PWR 88  RES 68  SPD 25  PRC 58
HP 460  AP 100  Regen 0.5/tick  Starting AP 0
```

Slowest-building character in a fight. Most dangerous once her passive
economy is running. Controls the tempo of the entire battlefield — shields
her team from her own stats, scrambles the enemy timeline, flips HP/AP
roles, then closes with a strike that burns everything that remains.

| Skill | AP | TU | Notes |
|---|---|---|---|
| Orb Strike (basic) | 0 | 9 | 33% PWR energy |
| Intell of Goddess | 30 | 5 | Shield all allies = 20% Tara's maxHp · +40% dodge self 15 ticks · CD 40 ticks |
| Chaotic Vortex | 25 | 12 | Push all enemies 4 ticks forward · 66% PWR to one random displaced enemy · CD 8 turns |
| Change of Order | 18 | 12 | HP/AP role swap on all enemies for 15 ticks · CD 35 ticks |
| Phoenix Burst | 50 | 15 | 333% PWR single target · 2% PWR burn/tick all enemies 8 ticks · CD 12 turns |

**Passive — Twilight Order:** Every 25 global battle ticks, gains 10% of all AP
spent by every unit since the last trigger. Enemies spending heavily to fight
back directly fuel her next Phoenix Burst.

**Change of Order** inverts the battlefield for 15 ticks: incoming damage hits
enemy AP instead of HP; enemy skill costs drain HP instead of AP. Every action
the enemy takes bleeds them; every hit they receive drains their AP pool. There
is no good answer during the window.

---

## Narrative Layer

Story beats and character reactions live entirely in JSON — no code changes
needed for new dialogue.

### Two data scopes

```
public/data/
├── characters/{id}/dialogue.json       # Universal reactions: skill cries, counters, death words
└── levels/{levelId}/narrative.json     # Story beats: intro, cutscenes, victory dialogue
```

### Standard event strings

| String | When emitted |
|---|---|
| `battle_start` | Battle initialises, units placed |
| `battle_victory` | All enemies defeated |
| `battle_defeat` | Player unit dies |
| `skill_used` | Any skill fires after dice resolves |
| `boosted_hit` | Boosted outcome rolls |
| `evaded` | Evade outcome rolls |
| `unit_death` | Any unit HP reaches 0 |
| `counter` | Counter reaction fires |
| `clash_resolved` | Cross-team clash winner determined |

Any string is valid — new events require only JSON entries, no code changes.

### Animation types

| Type | Visual |
|---|---|
| `dialogue` | Slide-up box — portrait + rarity nameplate + typewriter text · freezes battle |
| `screen_flash` | Full-screen colour burst, fades out |
| `portrait_fly` | Character portrait slides in from left or right edge |
| `floating_text` | Impact text rises from centre and fades |

### API

```ts
NarrativeService.emit({ type: 'skill_used', actorId: 'tara_001' })  // event match
NarrativeService.play('story_001_intro')                              // direct trigger
NarrativeService.registerEntries('tara', entries)                     // load scope
```

`once: true` on an entry — fires at most once per session.  
`sequence: true` — all lines play in order (cutscene); otherwise one line is
picked at random.

---

## Dungeon Mode

Turn-based grid exploration sits between the campaign map and the battle screen.

| Feature | Description |
|---|---|
| Grid movement | D-pad controls; party moves as a single token on the dungeon grid |
| Patrol enemies | Enemy units follow patrol routes; position advances each party move |
| Fog of war | Chebyshev-radius reveal around the party; unexplored tiles are hidden |
| Wave encounters | When a patrol reaches the party a 1.2 s "ENCOUNTER!" banner fires; combat launches |
| Stage objective pill | Header shows defeated / total enemy count; turns green when cleared |
| Party HP pill | Leader HP bar visible at top; pulses red at ≤ 30% HP |
| Hint toaster | One-shot contextual hints (localStorage-backed) guide new players |

---

## Battle UX Features

| Feature | Description |
|---|---|
| Tap-to-skip dice | Pointer-down on the arena cancels the 4 s animation; outcome resolves in < 100 ms |
| Player-turn pulse | Action grid breathes with a soft purple inner-ring while it is the player's turn |
| Skill info overlay | Long-press any skill button (even on cooldown) — full stats, description, effects, cooldown breakdown |
| Cooldown badges | Amber ⏳ tick cooldown · indigo ↻ turn cooldown — never conflated |
| Battle log | Full combat history in a slide-up React overlay; `BATTLE LOG` button below the arena |
| Narrative dialogue | Dialogue box slides up from the bottom — battle freezes while it is visible |
| First-time hints | One-shot contextual hints guide players through dice, skills, and movement |

---

## Architecture

### Layer ordering (no circular imports)

```
core  →  services  →  components / scenes  →  screens  →  App
```

| Layer | Constraint | Key modules |
|---|---|---|
| `core/` | Zero UI imports | Combat math · effects engine · narrative types · Zustand store |
| `services/` | No React imports | DataService (fetch + cache) · NarrativeService (event bus) · ResolutionService |
| `components/` | React + CSS Modules | ResourceBar · UnitPortrait · HintToaster · NarrativeLayer |
| `scenes/` | Phaser 3 only — no React | BattleScene · DicePanel · UnitStage · AttackPanel · TurnDisplayPanel |
| `screens/` | One screen per file | Screen-local contexts for ephemeral combat state |
| `App.tsx` | Root only | HashRouter + ScreenProvider + route declarations |

### Core design principles

1. **Tick stream is the sole action-order source.** Each unit owns a `tickPosition`;
   the lowest tick acts next. No round counter anywhere in `core/`.

2. **The system is dynamic, not absolute.** `core/` provides hooks — skills, items,
   and passives define what happens. New mechanics require only JSON, not code changes.

3. **No fixed team size.** Combat math scales to arbitrary unit counts; mode configs
   impose caps at the mode boundary only.

4. **Single controlled unit by default.** The party leader is the only HUD-bound unit;
   AI allies and enemies auto-fight on the same tick stream.

5. **Reactive mechanics use hooks, not hardcoded branches.** Dodge configs, AP freeze,
   HP/AP swap, shield penalties — all stored in `StatusEffect.payload` at apply time.
   No character ID checks anywhere in the engine.

---

## Repository Structure

```
Genesis/
├── README.md
├── CLAUDE.md                         # Contributor + AI assistant rules
├── CONCEPT.md                        # Game design principles
├── docs/
│   ├── mechanics/                    # Counter · Cooldown · Phaser arena · Narrative · Party leader
│   └── characters/in-game/          # Character design docs (Tara Kuronage, …)
└── genesis-web/
    ├── public/
    │   ├── manifest.json             # PWA: standalone, portrait lock, theme colour
    │   └── data/
    │       ├── characters/           # CharacterDef + SkillDef + PassiveDef + DialogueDef per character
    │       ├── statuses/             # StatusDef JSON (14 statuses across 3 characters)
    │       ├── campaign/             # StageDef + MapDef + LevelNarrativeDef per stage
    │       ├── levels/               # Level-scoped narrative (intro cutscenes, story beats)
    │       ├── tilesets/             # TilesetDef + tile PNG art
    │       └── modes/                # ModeDef files (story, ranked)
    └── src/
        ├── core/
        │   ├── combat/               # TickCalculator · HitChanceEvaluator · DiceResolver · CounterResolver · ClashResolver
        │   ├── effects/              # Open effect engine (15 primitives) + 6 builtin handlers + resolvers
        │   ├── narrative/            # NarrativeEntry types + NarrativeResolver (pure, no UI)
        │   └── engines/skill/        # SkillInstance lifecycle + level-up cache + invalidation
        ├── navigation/               # Screen routing · safe-area · back-button system
        ├── services/                 # DataService · NarrativeService · DisplayService · ResolutionService
        ├── screens/                  # Battle · Dungeon · Campaign · Roster · Settings + screen contexts
        ├── scenes/                   # Phaser 3 scenes (BattleScene + DungeonScene) + helper modules
        ├── components/               # ResourceBar · UnitPortrait · NarrativeLayer · HintToaster · …
        └── styles/
            └── tokens.css            # Full design-token set (colours, typography, spacing, motion)
```

---

## Game Content Format

All content is JSON. Nothing is hardcoded in TypeScript.

| File pattern | Schema |
|---|---|
| `characters/index.json` | `string[]` — character discovery list |
| `characters/{id}/main.json` | `CharacterDef` — stats, class, rarity, passive ref |
| `characters/{id}/skills.json` | `SkillDef[]` — full skill definitions with effects |
| `characters/{id}/passive.json` | `PassiveDef` — passive trigger + effects |
| `characters/{id}/dialogue.json` | `CharacterDialogueDef` — universal battle reactions |
| `characters/{id}/animations.json` | `AnimationManifest` — display dims, frame counts, aura defs, projectile config |
| `statuses/{id}.json` | `StatusDef` — stacking, duration, tags, tick effects, dodge config |
| `campaign/{stageId}/stage.json` | `StageDef` — team, AI settings, player control mode |
| `campaign/{stageId}/map.json` | `MapDef` — tilemap, entities, wave phases, fog of war |
| `campaign/{stageId}/narrative.json` | `LevelNarrativeDef` — story beats scoped to this stage |
| `levels/{levelId}/narrative.json` | `LevelNarrativeDef` — narrative for dungeon levels |
| `modes/{id}.json` | `ModeDef` — mode-level settings and caps |

---

## Design System (`tokens.css`)

| Category | Tokens |
|---|---|
| Backgrounds | `--bg-deep` → `--bg-elevated` (4 levels) + `--bg-overlay` |
| Accents | `--accent-genesis` (purple) · `--accent-gold` · `--accent-info` · `--accent-heal` · `--accent-warn` · `--accent-danger` · `--accent-evasion` |
| Typography | 6 scale steps — display (36sp) → micro (10sp) |
| Spacing | xs 4dp → 2xl 48dp |
| Motion | screen 300ms · modal 250ms · bar 400ms · button 80ms · timeline 200ms |
| Touch minimum | `--touch-min` = 3rem (48 dp) |
| Rarity colours | `--rarity-1` … `--rarity-6` · rarity-7 is a gradient, applied inline |

---

## Fullscreen Delivery

| Context | Mechanism |
|---|---|
| Capacitor native | `StatusBar.hide()` + `StatusBar.setOverlaysWebView(true)` on mount |
| PWA (home screen) | `manifest.json` `display: standalone` — browser chrome absent |
| Plain browser tab | First-tap gate on SplashScreen defers navigation until user gesture; Fullscreen API then activates |

---

## Navigation & Back Button

- `SCREEN_IDS` constants + `SCREEN_REGISTRY` map — never string literals for routes
- `ScreenShell` applies safe-area padding (`full` / `top-only` / `none`) from screen config
- **Native (Android/iOS):** Capacitor listener → `backButtonRegistry` → screen handler
- **Web:** `popstate` capture-phase interceptor + URL-stable sentinel keeps React Router clear
- **In-battle:** bounded pause loop — back → pause, back again → resume; 300 ms debounce guard
