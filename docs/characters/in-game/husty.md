# Husty

## Identity

| Field | Value |
|---|---|
| Species | Unknown — small, green-hued, ogre-adjacent |
| Profession | Physicist |
| Combat Role | Ranged energy disruptor |
| Rarity | 3 |
| Affiliation | Sekkarian Defense Force — Fleet 13, Team 6 |
| Data ID | `husty_001` |

Team 6's physicist and resident intellect. He has already done the math on most questions by the time anyone else thinks to ask them.

---

## Appearance

Small. Green-hued skin. Large round eyes. Facial structure that reads as ogre-adjacent until eye contact is made — at which point the intelligence behind the expression recalibrates everything else. The gap between first impression and second impression is part of how he moves through rooms.

---

## Personality

Husty operates at a pace that other people's conversations cannot fully reach. He is not impatient in the way someone becomes impatient when things go wrong — he is impatient the way a person becomes impatient when the answer is already obvious and formality requires waiting anyway.

He is precise without being unkind. When he tells Hugo his secondary coolant design has two flaws, it is not criticism — it is information. The offer to discuss it later is genuine. He simply cannot discuss it until lab clearance is sorted, and flagging it now costs nothing.

He holds his IQ the way some people hold a tool they use constantly: without ceremony, because ceremony would be redundant.

### Voice notes

- States conclusions before context — assumes the other person will catch up
- Offers critiques as facts rather than opinions, with no edge behind them
- Does not explain his reasoning unless asked — he has already explained it internally
- Unhurried in speech despite impatience in thought; the two coexist
- Slight, dry humour that lands quietly and without announcement

---

## Background

Member of Team 6, Sekkarian Defense Force, Fleet 13. His species is not yet documented — he is the first of his kind introduced in the story.

His IQ is cited at 300+ by Zorin during introductions. He does not confirm or deny this. He had already reviewed Hugo Rekrot's publicly available research papers and three patent filings before Hugo arrived on the ship — not as preparation, but out of habitual professional interest.

His open question — the two specific flaws in Hugo's secondary coolant calculation — is planted and unresolved.

**Open threads:**

- The two specific flaws in Hugo's coolant calculation — what they are, and what Husty knows that Hugo doesn't
- His species — unnamed, uncharacterized beyond appearance
- His history with the Defense Force — how long, why, what he's seen
- His relationship with Arina (fellow specialist; how two people operating at extreme precision interact)

---

## Combat Identity

Husty is a control-and-burst caster. He does not win through sustained output — he wins through resource management, positioning control, and a single high-power window that he earns by playing patiently.

His Power Surge mechanic accumulates passively every turn. Cached Shockwave cashes it all at once. The question is never *whether* to use it — it is *when the window is right* and whether the target's evasion will cost him half the payoff.

Neural Barrier gives him a defensive layer and a precision debuff simultaneously — a dual-purpose cooldown that rewards using it proactively rather than reactively.

Precise Calibration rewards AP discipline. Spend efficiently, reach 60 cumulative AP spent, gain a significant precision window. Then the cycle resets.

**Playstyle arc:**

1. Open with **Disruption** to lock enemy movement and deal immediate AoE energy damage
2. Use **Neural Barrier** when enemy pressure builds — shield absorbs incoming, debuff pressures their accuracy
3. Let **Power Surge** accumulate through the midgame; play **Basic Attack** and cooldown management around it
4. Watch the AP accumulator — when Precise Calibration procs, the +80 Precision window is the right moment to cast **Cached Shockwave**
5. Repeat the cycle: Surge resets on cast, AP accumulator resets on proc, Neural Barrier refreshes on cooldown

---

## Kit Reference

### Basic Attack
> *A focused energy burst — fast, reliable, no cost beyond time.*

| Field | Value |
|---|---|
| AP Cost | 0 |
| TU Cost | 11 |
| Damage | 40% Power (energy, ranged) |
| Max Level | 1 |

No frills. Fills turns during cooldown gaps and keeps AP available for the skills that matter.

---

### Disruption
> *A psychic burst that scrambles motor-nerve signals. Deals energy damage and locks all movement skills on the target team.*

| Field | Value |
|---|---|
| AP Cost | 16 |
| TU Cost | 12 |
| Damage | 15 flat + 20% Power (energy, ranged) — hits all enemies |
| On Hit | Applies Movement Lock to all enemies for 15 ticks |
| Max Level | 5 |
| Scaling | Power component: 20 → 28 → 36 → 46 → 58% |

The opener. Locks enemy repositioning for 15 ticks while dealing immediate AoE energy damage. At higher levels the damage component becomes meaningful on its own. The movement lock matters most against enemies with displacement or gap-closing skills.

---

### Cached Shockwave
> *Releases all stored Power Surge as a focused energy blast. Full hit lands at full surge value; evaded attacks still deal partial damage — a shockwave can't be fully dodged.*

| Field | Value |
|---|---|
| AP Cost | 25 |
| TU Cost | 16 |
| On Hit | 250% Surge + 15% Power (energy, ranged) |
| On Evade | 125% Surge + 15% Power (energy, ranged) |
| On Cast | Power Surge status resets; surge resets to 0 |
| Tick Cooldown | 25 ticks |
| Max Level | 1 |

The kit's damage ceiling. Output scales entirely with accumulated surge — larger windows produce dramatically higher numbers. The partial-damage guarantee on evade removes the sting of bad dice, but halving the surge payoff on a miss is a meaningful cost.

Surge resets on cast regardless of outcome. Timing the cast around the Precise Calibration precision window maximises hit chance on the full-damage version.

**Power Surge** (the status this skill fires through):
- Accumulates 1–5 surge per Husty's own turn start, randomly
- Cap: 45
- Duration: permanent (refreshes on battle start)

---

### Neural Barrier
> *A psychic field that absorbs damage and scrambles enemy sensors. Grants a shield on hit and reduces all enemies' accuracy.*

| Field | Value |
|---|---|
| AP Cost | 14 |
| TU Cost | 12 |
| On Hit — Self | Gains a flat HP shield |
| On Hit — All Enemies | Applies Neural Disruption: −15% Precision for 8 ticks |
| Turn Cooldown | 5 turns |
| Max Level | 5 |
| Shield Scaling | 20 → 30 → 45 → 60 → 80 HP |

Dual-purpose. The shield buys survival; the precision debuff taxes enemy accuracy for the next 8 ticks — a wide window that covers most of a combat phase. Best used proactively when ahead on HP, not as a panic button. The 5-turn cooldown is the main constraint; missing the timing window has a real cost.

**Neural Disruption** (the debuff applied to enemies):
- −15% Precision at apply, +15% restored at expire
- Duration: 8 ticks
- Stacking: refresh

---

## Passive — Precise Calibration

> *Husty's combat calculations are never approximate. AP spent in battle feeds a firing solution that locks in accuracy for the whole party.*

| Field | Value |
|---|---|
| Battle Start | Applies **Power Surge** status to self (permanent) |
| Proc Condition | 60 cumulative AP spent since last proc |
| Proc Effect | Applies **Precise Calibration** buff to **all allies**: +80% base accuracy on ranged skills for 4 turns |
| Gate | Will not proc while the buff is already active |
| Reset | AP accumulator clears to 0 on proc |

Two mechanics live in this passive.

**Power Surge** is the Cached Shockwave fuel system — applied at battle start, accumulates 1–5 per turn, capped at 45. Without this passive, Cached Shockwave has nothing to release.

**Precise Calibration** rewards AP economy. Every skill spend counts toward the 60 AP threshold. When it procs, the entire party's ranged skills gain +0.8 added directly to `baseChance` in the hit resolution formula (`finalChance = precision/100 × (baseChance + 0.8)`). For most party members this pushes ranged hit chance near or above 1.0 — effectively guaranteeing hits for 4 turns. The window is the right moment to dump Cached Shockwave.

After the buff expires, the gate lifts and the accumulator resumes. The cycle is predictable and plannable.

---

## Status IDs Referenced

| Status ID | Applied By | Purpose |
|---|---|---|
| `husty_001_power_surge` | Precise Calibration (battle start) | Accumulates surge: +1–5 per turn, max 45 |
| `husty_001_precision_buff` | Precise Calibration (on 60 AP spent) | +80 Precision for 4 turns; gates next proc |
| `husty_001_movement_block` | Disruption (on hit) | Locks movement-tagged skills for 15 ticks |
| `husty_001_neural_barrier` | Neural Barrier (on hit, self) | Flat HP shield carrier; no effect entries |
| `husty_001_neural_disruption` | Neural Barrier (on hit, all-enemies) | −15% Precision for 8 ticks |

---

## Engine Implementation Notes

All core mechanics are wired. `deltaPercent` on `modifyStat` handles the Neural Disruption precision debuff (percentage-based, not flat). AP accumulation is tracked via `unit.apSpentAccum`; the `onApSpent` event fires after every AP deduction in the battle engine; `resetApAccum` clears the counter on proc.

---

## Status

Kit complete. Engine wired. Personality documented. Species, personal history, and the coolant calculation thread reserved for later chapters.
