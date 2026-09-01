// The AnimPhase executor was deleted with the Phaser renderer, leaving all 15
// variants as dead letters. This pins the replacement's planning rules —
// especially branch selection and the budget clamp, since nothing awaits the
// animation and an over-long plan would be cut off mid-beat.

import { describe, it, expect } from 'vitest'
import { planSequence, planDuration, defaultSequence } from '../AnimSequence'
import type { AnimPhase } from '../../types'
import { SEQUENCE_BUDGET_MS, SHOVE_OUT_MS, EVADE_DODGE_MS } from '../../constants'

describe('planSequence — scheduling', () => {
  it('schedules sequential phases end to end', () => {
    const seq: AnimPhase[] = [
      { type: 'wait', ms: 100 },
      { type: 'wait', ms: 200 },
      { type: 'feedback' },
    ]
    expect(planSequence(seq, 'Hit').map(s => s.atMs)).toEqual([0, 100, 300])
  })

  it('starts every child of a parallel block at the same time', () => {
    const seq: AnimPhase[] = [
      { type: 'parallel', phases: [{ type: 'damageNumber' }, { type: 'feedback' }, { type: 'impact' }] },
    ]
    expect(planSequence(seq, 'Hit').map(s => s.atMs)).toEqual([0, 0, 0])
  })

  it('advances past a parallel block by its longest child, not the sum', () => {
    const seq: AnimPhase[] = [
      { type: 'parallel', phases: [{ type: 'wait', ms: 100 }, { type: 'wait', ms: 400 }] },
      { type: 'feedback' },
    ]
    const steps = planSequence(seq, 'Hit')
    expect(steps[steps.length - 1].atMs).toBe(400)
  })

  it('flattens nested parallels', () => {
    const seq: AnimPhase[] = [
      { type: 'parallel', phases: [
        { type: 'parallel', phases: [{ type: 'impact' }, { type: 'feedback' }] },
        { type: 'damageNumber' },
      ] },
    ]
    expect(planSequence(seq, 'Hit')).toHaveLength(3)
  })
})

describe('planSequence — branch', () => {
  const seq: AnimPhase[] = [{
    type: 'branch',
    cases: {
      Boosted: [{ type: 'statusText', text: 'BOOST', colour: '#fff' }],
      Hit:     [{ type: 'statusText', text: 'HIT',   colour: '#fff' }],
      default: [{ type: 'statusText', text: 'OTHER', colour: '#fff' }],
    },
  }]

  it('picks the case matching the rolled outcome', () => {
    const [step] = planSequence(seq, 'Boosted')
    expect((step.phase as { text: string }).text).toBe('BOOST')
  })

  it('falls back to default for an unlisted outcome', () => {
    const [step] = planSequence(seq, 'Evade')
    expect((step.phase as { text: string }).text).toBe('OTHER')
  })

  it('produces nothing when neither the outcome nor a default is listed', () => {
    const bare: AnimPhase[] = [{ type: 'branch', cases: { Hit: [{ type: 'impact' }] } }]
    expect(planSequence(bare, 'Graze')).toEqual([])
  })
})

describe('planSequence — budget', () => {
  it('leaves a plan that already fits untouched', () => {
    const seq: AnimPhase[] = [{ type: 'wait', ms: 100 }, { type: 'feedback' }]
    expect(planSequence(seq, 'Hit').map(s => s.atMs)).toEqual([0, 100])
  })

  it('compresses an over-long plan into the budget', () => {
    const seq: AnimPhase[] = [
      { type: 'wait', ms: 5000 }, { type: 'feedback' },
      { type: 'wait', ms: 5000 }, { type: 'impact' },
    ]
    const steps = planSequence(seq, 'Hit')
    expect(Math.max(...steps.map(s => s.atMs))).toBeLessThanOrEqual(SEQUENCE_BUDGET_MS)
  })

  it('preserves relative ordering when compressing', () => {
    const seq: AnimPhase[] = [
      { type: 'wait', ms: 4000 }, { type: 'feedback' },
      { type: 'wait', ms: 4000 }, { type: 'impact' },
    ]
    const at = planSequence(seq, 'Hit').map(s => s.atMs)
    expect(at).toEqual([...at].sort((a, b) => a - b))
  })

  it('never divides by zero on an empty or instantaneous sequence', () => {
    expect(planSequence([], 'Hit')).toEqual([])
    expect(() => planSequence([{ type: 'feedback' }], 'Hit')).not.toThrow()
  })
})

describe('defaultSequence', () => {
  it('opens melee with a shove and ranged with a projectile', () => {
    expect(planSequence(defaultSequence(true), 'Hit')[0].phase.type).toBe('shove')
    expect(planSequence(defaultSequence(false), 'Hit')[0].phase.type).toBe('projectile')
  })

  it('makes Evade and Graze visually distinct — the defender moves on an evade', () => {
    // Both used to print a word and nothing else, so they read identically.
    const evade = planSequence(defaultSequence(true), 'Evade').map(s => s.phase.type)
    const graze = planSequence(defaultSequence(true), 'Graze').map(s => s.phase.type)
    expect(evade).toContain('evasionDodge')
    expect(graze).not.toContain('evasionDodge')
    expect(evade).not.toEqual(graze)
  })

  it('shakes harder on a boosted hit than a normal one', () => {
    const shakeOf = (o: 'Boosted' | 'Hit') =>
      planSequence(defaultSequence(true), o)
        .map(s => s.phase).find(p => p.type === 'cameraShake') as { duration: number } | undefined
    expect(shakeOf('Boosted')!.duration).toBeGreaterThan(shakeOf('Hit')!.duration)
  })

  it('every outcome yields a plan inside the budget', () => {
    for (const outcome of ['Boosted', 'Hit', 'Evade', 'Graze'] as const) {
      for (const melee of [true, false]) {
        const steps = planSequence(defaultSequence(melee), outcome)
        expect(steps.length).toBeGreaterThan(0)
        expect(planDuration(steps)).toBeLessThanOrEqual(SEQUENCE_BUDGET_MS)
      }
    }
  })

  it('schedules the shove before the impact that follows it', () => {
    const steps = planSequence(defaultSequence(true), 'Hit')
    const shove  = steps.find(s => s.phase.type === 'shove')!
    const impact = steps.find(s => s.phase.type === 'impact')!
    expect(impact.atMs).toBe(shove.atMs + SHOVE_OUT_MS)
  })

  it('holds the evade feedback until after the dodge completes', () => {
    const steps = planSequence(defaultSequence(true), 'Evade')
    const dodge = steps.find(s => s.phase.type === 'evasionDodge')!
    const fb    = steps.find(s => s.phase.type === 'feedback')!
    expect(fb.atMs).toBe(dodge.atMs + EVADE_DODGE_MS)
  })
})
