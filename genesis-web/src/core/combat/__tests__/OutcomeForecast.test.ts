// OutcomeForecast is the single source of truth shared by the resolver (at roll
// time) and the UI (one moment earlier). If these drift, the odds strip on a
// skill card lies to the player about what is going to happen.

import { describe, it, expect } from 'vitest'
import { forecastOutcomes, forecastApGain, rangedChanceBonus, isApRegenFrozen } from '../OutcomeForecast'
import { calculateStrikeChance, tickFactor } from '../HitChanceEvaluator'
import { combinedForecast, reactionChance } from '../PhaseResolver'
import type { Unit } from '../../types'
import type { SkillDef } from '../../effects/types'

const unit = (over: Partial<Unit> = {}): Unit => ({
  id: 'u1', defId: 'hugo_001', name: 'Hugo', className: 'Warrior', rarity: 3,
  hp: 100, maxHp: 100, ap: 50, maxAp: 100, apRegenRate: 0.6,
  stats: { attack: 10, defense: 10, speed: 10, precision: 50, endurance: 50, evasion: 10, luck: 10 },
  tickPosition: 10, actionCount: 0, isAlly: true, statusSlots: [], skills: [],
  ...over,
} as unknown as Unit)

const skill = (over: Partial<SkillDef> = {}): SkillDef => ({
  type: 'skill', id: 's1', name: 'Strike', tuCost: 8, apCost: 10,
  tags: [], maxLevel: 5, targeting: { selector: 'enemy' }, effects: [],
  ...over,
} as unknown as SkillDef)

describe('forecastOutcomes', () => {
  it('always returns a table summing to 1', () => {
    for (const precision of [1, 25, 50, 75, 100, 200]) {
      const p = forecastOutcomes(unit({ stats: { precision } as never }), skill())
      const sum = p.Boosted + p.Hit + p.Evade + p.Graze
      expect(sum).toBeCloseTo(1, 10)
    }
  })

  it('matches the resolver’s own math exactly', () => {
    // precision 50 + baseChance 1.0, scaled by the skill's tick investment.
    // The forecast and the roll must never disagree — that is this module's
    // entire reason to exist — so the expectation mirrors the full formula.
    const expected = combinedForecast(
      calculateStrikeChance(50, 1.0) * tickFactor(skill().tuCost),
      reactionChance(undefined),
    )
    expect(forecastOutcomes(unit(), skill())).toEqual(expected)
  })

  it('lands a heavy skill more often than a jab for the same unit', () => {
    // Tick investment buys accuracy: TU is the currency the game is about, and
    // it previously had no bearing on whether an action connected.
    const jab   = forecastOutcomes(unit(), { ...skill(), tuCost: 5 })
    const heavy = forecastOutcomes(unit(), { ...skill(), tuCost: 20 })
    expect(heavy.Boosted + heavy.Hit).toBeGreaterThan(jab.Boosted + jab.Hit)
    expect(heavy.Evade + heavy.Graze).toBeLessThan(jab.Evade + jab.Graze)
  })

  it('tips toward good outcomes as precision rises', () => {
    const low  = forecastOutcomes(unit({ stats: { precision: 25 } as never }), skill())
    const high = forecastOutcomes(unit({ stats: { precision: 90 } as never }), skill())
    expect(high.Boosted + high.Hit).toBeGreaterThan(low.Boosted + low.Hit)
    expect(high.Evade + high.Graze).toBeLessThan(low.Evade + low.Graze)
  })

  it('reads differently for the same skill in different hands', () => {
    // The whole justification for showing odds per-card rather than per-skill.
    const a = forecastOutcomes(unit({ stats: { precision: 40 } as never }), skill())
    const b = forecastOutcomes(unit({ stats: { precision: 70 } as never }), skill())
    expect(a).not.toEqual(b)
  })

  it('honours a skill’s own baseChance', () => {
    const weak   = forecastOutcomes(unit(), skill({ resolution: { baseChance: 0.5 } } as never))
    const normal = forecastOutcomes(unit(), skill())
    expect(weak.Hit).toBeLessThan(normal.Hit)
  })

  it('reads the defender, not just the actor', () => {
    // Phase 2 is the point of the rewrite. If the forecast ignored the target,
    // the second roll would be decoration and the odds strip would say the same
    // thing about a glass cannon and a bulwark.
    const soft = unit({ id: 'e1', isAlly: false, stats: { precision: 50, endurance: 20 } as never })
    const hard = unit({ id: 'e2', isAlly: false, stats: { precision: 50, endurance: 90 } as never })

    const vsSoft = forecastOutcomes(unit(), skill(), soft)
    const vsHard = forecastOutcomes(unit(), skill(), hard)

    expect(vsHard.Evade).toBeGreaterThan(vsSoft.Evade)
    expect(vsSoft.Boosted).toBeGreaterThan(vsHard.Boosted)
  })

  it('falls back to an average defender when no target is chosen', () => {
    // The action grid shows odds before the player picks anyone. Absent must
    // mean "the baseline table", not "nobody resists".
    const average = unit({ id: 'e1', isAlly: false, stats: { precision: 50, endurance: 50 } as never })
    expect(forecastOutcomes(unit(), skill())).toEqual(forecastOutcomes(unit(), skill(), average))
  })

  it('never returns a negative probability even at precision 0', () => {
    const p = forecastOutcomes(unit({ stats: { precision: 0 } as never }), skill())
    for (const v of Object.values(p)) expect(v).toBeGreaterThanOrEqual(0)
  })
})

describe('rangedChanceBonus', () => {
  const buffed = unit({ statusSlots: [{ id: 'x', payload: { rangedBaseChanceBonus: 0.25 } }] as never })

  it('is zero for a skill without the ranged tag', () => {
    expect(rangedChanceBonus(buffed, skill({ tags: ['melee'] } as never))).toBe(0)
  })

  it('sums the bonus for a ranged skill', () => {
    expect(rangedChanceBonus(buffed, skill({ tags: ['ranged'] } as never))).toBe(0.25)
  })

  it('improves the ranged forecast but leaves melee untouched', () => {
    const meleeSame = forecastOutcomes(buffed, skill({ tags: ['melee'] } as never))
    expect(meleeSame).toEqual(forecastOutcomes(unit(), skill({ tags: ['melee'] } as never)))

    const rangedUp = forecastOutcomes(buffed, skill({ tags: ['ranged'] } as never))
    const rangedFlat = forecastOutcomes(unit(), skill({ tags: ['ranged'] } as never))
    expect(rangedUp.Hit).toBeGreaterThan(rangedFlat.Hit)
  })
})

describe('forecastApGain', () => {
  it('returns the AP an action will pay back', () => {
    // 8 ticks x 0.6 regen, rounded
    expect(forecastApGain(unit(), 8, 20)).toBe(5)
  })

  it('is zero on the opening tick, matching the resolver', () => {
    expect(forecastApGain(unit(), 8, 0)).toBe(0)
  })

  it('scales with tuCost — the tempo tradeoff the player is choosing', () => {
    const cheap = forecastApGain(unit(), 6, 20)
    const slow  = forecastApGain(unit(), 15, 20)
    expect(slow).toBeGreaterThan(cheap)
  })

  it('is zero while a status freezes AP regen', () => {
    const frozen = unit({ statusSlots: [{ id: 'f', payload: { freezesApRegen: true } }] as never })
    expect(isApRegenFrozen(frozen)).toBe(true)
    expect(forecastApGain(frozen, 8, 20)).toBe(0)
  })
})
