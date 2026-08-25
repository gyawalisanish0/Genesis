// Engine invariants — the safety net for "declared but never wired".
//
// Every bug found in the combat engine this session shared one shape: something
// was declared in one place and silently not honoured in another, and nothing
// failed. tsc was happy, the unit suite was happy, the game just quietly did
// the wrong thing.
//
//   · BOOSTED_MULTIPLIER lived only in a function the pipeline never called, so
//     a Boosted roll dealt exactly as much as a plain Hit.
//   · MAX_SKILL_SLOTS was exported and referenced nowhere, while the action
//     grid hardcoded 4 — a fifth authored skill would never render.
//   · A tickShove aimed at the caster was written to the snapshot and then
//     overwritten by an advance computed from the pre-action unit.
//   · A skill missing tuCost produced NaN probabilities that rendered as an
//     empty odds band rather than throwing.
//
// These tests assert the wiring itself rather than any one behaviour, so the
// next member of that family fails here instead of shipping.

import { describe, it, expect } from 'vitest'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { registerBuiltins } from '../effects/builtins'
import { getHandler } from '../effects/registry'
import { shiftProbabilities, calculateFinalChance, tuAccuracyFactor } from '../combat/HitChanceEvaluator'
import { applyOutcome, outcomeScale, type DiceOutcome } from '../combat/DiceResolver'
import { MAX_SKILL_SLOTS, DICE_BASE_PROBABILITIES } from '../constants'

registerBuiltins()

const ROOT       = join(fileURLToPath(import.meta.url), '../../../..')
const CHARACTERS = join(ROOT, 'public/data/characters')
const STATUSES   = join(ROOT, 'public/data/statuses')

const OUTCOMES: DiceOutcome[] = ['Boosted', 'Hit', 'Evade', 'Fail']

interface AuthoredSkill {
  char: string
  id: string
  name: string
  tuCost: number
  apCost: number
  tags: string[]
  effects: Array<{ type: string; status?: string; id?: string }>
  levelUpgrades?: Array<{ patch: Record<string, unknown> }>
}

function characterDirs(): string[] {
  return readdirSync(CHARACTERS).filter(e => statSync(join(CHARACTERS, e)).isDirectory())
}

function allSkills(): AuthoredSkill[] {
  const out: AuthoredSkill[] = []
  for (const char of characterDirs()) {
    const file = join(CHARACTERS, char, 'skills.json')
    let raw: string
    try { raw = readFileSync(file, 'utf8') } catch { continue }
    for (const s of JSON.parse(raw)) out.push({ ...s, char })
  }
  return out
}

const SKILLS = allSkills()

describe('content is reachable by the engine', () => {
  it('finds skills to check at all', () => {
    // A silently empty corpus would make every test below vacuously pass.
    expect(SKILLS.length).toBeGreaterThan(10)
  })

  it('only uses effect types that have a registered handler', () => {
    const orphans = SKILLS.flatMap(s =>
      s.effects
        .filter(e => !getHandler(e.type as never))
        .map(e => `${s.char}/${s.id}: "${e.type}"`))
    expect(orphans, 'effect types with no builtin handler — these do nothing at runtime').toEqual([])
  })

  it('only references statuses that exist on disk', () => {
    const known = new Set(
      readdirSync(STATUSES).filter(f => f.endsWith('.json')).map(f => f.replace(/\.json$/, '')))
    const missing = SKILLS.flatMap(s =>
      s.effects
        .filter(e => e.type === 'applyStatus' && e.status && !known.has(e.status))
        .map(e => `${s.char}/${s.id} → ${e.status}`))
    expect(missing, 'applyStatus targets with no StatusDef — the status never lands').toEqual([])
  })

  it('points every levelUpgrades patch at an effect that exists', () => {
    // Patch paths are dot-delimited strings resolved by name. A typo does not
    // throw; the upgrade simply never applies, so the skill stops scaling.
    const broken: string[] = []
    for (const s of SKILLS) {
      const ids = new Set(s.effects.map(e => e.id).filter(Boolean))
      for (const up of s.levelUpgrades ?? []) {
        for (const path of Object.keys(up.patch)) {
          const [head, key] = path.split('.')
          if (head !== 'effects') continue
          if (!ids.has(key)) broken.push(`${s.char}/${s.id}: "${path}"`)
        }
      }
    }
    expect(broken, 'patch paths naming an effect id that does not exist').toEqual([])
  })

  it('keeps every character within the action grid’s slot count', () => {
    // ActionGrid renders exactly MAX_SKILL_SLOTS non-basic skills and drops the
    // rest without warning, so a sixth skill is authored content nobody can use.
    const over = characterDirs().map(char => {
      const nonBasic = SKILLS.filter(s => s.char === char && !s.tags.includes('basic'))
      return { char, count: nonBasic.length }
    }).filter(r => r.count > MAX_SKILL_SLOTS)
    expect(over, `characters with more than ${MAX_SKILL_SLOTS} non-basic skills`).toEqual([])
  })

  it('gives every skill a finite, non-negative cost', () => {
    const bad = SKILLS
      .filter(s => !Number.isFinite(s.tuCost) || !Number.isFinite(s.apCost) || s.tuCost < 0 || s.apCost < 0)
      .map(s => `${s.char}/${s.id} tu=${s.tuCost} ap=${s.apCost}`)
    expect(bad, 'a non-finite tuCost silently neutralises the accuracy model').toEqual([])
  })
})

describe('the dice table can never degenerate', () => {
  it('produces a finite distribution summing to 1 for any input', () => {
    const inputs = [0, 0.001, 0.5, 1, 1.37, 2, 10, 1e6, -1, NaN, Infinity]
    for (const fc of inputs) {
      const p = shiftProbabilities(fc)
      const values = Object.values(p)
      for (const v of values) {
        expect(Number.isFinite(v), `non-finite probability at finalChance=${fc}`).toBe(true)
        expect(v, `negative probability at finalChance=${fc}`).toBeGreaterThanOrEqual(0)
      }
      expect(values.reduce((a, b) => a + b, 0), `sum at finalChance=${fc}`).toBeCloseTo(1, 9)
    }
  })

  it('keeps every outcome reachable across the whole precision range', () => {
    for (let precision = 0; precision <= 200; precision += 10) {
      const p = shiftProbabilities(calculateFinalChance(precision, 1))
      for (const o of OUTCOMES) {
        expect(p[o], `${o} unreachable at precision ${precision}`).toBeGreaterThan(0)
      }
    }
  })

  it('never yields a non-finite table for any authored skill', () => {
    // The NaN that produced an empty odds band came from a real skill shape,
    // not a synthetic one — so sweep the actual content.
    for (const s of SKILLS) {
      const p = shiftProbabilities(calculateFinalChance(50, 1) * tuAccuracyFactor(s.tuCost))
      for (const o of OUTCOMES) {
        expect(Number.isFinite(p[o]), `${s.char}/${s.id} → ${o}`).toBe(true)
      }
    }
  })
})

describe('outcome magnitude is wired end to end', () => {
  it('gives the four outcomes four distinct magnitudes', () => {
    // OUTCOMES is declaration order, not magnitude order — Evade sits between
    // Hit and Fail in the table but delivers the least.
    const byMagnitude: DiceOutcome[] = ['Boosted', 'Hit', 'Fail', 'Evade']
    const magnitudes = byMagnitude.map(outcomeScale)
    expect(magnitudes).toEqual([...magnitudes].sort((a, b) => b - a))
    expect(new Set(magnitudes).size, 'two outcomes share a magnitude — one is decorative').toBe(4)
  })

  it('agrees with applyOutcome, which is the other half of the same rule', () => {
    for (const o of OUTCOMES) {
      expect(applyOutcome(o, 100).output).toBe(Math.round(100 * outcomeScale(o)))
    }
  })

  it('rewards a hit more than a miss for every base probability entry', () => {
    // Guards the specific regression where Boosted collapsed onto Hit.
    expect(Object.keys(DICE_BASE_PROBABILITIES).sort()).toEqual([...OUTCOMES].sort())
    expect(outcomeScale('Boosted')).toBeGreaterThan(outcomeScale('Hit'))
    expect(outcomeScale('Fail')).toBeGreaterThan(outcomeScale('Evade'))
  })
})
