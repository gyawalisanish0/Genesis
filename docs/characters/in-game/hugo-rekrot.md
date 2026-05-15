# Hugo Rekrot

## Identity

| Field | Value |
|---|---|
| Species | Sekkar-human hybrid |
| Profession | Material Engineer |
| Combat Role | Front-line suit fighter |
| Rarity | 4 |
| Affiliation (game) | Commander's deployed team, Mars mission |
| Affiliation (2099–2109) | Sekkarian Defense Force — Fleet 13, Team 6 |
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

ANBOT was drafted at the military contracting firm where Hugo first worked after
graduation. He walked away from the firm — and from the people who wanted to
weaponise it — before it could be taken from him. He finished it on his own terms
inside the Sekkarian Defense Force.

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

Hugo is funny and precise — but not deliberately funny. The humor comes from
the gap between how seriously he takes himself and how often things go
spectacularly wrong around him.

He is **defensive by default**. When something fails he already has the
technical justification built before anyone asks. Precise language is his
shield — "the environmental variables were outside the test parameters" is
easier than admitting he miscalculated. Years of being underestimated as a
new recruit in institutions that couldn't keep up with him calcified this
habit. He pre-justifies everything before anyone can question it.

His school convention record — multiple failures from chaotic inventions —
follows him. The inventions were never wrong. The context just wasn't ready
for them. That's his position and he holds it.

**In battle, the near-death state strips all of that away.** When HP drops to
critical and Primal Awareness fires, Hugo goes quiet. No deflection, no
justification. Just him and the suit operating on instinct and biology. The
contrast is stark — the loudest person in the room suddenly becomes the
calmest presence on the battlefield.

### Voice notes

- Explains things nobody asked him to explain
- Corrects people mid-sentence with unnecessary precision
- Funny in spite of himself — the chaos finds him even when he's being careful
- At critical HP: clipped, calm, economical — a completely different register
- Does not take compliments well; redirects them to the suit

---

## Background

New recruit in the fleet — but a veteran by experience. He carries more field
knowledge than most of the people outranking him, and that gap is the source
of most of his friction.

**The arc:**

1. Troubled academic record — repeated school convention failures from
   inventions too ambitious for the environments they were tested in
2. Graduates → joins a military contracting firm as a material engineer
3. Drafts ANBOT at the firm — their resources give him what he needs to build
   it seriously for the first time
4. Realises what a weapon like that becomes in military hands — decides to walk
5. His best friend and colleague tries to convince him to stay, citing fame and
   wealth they could achieve together. Hugo refuses.
6. Leaves the firm. First contact with the Sekkarian Defense Force is not a
   recruitment — it is an abduction. They detected the ANBOT draft and treated
   it as a threat.
7. Eventually earns his place in the fleet. Finishes ANBOT fully there, on his
   own terms.

ANBOT is not sentimental to him. It is the proof he was right all along.

**Open threads (for later chapters):**
- The best friend who stayed at the firm — that relationship and where it goes
- The full circumstances of the abduction and what followed
- His hybrid upbringing and what being Sekkar-human means to him personally
- His relationship with the Commander

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
| AP Cost | 12 |
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
| Regen | 4% max HP every 10 ticks while shield is active |
| Break Penalty | If shield breaks within 9 turns of cast: overflow damage is doubled |
| Cooldown | 48 ticks — starts on shield break, not on activation |
| Restriction | Cannot cast while shield is already active |

The regen window rewards commitment — pop it early when HP is healthy for
maximum shield value and recovery time. Using it as a panic button at low HP
produces a thin shield that breaks easily, triggering both the doubled overflow
and the long cooldown at the worst possible moment.

Interaction with Primal Awareness: at 10% HP the shield is minimal. A burst
through it during the penalty window punishes hard when there is no HP left
to absorb the spike.

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
| Effect | 30% dodge chance vs ranged attacks |
| Duration | 15 ticks — 2 dodge charges |
| Cooldown | 20 ticks |

Grants 2 dodge charges. Each successful ranged dodge consumes one charge.
When both charges are spent the status expires. Use freely in the early and
mid fight — the charges are the resource that unlocks Hyper Mode later.

#### Hyper Mode
Replaces Normal Mode when **both** conditions are met:
- Primal Awareness is active (HP below 10%)
- Fewer than 2 dodge charges remain on the Normal Mode status (at least one ranged dodge already absorbed)

Action grid shows **Hyper Sense ★** with updated costs when this unlocks.

| Field | Value |
|---|---|
| AP Cost | 20 |
| TU Cost | 6 |
| Effect | 90% melee dodge / 50% ranged dodge for the Primal Awareness duration |
| On Expiry | Counter: 200% Power energy damage (energy, ranged) |
| Cooldown | 8 turns (shared slot — overwrites Normal Mode cooldown) |

The counter on expiry is automatic and always hits — it bypasses the dice
pipeline entirely. The Hyper Mode window ending is itself the trigger.

The intended sequence: cast Normal Mode early → absorb a ranged hit → enter
Primal Awareness at critical HP → Hyper Mode unlocks on the next Hyper Sense cast.

---

## Passive — Primal Awareness

> *When HP drops below 10%, ANBOT emergency-reroutes all nanite power into evasion.*

| Field | Value |
|---|---|
| Trigger | HP drops below 10% |
| Activation | Guaranteed — no RNG on trigger |
| Dodge Points | 5 stacks |
| Dodge Chance | 70% per hit attempt |
| Dodge Consumption | One stack consumed per incoming hit attempt (successful dodge or not) |
| AP Regen | Frozen for 3 of Hugo's own turns |
| Reactivation Gate | Cannot trigger again until AP returns to 80%+ and dodge status is gone |

**Biological basis**: Hugo's Sekkar skin receptors detect incoming attack
pressure shifts. ANBOT reads the signal and reroutes before the hit lands.
The 70% is not perfect — speed and angle still factor in.

**AP freeze logic**: rerouting nanites into evasion drains the suit's energy
reserves. AP regen is sacrificed for the survival window. With AP already
spent, the 20 AP cost of Hyper Sense becomes a meaningful decision.

**Reactivation gate**: prevents the passive from being a permanent escape
valve. Hugo must burn through the dodge window and rebuild his AP economy
before the safety net resets.

---

## Status IDs Referenced

| Status ID | Applied By | Purpose |
|---|---|---|
| `hugo_001_shelling_point_active` | Shelling Point | Shield HP pool + tick regen (56 HP / 10 turns) |
| `hugo_001_shelling_point_penalty_window` | Shelling Point | 9-turn penalty window — break during this doubles overflow damage |
| `hugo_001_primal_awareness_dodge` | Primal Awareness | 5-stack dodge at 70% per hit attempt, consumed per attempt |
| `hugo_001_ap_regen_freeze` | Primal Awareness | Halts AP regen for 3 turns |
| `hugo_001_hyper_sense_ranged_dodge` | Hyper Sense (Normal) | 30% ranged dodge; 2 stacks — each successful dodge consumes 1; expires at 0 |
| `hugo_001_hyper_sense_hyper_active` | Hyper Sense (Hyper) | 90% melee / 50% ranged dodge; onExpire fires 200% Power energy counter (always hits) |

---

## Animation Manifest

`public/data/characters/hugo_001/animations.json` defines all battle arena animations.

### Display

```json
"display": { "width": 160, "height": 180, "anchorX": 0.5, "anchorY": 1.0 }
```

- `meleeDashDx`: 80 px — how far the container shoves toward the target on melee attacks
- `idleSwapBelowHpPercent`: 0.4 — switches to `idle_damaged` state when HP < 40%
- `tagMap`: `{ "melee": "melee_attack" }` — maps the `melee` skill tag to `melee_attack` animation

### Animation states

| State | Frames | FPS | Repeat | Aura | Notes |
|---|---|---|---|---|---|
| `idle` | 6 | 8 | -1 (loop) | — | ✅ Done |
| `idle_damaged` | 4 | 6 | -1 (loop) | Red pulse (danger, ADD, r=88, α=0.45, period=1600ms) | ✅ Done |
| `hurt` | — | 10 | 0 (once) | — | ✅ Done |
| `hurt_damaged` | — | 10 | 0 (once) | — | ✅ Done |
| `dodge` | — | 12 | 0 (once) | — | ✅ Done |
| `dodge_damaged` | — | 12 | 0 (once) | — | ✅ Done |
| `dash` | 1 | — | 0 (once) | — | ✅ Done — held as static pose during shove tween |
| `dash_damaged` | 1 | — | 0 (once) | — | ✅ Done |
| `death` | — | 8 | 0 (once) | — | ⬜ Pending |
| `death_damaged` | — | 8 | 0 (once) | — | ⬜ Pending |

### Skill animation states

| Skill | Frames | FPS | Aura | Sequence | Notes |
|---|---|---|---|---|---|
| `hugo_001_basic_attack` | — | 12 | — | Strike | ✅ Done |
| `hugo_001_basic_attack_damaged` | — | 12 | — | Strike | ✅ Done |
| `hugo_001_nanites_slash` | — | 12 | — | Blade form → dash → slash | ⬜ Pending |
| `hugo_001_nanites_slash_damaged` | — | 12 | — | Blade form → dash → slash | ⬜ Pending |
| `hugo_001_hammer_bash` | — | 10 | — | Dash → hammer form → smash | ⬜ Pending |
| `hugo_001_hammer_bash_damaged` | — | 10 | — | Dash → hammer form → smash | ⬜ Pending |
| `hugo_001_shelling_point` | — | 8 | — | Idle pose + shield-forming VFX | ⬜ Pending — no distinct body animation; nanite shimmer + shield glow carries it |
| `hugo_001_shelling_point_damaged` | — | 8 | — | Idle pose + shield-forming VFX | ⬜ Pending |
| `hugo_001_hyper_sense` | — | 8 | Gold rapid-pulse (gold, ADD, r=120, α=0.75, period=900ms) | Idle pose + gold aura | ⬜ Pending — aura carries the cast; no distinct body animation |
| `hugo_001_hyper_sense_damaged` | — | 8 | Gold rapid-pulse (same) | Idle pose + gold aura | ⬜ Pending |
| `hugo_001_hyper_sense_hyper` | — | 10 | Intense gold aura | Energy release | ⬜ Pending — expiry counter: distinct animation for the 200% Power energy burst |

### Attack animation design notes

**Nanites Slash** — weapon forms *before* movement. ANBOT's nanite mass reshapes the arm into a blade while still in place, then dashes and cuts through the target in one motion. The blade form is the windup; the dash+slash is the release.

**Hammer Bash** — commitment first, weapon second. ANBOT dashes toward the target with no formed weapon, then consolidates nanite mass mid-approach into a crushing hammer limb and drives it down. The weapon forms during the dash, not before it.

**Shelling Point** — no body animation. Cast reads as idle pose while nanite particles shimmer and a shield shell solidifies around the character. VFX-driven entirely.

**Hyper Sense (Normal)** — no body animation. Gold aura pulse communicates the heightened defensive state. Cast reads as idle + aura activation.

**Hyper Sense (Hyper Mode expiry)** — the passive counter fires automatically when the status expires. Needs a distinct energy-release animation: stored energy venting outward as the nanite mass channels a focused 200% Power burst.

### Aura design rationale

**`idle_damaged` aura** — red pulsing glow signals the critical HP threshold.
The slow pulse (1600 ms) reads as danger/distress. Matches the narrative beat
where Primal Awareness fires and Hugo goes into survival mode.

**`hyper_sense` aura** — gold rapid-pulse signals an active defensive posture.
The fast pulse (900 ms) reads as heightened alertness/energy. Matches the
biological hyper-sensitivity of Sekkar receptors under the Hyper Sense skill.

`projectile: null` — Hugo has no ranged attack; melee only.

## Engine Implementation Notes

All core mechanics are fully wired. No known approximations.

---

## Status

Kit complete. Engine wired. Personality documented. Backstory foundation laid.
Commander relationship and best-friend thread reserved for later chapters.
