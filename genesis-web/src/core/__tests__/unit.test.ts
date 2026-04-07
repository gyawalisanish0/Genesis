import { describe, it, expect } from 'vitest'
import { createUnit, takeDamage, healUnit, gainAp, spendAp, isAlive } from '../unit'
import type { CharacterDef } from '../types'

const WARRIOR_DEF: CharacterDef = {
  type:        'character',
  id:          'warrior_001',
  name:        'Iron Warden',
  className:   'Warrior',
  rarity:      3,
  stats:       { strength: 75, endurance: 60, power: 20, resistance: 45, speed: 40, precision: 55 },
  maxHp:       1200,
  maxAp:       100,
  apRegenRate: 8,
  passive:     null,
  skillPath:   'warrior_path',
}

describe('createUnit', () => {
  it('starts at full HP and zero AP', () => {
    const unit = createUnit(WARRIOR_DEF, true)
    expect(unit.hp).toBe(1200)
    expect(unit.ap).toBe(0)
  })

  it('copies stats so mutations do not affect the def', () => {
    const unit = createUnit(WARRIOR_DEF, true)
    unit.stats.strength = 999
    expect(WARRIOR_DEF.stats.strength).toBe(75)
  })

  it('assigns unique ids', () => {
    const a = createUnit(WARRIOR_DEF, true)
    const b = createUnit(WARRIOR_DEF, true)
    expect(a.id).not.toBe(b.id)
  })
})

describe('takeDamage', () => {
  it('reduces HP by the given amount', () => {
    const unit = createUnit(WARRIOR_DEF, true)
    const after = takeDamage(unit, 200)
    expect(after.hp).toBe(1000)
  })

  it('clamps HP at 0', () => {
    const unit = createUnit(WARRIOR_DEF, true)
    expect(takeDamage(unit, 9999).hp).toBe(0)
  })

  it('does not mutate the original unit', () => {
    const unit = createUnit(WARRIOR_DEF, true)
    takeDamage(unit, 100)
    expect(unit.hp).toBe(1200)
  })
})

describe('healUnit', () => {
  it('restores HP up to maxHp', () => {
    const unit  = { ...createUnit(WARRIOR_DEF, true), hp: 500 }
    const after = healUnit(unit, 200)
    expect(after.hp).toBe(700)
  })

  it('does not exceed maxHp', () => {
    const unit = { ...createUnit(WARRIOR_DEF, true), hp: 1100 }
    expect(healUnit(unit, 999).hp).toBe(1200)
  })
})

describe('spendAp', () => {
  it('deducts AP when sufficient', () => {
    const unit = { ...createUnit(WARRIOR_DEF, true), ap: 80 }
    const { unit: after, success } = spendAp(unit, 30)
    expect(success).toBe(true)
    expect(after.ap).toBe(50)
  })

  it('returns false and leaves unit unchanged when insufficient', () => {
    const unit = { ...createUnit(WARRIOR_DEF, true), ap: 10 }
    const { unit: after, success } = spendAp(unit, 30)
    expect(success).toBe(false)
    expect(after.ap).toBe(10)
  })
})

describe('gainAp', () => {
  it('adds AP up to maxAp', () => {
    const unit  = createUnit(WARRIOR_DEF, true)  // ap = 0
    const after = gainAp(unit, 50)
    expect(after.ap).toBe(50)
  })

  it('does not exceed maxAp', () => {
    const unit = { ...createUnit(WARRIOR_DEF, true), ap: 90 }
    expect(gainAp(unit, 50).ap).toBe(100)
  })
})

describe('isAlive', () => {
  it('returns true when hp > 0', () => {
    expect(isAlive(createUnit(WARRIOR_DEF, true))).toBe(true)
  })

  it('returns false when hp === 0', () => {
    const dead = { ...createUnit(WARRIOR_DEF, true), hp: 0 }
    expect(isAlive(dead)).toBe(false)
  })
})
