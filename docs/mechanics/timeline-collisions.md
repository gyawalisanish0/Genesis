# Timeline Collisions

When two or more units land on the same tick position the battle engine
resolves the conflict before advancing the phase. There are three
interlocking mechanics, ordered by priority:

1. **Tick occupancy cap + D8 displacement** — no more than 4 units may share
   a tick slot. The 5th incoming unit is cascaded to an open slot.
2. **Same-team collision** — allies sharing a tick are ordered by Speed; ties
   trigger a Now/Later player-choice prompt.
3. **Cross-team clash** — opposing units sharing a tick compete via a speed
   comparison + weighted dice. The winner's team acts first; no one is
   displaced — the loser still acts on the same tick, just second.

---

## 1. Tick Occupancy Cap (`TICK_MAX_OCCUPANCY = 4`)

Every call to `registerTick` passes through `resolveTickDisplacement` in
`src/core/combat/TickDisplacer.ts` before the tick is committed to state.

### D8 probability table

| Magnitude | Each-direction probability | Total |
|:---------:|:--------------------------:|:-----:|
| ±1        | 30 %                       | 60 %  |
| ±2        | 12.5 %                     | 25 %  |
| ±3        | 5 %                        | 10 %  |
| ±4        | 2.5 %                      | 5 %   |

If the displaced tick is also full the offset is applied again (cascade).
Tick positions are clamped to ≥ 0. A 64-iteration safety cap prevents
infinite loops in degenerate all-full scenarios.

---

## 2. Same-Team Collision

Triggered when two or more allied units are active at the same tick.

### Enemy-only collision

Resolved automatically: active enemies are sorted by `stats.speed` descending
and the AI loop iterates in that order. No player prompt.

### Player-ally collision (1P build; extends to N allies in multi-character modes)

| Speeds    | Resolution                                                      |
|-----------|-----------------------------------------------------------------|
| Different | Faster unit acts first; `phase` is set to `'player'`            |
| Tied      | `pendingTeamCollision` is set → **Now/Later overlay** appears   |

**Now/Later rules** (choices collected sequentially, one unit per screen):

| Unit 1 | Unit 2 | Outcome                                                              |
|--------|--------|----------------------------------------------------------------------|
| Now    | Later  | Now unit acts first; Later unit's tick advances by +1 (D8 check)    |
| Now    | Now    | Both act this tick; order by speed (D2 on tie, both in `'player'`)  |
| Later  | Now    | Same as above, reversed                                             |
| Later  | Later  | Both advance +1 (D8 checks apply to each)                           |

`resolveTeamCollision` calls `registerTick(id, tick + 1)` for every
`'later'` unit, which in turn runs the displacement check.

---

## 3. Cross-Team Clash

Triggered when `activeUnitIds` contains at least one player unit **and** at
least one enemy unit simultaneously. Logic lives in
`src/core/combat/ClashResolver.ts`.

### Core principle

Each team is a **faction**. Whichever faction has the higher average
effective speed acts first. On a tie, a weighted dice is rolled — the
weight of each tied faction equals its unit count divided by the total
units in the tie.

This generalises cleanly to any N-faction, M-units-per-faction scenario:

| Configuration | Speed comparison          | Tie dice           |
|---------------|---------------------------|--------------------|
| 1 v 1         | Direct speed compare      | D2 (50 / 50)       |
| 2 v 1         | avg(2) vs single          | D3 weighted 2 : 1  |
| 1 v 1 v 1     | Three solo speeds         | D3 (1/3 each)      |
| 2 v 2         | avg(2) vs avg(2)          | D2 (50 / 50)       |
| 3 v 1         | avg(3) vs single          | D4 weighted 3 : 1  |

### Effective speed

```
effectiveSpeed = unit.stats.speed + unit.clashSpeedModifier
```

`clashSpeedModifier` comes from `CharacterDef.clash.speedModifier` (default 0).
This allows character data to encode a passive clash speed advantage without
touching `core/` logic.

### Loser placement

The loser **is not displaced** to a new tick. All units at the same tick still
act on that tick — the clash only resolves the *ordering within that tick*.
After the winning faction completes its turns, the losing faction acts, sorted
by effective speed descending within the losing side.

A brief log entry announces the winner (visible for `CLASH_ANNOUNCE_MS = 1500 ms`)
before the phase advances.

### Unique clash mechanisms

When any unit in the clash has `CharacterDef.clash.uniqueClash: true`, the
normal speed/dice path is bypassed and `pendingClash` is set instead. This
activates the **ClashQteOverlay** (spinning knob + tug-of-war bar), allowing
character-specific clash abilities to be expressed entirely through character
data. The framework provides the hook; the character definition drives what
happens.

---

## Data schema — `CharacterDef.clash`

```json
{
  "clash": {
    "speedModifier": 15,
    "uniqueClash": false
  }
}
```

Both fields are optional. Omitting the `clash` key entirely is equivalent to
`{ speedModifier: 0, uniqueClash: false }`.

| Field           | Type    | Effect                                          |
|-----------------|---------|-------------------------------------------------|
| `speedModifier` | number  | Flat bonus to this unit's effective clash speed |
| `uniqueClash`   | boolean | `true` → QTE overlay instead of speed/dice      |

---

## Constants reference

| Constant                   | Value | Purpose                                         |
|----------------------------|-------|-------------------------------------------------|
| `TICK_MAX_OCCUPANCY`       | 4     | Max units per tick before D8 displacement fires |
| `CLASH_ANNOUNCE_MS`        | 1500  | ms the clash-result log entry is shown before phase advances |
| `QTE_KNOB_RPM`             | 90    | Knob spin speed for unique-clash QTE (1.5 rps)  |
| `QTE_TARGET_ZONE_DEG`      | 60    | Target arc width in degrees                     |
| `QTE_ROUNDS`               | 3     | Tap rounds per unique-clash QTE                 |
| `QTE_BAR_FILL_PER_HIT`     | 0.18  | Bar shift per successful tap                    |
| `QTE_BAR_ALLY_WEIGHT_BONUS`| 0.05  | Extra shift per additional ally on tick (QTE)   |
| `AI_QTE_ACCURACY`          | 0.65  | AI hit probability in unique-clash QTE          |
| `QTE_AI_TAP_DELAY_MS`      | 1200  | ms before AI taps each QTE round               |

All constants live in `src/core/constants.ts`.
Displacement logic: `src/core/combat/TickDisplacer.ts`.
Clash ordering logic: `src/core/combat/ClashResolver.ts`.
