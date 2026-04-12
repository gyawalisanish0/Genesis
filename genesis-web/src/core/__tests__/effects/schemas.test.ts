import { describe, it, expect } from 'vitest'
import { skillDefSchema } from '../../effects/schemas'
import slashJson       from '../../../../public/data/skills/slash_001.json'
import arcaneBoltJson  from '../../../../public/data/skills/arcane_bolt_001.json'

describe('skillDefSchema', () => {
  it('accepts the rewritten Slash skill', () => {
    const parsed = skillDefSchema.parse(slashJson)
    expect(parsed.id).toBe('slash_001')
    expect(parsed.effects).toHaveLength(1)
    expect(parsed.levelUpgrades).toHaveLength(4)
  })

  it('accepts the rewritten Arcane Bolt skill', () => {
    const parsed = skillDefSchema.parse(arcaneBoltJson)
    expect(parsed.id).toBe('arcane_bolt_001')
    expect(parsed.tags).toContain('energy')
  })

  it('rejects an unknown effect type', () => {
    const broken = {
      ...slashJson,
      effects: [{ when: { event: 'onCast' }, type: 'eldritch', amount: 10 }],
    }
    expect(() => skillDefSchema.parse(broken)).toThrow()
  })

  it('rejects extra unknown top-level keys', () => {
    const broken = { ...slashJson, secret: true }
    expect(() => skillDefSchema.parse(broken)).toThrow()
  })

  it('rejects a level upgrade below 2', () => {
    const broken = {
      ...slashJson,
      levelUpgrades: [{ level: 1, patch: { apCost: 10 } }],
    }
    expect(() => skillDefSchema.parse(broken)).toThrow()
  })
})
