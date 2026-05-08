import { describe, it, expect } from 'vitest'
import { skillDefSchema } from '../../effects/schemas'
import hugoSkills  from '../../../../public/data/characters/hugo_001/skills.json'
import hustySkills from '../../../../public/data/characters/husty_001/skills.json'

const hugoBasicJson  = hugoSkills[0]
const hustyBasicJson = hustySkills[0]

describe('skillDefSchema', () => {
  it('accepts Hugo basic attack skill', () => {
    const parsed = skillDefSchema.parse(hugoBasicJson)
    expect(parsed.id).toBe('hugo_001_basic_attack')
    expect(parsed.effects).toHaveLength(1)
    expect(parsed.levelUpgrades).toHaveLength(0)
  })

  it('accepts Husty basic attack skill', () => {
    const parsed = skillDefSchema.parse(hustyBasicJson)
    expect(parsed.id).toBe('husty_001_basic_attack')
    expect(parsed.tags).toContain('energy')
  })

  it('rejects an unknown effect type', () => {
    const broken = {
      ...hugoBasicJson,
      effects: [{ when: { event: 'onCast' }, type: 'eldritch', amount: 10 }],
    }
    expect(() => skillDefSchema.parse(broken)).toThrow()
  })

  it('rejects extra unknown top-level keys', () => {
    const broken = { ...hugoBasicJson, secret: true }
    expect(() => skillDefSchema.parse(broken)).toThrow()
  })

  it('rejects a level upgrade below 2', () => {
    const broken = {
      ...hugoBasicJson,
      levelUpgrades: [{ level: 1, patch: { apCost: 10 } }],
    }
    expect(() => skillDefSchema.parse(broken)).toThrow()
  })
})
