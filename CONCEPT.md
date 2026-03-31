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
- AP regenerates on the **Tick rhythm** — units accumulate AP as Ticks pass, creating a natural cadence of when powerful skills become available
- **AP regen rate is character-defined** — each unit has a unique regen value baked into their design; it is a core part of their identity, not a shared stat
- **Every skill defines its own TU and AP cost** — both values are fixed properties of the skill itself, not derived from unit stats
- Skill cost has two dimensions: **TU cost** (how far the unit's marker advances on the stream) and **AP cost** (whether you can afford to use it at all)
- Managing both simultaneously is the core skill expression of Genesis

---

## The Tick System (Core Framework)

Genesis replaces traditional turn-based conventions with a **continuous, infinite Timeline**.

### Fundamentals
- **No rounds.** Combat flows from Tick 0 → ∞ until one side is eliminated
- **TU (Tick Unit)** is the single atomic unit of time — it simultaneously governs:
  - **Initiative** — when a unit first acts (their starting Tick position)
  - **Action cost** — how many Ticks an action consumes before the unit can act again
  - **Resource regeneration** — resources refill on Tick intervals, creating a rhythm the player must read and exploit
- All units — player and enemy — exist as markers on the same live Tick stream
- The full stream is always visible; players can plan multiple moves ahead

### Action Economy
- When a unit's Tick marker is reached, the player chooses an action
- The chosen skill advances the unit's marker by that skill's **TU cost** — a fixed value defined on the skill itself; lighter skills keep the unit mobile, heavier skills hit harder but create a longer wait
- This makes every decision a trade-off between **power now** vs **tempo later**
- **Tick cost is fixed per action** — with one exception: a **Tumbling** dice result pushes the acting unit's marker forward an additional 1–5 Ticks as a tempo penalty
- **Tick manipulation skills exist** — certain skills can directly push enemy markers forward (delay) or pull ally markers backward (haste), making the stream an active battleground, not just a read-out

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

| Outcome | Probability | Effect |
|---|---|---|
| **Boosted** | 15% | 1.5× output |
| **Success** | 45% | 1.0× output |
| **Tumbling** | 10% | 0.5× output + source delayed 1–5 Ticks (random) |
| **Guard Up** | 20% | Target gains 10% of output as mitigation |
| **Evasion** | 10% | No effect → 15% Counter chance (↓5% per recursion, min 1%) |

### Outcome Notes

**Boosted** — a critical hit; straightforward 50% output bonus.

**Success** — baseline; the skill lands at full intended output.

**Tumbling** — the skill partially lands but the attacker loses footing. Output is halved *and* the source unit's Tick marker is pushed forward by 1–5 Ticks (rolled randomly). This is the **primary bridge between the Dice and Tick systems** — a bad roll doesn't just reduce damage, it disrupts the attacker's tempo.

**Guard Up** — the action lands but inadvertently fortifies the target. 10% of the output converts into mitigation for the target rather than being a miss. The attacker still acts; the target becomes slightly harder to hurt.

**Evasion** — the action fails entirely. The target then has a **15% chance to counter**. If that counter rolls Evasion, the next counter chance drops to 10%, then 5%, then floors at 1% per further recursion. Counters are full actions — they roll the resolution table independently and can themselves result in any outcome including Tumbling or further Evasion.

### System Relationship

| Layer | Nature | Tick Interaction |
|---|---|---|
| Tick System | Deterministic | Always visible; fully plannable |
| Dice | Probabilistic | Independent — *except* Tumbling, which delays the source |

The Tumbling outcome is the only case where a dice result modifies the Tick stream.

---

## Visual Style

- Minimalist / flat — clean geometry, bold colours, strong contrast
- The Tick stream is a **first-class UI element**: always visible, always readable, the centre of the combat screen
- Every animation is snappy and purposeful — reinforce the weight of Tick decisions
- Palette TBD; lean dark with high-contrast accent colours per faction / universe

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
| **Precision** | Accuracy stat — multiplied by a skill's base chance to determine the final hit chance percentage |

### Starting Tick Formula

Each character's position on the Tick stream at combat start is calculated as:

```
speed_factor  = 1 - (Speed / 100)
max_offset    = (class_max - class_min) × speed_factor
starting_tick = class_min + randint(0, round(max_offset))
```

Speed does not guarantee a fixed position — it **compresses the ceiling** of the random roll toward the class minimum:

| Speed | Effective roll range |
|---|---|
| 100 | Always `class_min` — fastest possible for class |
| 75 | `class_min` to `class_min + 25%` of range |
| 50 | `class_min` to `class_min + 50%` of range |
| 0 | Full `[class_min, class_max]` — no bias |

### Classes

Six classes define a character's combat role, skill archetype, and Tick range:

| Class | Tick Range | Role |
|---|---|---|
| **Hunter** | 1 – 6 | Mobile and fast — high Speed; exploits Tick advantages |
| **Ranger** | 3 – 9 | Ranged precision — high Precision; consistent output |
| **Caster** | 5 – 12 | Ability-driven — high Power; skill-heavy AP usage |
| **Warrior** | 6 – 14 | Frontline melee — high Strength and Endurance |
| **Enchanter** | 7 – 15 | Support and control — buffs, debuffs, Tick manipulation |
| **Guardian** | 10 – 20 | Defensive anchor — high Resistance and Endurance; absorbs pressure |

> **Note**: Class Tick ranges are working values — to be confirmed during prototyping.

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
| **AP** | Action Points — spent to use skills; regenerates at the unit's defined regen rate on the Tick rhythm |
| **Secondary Resource** | Optional third resource unique to the unit or mode (e.g. rage, shield charge, mana) — defined per character |
| **Status Slots** | Tracks active buffs, debuffs, and conditions applied to the unit |

HP and AP are universal. Secondary resource and status slots are present only where a unit's design or the mode calls for them.

---

## Combat Actions

Every unit in battle has access to the following actions on their turn:

| Action | Description |
|---|---|
| **Basic Attack** | A default attack available to all units — no AP cost, fixed TU cost, base output defined by the unit; rolls the full dice resolution table (Boosted / Success / Tumbling / Guard Up / Evasion) |
| **Active Skill 1–4** | The unit's equipped active skills — each has its own TU cost, AP cost, base value, base chance, effect type, and tags |
| **Skip / End Turn** | Pass the turn — advances the unit's Tick marker by a fixed amount without spending AP |
| **In-Game Options** | Context-dependent actions available depending on mode or battle state (e.g. surrender, inspect, use item) |

### Skill Loadout
- Each unit equips **up to 4 active skills** before entering battle
- Each unit has **one unique passive** — always active, occupies no slot, cannot be swapped
- The passive is intrinsic to the character and defines part of their identity within the Tick framework

---

## Skill Design

Skills in Genesis are **self-defining** — there are no locked categories or types imposed by the system. Each skill declares its own:

- **TU cost** — how far the unit's marker advances after use
- **AP cost** — what it costs to execute
- **Base value** — an integer representing a **percentage of the relevant character stat** used as the skill's output. `null` if the skill has no numeric output (e.g. pure Tick manipulation or utility effects)
  - Example: base value `20` on a Strength-80 character = `80 × 0.20 = 16` output
  - The skill's module class **auto-detects the relevant stat** from the skill's own definition — no manual stat lookup required by the caller
  - Which stat is used (Strength, Power, Endurance, etc.) is declared on the skill itself
- **Base chance** — a multiplier from `0.01` to `1.50` applied against the user's Precision stat to calculate the skill's final hit chance
- **Effect type** — what the base value does: `damage`, `heal`, or any other combat factor defined on the skill itself
- **Tags** — 1 to 4 tags that describe the skill's nature (see below)
- **Max level** — the highest level this skill can reach during a battle; defined on the skill
- **Level upgrades** — the effects and stat changes unlocked at each level; fully defined on the skill

### Output Formula

```
Raw Output = Relevant Stat × (Base Value / 100)
```

**Example**: Strength 80, Base Value 20 → `80 × 0.20 = 16`

- The **relevant stat** is declared on the skill itself and auto-detected by the skill's module class
- Common mappings (defined per skill, not enforced by the framework):
  - Physical skills → Strength
  - Energy skills → Power
  - Defensive / healing skills → Endurance or Resistance
- Raw output is then modified by the dice resolution result (Boosted 1.5×, Success 1.0×, Tumbling 0.5×, etc.)

### Hit Chance Formula

```
Final Chance (%) = Precision × Base Chance
```

**Example**: Precision 95 × Base Chance 0.75 = **71.25% hit chance**

- Base chance `1.0` means the skill hits exactly as often as the character's raw Precision
- Base chance `> 1.0` (up to `1.5`) means the skill is more accurate than the character's baseline — reliable, consistent skills
- Base chance `< 1.0` means the skill trades accuracy for other properties — power, utility, or Tick cost savings

Final chance acts as a **probability shift** on the dice resolution table — it does not gate the roll. Every action always produces an outcome; final chance adjusts how likely favourable outcomes are:

| Final Chance | Effect on Table |
|---|---|
| 100% | Base probabilities (Boosted 15% / Success 45% / Tumbling 10% / Guard Up 20% / Evasion 10%) |
| > 100% | Positive outcomes (Boosted, Success) gain probability mass; negative outcomes (Tumbling, Evasion) shrink |
| < 100% | Negative outcomes grow; positive outcomes shrink |

The exact redistribution formula is to be finalised during prototyping — the principle is that no roll ever produces nothing, and Precision always matters.

### Skill Tags

Each skill carries between one and four tags that classify its behaviour and enable interactions with other systems (buffs, resistances, class synergies, etc.):

| Tag | Description |
|---|---|
| **Physical** | Output is physical in nature — interacts with Strength and Resistance |
| **Energy** | Output is energy-based — interacts with Power and Resistance |
| **Melee** | Requires proximity — close-range targeting |
| **Ranged** | Operates at distance — ranged targeting |
| **Utility** | No direct combat output — positioning, Tick effects, resource manipulation |
| **Unique** | Singular mechanic specific to the character — not shared by any other skill |
| **Special** | Enhanced or signature skill — above baseline power or complexity |
| **Awakened** | Unlocked at high rarity or a power threshold — represents a character's full potential |
| **Misc** | Catch-all for effects that don't fit other tags |

This open design means skills can be as simple or complex as their character demands, without the framework constraining what a skill is allowed to do.

---

## Items System

Items are split into two strictly separate tiers with different scopes and purposes.

### Campaign Items
- **Scope**: Mission or campaign-specific — available only within the run or mission they belong to
- Earned, found, or awarded during a campaign encounter
- **Item-defined type** — no fixed form; each item declares its own behaviour (consumable, temporary gear, passive buff, or anything else)
- Fit within the **temporary progression layer** — reset when the campaign or mission ends
- Defined in `assets/data/items/campaign/` — scoped to their campaign

### Genesis Items
- **Scope**: Global — available across all modes and sessions
- Two subtypes:
  - **Equipment** — gear equipped in pre-battle slots; modifies stats, TU costs, AP pools, or output for the fight
  - **Relics** — artefacts equipped in pre-battle slots; effects are fully self-defined per relic (Tick modifiers, dice-conditional triggers, stat scaling, or any combination)
- **Equipment slots are unit-defined** — each unit declares its own slot configuration as part of its design; no universal slot count enforced
- **All items are self-defining** — effect type, magnitude, and conditions are declared on the item itself, not by a shared type system
- **Strictly balance-maintained** — every Genesis Item is centrally designed and reviewed; no procedural generation; the full item pool is a curated, closed set
- Defined in `assets/data/items/genesis/` — globally accessible

### Balance Rule
Genesis Items are the only persistent power-affecting items in the game. Because they cross all modes and sessions, every item in this pool is held to strict balance standards. No Genesis Item is added without evaluating its impact on the Tick system, AP economy, and dice outcomes.

---

## Win Conditions & Loss State

Both victory and defeat are **mode-dependent** — no single rule applies across all modes. Each mode defines its own win and loss states independently.

---

## Game Modes

Four game modes are planned, each with its own ruleset, roster behaviour, and win/loss conditions:

| Mode | Description |
|---|---|
| **Story / Campaign** | Fixed encounters with set enemies; narrative-driven progression through multiversal arcs |
| **Endless / Roguelite** | Procedural runs with escalating difficulty; temporary progression grows during the run; permanent progression advances on loss |
| **PvP** | Player vs Player — Tick mastery and roster knowledge tested against other players |
| **Event / Challenge** | Time-limited modes with unique rules, modifiers, or win conditions; rewards exclusive currency or cosmetics |

---

## Status Effects

Status effects follow the same open design as skills — **there are no locked status effect types**. Each skill defines the status effects it applies as part of its effect definition. Any condition, periodic effect, or state modifier is valid as long as it is fully specified on the skill.

Common patterns (not exhaustive):
- Periodic damage or healing on Tick intervals
- Stat modifications (temporary Strength, Resistance, Speed changes)
- Tick manipulation conditions (slowed, hastened)
- Shields, guards, or damage absorption states

---

---

## Open Questions

- [x] Core loop → continuous Tick stream (Tick 0 → ∞), no rounds
- [x] TU = Tick = initiative + action cost + resource regen rhythm
- [x] Timeline manipulation → skill-only; Tick cost is always fixed
- [x] Skill resolution → 5-outcome dice table (Boosted 15% / Success 45% / Tumbling 10% / Guard Up 20% / Evasion 10%); pure RNG; Tumbling is the one outcome that delays the source on the Tick stream
- [x] Roster source → mix of pre-built, in-combat draft, and mode-assigned depending on mode
- [x] Resources → AP per-unit; regenerates on Tick rhythm; skills cost both AP and Ticks
- [x] Enemy Tick manipulation → confirmed; skills can delay enemies or haste allies on the stream
- [x] Progression → two layers: temporary (Skill Path + Level Up, resets per battle/campaign) and permanent (User Level cosmetic prestige, Game Currency, per-character Mastery Road — quest-based, purely cosmetic)
- [x] Skill Path → MOBA-style skill leveling; unit level up awards skill points (defined by character's Skill Path); points spent to level individual skills; each skill defines its own max level and per-level upgrades; all resets on battle end
- [x] Multiverse role → Multiversal Mix; any character adapted into the framework; roster has infinite range
- [x] Character stats → Strength, Endurance, Power, Resistance, Speed, Precision
- [x] Classes → Warrior, Caster, Ranger, Hunter, Enchanter, Guardian
- [x] Rarity → 7 tiers: Normal → Advance → Super → Epic → Master → Legend → OMEGA
- [ ] What does "power" look like visually on the Tick stream?
- [x] Speed → starting Tick formula: `class_min + randint(0, round((class_max - class_min) × (1 - Speed/100)))`; class ranges defined per class
- [x] Final chance → probability shift on the dice table; no pre-roll gate; every action always produces an outcome; exact redistribution formula TBD during prototyping
- [x] AP regen rate → character-defined; unique per unit, baked into their design
- [x] Skill types → no locked categories; each skill is self-defining (TU cost + AP cost + base value + base chance + effect type + 1–4 tags)
- [x] Combat actions → Basic Attack, 4 active skill slots, unique passive (always active), Skip/End Turn, in-game options
- [x] Precision → multiplied by skill base chance (0.01–1.50) to produce final hit chance %
- [x] Unit anatomy → HP and AP universal; secondary resource and status slots situational per character/mode
- [x] Win condition → mode-dependent
- [x] Loss state → mode-dependent
- [x] Game modes → Story/Campaign, Endless/Roguelite, PvP, Event/Challenge
- [x] Status effects → skill-defined; no locked types; any condition valid if specified on the skill
- [x] Items → two tiers: Campaign Items (mission-scoped, temporary, item-defined type) and Genesis Items (global Equipment + Relics, pre-battle slots, unit-defined slot config, self-defining effects, strictly balance-maintained)
- [x] Data architecture → JSON definitions for all game content; one file per entity; loaded by data_service
- [ ] Is there a narrative layer, or is progression purely systemic?
- [ ] Monetisation model (if any)?
- [ ] Dice variance — pure RNG or some mitigation system?
