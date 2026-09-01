// Two-phase resolution. CONCEPT.md § Skill Resolution.
//
// The thing worth protecting here is not any single number — it is that the two
// tables the resolver rolls and the one table the player is shown are the same
// distribution. A forecast that disagrees with the roll is worse than no
// forecast: it teaches the player odds the engine does not honour.

import { describe, it, expect } from 'vitest'
import {
  strikeTable, reactionTable, reactionChance,
  combineOutcome, combinedForecast, OUTCOME_MATRIX,
} from '../combat/PhaseResolver'
import type { StrikeBand, ReactionBand } from '../combat/PhaseResolver'
import { calculateStrikeChance } from '../combat/HitChanceEvaluator'
import {
  MIN_OUTCOME_POOL, STRIKE_BASE_PROBABILITIES, REACTION_BASE_TABLES,
  REACTION_BASELINE_ENDURANCE,
} from '../constants'

const sum = (table: Record<string, number>) =>
  Object.values(table).reduce((a, b) => a + b, 0)

const STRIKE_BANDS = Object.keys(STRIKE_BASE_PROBABILITIES) as StrikeBand[]
const REACTION_BANDS = Object.keys(REACTION_BASE_TABLES.Solid) as ReactionBand[]

describe('shiftPools', () => {
  it('keeps a table summing to 1 at every chance', () => {
    for (const chance of [0, 0.3, 0.7, 1, 1.3, 2, 5, 100]) {
      expect(sum(strikeTable(chance)), `strike @ ${chance}`).toBeCloseTo(1, 9)
      expect(sum(reactionTable('Solid', chance)), `reaction @ ${chance}`).toBeCloseTo(1, 9)
    }
  })

  it('returns the base table untouched at chance 1', () => {
    expect(strikeTable(1)).toEqual(STRIKE_BASE_PROBABILITIES)
    for (const band of STRIKE_BANDS) {
      expect(reactionTable(band, 1), band).toEqual(REACTION_BASE_TABLES[band])
    }
  })

  it('grows the named pool and shrinks the rest', () => {
    const low  = strikeTable(0.5)
    const high = strikeTable(1.5)
    expect(high.Clean + high.Solid).toBeGreaterThan(low.Clean + low.Solid)
    expect(high.Loose).toBeLessThan(low.Loose)
  })

  it('preserves the ratio inside each pool', () => {
    // Shifting must not reorder a table — a Clean strike stays rarer than a
    // Solid one however high the Precision.
    const t = strikeTable(1.6)
    expect(t.Clean / t.Solid).toBeCloseTo(
      STRIKE_BASE_PROBABILITIES.Clean / STRIKE_BASE_PROBABILITIES.Solid, 9,
    )
  })

  it('is neutral on a malformed chance rather than producing NaN', () => {
    for (const bad of [NaN, Infinity, -Infinity] as number[]) {
      expect(strikeTable(bad), String(bad)).toEqual(STRIKE_BASE_PROBABILITIES)
    }
  })
})

// ── The dice must always stay a dice ─────────────────────────────────────────
//
// strikeChance = precision/50 is unbounded, so without MIN_OUTCOME_POOL a
// Precision-100 unit reaches a 100% positive pool: it cannot be read and cannot
// be deflected. The table silently collapses to one result at both ends.

describe('outcome pool floors', () => {
  it('never lets a pool reach zero, however extreme the input', () => {
    for (const chance of [0, 0.01, 0.5, 1, 1.5, 2, 5, 100]) {
      const s = strikeTable(chance)
      expect(s.Clean + s.Solid, `positive @ ${chance}`).toBeGreaterThanOrEqual(MIN_OUTCOME_POOL - 1e-9)
      expect(s.Loose, `negative @ ${chance}`).toBeGreaterThanOrEqual(MIN_OUTCOME_POOL - 1e-9)

      const r = reactionTable('Solid', chance)
      expect(r.Read + r.Deflect, `reaction+ @ ${chance}`).toBeGreaterThanOrEqual(MIN_OUTCOME_POOL - 1e-9)
      expect(r.Caught, `reaction- @ ${chance}`).toBeGreaterThanOrEqual(MIN_OUTCOME_POOL - 1e-9)
    }
  })

  it('keeps a perfect-precision unit answerable', () => {
    const p = combinedForecast(calculateStrikeChance(100, 1), 1)
    expect(p.Evade + p.Graze).toBeGreaterThan(0)
  })

  it('keeps a zero-precision unit capable of landing a hit', () => {
    const p = combinedForecast(calculateStrikeChance(0, 1), 1)
    expect(p.Boosted + p.Hit).toBeGreaterThan(0)
  })

  it('keeps an unhittable defender hittable', () => {
    const p = combinedForecast(1, reactionChance(10_000))
    expect(p.Boosted + p.Hit).toBeGreaterThan(0)
  })
})

describe('reactionChance', () => {
  it('is 1 at the baseline Endurance', () => {
    expect(reactionChance(REACTION_BASELINE_ENDURANCE)).toBe(1)
  })

  it('scales linearly with Endurance — the defensive stat', () => {
    expect(reactionChance(REACTION_BASELINE_ENDURANCE * 2)).toBeCloseTo(2)
    expect(reactionChance(REACTION_BASELINE_ENDURANCE / 2)).toBeCloseTo(0.5)
  })

  it('falls back to the baseline table when there is no defender', () => {
    // The action grid shows odds before a target is picked. "Against an average
    // opponent" is the honest answer there; a 0 would advertise a free hit.
    expect(reactionChance(undefined)).toBe(1)
    expect(reactionChance(NaN)).toBe(1)
  })
})

describe('the outcome matrix', () => {
  it('gives every pairing an outcome', () => {
    for (const s of STRIKE_BANDS) {
      for (const r of REACTION_BANDS) {
        expect(combineOutcome(s, r), `${s}/${r}`).toBeTypeOf('string')
      }
    }
  })

  it('lets a Clean strike be read and a Loose one still land', () => {
    // Neither phase decides the outcome alone. If it did, the second roll would
    // be decoration — which is exactly what the single-roll system was.
    expect(OUTCOME_MATRIX.Clean.Read).toBe('Evade')
    expect(OUTCOME_MATRIX.Loose.Caught).toBe('Graze')
  })

  it('reserves Boosted for a clean strike nobody answered', () => {
    const boosted = STRIKE_BANDS.flatMap(s =>
      REACTION_BANDS.filter(r => OUTCOME_MATRIX[s][r] === 'Boosted').map(r => `${s}/${r}`))
    expect(boosted).toEqual(['Clean/Caught'])
  })
})

describe('combinedForecast', () => {
  it('is the baseline distribution when both units are average', () => {
    // Hand-computed from the two published tables, and the numbers CONCEPT.md
    // quotes. If a base table moves, this must be recomputed deliberately —
    // that is the point of pinning it.
    const p = combinedForecast(1, 1)
    expect(p.Boosted).toBeCloseTo(0.12, 9)
    expect(p.Hit).toBeCloseTo(0.32, 9)
    expect(p.Graze).toBeCloseTo(0.33, 9)
    expect(p.Evade).toBeCloseTo(0.23, 9)
  })

  it('sums to 1 across the whole stat range', () => {
    for (const strike of [0, 0.5, 1, 2, 10]) {
      for (const reaction of [0, 0.5, 1, 2, 10]) {
        expect(sum(combinedForecast(strike, reaction)), `${strike}/${reaction}`).toBeCloseTo(1, 9)
      }
    }
  })

  it('rewards the actor for Precision and the defender for Endurance', () => {
    const base   = combinedForecast(1, 1)
    const sharp  = combinedForecast(1.6, 1)
    const tough  = combinedForecast(1, 1.6)

    expect(sharp.Boosted).toBeGreaterThan(base.Boosted)
    expect(tough.Evade).toBeGreaterThan(base.Evade)
    // And the two stats genuinely oppose: a tougher defender undoes the
    // attacker's edge rather than each acting on a separate outcome.
    expect(combinedForecast(1.6, 1.6).Evade).toBeGreaterThan(sharp.Evade)
  })
})
