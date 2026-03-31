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

- Power is earned through Tick mastery and expressed through deeper timeline control
- Multiple axes: unit stats, abilities, Tick cost modifiers, roster depth
- No wasted progress — losses feed the meta loop forward

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
- The chosen action advances the unit's marker by its Tick cost — lighter actions keep the unit mobile; heavier actions hit harder but create a longer wait
- This makes every decision a trade-off between **power now** vs **tempo later**
- **Tick cost is fixed per action** — dice rolls never affect when a unit acts next

### What Makes It Different
| Traditional Turn-Based | Genesis Tick System |
|---|---|
| Discrete rounds | Continuous infinite stream |
| Everyone acts once per round | Fast units act multiple times before slow ones act once |
| Resources reset each round | Resources regenerate on Tick rhythm — timing matters |
| Turn order is a list | Turn order is a live, always-shifting timeline |

---

## Skill Resolution (Dice System)

When a unit acts, the outcome is resolved through a dice roll. The two systems are intentionally independent:

- **Tick System** = deterministic strategic layer; the stream is always visible and fully plannable
- **Dice** = probabilistic resolution layer; what happens when you act is never guaranteed

### Resolution Rules
- Every skill triggers a dice roll on execution
- The roll determines **full resolution**: whether the skill lands (hit / miss / crit) and the magnitude of the effect (damage, healing, buff strength)
- Dice are **pure RNG** — no stat or resource modifies the roll
- This creates a core tension: perfect Tick planning vs unpredictable outcomes

> **Open design note**: Pure RNG with no player agency is the riskiest part of this system. Worth prototyping whether some form of variance mitigation (rerolls, build-based probability shifts) improves feel without undermining the framework.

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
- [x] Skill resolution → dice roll for full resolution (hit/miss/crit + magnitude); pure RNG; dice never affect Tick cost
- [x] Roster source → mix of pre-built, in-combat draft, and mode-assigned depending on mode
- [ ] What does "power" look like visually on the Tick stream?
- [ ] Can skills affect *enemy* Tick markers? (delay, interrupt, pull-forward)
- [ ] Resource types — what do they do, how do Tick-based regen intervals work?
- [ ] How does the multiversal setting factor into gameplay? (factions, zones, or pure flavour)
- [ ] Is there a narrative layer, or is progression purely systemic?
- [ ] What happens when the player loses a combat?
- [ ] Multiplayer / social, or single-player only?
- [ ] Monetisation model (if any)?
- [ ] Dice variance — pure RNG or some mitigation system?
