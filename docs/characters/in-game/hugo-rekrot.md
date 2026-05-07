# Hugo Rekrot

## Identity

| Field | Value |
|---|---|
| Species | Sekkar-human hybrid |
| Profession | Material Engineer |
| Combat Role | Front-line suit fighter |
| Rarity | 4 |
| Affiliation | Commander's deployed team — Mars mission |
| Data ID | `hugo_001` |

First playable character in Genesis.

---

## ANBOT — Advance Nano Based Omni Tech

Hugo does not fight directly. He fights through ANBOT — a nanite-based battle
suit of his own invention. The suit wraps him completely and reshapes on the fly,
forming weapons, shields, and evasion structures from a living mass of nanites.

ANBOT is inspired by the same principle as venom symbiosis: the suit and the
wearer act as one. Hugo's commands are instant — there is no interface, no
delay. The nanites respond to intent.

Hugo built ANBOT himself. The backstory behind its creation is developed
separately — see future lore entries.

---

## Appearance

Humanoid. Carries both human and Sekkar traits. When ANBOT is active the suit
envelops him — the surface shifts and extends as needed. The visual identity
of the suit versus the man beneath is part of ongoing character design.

Sekkars carry scale skin along their backs. Whether Hugo inherits this fully
or partially as a hybrid is still being defined visually.

---

## Sekkar Biology in Combat

Hugo's Sekkar side gives him hypersensitive skin receptors and an efficient
neural network capable of detecting slight changes in air pressure. This is
not a learned skill — it is inherited physiology.

In battle, these receptors detect incoming attacks a fraction of a second
before impact. ANBOT reads that signal and reroutes nanite density into an
evasion configuration within that window. The suit reacts before Hugo's
conscious mind finishes processing the threat.

This biological trait is the foundation of **Primal Awareness** and feeds
directly into **Hyper Sense**. It may surface in other ways as the character
develops.

---

## Personality

TBD — to be developed in the next design session.

---

## Background

Hugo invented ANBOT. The circumstances behind its creation, his path to the
Mars mission, and what he carries from his hybrid upbringing are all in
development.

---

## Combat Identity

Hugo is a last-stand fighter. His kit is not about dominating early — it is
about surviving long enough to become dangerous. The closer he gets to death,
the harder he is to finish.

His Sekkar biology and ANBOT integration mean that the threat window is real:
a Hugo at 10% HP with Primal Awareness active, dodge points burning, and Hyper
Sense available is a genuine crisis for the opponent.

**Playstyle arc:**

1. Use **Nanites Slash** and **Hammer Bash** to apply pressure and trade damage
2. Deploy **Shelling Point** proactively while HP is high — the shield is thicker and the regen window is longer
3. Survive into the 10% threshold — **Primal Awareness** fires automatically
4. Read the dodge points — if burning fast, shift **Hyper Sense** to Hyper Mode
5. Let the Hyper Mode window expire into the 200% Power energy counter

---

## Kit Reference

### Nanites Slash
> *ANBOT reshapes its nanite mass into a blade and slashes the target.*

| Field | Value |
|---|---|
| AP Cost | 15 |
| TU Cost | 8 |
| Damage | 60% STR (physical, melee) |
| Max Level | 5 |
| Scaling | 60 → 72 → 85 → 100 → 115% STR |

Basic offensive skill. Reliable hit chance, no cooldown. The bread-and-butter
action for ticking down the AP economy.

---

### Hammer Bash
> *ANBOT consolidates its nanite mass into a crushing hammer limb and drives it into the target.*

| Field | Value |
|---|---|
| AP Cost | 25 |
| TU Cost | 13 |
| Damage | 125% STR (physical, melee) |
| Cooldown | 2 turns |
| Max Level | 5 |
| Scaling | 125 → 140 → 158 → 178 → 200% STR |

The heavy hit. High tick cost means a long wait after use. The 2-turn cooldown
prevents spam — use it when a big window opens, not as a rotation filler.

---

### Shelling Point
> *ANBOT redistributes nanite density into a protective shell.*

| Field | Value |
|---|---|
| AP Cost | 20 |
| TU Cost | 6 |
| Shield | 25% of current HP |
| Regen | 4% max HP per 10 ticks while shield is active |
| Break Penalty | The hit that shatters the shield deals 2× damage to Hugo |
| Cooldown | 48 ticks — starts on shield break (not on activation) |

**Design note**: The cooldown is unusual — it is silent on cast and begins only
when the shield breaks. If the shield never breaks, there is no cooldown.
This mechanic requires engine support beyond the standard tickCooldown field.

The regen window rewards commitment — pop it early when HP is healthy for
maximum shield value and recovery time. Using it as a panic button at low HP
produces a thin shield that breaks easily, triggering both the 2× spike and the
long cooldown at the worst possible moment.

Interaction with Primal Awareness: at 10% HP the shield is minimal. A burst
through it punishes hard when there is no HP left to absorb the 2× hit.

---

### Hyper Sense
> *ANBOT amplifies Sekkar receptor sensitivity into a defensive posture.*

This skill has two modes. The mode available depends on combat state.

#### Normal Mode
Active when Primal Awareness is **not** running.

| Field | Value |
|---|---|
| AP Cost | 10 |
| TU Cost | 7 |
| Effect | 30% dodge chance vs all ranged attacks for 15 ticks |
| Cooldown | 20 ticks |

Solid utility option in the early and mid fight. Low cost, ranged coverage,
regular cooldown. Use freely.

#### Hyper Mode
Replaces Normal Mode when **both** conditions are met:
- Primal Awareness is active (HP below 10%)
- Fewer than 2 dodge points remaining

| Field | Value |
|---|---|
| AP Cost | 20 |
| TU Cost | 6 |
| Effect | 90% melee dodge / 50% ranged dodge for the Primal Awareness duration |
| On Expiry | Counter: 200% Power energy damage |
| Cooldown | 8 turns |

**Design note**: Hyper Mode is tied to the Primal Awareness window — it expires
when the passive expires. The cost, TU, and cooldown differ from Normal Mode.
Conditional cost-switching requires engine support.

The counter on expiry is automatic — no additional input. The Hyper Mode window
ending is itself the trigger.

---

## Passive — Primal Awareness

> *When HP drops below 10%, ANBOT emergency-reroutes all nanite power into evasion.*

| Field | Value |
|---|---|
| Trigger | HP drops below 10% |
| Activation | Guaranteed — no RNG on trigger |
| Dodge Points | 5 |
| Dodge Chance | 70% per hit attempt |
| Dodge Consumption | One point consumed per incoming hit attempt (successful dodge or not) |
| AP Regen | Frozen for 3 of Hugo's own turns |
| Reactivation Gate | Cannot trigger again until AP returns to 80%+ |

**Biological basis**: Hugo's Sekkar skin receptors detect incoming attack
pressure shifts. ANBOT reads the signal and reroutes before the hit lands.
The 70% is not perfect — speed and angle still factor in.

**AP freeze logic**: rerouting nanites into evasion drains the suit's energy
reserves. AP regen is sacrificed for the survival window. With AP already
spent, the 20 AP cost of Hyper Sense becomes a meaningful decision.

**Reactivation gate**: prevents the passive from being a permanent escape
valve. Hugo must rebuild his AP economy before the safety net resets.

---

## Status IDs Referenced

These statuses are applied by Hugo's skills and passive. Each requires a
status definition file to be authored separately.

| Status ID | Applied By | Purpose |
|---|---|---|
| `hugo_001_shelling_point_active` | Shelling Point | Carries shield HP, tick regen, break penalty logic |
| `hugo_001_primal_awareness_dodge` | Primal Awareness | 5-stack dodge at 70% per hit attempt |
| `hugo_001_ap_regen_freeze` | Primal Awareness | Halts AP regen for 3 turns |
| `hugo_001_hyper_sense_ranged_dodge` | Hyper Sense (Normal) | 30% ranged dodge for 15 ticks |
| `hugo_001_hyper_sense_hyper_active` | Hyper Sense (Hyper) | 90% melee / 50% ranged dodge + end-of-duration counter |

---

## Engine Work Required

| Mechanic | Skill | Notes |
|---|---|---|
| Break-triggered cooldown | Shelling Point | Cooldown starts on shield break, not on cast |
| Conditional cost-switching | Hyper Sense | AP cost and TU cost differ between Normal and Hyper mode |
| Shield absorption + break penalty | Shelling Point status | Requires `onTakeDamage` shield logic in status engine |
| Dodge point stacks with per-attempt consumption | Primal Awareness status | Stacked status with 70% chance, consumed on each hit attempt |
| AP regen halt | Primal Awareness status | `apRegenRate` is not a current StatKey — needs engine support |

---

## Status

Kit locked. Personality in development. Backstory TBD.
