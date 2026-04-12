import { describe, it, expect } from 'vitest'
import { applyLevelUpgrades } from '../../effects/patch'
import type { SkillDef } from '../../effects/types'

const BASE: SkillDef = {
  type: 'skill',
  id: 'test_001',
  name: 'Test',
  tuCost: 5,
  apCost: 12,
  tags: ['physical', 'melee'],
  maxLevel: 5,
  targeting: { selector: 'enemy', range: 'melee' },
  resolution: { baseChance: 1.0 },
  effects: [
    { id: 'dmg',     when: { event: 'onCast' }, type: 'damage', amount: { stat: 'strength', percent: 80 } },
    { id: 'finish',  when: { event: 'onAfterHit' }, type: 'heal', amount: 10 },
  ],
  levelUpgrades: [
    { level: 2, patch: { apCost: 10, 'effects.dmg.amount.percent': 90 } },
    { level: 3, patch: { 'effects.dmg.amount.percent': 100, 'effects.finish.amount': 15 } },
    { level: 4, patch: { 'resolution.baseChance': 1.2 } },
  ],
}

describe('applyLevelUpgrades', () => {
  it('returns a deep clone at level 1 (no patches applied)', () => {
    const out = applyLevelUpgrades(BASE, 1)
    expect(out).not.toBe(BASE)
    expect(out.apCost).toBe(12)
    expect((out.effects[0] as { amount: { percent: number } }).amount.percent).toBe(80)
  })

  it('applies a single level patch by named effect id', () => {
    const out = applyLevelUpgrades(BASE, 2)
    expect(out.apCost).toBe(10)
    expect((out.effects[0] as { amount: { percent: number } }).amount.percent).toBe(90)
  })

  it('accumulates patches across levels', () => {
    const out = applyLevelUpgrades(BASE, 3)
    expect(out.apCost).toBe(10)
    expect((out.effects[0] as { amount: { percent: number } }).amount.percent).toBe(100)
    expect((out.effects[1] as { amount: number }).amount).toBe(15)
  })

  it('walks nested resolution paths', () => {
    const out = applyLevelUpgrades(BASE, 4)
    expect(out.resolution!.baseChance).toBe(1.2)
  })

  it('does not mutate the base object', () => {
    applyLevelUpgrades(BASE, 4)
    expect(BASE.apCost).toBe(12)
    expect((BASE.effects[0] as { amount: { percent: number } }).amount.percent).toBe(80)
    expect(BASE.resolution!.baseChance).toBe(1.0)
  })

  it('throws when a patch references an unknown effect id', () => {
    const broken: SkillDef = {
      ...BASE,
      levelUpgrades: [{ level: 2, patch: { 'effects.ghost.amount': 99 } }],
    }
    expect(() => applyLevelUpgrades(broken, 2)).toThrow(/ghost/)
  })

  it('throws when a patch path does not exist on the base', () => {
    const broken: SkillDef = {
      ...BASE,
      levelUpgrades: [{ level: 2, patch: { 'effects.dmg.nonsense': 99 } }],
    }
    expect(() => applyLevelUpgrades(broken, 2)).toThrow(/does not exist/)
  })
})
