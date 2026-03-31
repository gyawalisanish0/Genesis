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
- **Macro loop** (session): Win combat encounters, earn resources, unlock upgrades
- **Meta loop** (long-term): Persistent power progression, expand roster, unlock new game modes and multiversal arcs

---

## Progression System

- **Three axes of growth** — units advance through a combination of:
  - **Levels** — stats increase, new skills unlock as a unit gains XP
  - **Equipment / Relics** — equippable items that modify Tick costs, dice weights, AP pools, or output values
  - **Skill Trees** — branching upgrades that deepen a unit's abilities and specialisation
- No wasted progress — losses feed the meta loop forward

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

## Open Questions

- [x] Core loop → continuous Tick stream (Tick 0 → ∞), no rounds
- [x] TU = Tick = initiative + action cost + resource regen rhythm
- [x] Timeline manipulation → skill-only; Tick cost is always fixed
- [x] Skill resolution → 5-outcome dice table (Boosted 15% / Success 45% / Tumbling 10% / Guard Up 20% / Evasion 10%); pure RNG; Tumbling is the one outcome that delays the source on the Tick stream
- [x] Roster source → mix of pre-built, in-combat draft, and mode-assigned depending on mode
- [x] Resources → AP per-unit; regenerates on Tick rhythm; skills cost both AP and Ticks
- [x] Enemy Tick manipulation → confirmed; skills can delay enemies or haste allies on the stream
- [x] Progression → combination of levels, equipment/relics, and skill trees
- [x] Multiverse role → Multiversal Mix; any character adapted into the framework; roster has infinite range
- [ ] What does "power" look like visually on the Tick stream?
- [x] AP regen rate → character-defined; unique per unit, baked into their design
- [ ] Are Tick manipulation skills a dedicated skill type, or can any skill have Tick effects?
- [ ] Is there a narrative layer, or is progression purely systemic?
- [ ] What happens when the player loses a combat?
- [ ] Multiplayer / social, or single-player only?
- [ ] Monetisation model (if any)?
- [ ] Dice variance — pure RNG or some mitigation system?
