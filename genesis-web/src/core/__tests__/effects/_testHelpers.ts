// Shared in-memory BattleState double + minimal unit factory used by the
// effect-system test files. Pure test scaffolding — never imported from
// production code. Lives next to the tests so its scope is visibly local.

import type { BattleState } from '../../effects/types'
import type { StatBlockDef, Unit } from '../../types'

export function makeUnit(overrides: Partial<Unit> = {}): Unit {
  const stats: StatBlockDef = {
    strength:   80,
    endurance:  60,
    power:      70,
    resistance: 50,
    speed:      40,
    precision:  90,
  }
  return {
    id:           overrides.id ?? `unit-${Math.random().toString(36).slice(2, 8)}`,
    defId:        'test_def',
    name:         'Test Unit',
    className:    'Warrior',
    rarity:       1,
    stats:        { ...stats, ...(overrides.stats ?? {}) },
    maxHp:        100,
    hp:           100,
    maxAp:        100,
    ap:           50,
    apRegenRate:  5,
    tickPosition:        0,
    actionCount:         0,
    clashSpeedModifier:  0,
    clashUniqueEnabled:  false,
    skills:              [],
    statusSlots:         [],
    isAlly:              true,
    ...overrides,
  }
}

export function makeBattleState(initial: Unit[] = []): BattleState {
  const units = new Map(initial.map(u => [u.id, u]))
  return {
    getUnit:     id => units.get(id),
    setUnit:     unit => { units.set(unit.id, unit) },
    getAllUnits: () => Array.from(units.values()),
  }
}
