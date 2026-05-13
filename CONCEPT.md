# CONCEPT.md — Genesis

---

## Logline

Genesis is a combat framework built on a continuous, infinite Timeline — where every Tick carries strategic weight, victory is earned through temporal mastery, and no two fights ever flow the same way.

---

## Core Fantasy

- Feeling like the only person who can see time — reading the Tick stream and acting with surgical precision
- Every action is a double decision: *what you do* and *how many Ticks you spend doing it*
- Watching tempo compound: small early Tick advantages snowball into total timeline dominance
- A roster that shifts by mode — mastery is never static, always contextual
- This is not "another RPG." It is a new combat framework.

---

## Theme & Tone

- **Theme**: Power, origins, convergence — warriors and forces from across the multiverse drawn into a single conflict where time itself is the battlefield
- **Tone**: Epic but sharp; the minimalist aesthetic keeps focus on the Tick stream, not spectacle

---

## Genre

**Combat framework first.** Not a turn-based RPG — a continuous timeline strategy game with RPG progression on top. The Tick system is the invention; everything else serves it.

---

## Core Loop

- **Micro loop** (each action): Read the live Tick stream, choose an action — every skill has a Tick cost that determines when that unit next acts and how fast resources regenerate; spend Ticks for power or preserve them for tempo
- **Macro loop** (session): Win combat encounters, earn Game Currency, advance the temporary Skill Path and Level Up system
- **Meta loop** (long-term): Invest Currency into Mastery Roads, grow User Level prestige, expand roster

---

## Progression System

Progression is split into two distinct layers — **temporary** (resets at the end of a battle or campaign) and **permanent** (persists across all sessions).

---

### Temporary Progression *(resets on battle / campaign end)*

| System | Description |
|---|---|
| **Skill Path** | Character-defined distribution of skill points awarded on level up — determines how many points the player receives and how they can be allocated across skills |
| **Level Up** | Characters gain XP and level up during a battle or campaign, boosting stats and awarding skill points; all levels reset to default when the run ends |

#### Skill Leveling — MOBA-Style
Each skill has its own temporary level that grows during the battle:

- Every skill defines its own **max level**, **per-level upgrades**, and **effects at each level** — fully specified on the skill itself
- On unit level up, the player receives **skill points** as defined by the character's Skill Path
- Skill points are spent to level up individual skills — the player chooses which skills to prioritise
- A skill cannot exceed its defined max level
- All skill levels reset to default at the end of the battle or campaign

This creates MOBA-style in-battle decision making: do you level a skill early for a power spike, or spread points for flexibility?

Temporary progression creates meaningful in-run decision-making and power fantasy without permanently distorting character balance. Every run starts from the same baseline.

---

### Permanent Progression *(persists forever)*

| System | Description |
|---|---|
| **User Level** | Account-wide prestige indicator — cosmetic only; carries no gameplay stat bonuses or content locks |
| **Game Currency** | Earned through play and retained across sessions; spent on permanent unlocks, Mastery Road nodes, or cosmetics |
| **Mastery Road** | A per-character web of cosmetic nodes unlocked through character-specific quests — no gameplay power, purely visual rewards |

#### Mastery Road
- Each character has their own independent mastery web
- Nodes are unlocked by completing **character-specific quests** — not by grinding currency or XP
- **Purely cosmetic** — no stat increases, no passive bonuses, no gameplay advantage; rewards are skins, effects, titles, and visual flair
- The web is permanent — progress is never lost between sessions
- This keeps progression tied to achievement and mastery, not time investment

---

## Action Points (AP)

Each unit has its own **AP pool** — the resource spent to execute skills.

- AP is **per-unit** — pools are independent; one unit's spending never affects another's
- AP regenerates on the **Tick rhythm** — `AP gained = ticks elapsed × character's apRegenRate`
- **AP regen rate is character-defined** — each unit has a unique `apRegenRate` value baked into their `CharacterDef`; it is a core part of their identity, not a shared stat
- **Every skill defines its own TU and AP cost** — both values are fixed properties of the skill itself, not derived from unit stats
- Skill cost has two dimensions: **TU cost** (how far the unit's marker advances on the stream) and **AP cost** (whether you can afford to use it at all)
- **AP regen can be frozen** — status effects with `payload.freezesApRegen: true` suppress all regen for their duration; the unit still acts on the tick stream but accumulates no AP
- Managing AP and TU simultaneously is the core skill expression of Genesis

---

## The Tick System (Core Framework)

Genesis replaces traditional turn-based conventions with a **continuous, infinite Timeline**.

### Fundamentals
- **No rounds.** Combat flows from Tick 0 → ∞ until one side is eliminated
- **TU (Tick Unit)** is the single atomic unit of time — it simultaneously governs:
  - **Initiative** — when a unit first acts (their starting Tick position)
  - **Action cost** — how many Ticks an action consumes before the unit can act again
  - **Resource regeneration** — AP refills on the Tick rhythm; `calculateApGained(ticksElapsed, apRegenRate)`
- All units — player and enemy — exist as markers on the same live Tick stream
- The full stream is always visible; players can plan multiple moves ahead

### Starting Tick Formula

```
speed_factor  = 1 - (Speed / 100)
spread        = round((class_max - class_min) × speed_factor)
starting_tick = class_min + randint(0, spread)
```

Speed compresses the ceiling of the random roll toward the class minimum:

| Speed | Effective roll range |
|---|---|
| 100 | Always `class_min` — fastest possible for class |
| 75  | `class_min` to `class_min + 25%` of range |
| 50  | `class_min` to `class_min + 50%` of range |
| 0   | Full `[class_min, class_max]` — no bias |

### Action Economy
- When a unit's Tick marker is reached, the player chooses an action
- The chosen skill advances the unit's marker by that skill's **TU cost** — a fixed value defined on the skill itself; lighter skills keep the unit mobile, heavier skills hit harder but create a longer wait
- This makes every decision a trade-off between **power now** vs **tempo later**
- **Tick manipulation skills exist** — certain skills can directly push enemy markers forward (delay), making the stream an active battleground, not just a read-out

### What Makes It Different
| Traditional Turn-Based | Genesis Tick System |
|---|---|
| Discrete rounds | Continuous infinite stream |
| Everyone acts once per round | Fast units act multiple times before slow ones act once |
| Resources reset each round | Resources regenerate on Tick rhythm — timing matters |
| Turn order is a list | Turn order is a live, always-shifting timeline |

---

## Skill Resolution (Dice System)

Every action triggers a single dice roll. The roll determines the full outcome — both the nature of the result and its magnitude.

### Resolution Table

| Outcome | Base % | Effect |
|---|---|---|
| **Boosted** | 10% | 1.5× output |
| **Hit**     | 40% | 1.0× output |
| **Evade**   | 20% | No output — target evades; counter chain check fires |
| **Fail**    | 30% | No output — miss; no counter opportunity |

Base probabilities at `finalChance = 1.0` (Precision 100, baseChance 1.0). The table always sums to 1.0.

### Outcome Notes

**Boosted** — a critical hit; 50% output bonus (`BOOSTED_MULTIPLIER = 1.5`).

**Hit** — baseline; the skill lands at full intended output.

**Evade** — the action fails entirely. The target then has a **15% chance to counter** (see Counter Chain). Unlike Fail, Evade gives the target the counter window.

**Fail** — clean miss; no output, no counter window.

### Probability Shifting

`finalChance = (Precision / 100) × baseChance`

Probabilities are split into two pools — positive (`Boosted + Hit = 50%`) and negative (`Evade + Fail = 50%`). `finalChance` scales one pool up and the other down proportionally, always summing to 1.0. The ratio between outcomes within each pool stays fixed.

| Final Chance | Effect on Table |
|---|---|
| 1.0 (100%) | Base probabilities as above |
| > 1.0 | Positive pool (Boosted, Hit) grows; negative pool (Evade, Fail) shrinks |
| < 1.0 | Negative pool grows; positive pool shrinks |

### Dice Alteration
The base roll is pure RNG — no system-level mitigation. However, **any skill or passive can alter the dice roll if its definition allows it**:

- A passive might shift outcome probabilities (`shiftProbability` effect)
- A skill might guarantee the next roll (`forceOutcome` effect)
- A relic might trigger a reroll (`rerollDice` effect)

Dice alteration is declared on the skill or passive itself — the framework provides the hook, the content provides the effect.

---

## Counter Chain

When a single-target skill is **Evaded**, the defending unit may counter-attack.

### Chain Formula

```
chance = max(0.01, 0.15 - depth × 0.02)
```

| Depth | Counter Chance |
|---|---|
| 0 | 15% |
| 1 | 13% |
| 2 | 11% |
| 3 | 9% |
| … | … |
| 7+ | 1% (floor) |

- **Player counters** — a `[COUNTER]` / `[SKIP]` prompt appears; the player decides
- **Enemy AI counters** — only if remaining AP after cost ≥ 20 (strategic reserve)
- Counter skills bypass cooldowns when used reactively
- The framework detects Evade and checks for a `counter` or `uniqueCounter`-tagged skill — no character ID checks

---

## Clash Resolution

When two or more units from different factions land on the **same Tick**, a clash fires before either acts.

### Resolution
1. Each faction's **average effective speed** is calculated: `avgSpeed = sum(unit.speed + unit.clashSpeedModifier) / unitCount`
2. The faction with the higher average acts first
3. **Ties** broken by weighted dice: weight = `faction_size / total_units_in_tie`
4. A QTE path (`clashUniqueEnabled`) allows a player-interactive resolution instead of speed compare

Clash is a multi-faction system — it handles any N:M configuration (1v1, 2v1, 1v1v1, etc.) without hardcoded assumptions.

---

## Visual Style

- Minimalist / flat — clean geometry, bold colours, strong contrast
- The Tick stream is a **first-class UI element**: always visible, always readable, the centre of the combat screen
- Every animation is snappy and purposeful — reinforce the weight of Tick decisions
- Palette: dark background with high-contrast accent colours per faction / universe

---

## Platform & Session Design

- Primary: Android / iOS — designed for 5–15 minute combat sessions
- State always saved on exit — no penalty for interruption
- Portrait-first; Tick stream UI optimised for one-thumb reach

---

## Multiversal Mix

Genesis does not take place *inside* any single universe — it draws characters *from* all of them.

- Any character from any universe, fiction, mythology, or setting can be **adapted into Genesis**
- Adaptation means translating a character's identity into Tick costs, AP pools, skill sets, and dice tendencies — the framework absorbs them, not the other way around
- No universe is mechanically privileged; a character's power comes from their design within the Tick system, not their source material
- This gives the roster infinite creative range while keeping the combat framework consistent

---

## Roster System

Unit availability is mode-driven — no single rule applies across all game modes:

- Some modes let the player **pre-build a squad** before entering combat
- Some modes use an **in-combat draft** — units are picked or discovered mid-fight
- Some modes **assign the roster** — the mode dictates which units are available
- Mastery means adapting to whatever configuration the mode demands

---

## Character System

### Stats

Every character has six core stats that define their identity and combat behaviour:

| Stat | Role |
|---|---|
| **Strength** | Governs physical skill output |
| **Endurance** | Governs HP pool and physical durability |
| **Power** | Governs magical / ability-based skill output |
| **Resistance** | Governs damage mitigation and defensive capacity |
| **Speed** | Determines starting Tick position — higher Speed biases toward the class minimum (acts sooner) |
| **Precision** | Accuracy stat — multiplied by a skill's base chance to determine the final hit chance multiplier |

### Classes

Six classes define a character's combat role, skill archetype, and Tick range:

| Class | Tick Range | Role |
|---|---|---|
| **Hunter**    | 1 – 6   | Mobile and fast — high Speed; exploits Tick advantages |
| **Ranger**    | 3 – 9   | Ranged precision — high Precision; consistent output |
| **Caster**    | 5 – 12  | Ability-driven — high Power; skill-heavy AP usage |
| **Warrior**   | 6 – 14  | Frontline melee — high Strength and Endurance |
| **Enchanter** | 7 – 15  | Support and control — buffs, debuffs, Tick manipulation |
| **Guardian**  | 10 – 20 | Defensive anchor — high Resistance and Endurance; absorbs pressure |

### Rarity

Seven rarity tiers define a character's overall power ceiling and design complexity:

| Tier | Rarity |
|---|---|
| 1 | Normal |
| 2 | Advance |
| 3 | Super |
| 4 | Epic |
| 5 | Master |
| 6 | Legend |
| 7 | OMEGA |

Higher rarity characters have higher stat ceilings, deeper skill sets, and greater mechanical complexity. OMEGA tier represents the apex — characters with unique framework-level effects.

---

## Unit Anatomy

A unit's stat profile is **dynamic and situational** — not every unit carries every resource. The possible stats are:

| Stat | Description |
|---|---|
| **HP** | Health pool — reaches zero, unit is eliminated |
| **AP** | Action Points — spent to use skills; regenerates at the unit's `apRegenRate` per Tick elapsed |
| **Secondary Resource** | Optional third resource unique to the unit or mode (e.g. Power Surge charge) — defined per character |
| **Status Slots** | Tracks active buffs, debuffs, and conditions applied to the unit; each slot carries an open `payload` for mechanic flags |

HP and AP are universal. Secondary resource and status slots are present only where a unit's design or the mode calls for them.

---

## Combat Actions

Every unit in battle has access to the following actions on their turn:

| Action | Description |
|---|---|
| **Basic Attack** | A default attack available to all units — tagged `basic`; no AP cost, fixed TU cost, base output defined by the unit |
| **Active Skill 1–4** | The unit's equipped active skills — each has its own TU cost, AP cost, base value, base chance, effect type, and tags |
| **Skip / End Turn** | Pass the turn — advances the unit's Tick marker by a fixed amount without spending AP |
| **In-Game Options** | Context-dependent actions available depending on mode or battle state |

### Skill Loadout
- Each unit equips **up to 4 active skills** before entering battle
- Each unit has **one unique passive** — always active, occupies no slot, cannot be swapped
- The passive is intrinsic to the character and defines part of their identity within the Tick framework

---

## Skill Design

Skills in Genesis are **self-defining** — there are no locked categories or types imposed by the system. Each skill declares its own:

- **TU cost** — how far the unit's marker advances after use
- **AP cost** — what it costs to execute
- **Base value** — a percentage of the relevant character stat used as the skill's output
- **Base chance** — a multiplier from `0.01` to `1.50` applied against the user's Precision stat to calculate the skill's final hit chance multiplier
- **Effect list** — one or more composable effects, each with its own `when` trigger, optional `condition`, and optional `target` override
- **Tags** — 1 to 4 tags that describe the skill's nature (see below)
- **Max level** — the highest level this skill can reach during a run
- **Level upgrades** — dot-delimited named-key patches per level; no new effect definitions needed for progression

### Output Formula

```
Raw Output = Relevant Stat × (Base Value / 100)
```

**Example**: Power 88, Base Value 333 → `88 × 3.33 = 293`

Raw output is then modified by the dice outcome (`Boosted` = ×1.5, `Hit` = ×1.0).

### Hit Chance Formula

```
Final Chance = (Precision / 100) × Base Chance
```

**Example**: Precision 58 × Base Chance 1.05 = **60.9% toward the positive pool**

Base chance `1.0` means the skill hits exactly as often as the character's raw Precision allows. Base chance `> 1.0` (up to `1.5`) pushes toward the positive pool more aggressively; base chance `< 1.0` favours the negative pool.

### Skill Tags

Each skill carries between one and four tags that classify its behaviour and enable interactions with other systems:

| Tag | Description |
|---|---|
| **physical** | Output is physical in nature — interacts with Strength |
| **energy** | Output is energy-based — interacts with Power |
| **melee** | Requires proximity — close-range targeting |
| **ranged** | Operates at distance — ranged targeting |
| **utility** | No direct combat output — positioning, Tick effects, resource manipulation |
| **unique** | Singular mechanic specific to the character |
| **special** | Enhanced or signature skill — above baseline power or complexity |
| **awakened** | Unlocked at high rarity or a power threshold |
| **misc** | Catch-all for effects that don't fit other tags |
| **counter** | Standard reactive counter — eligible to fire on Evade |
| **uniqueCounter** | Character-specific reactive counter with custom effects |
| **basic** | Default attack — no AP cost, always available |
| **movement** | Repositioning or Tick displacement skill |
| **tempo** | Tick-synergy skill — gains value from stream positioning |
| **hyper** | Skill has a conditional hyper-mode variant (different effects when activated) |

---

## Engine Architecture

Genesis's combat logic is split into **three cooperating engines** that share a single set of effect primitives. All battlefield behaviour — everything that happens when a skill is cast, a status ticks, or a passive triggers — is expressed as **composable effects** driven by JSON definitions. The engines are scaffolding; the effects are the vocabulary; the JSON is the script.

### Composable Effects

`core/effects/` holds a registry of **effect primitives** — small, typed functions that mutate battle state only through a typed `EffectContext` (`caster`, `target`, `battle`, `source`).

**14 effect primitives:**

| Primitive | Purpose |
|---|---|
| `damage` | Deal damage to target |
| `heal` | Restore HP to target |
| `tickShove` | Push target(s) forward on the Tick stream |
| `gainAp` | Grant AP to target |
| `spendAp` | Drain AP from target |
| `modifyStat` | Temporarily alter a stat |
| `applyStatus` | Apply a status effect with optional payload flags |
| `removeStatus` | Remove a status by ID or tag |
| `shiftProbability` | Adjust the probability of a dice outcome |
| `rerollDice` | Reroll the dice on a specific outcome |
| `forceOutcome` | Force the next dice roll to a specific outcome |
| `triggerSkill` | Fire another skill as a sub-action |
| `secondaryResource` | Mutate the unit's secondary resource (delta, set, max) |
| `resetApAccum` | Reset the unit's AP accumulator (used by passive proc gates) |

### ValueExpr

Effect amounts reference character stats without a mini-language — five forms only:

```
ValueExpr =
  | number                                                  -- flat value
  | { stat, percent, of? }                                  -- stat-scaled (caster or target)
  | { sum: ValueExpr[] }                                    -- sum of expressions
  | { secondary: number }                                   -- secondary resource multiplier
  | { globalApSpentPercent: number }                        -- % of all AP spent by all units
```

### WhenClause — Trigger Events

Effects and passives declare a `when` field from this set:

| Event | Fires when |
|---|---|
| `onCast` | Skill is used (before dice) |
| `onDiceRoll` | Dice resolves (optionally filtered by outcome) |
| `onHit` | Attack connects |
| `onMiss` | Attack misses |
| `onAfterHit` | After all hit effects resolve |
| `onEvade` | Target evades |
| `onApply` | Status is applied to the unit |
| `onExpire` | Status duration runs out |
| `onRemoved` | Status is explicitly removed |
| `onTickInterval` | Every N of the unit's own actions |
| `onUnitTurnStart` | When the unit's Tick marker is reached |
| `onTakeDamage` | Unit receives damage |
| `onHpThreshold` | HP crosses a `below` or `above` threshold |
| `onApChange` | AP pool changes |
| `onBattleStart` | Battle initialises |
| `onBattleEnd` | Battle concludes |
| `onApSpent` | Unit spends AP |
| `onBattleTickInterval` | Every N cumulative global battle ticks |

### The Three Engines

| Engine | Owns | Lifecycle |
|---|---|---|
| **Skill Engine** | Skill instances, level patches, AP/TU costs, dice triggering | Instance per equipped skill per battle |
| **Status Engine** | Active status instances, durations, stacking, payload flags | Instance per applied status per unit |
| **Passive Engine** | Each unit's single unique passive — always active | One instance per unit, lives the whole battle |

### Skill Level Lifecycle & Patch Cache

Each `SkillInstance` holds:
- `baseDef` — the untouched level-1 source (immutable)
- `currentLevel` — current level during the run
- `cachedEffects` — patched effect list, recomputed once on level-up
- `cachedCosts` — patched TU/AP costs, recomputed the same way
- `cacheVersion` — bumped to force recomputation if a passive modifies the skill mid-battle

Every cast reads from the cache (no per-call patch math). The **mode / run lifecycle owns reset timing** — the battle engine never calls `resetToDefault()` itself.

### Status Stacking

Status stacking is **per-status, not global**. Each status JSON declares its own stacking rule. Valid modes: `refresh` · `extend` · `stack` · `independent`.

---

## Narrative Layer *(implemented)*

Story beats and character reactions live entirely in JSON — no code changes needed for new dialogue.

### Two Data Scopes

```
public/data/
├── characters/{id}/dialogue.json       # Universal reactions — skill cries, counters, death words
└── levels/{levelId}/narrative.json     # Story beats — intro, cutscenes, victory dialogue
```

### NarrativeService API

```ts
NarrativeService.emit(event)                        // fire event; NarrativeLayer resolves match
NarrativeService.play(narrativeId)                  // trigger specific entry directly
NarrativeService.registerEntries(namespace, entries) // load a scope into the pool
NarrativeService.unregisterEntries(namespace)        // unload a scope
```

### Entry Fields

- `narrativeId` — unique primary key; used for direct triggers and `once` tracking
- `trigger` — optional event match (`event`, `actorId`, `targetId`, `chance`)
- `once` — fires at most once per session
- `sequence` — all lines play in order (cutscene); otherwise one line picked at random
- `lines` — array of `{ speakerId, text }`

### Animation Types

| Type | Visual |
|---|---|
| `dialogue` | Slide-up box — portrait + rarity nameplate + typewriter text · **freezes battle** |
| `screen_flash` | Full-screen colour burst, fades out |
| `portrait_fly` | Character portrait slides in from left or right edge |
| `floating_text` | Impact text rises from centre and fades |

### Standard Event Strings

`battle_start` · `battle_victory` · `battle_defeat` · `skill_used` · `boosted_hit` · `evaded` · `unit_death` · `counter` · `clash_resolved`

Any string is valid — new events require only JSON entries, no code changes.

---

## Items System *(planned)*

Items are split into two strictly separate tiers with different scopes and purposes.

### Campaign Items
- **Scope**: Mission or campaign-specific — available only within the run or mission they belong to
- Earned, found, or awarded during a campaign encounter
- **Item-defined type** — no fixed form; each item declares its own behaviour
- Fit within the **temporary progression layer** — reset when the campaign or mission ends

### Genesis Items
- **Scope**: Global — available across all modes and sessions
- Two subtypes:
  - **Equipment** — gear equipped in pre-battle slots; modifies stats, TU costs, AP pools, or output for the fight
  - **Relics** — artefacts with fully self-defined effects (Tick modifiers, dice-conditional triggers, stat scaling)
- **Equipment slots are unit-defined** — each unit declares its own slot configuration
- **All items are self-defining** — effect type, magnitude, and conditions declared on the item itself
- **Strictly balance-maintained** — every Genesis Item is centrally designed; no procedural generation

### Balance Rule
Genesis Items are the only persistent power-affecting items in the game. Every item in this pool is held to strict balance standards — no Genesis Item is added without evaluating its impact on the Tick system, AP economy, and dice outcomes.

---

## Win Conditions & Loss State

Both victory and defeat are **mode-dependent** — no single rule applies across all modes. Each mode defines its own win and loss states independently.

---

## Game Modes

| Mode | Description | Status |
|---|---|---|
| **Story / Campaign** | Fixed encounters with set enemies; narrative-driven progression through multiversal arcs | Implemented |
| **Ranked** | Competitive format; leaderboard-driven; best-of-N structure | Stub (data exists; full PvP logic planned) |
| **Endless / Roguelite** | Procedural runs with escalating difficulty; temporary progression grows during the run; permanent progression advances on run end | Planned |
| **Event / Challenge** | Time-limited modes with unique rules, modifiers, or win conditions; rewards exclusive currency or cosmetics | Planned |

---

## Status Effects

Status effects follow the same open design as skills — **there are no locked status effect types**. Each status declares:

- `stacking` — how duplicate applications are handled (`refresh` / `extend` / `stack` / `independent`)
- `duration` — in ticks, turns, `'battle'`, or `'untilStatusGone'`
- `tags` — descriptive and mechanic-triggering (e.g. `hp-ap-swap`, `dodge`, `buff`, `debuff`)
- `effects` — the same effect primitive list used by skills and passives
- `dodgeConfig` — optional; declares dodge chance per attack type and consumption behaviour
- `payload` flags — set at apply time; the engine reads these generically (e.g. `freezesApRegen`, `hpApSwapped`, `doublesShieldOverflow`, `onBreakTickCooldown`, `blocksRecastOfSkill`)

No character ID checks exist anywhere in the engine — all mechanic behaviour is driven by payload flags declared in the status JSON.

---

## Enemy AI

Enemies are **Tick-aware** — they evaluate the full Tick stream before making decisions, just as a skilled player would.

- Enemies read all unit positions on the stream before choosing an action
- AI factors in AP availability, skill TU costs, and the positioning of both allied and enemy markers
- Enemies can delay attacks to act before a player unit, prioritise targets who are far back on the stream, or use Tick manipulation skills strategically
- AI difficulty can be tuned by adjusting how many moves ahead the enemy evaluates — higher difficulty = deeper lookahead
- **Enemy counter AI** — counters only if remaining AP after cost ≥ `AI_COUNTER_AP_RESERVE` (20); otherwise skips to preserve AP economy

---

## Open Questions

- [x] Core loop → continuous Tick stream (Tick 0 → ∞), no rounds
- [x] TU = Tick = initiative + action cost + resource regen rhythm
- [x] Timeline manipulation → skill-only via `tickShove` effect primitive
- [x] Skill resolution → 4-outcome dice table (Boosted 10% / Hit 40% / Evade 20% / Fail 30%); pure RNG; no outcome modifies the Tick stream directly
- [x] Roster source → mix of pre-built, in-combat draft, and mode-assigned depending on mode
- [x] Resources → AP per-unit; regenerates on Tick rhythm (`ticks × apRegenRate`); can be frozen via status payload
- [x] Enemy Tick manipulation → confirmed; `tickShove` effect can delay enemies on the stream
- [x] Progression → two layers: temporary (Skill Path + Level Up, resets per run) and permanent (User Level cosmetic prestige, Game Currency, per-character Mastery Road — quest-based, purely cosmetic)
- [x] Skill Path → MOBA-style skill leveling; unit level up awards skill points; points spent to level individual skills; each skill defines its own max level and per-level upgrades; all resets on run end
- [x] Multiverse role → Multiversal Mix; any character adapted into the framework; roster has infinite range
- [x] Character stats → Strength, Endurance, Power, Resistance, Speed, Precision
- [x] Classes → Warrior, Caster, Ranger, Hunter, Enchanter, Guardian
- [x] Rarity → 7 tiers: Normal → Advance → Super → Epic → Master → Legend → OMEGA
- [x] Speed → starting Tick formula: `class_min + randint(0, round((class_max - class_min) × (1 - Speed/100)))`; class ranges defined per class
- [x] Final chance → `(Precision / 100) × baseChance`; probability shift redistributes positive pool (Boosted + Hit) and negative pool (Evade + Fail) proportionally; always sums to 1.0
- [x] AP regen rate → character-defined `apRegenRate`; unique per unit; can be frozen via status payload flag `freezesApRegen`
- [x] Skill types → no locked categories; each skill is self-defining (TU cost + AP cost + base value + base chance + effect list + 1–4 tags)
- [x] Combat actions → Basic Attack (tagged `basic`), 4 active skill slots, unique passive (always active), Skip/End Turn, in-game options
- [x] Precision → multiplied by skill base chance (0.01–1.50) to produce final hit chance multiplier
- [x] Unit anatomy → HP and AP universal; secondary resource and status slots situational per character/mode
- [x] Win condition → mode-dependent
- [x] Loss state → mode-dependent
- [x] Game modes → Story/Campaign (implemented), Ranked stub (implemented), Endless/Roguelite (planned), Event/Challenge (planned)
- [x] Status effects → skill/passive-defined; no locked types; stacking mode declared per status; mechanic flags in open payload
- [x] Enemy AI → Tick-aware; evaluates full stream before acting; counter AI skips if AP reserve < 20
- [x] Clash resolution → implemented; avg faction speed comparison + weighted dice on ties; QTE path optional
- [x] Narrative → implemented; event bus + JSON dialogue scopes + battle freeze on dialogue; NarrativeService API
- [x] Counter chain → `max(0.01, 0.15 - depth × 0.02)`; player sees prompt; enemy AI uses AP reserve gate
- [x] Items → two tiers: Campaign Items (mission-scoped, temporary) and Genesis Items (global Equipment + Relics, strictly balance-maintained) — planned, not yet implemented
- [x] Data architecture → JSON definitions for all game content in `public/data/`; one file per entity; loaded and cached by DataService
- [x] Dice variance → pure RNG base; alteration only through skills or passives that explicitly declare `shiftProbability`, `rerollDice`, or `forceOutcome` effects
- [x] Monetisation → Ads (AdMob via Capacitor) + IAP; no gameplay power sold; IAP limited to cosmetics, currency, and character unlocks
- [ ] What does "power" look like visually on the Tick stream?

---

## Monetisation

Genesis monetises through two channels — both strictly non-pay-to-win.

### Ads
- **Primary network**: AdMob (via Capacitor plugin)
- Ad placements are between sessions or on opt-in reward screens — never interrupting active combat
- Players can opt into rewarded ads for bonus Game Currency

### In-App Purchases (IAP)
- **Game Currency** — purchase currency to spend on cosmetics and Mastery Road progression faster
- **Character unlocks** — acquire specific characters directly
- **Cosmetic bundles** — skins, effects, titles
- **Ad removal** — one-time purchase to remove non-rewarded ads

### Non-Negotiable Rule
**No IAP gives gameplay power.** No stat boosts, no Genesis Items, no skill advantages purchasable. Every player competes on equal mechanical footing — victory is earned through Tick mastery, not spending.
