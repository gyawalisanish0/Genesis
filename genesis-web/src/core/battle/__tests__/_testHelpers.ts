// Shared unit/skill/callback fixtures for BattleEngine tests. Pure test
// scaffolding — never imported from production code.

import { vi } from 'vitest'
import type { Unit, StatBlockDef, ClassName } from '../../types'
import type { SkillDef } from '../../effects/types'
import { createSkillInstance } from '../../engines/skill/SkillInstance'
import type { BattleEngineCallbacks, BattleEngineConfig, BattleEngineSnapshot } from '../EngineTypes'
import type { DiceOutcome } from '../../combat/DiceResolver'
import {
  strikeTable, reactionTable, combineOutcome,
  type StrikeBand, type ReactionBand,
} from '../../combat/PhaseResolver'
import { calculateStrikeChance, tickFactor } from '../../combat/HitChanceEvaluator'

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

// ── Forcing an outcome ───────────────────────────────────────────────────────

/** Where a value falls in a table rolled in declaration order. */
function bandAt<K extends string>(probs: Readonly<Record<K, number>>, value: number): K {
  let cumulative = 0
  const entries = Object.entries(probs) as [K, number][]
  for (const [band, prob] of entries) {
    cumulative += prob
    if (value < cumulative) return band
  }
  return entries[entries.length - 1][0]
}

/**
 * A `Math.random` value that makes the resolver produce `outcome`.
 *
 * Tests used to pin a literal — 0.3 for "guaranteed Hit". Under two phases the
 * same constant lands on Graze, and nothing in the test would have said so: it
 * would simply have started asserting against a branch nobody meant to test.
 * That is the failure mode this whole audit kept finding, so the value is
 * derived from the live tables instead and moves when they do.
 *
 * The engine rolls both phases from the same mocked constant, so this searches
 * for a value satisfying both and returns the middle of the widest run — the
 * furthest any tuning nudge has to travel before the test breaks loudly rather
 * than quietly measuring something else.
 */
export function rollFor(
  outcome: DiceOutcome,
  opts: { precision?: number; baseChance?: number; tuCost?: number; reactionChance?: number } = {},
): number {
  const { precision = 50, baseChance = 1, tuCost = 8, reactionChance = 1 } = opts
  const strike = strikeTable(calculateStrikeChance(precision, baseChance) * tickFactor(tuCost))
  const reactions = Object.fromEntries(
    (Object.keys(strike) as StrikeBand[]).map(b => [b, reactionTable(b, reactionChance)]),
  ) as Record<StrikeBand, Record<ReactionBand, number>>

  const STEPS = 10_000
  let best = { start: -1, length: 0 }
  let run  = { start: -1, length: 0 }

  for (let i = 0; i < STEPS; i++) {
    const value = (i + 0.5) / STEPS
    const band  = bandAt(strike, value)
    const hits  = combineOutcome(band, bandAt(reactions[band], value)) === outcome

    run = hits ? { start: run.length === 0 ? i : run.start, length: run.length + 1 } : { start: -1, length: 0 }
    if (run.length > best.length) best = run
  }

  if (best.length === 0) {
    throw new Error(`no Math.random value yields ${outcome} for ${JSON.stringify(opts)}`)
  }
  return (best.start + best.length / 2) / STEPS
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
    onEngineError:     vi.fn(),
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
