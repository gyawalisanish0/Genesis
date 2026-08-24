// Shared unit/skill/callback fixtures for BattleEngine tests. Pure test
// scaffolding — never imported from production code.

import { vi } from 'vitest'
import type { Unit, StatBlockDef, ClassName } from '../../types'
import type { SkillDef } from '../../effects/types'
import { createSkillInstance } from '../../engines/skill/SkillInstance'
import type { BattleEngineCallbacks, BattleEngineConfig, BattleEngineSnapshot } from '../EngineTypes'

export function makeUnit(overrides: Partial<Unit> = {}): Unit {
  const stats: StatBlockDef = {
    strength:   50,
    endurance:  50,
    power:      50,
    resistance: 50,
    speed:      50,
    precision:  50,
  }
  return {
    id:                 overrides.id ?? `unit-${Math.random().toString(36).slice(2, 8)}`,
    defId:              'test_def',
    name:               'Test Unit',
    className:          'Warrior' as ClassName,
    rarity:             1,
    stats:              { ...stats, ...(overrides.stats ?? {}) },
    maxHp:              100,
    hp:                 100,
    maxAp:              100,
    ap:                 100,
    apRegenRate:        0,
    tickPosition:       0,
    actionCount:        0,
    clashSpeedModifier: 0,
    clashUniqueEnabled: false,
    skills:             [],
    statusSlots:        [],
    secondaryResource:  0,
    apSpentAccum:       0,
    isAlly:             true,
    ...overrides,
  }
}

/** A single-target, always-eligible melee strike: damage = caster.strength × percent / 100. */
export function makeDamageSkillDef(overrides: Partial<SkillDef> = {}): SkillDef {
  return {
    type:       'skill',
    id:         'basic_strike',
    name:       'Basic Strike',
    tuCost:     8,
    apCost:     10,
    tags:       ['physical', 'melee'],
    maxLevel:   1,
    targeting:  { selector: 'enemy', range: 'melee' },
    resolution: { baseChance: 1.0 },
    effects: [
      { id: 'dmg', when: { event: 'onCast' }, type: 'damage', amount: { stat: 'strength', percent: 100 } },
    ],
    ...overrides,
  }
}

export function makeSkillInstance(def: SkillDef = makeDamageSkillDef()) {
  return createSkillInstance(def)
}

export interface CallbackHarness {
  cb:        BattleEngineCallbacks
  snapshots: BattleEngineSnapshot[]
  logs:      string[]
  latest():  BattleEngineSnapshot
}

export function makeCallbacks(): CallbackHarness {
  const snapshots: BattleEngineSnapshot[] = []
  const logs: string[] = []
  const cb: BattleEngineCallbacks = {
    onSetTurnState:    vi.fn(),
    onClearTurn:       vi.fn(),
    onPlayDice:        vi.fn(),
    onPlayAttack:      vi.fn(),
    onPlayDeath:       vi.fn(),
    onShowTurnDisplay: vi.fn(),
    onHideTurnDisplay: vi.fn(),
    onShowDiceResult:  vi.fn(),
    onClearDiceResult: vi.fn(),
    onNarrativeEmit:   vi.fn(),
    onStateChanged:    vi.fn((s: BattleEngineSnapshot) => { snapshots.push(s) }),
    onBattleEnd:       vi.fn(),
    onLog:             vi.fn((e) => { logs.push(e.text) }),
    onHistory:         vi.fn(),
    onTickDisplaced:   vi.fn(),
  }
  return { cb, snapshots, logs, latest: () => snapshots[snapshots.length - 1] }
}

export function makeConfig(overrides: Partial<BattleEngineConfig> = {}): BattleEngineConfig {
  return {
    playerUnits:     [],
    enemies:         [],
    unitSkillsMap:   new Map(),
    registeredTicks: new Map(),
    passiveDefs:     new Map(),
    statusDefs:      new Map(),
    manifests:       new Map(),
    animSequences:   new Map(),
    controlledIds:   new Set(),
    ...overrides,
  }
}
