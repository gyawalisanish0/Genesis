# CONCEPT.md — Genesis

---

## Logline

Genesis is a turn-based combat game set across a fractured multiverse — where mastering the Timeline, a dynamic turn-order system, is the key to outthinking opponents and ascending to absolute power.

---

## Core Fantasy

- Feeling like the smartest person in the room — reading the timeline and acting at the perfect moment
- Every skill choice is a double decision: *what you do* and *when you act again*
- Watching power compound: small early timeline advantages snowball into overwhelming control
- A roster that shifts by mode — mastery is never static, always contextual
- Adapting to whatever units you're given and finding the optimal Timeline line-up with them

---

## Theme & Tone

- **Theme**: Power, origins, convergence — warriors and forces from across the multiverse drawn into a single conflict
- **Tone**: Epic but sharp; the minimalist aesthetic keeps focus on strategy, not spectacle

---

## Genre

Turn-based strategy / RPG hybrid. Combat is the core; progression and power systems are the meta layer.

---

## Core Loop

- **Micro loop** (each turn): Read the Timeline, choose an action — each skill has a timeline cost that determines when that unit acts next; spend a heavy skill now or stay mobile with a lighter one
- **Macro loop** (session): Win combat encounters, earn resources, unlock upgrades
- **Meta loop** (long-term): Persistent power progression, expand roster, unlock new game modes and multiversal arcs

---

## Progression System

- Power is earned through combat mastery and expressed through expanded Timeline control
- Multiple axes: character stats, abilities, timeline cost modifiers, roster depth
- No wasted progress — losses feed the meta loop forward

---

## Timeline Mechanic (Core System)

The Timeline is the central mechanic of all combat in Genesis.

- All units — player and enemy — are positioned on a shared Timeline track
- When a unit reaches its turn marker, it acts
- The **action or skill chosen determines how far the unit's marker advances** after acting — lighter skills advance the marker less (act sooner again); heavier skills push the marker further (longer wait)
- This makes every decision a trade-off between **power now** vs **speed later**
- Players can read the full Timeline at all times, enabling forward planning and counter-play
- **Timeline manipulation is skill-only** — no passive stat affects marker distance; all timeline interaction comes from deliberate skill choices
- **Timeline cost is fixed** — dice rolls never affect when a unit acts next; the two systems are fully independent

---

## Skill Resolution (Dice System)

When a unit acts, the outcome is resolved through a dice roll. The two systems — Timeline and Dice — are intentionally separate:

- **Timeline** = deterministic strategic layer; players always know the turn order in advance
- **Dice** = probabilistic resolution layer; players never know exactly what will happen when they act

### Resolution Rules
- Every skill triggers a dice roll on use
- The roll determines **full resolution**: both whether the skill lands (hit / miss / crit) and the magnitude of the effect (damage, healing, buff strength)
- Dice are **pure RNG** — no player resource or stat modifies the roll before or after it happens
- This creates a tension between perfect planning (Timeline) and unpredictable outcomes (Dice)

---

## Visual Style

- Minimalist / flat — clean geometry, bold colours, strong contrast
- The Timeline is a **first-class UI element**: always visible, always readable, central to the combat screen
- Animations are snappy and purposeful — reinforce the feel of decisive action
- Palette TBD; lean dark with high-contrast accent colours per faction / universe

---

## Platform & Session Design

- Primary: Android / iOS — designed for 5–15 minute combat sessions
- State always saved on exit — no penalty for interruption
- Portrait-first; Timeline UI optimised for one-thumb reach

---

## Roster System

Unit availability is mode-driven — no single rule applies across all game modes:

- Some modes let the player **pre-build a squad** before entering combat
- Some modes use an **in-combat draft** — units are picked or discovered mid-fight
- Some modes **assign the roster** — the mode dictates which units are available
- Mastery means adapting to whatever configuration the mode demands

---

## Open Questions

- [x] What is the micro-loop? → Timeline-based turn-order combat
- [x] Timeline manipulation → skill-only; no passive stat influence; cost is always fixed
- [x] Skill resolution → dice roll for full resolution (hit/miss/crit + magnitude); pure RNG; dice never affect the timeline
- [x] Roster source → mix of pre-built, in-combat draft, and mode-assigned depending on mode
- [ ] What does "power" look like visually? (number, character, timeline position?)
- [ ] Can skills affect *enemy* timeline markers? (delay, pull-forward)
- [ ] How does the multiversal setting factor into gameplay? (factions, zones, or pure flavour)
- [ ] Is there a narrative layer, or is progression purely systemic?
- [ ] Multiplayer / social, or single-player only?
- [ ] What happens when the player loses a combat?
- [ ] Monetisation model (if any)?
