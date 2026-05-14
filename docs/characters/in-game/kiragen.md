# Kiragen — In-Game Characters

Character definitions for both Kiragen types used in the demo campaign.
Kiragen appear exclusively in Stage 3.

---

## Kiragen Combatant (`kiragen_combatant_001`)

### Identity

| Field | Value |
|---|---|
| Species | Kiragen |
| Role | Tech-integrated direct combat soldier |
| Combat identity | Adaptive threat — becomes exponentially more dangerous the longer the fight runs |
| Class | Ranger |
| Rarity | 3 |
| Data ID | `kiragen_combatant_001` |

### Passive — Tactical Scan

> *Every move the opposition makes is data. The longer the Kiragen
> watches, the less it misses.*

The Kiragen combatant maintains a **Context Bar** that fills as the
opposing team acts. The bar is a live value — thresholds are active
while the bar is at or above them and deactivate if it drops back below.
Temporary effects (such as the controller's **Intell**) can add to the
bar for a duration then fall off; the base accumulation from opponent
actions is permanent.

**Fill rate:** 4–8% per opponent action (random per action). All
player-side units contribute — Hugo, Husty, and Tara each fill the
bar independently on their turns.

**Threshold timing** (approximate, with all 3 player units acting):

| Threshold | Approx. player actions to reach |
|---|---|
| 30% | 4–8 actions |
| 70% | 9–18 actions |
| 100% | 13–25 actions |

The 4–8% randomisation means the player cannot calculate exactly when
the Kiragen tips over a threshold. They know the pressure is building —
they don't know how fast.

**Thresholds:**

| Context Bar | Effect |
|---|---|
| 30%+ | Dodge chance → 40% |
| 70%+ | Dodge chance → 55% · Deflect 30% of incoming damage (blocked) at 15% chance |
| 100% | Dodge chance → 60% · Deflect 35% of incoming damage (blocked) at 18% chance · Critical chance 10% at 300% of own skill base damage |

**Deflect** blocks a portion of incoming damage — it is not reflected
back to the attacker. The Kiragen simply absorbs less.

**Critical** at 100% applies to the Kiragen's own skill actions only —
10% chance any of their attacks deals 300% of that skill's base damage.

### Stats

| Stat | Value |
|---|---|
| STR | 15 |
| END | 30 |
| PWR | 65 |
| RES | 50 |
| SPD | 35 |
| PRC | 55 |
| HP | 180 |
| AP | 85 |
| AP Regen | 0.60 / tick |

### Skills

#### Plasma Beam
| Field | Value |
|---|---|
| AP Cost | 18 |
| TU Cost | 15 |
| Damage | 70% PWR (energy, ranged) |
| Base Chance | 0.89 |
| On-hit effect | 10% chance to stun target for 2 turns |
| Tags | `energy`, `ranged` |

Stun restricts the target to Skip only. The stunned unit's skip TU cost
is determined by the applying status's `forcedSkipTuCost` payload key
(overrides the global `SKIP_TU_COST` default of 10).

#### Rescan
| Field | Value |
|---|---|
| AP Cost | 12 |
| TU Cost | 20 |
| Base Chance | — (self-cast, no accuracy roll) |
| Available | After the combatant's own 5th action (`minTurns: 5`) |
| Cooldown | 8 turns (`turnCooldown: 8`) |
| Tags | `buff`, `self` |

On cast, compare the combatant's current AP% and Context Bar%:

- If AP% > Context Bar% → Context Bar is raised to AP%
- If Context Bar% > AP% → AP is raised to match Context Bar%

Whichever resource is lagging gets pulled up to the higher one. Both
values are expressed as a percentage of their respective maximums
(AP/maxAP, Context Bar/100).

**Strategic pressure it creates:**

The cooldown and 3-turn gate mean Rescan cannot appear before mid-fight.
Once available it becomes a dual threat:

- A combatant sitting at high AP can spike its own Context Bar past a
  threshold the player thought was still safe — no additional player
  actions required.
- A combatant with a depleted AP bar but a high Context Bar refills
  to fighting capacity in one cast, forcing the player to re-evaluate
  AP-drain strategies.

`minTurns: 5` — locks Rescan until the combatant has taken at least 5
actions in the current battle. Engine support required (new field, not yet
in CooldownResolver).

---

## Kiragen Controller (`kiragen_controller_001`)

### Identity

| Field | Value |
|---|---|
| Species | Kiragen |
| Role | Signal operator — maintains Netrolume frequency lock |
| Combat identity | TBD |
| Class | Enchanter |
| Rarity | 3 |
| Data ID | `kiragen_controller_001` |

### Passive — Vast Influence

> *The signal doesn't stop at one. Every frequency point the controller
> holds, the whole pack holds.*

The Kiragen controller broadcasts a shared frequency level to all
Netrolume allies on the field. The broadcast is additive with each
unit's own Hertz Beats points — no ceiling on total frequency.

**Progression:**

| Trigger | Frequency Points |
|---|---|
| Battle start | 1 |
| Tick 15 | 2 |
| Each counter the controller triggers | +1 (cap: 5 total) |

**Broadcast effect:** All Netrolume allies on the field inherit the
controller's current frequency count on top of their own Hertz Beats.
Each point reduces all action TU costs by 10% of that skill's base TU.

**Example at 4 broadcast points:**

| Unit | Own Hertz Beats | Total Points | TU Reduction |
|---|---|---|---|
| Netrolume Grunt | 1 | 5 | −50% |
| Netrolume Elite | 2 | 6 | −60% |
| Netrolume Elite + Great Growl | 4 | 8 | −80% |

At maximum broadcast (5 points) these values increase by one step each.
An Elite mid-Great Growl with a max-broadcast controller reaches 9 total
frequency points — −90% TU on all actions.

**Strategic pressure:**

The tick ramp is slow and passive — 2 points by tick 15 is threatening
but manageable. The counter ramp is fast and player-triggered: every
attack on the controller that it counters pushes the broadcast higher.
Three counters from tick 15 onward hits the cap.

The player must kill the controller quickly, but attacking it is exactly
what accelerates the frequency. The correct response is burst — enough
damage to kill it before it can counter repeatedly.

### Stats

TBD

### Skills

#### Data Pulse
| Field | Value |
|---|---|
| AP Cost | 40 |
| TU Cost | 15 |
| Damage | 15% PWR (energy, ranged) per target |
| Target | All opposition units (AoE) |
| Base Chance | — (hits all; individual debuff chances below) |
| Tags | `energy`, `ranged`, `aoe` |

Applies two independent effects on cast:

**Virus** — each target hit has a 10% independent chance to receive a
debuff reducing the accuracy of all their skills by 6% for 8 ticks.
Multiple targets can each proc independently.

**Intell** — temporarily adds 4% to the Context Bar of all Kiragen
Combatants on the field for 5 ticks. The addition is a live overlay —
it can push the bar over a threshold for the window's duration, but
falls off cleanly when the 5 ticks expire.

The high AP cost (40) means the controller cannot cycle Data Pulse
freely. Each cast is a deliberate decision — the Virus spread and Intell
window must count.

#### Critical Spawn
| Field | Value |
|---|---|
| AP Cost | 34 |
| TU Cost | 20 |
| Base Chance | — (no accuracy roll) |
| Tags | `summon`, `buff`, `uniqueCounter` |

This skill has two independent spawn states and a distinct counter
behaviour — active cast and counter trigger each track their own
first-use flag.

**Active cast — first use:** Spawns a **Netrolume Grunt** into the
battle. The grunt enters with full stats and its own tick position.

**Active cast — subsequent uses:** Grants all Netrolume currently on
the field **10% critical chance for 7 ticks**. Critical damage is
**180% of the attacking Netrolume's STR**.

**Counter — first trigger:** Spawns a **Netrolume Elite** that
immediately executes a normal attack against the attacker before taking
its own position on the tick stream.

**Counter — subsequent triggers:** Applies a **−20% base accuracy
reduction** to the attacker for 6 ticks (all their skills are affected).

**Spawn independence:** The active and counter spawn flags are tracked
separately. The grunt and elite can both enter the field in the same
battle — the controller may field up to 2 additional Netrolume through
this skill alone, on top of any already present in the encounter.

---

## Design Notes

- Both Kiragen types are human-looking with greyish-green skin. No
  visual tells that distinguish them from a distance except context.
- Tech integration is internal — they carry no visible weapons or
  equipment. Everything they do comes from within.
- **Tactical Scan** rewards aggressive play: burst the combatant down
  before 70% Context Bar if possible. A combatant that reaches 100%
  in a 3v1 is a genuine crisis — 60% dodge, deflect on top, and a
  10% chance of triple damage on every swing.
- Stage 3 will typically feature both a combatant and a controller
  in the same encounter. The correct priority target order is a key
  tactical decision the player has to make.
