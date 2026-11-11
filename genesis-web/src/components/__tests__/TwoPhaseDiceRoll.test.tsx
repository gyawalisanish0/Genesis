// @vitest-environment jsdom
//
// The orchestrator: strike beat, then reaction beat, then the existing
// combined-outcome DiceRoll. Each transition is asserted by what's on screen,
// not by reading component state, so a regression that silently skips a beat
// (e.g. jumping straight from strike to the final outcome) shows up as the
// wrong text being present at the wrong time.

import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest'
import { render, cleanup, act } from '@testing-library/react'
import { TwoPhaseDiceRoll } from '../TwoPhaseDiceRoll'
import { PHASE_SWEEP_MS, PHASE_GAP_MS, DICE_SWEEP_MS } from '../../core/constants'
import type { DicePhaseData } from '../../core/battle/EngineTypes'

afterEach(cleanup)

const PHASES: DicePhaseData = {
  strike: 'Solid', strikeProbabilities: { Clean: 0.2, Solid: 0.5, Loose: 0.3 },
  reaction: 'Caught', reactionProbabilities: { Read: 0.2, Deflect: 0.3, Caught: 0.5 },
}
const PROBABILITIES = { Boosted: 0.12, Hit: 0.32, Graze: 0.33, Evade: 0.23 }

const PHASE_BEAT_MS = PHASE_SWEEP_MS + PHASE_GAP_MS

describe('TwoPhaseDiceRoll', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('opens on the strike beat', () => {
    const { container } = render(<TwoPhaseDiceRoll phases={PHASES} probabilities={PROBABILITIES} outcome="Hit" />)
    expect(container.textContent).toContain('STRIKE')
    expect(container.textContent).not.toContain('REACTION')
  })

  it('advances to the reaction beat once the strike beat settles and holds', () => {
    const { container } = render(<TwoPhaseDiceRoll phases={PHASES} probabilities={PROBABILITIES} outcome="Hit" />)

    act(() => { vi.advanceTimersByTime(PHASE_BEAT_MS - 10) })
    expect(container.textContent).toContain('STRIKE')

    act(() => { vi.advanceTimersByTime(10) })
    expect(container.textContent).toContain('REACTION')
    expect(container.textContent).not.toContain('STRIKE')
  })

  it('reaches the combined outcome only after both phase beats have played', () => {
    // Each advance is its own act() so React actually mounts the next beat
    // (and that beat's own effect arms its own timer) before the fake clock
    // is asked to run further — a single large jump can outrun the commit
    // that would have scheduled the next timer at all.
    const { container } = render(<TwoPhaseDiceRoll phases={PHASES} probabilities={PROBABILITIES} outcome="Hit" />)

    act(() => { vi.advanceTimersByTime(PHASE_BEAT_MS) })  // strike -> reaction
    expect(container.querySelector('[role="status"]')?.getAttribute('aria-label')).not.toContain('Roll:')

    act(() => { vi.advanceTimersByTime(PHASE_BEAT_MS) })  // reaction -> outcome
    const roll = container.querySelector('[role="status"]')
    expect(roll?.getAttribute('aria-label')).toBe('Roll: Hit')
  })

  it('the final DiceRoll settles on the actual rolled outcome, not the phase labels', () => {
    const { container } = render(<TwoPhaseDiceRoll phases={PHASES} probabilities={PROBABILITIES} outcome="Boosted" />)
    act(() => { vi.advanceTimersByTime(PHASE_BEAT_MS) })       // strike -> reaction
    act(() => { vi.advanceTimersByTime(PHASE_BEAT_MS) })       // reaction -> outcome
    act(() => { vi.advanceTimersByTime(DICE_SWEEP_MS) })       // DiceRoll's own sweep settles
    const callout = container.querySelector('[class*="result"]')!
    expect(callout.textContent).toBe('BOOSTED')
  })
})
