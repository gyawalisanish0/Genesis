import { describe, it, expect } from 'vitest'
import {
  createSkillInstance, levelUpSkill, resetSkillToDefault, invalidateCache, getCachedSkill,
} from '../../../engines/skill/SkillInstance'
import type { SkillDef } from '../../../effects/types'

const SKILL: SkillDef = {
  type: 'skill',
  id: 'slash_001',
  name: 'Slash',
  tuCost: 8,
  apCost: 20,
  tags: ['physical', 'melee'],
  maxLevel: 3,
  targeting: { selector: 'enemy', range: 'melee' },
  resolution: { baseChance: 1.0 },
  effects: [
    { id: 'dmg', when: { event: 'onCast' }, type: 'damage', amount: { stat: 'strength', percent: 80 } },
  ],
  levelUpgrades: [
    { level: 2, patch: { apCost: 18, 'effects.dmg.amount.percent': 90 } },
    { level: 3, patch: { 'effects.dmg.amount.percent': 100 } },
  ],
}

function dmgPercent(effects: readonly { type: string; amount: unknown }[]): number {
  const dmg = effects.find(e => e.type === 'damage')!
  return (dmg.amount as { percent: number }).percent
}

describe('SkillInstance lifecycle', () => {
  it('starts at level 1 with the base cache', () => {
    const inst = createSkillInstance(SKILL)
    expect(inst.currentLevel).toBe(1)
    expect(inst.cachedCosts.apCost).toBe(20)
    expect(dmgPercent(inst.cachedEffects)).toBe(80)
  })

  it('levelUpSkill rebuilds the cache and bumps cacheVersion', () => {
    const inst = createSkillInstance(SKILL)
    const lv2 = levelUpSkill(inst)
    expect(lv2.currentLevel).toBe(2)
    expect(lv2.cachedCosts.apCost).toBe(18)
    expect(dmgPercent(lv2.cachedEffects)).toBe(90)
    expect(lv2.cacheVersion).toBe(inst.cacheVersion + 1)
  })

  it('levelUpSkill is capped at maxLevel', () => {
    let inst = createSkillInstance(SKILL)
    for (let i = 0; i < 10; i += 1) inst = levelUpSkill(inst)
    expect(inst.currentLevel).toBe(SKILL.maxLevel)
  })

  it('resetSkillToDefault returns to level 1', () => {
    let inst = createSkillInstance(SKILL)
    inst = levelUpSkill(inst)
    inst = levelUpSkill(inst)  // level 3
    const reset = resetSkillToDefault(inst)
    expect(reset.currentLevel).toBe(1)
    expect(reset.cachedCosts.apCost).toBe(20)
    expect(dmgPercent(reset.cachedEffects)).toBe(80)
  })

  it('does not mutate the source SkillDef across level-ups', () => {
    let inst = createSkillInstance(SKILL)
    inst = levelUpSkill(inst)
    inst = levelUpSkill(inst)
    expect(SKILL.apCost).toBe(20)
    expect(dmgPercent(SKILL.effects)).toBe(80)
  })

  it('invalidateCache bumps the version without changing level', () => {
    const inst = createSkillInstance(SKILL)
    const out  = invalidateCache(inst)
    expect(out.currentLevel).toBe(inst.currentLevel)
    expect(out.cacheVersion).toBe(inst.cacheVersion + 1)
  })

  it('getCachedSkill returns the patched def at the current level', () => {
    let inst = createSkillInstance(SKILL)
    inst = levelUpSkill(inst)
    const def = getCachedSkill(inst)
    expect(def.apCost).toBe(18)
    expect(dmgPercent(def.effects)).toBe(90)
  })
})
