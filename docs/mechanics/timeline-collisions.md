# Timeline Collisions

When two or more units share the same tick position the battle engine
resolves the conflict before advancing the phase. There are three
interlocking mechanics, ordered by priority:

1. **Tick occupancy cap + D8 displacement** — prevents more than 4 units
   occupying a single tick slot.
2. **Same-team collision** — allies at the same tick are ordered by Speed;
   tied Speed triggers a Now/Later player-choice prompt.
3. **Cross-team clash QTE** — opposing units at the same tick compete in a
   spinning-knob reaction mini-game to determine who acts first.

---

## 1. Tick Occupancy Cap (`TICK_MAX_OCCUPANCY = 4`)

`registerTick` passes every incoming tick position through
`resolveTickDisplacement` in `src/core/combat/TickDisplacer.ts` before
committing it to state.

### D8 probability table

| Magnitude | Direction probability | Combined probability |
|:---------:|:---------------------:|:--------------------:|
| ±1        | 30% each              | 60% total            |
| ±2        | 12.5% each            | 25% total            |
| ±3        | 5% each               | 10% total            |
| ±4        | 2.5% each             | 5% total             |

`rollD8Displacement()` samples a magnitude via `Math.random()` against
cumulative thresholds `[0.60, 0.85, 0.95, 1.00]`, then multiplies by
`Math.random() < 0.5 ? -1 : 1` for direction.

### Cascade

If the displaced tick is also full, the displacement is applied again from
that tick — cascading until a non-full slot is found (or a safety cap of
64 iterations is reached). Tick positions are clamped to ≥ 0.

---

## 2. Same-Team Collision

Triggered when `activeUnitIds` contains two or more units from the same
team at the same tick.

### Enemy-only collision

Resolved automatically: enemies are sorted by `stats.speed` descending and
the AI loop iterates in that order. No player prompt.

### Player-ally collision (current 1P build: only 1 ally, kept for future)

| Speeds    | Resolution                                           |
|-----------|------------------------------------------------------|
| Different | Faster unit acts first; phase is set to `'player'`   |
| Tied      | `pendingTeamCollision` is set → Now/Later overlay appears |

#### Now/Later rules

Both choices are offered one unit at a time (sequentially in 1P build):

| Unit 1 | Unit 2 | Outcome                                                         |
|--------|--------|-----------------------------------------------------------------|
| Now    | Later  | Now unit acts first; Later unit's tick is advanced by +1        |
| Now    | Now    | Both act this tick (D2 log for tiebreak, both in same `'player'` phase) |
| Later  | Now    | Same as Now/Later above, in reverse order                       |
| Later  | Later  | Both advance +1 (displacement checks apply to both)             |

`resolveTeamCollision` in `BattleContext` calls `registerTick(id, tick + 1)`
for every `'later'` unit, which in turn runs the displacement check.

---

## 3. Cross-Team Clash QTE

Triggered when `activeUnitIds` contains at least one player unit **and** at
least one enemy unit simultaneously.

A `pendingClash` state (`ClashState`) is set and the `ClashQteOverlay` is
shown. Phase stays in `'resolving'` until the overlay calls `resolveClash`.

### Knob spin

The knob rotates at `QTE_KNOB_RPM = 90` rpm (≈ 1 revolution per 667 ms).
The angle at the moment the player taps is computed from elapsed wall-clock
time:

```
angle = ((Date.now() - startTime) % QTE_PERIOD_MS) / QTE_PERIOD_MS * 360
```

### Target zone

A fixed `QTE_TARGET_ZONE_DEG = 60°` arc is rendered on the dial.
A tap is a **hit** when:

```
normalised = ((angle − zoneStart) mod 360 + 360) mod 360
hit         = normalised ≤ QTE_TARGET_ZONE_DEG
```

### Bar mechanics

The tug-of-war bar starts at 0.5 (centred).

| Event       | Bar shift                                                  |
|-------------|------------------------------------------------------------|
| Tap hit     | `QTE_BAR_FILL_PER_HIT + (teamSize − 1) × QTE_BAR_ALLY_WEIGHT_BONUS` toward the tapper's side |
| Tap miss    | No shift                                                   |

Constants:
- `QTE_BAR_FILL_PER_HIT = 0.18`
- `QTE_BAR_ALLY_WEIGHT_BONUS = 0.05` per **additional** same-team unit on the tick

### AI behaviour

After `QTE_AI_TAP_DELAY_MS = 1200` ms the AI auto-taps with
`AI_QTE_ACCURACY = 0.65` hit probability.

### Resolution

After `QTE_ROUNDS = 3` rounds each, the side with bar > 0.5 wins. A tie
(`barValue === 0.5`) is broken by a D2 roll. The winner's team acts first:
- Player wins → `setPhase('player')`
- Enemy wins → `setPhase('enemy')`

---

## Constants reference

| Constant                   | Value | Purpose                                   |
|----------------------------|-------|-------------------------------------------|
| `TICK_MAX_OCCUPANCY`       | 4     | Max units per tick before displacement    |
| `QTE_KNOB_RPM`             | 90    | Knob spin speed (1.5 rps)                 |
| `QTE_TARGET_ZONE_DEG`      | 60    | Target arc width in degrees               |
| `QTE_ROUNDS`               | 3     | Tap rounds per QTE                        |
| `QTE_BAR_FILL_PER_HIT`     | 0.18  | Bar shift per successful tap              |
| `QTE_BAR_ALLY_WEIGHT_BONUS`| 0.05  | Extra shift per additional ally on tick   |
| `AI_QTE_ACCURACY`          | 0.65  | AI hit probability                        |
| `QTE_AI_TAP_DELAY_MS`      | 1200  | ms before AI taps each round              |

All constants live in `src/core/constants.ts`.
Displacement logic lives in `src/core/combat/TickDisplacer.ts`.
