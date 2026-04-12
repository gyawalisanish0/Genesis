import { describe, it, expect } from 'vitest'
import { resolveValueExpr } from '../../effects/resolveValue'
import type { EffectContext } from '../../effects/types'
import { makeBattleState, makeUnit } from './_testHelpers'

function ctxFor(casterStrength: number, targetPower?: number): EffectContext {
  const caster = makeUnit({ id: 'c', stats: { strength: casterStrength } as never })
  const target = targetPower !== undefined
    ? makeUnit({ id: 't', stats: { power: targetPower } as never, isAlly: false })
    : undefined
  return {
    caster, target,
    battle: makeBattleState([caster, ...(target ? [target] : [])]),
    source: 'skill',
    event:  { event: 'onCast' },
  }
}

describe('resolveValueExpr', () => {
  it('returns a flat number unchanged', () => {
    expect(resolveValueExpr(42, ctxFor(80))).toBe(42)
  })

  it('resolves a caster stat at percent', () => {
    // 80 strength × 50% = 40
    expect(resolveValueExpr({ stat: 'strength', percent: 50 }, ctxFor(80))).toBe(40)
  })

  it('resolves a target stat when of: target', () => {
    expect(
      resolveValueExpr({ stat: 'power', percent: 25, of: 'target' }, ctxFor(80, 100)),
    ).toBe(25)
  })

  it('throws when target stats are referenced without a target', () => {
    expect(() =>
      resolveValueExpr({ stat: 'power', percent: 25, of: 'target' }, ctxFor(80)),
    ).toThrow(/target/)
  })

  it('sums composite expressions', () => {
    expect(
      resolveValueExpr({ sum: [10, { stat: 'strength', percent: 50 }] }, ctxFor(80)),
    ).toBe(50)
  })
})
