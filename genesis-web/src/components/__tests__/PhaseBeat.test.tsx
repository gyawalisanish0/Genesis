// @vitest-environment jsdom
//
// One resolution phase's reveal: sweep, settle, hold, then hand off. The
// negative control that matters here is timing — onSettled must not fire
// before the needle has actually locked on, or the beat reads as decided
// before it visibly rolled.

import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest'
import { render, cleanup, act } from '@testing-library/react'
import { PhaseBeat } from '../PhaseBeat'
import { PHASE_SWEEP_MS, PHASE_GAP_MS } from '../../core/constants'

afterEach(cleanup)

const ORDER = ['Read', 'Deflect', 'Caught'] as const
const PROBS = { Read: 0.2, Deflect: 0.3, Caught: 0.5 }

describe('PhaseBeat', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('shows the label and the eventual result text from the first render', () => {
    const { container } = render(
      <PhaseBeat label="REACTION" tone="reaction" order={ORDER} probabilities={PROBS} result="Deflect" onSettled={() => {}} />,
    )
    expect(container.textContent).toContain('REACTION')
    expect(container.textContent).toContain('DEFLECT')
  })

  it('sweeps before settling — the needle has no fixed position yet', () => {
    const { container } = render(
      <PhaseBeat label="STRIKE" tone="strike" order={['Clean', 'Solid', 'Loose']} probabilities={{ Clean: 0.2, Solid: 0.5, Loose: 0.3 }} result="Solid" onSettled={() => {}} />,
    )
    const needle = container.querySelector('[class*="needle"]') as HTMLElement
    expect(needle.className).toContain('needleSweeping')
    expect(needle.style.left).toBe('')
  })

  it('does not call onSettled before the sweep has finished', () => {
    const onSettled = vi.fn()
    render(<PhaseBeat label="STRIKE" tone="strike" order={ORDER} probabilities={PROBS} result="Caught" onSettled={onSettled} />)

    act(() => { vi.advanceTimersByTime(PHASE_SWEEP_MS - 10) })
    expect(onSettled).not.toHaveBeenCalled()
  })

  it('settles the needle at the sweep boundary, then holds before advancing', () => {
    const onSettled = vi.fn()
    const { container } = render(
      <PhaseBeat label="STRIKE" tone="strike" order={ORDER} probabilities={PROBS} result="Caught" onSettled={onSettled} />,
    )

    act(() => { vi.advanceTimersByTime(PHASE_SWEEP_MS) })
    const needle = container.querySelector('[class*="needle"]') as HTMLElement
    expect(needle.className).toContain('needleSettled')
    // Onto the centre of Caught's zone: Read 20% + Deflect 30% + half of Caught's 50%.
    expect(parseFloat(needle.style.left)).toBeCloseTo(75, 5)
    expect(onSettled).not.toHaveBeenCalled()

    act(() => { vi.advanceTimersByTime(PHASE_GAP_MS) })
    expect(onSettled).toHaveBeenCalledTimes(1)
  })

  it('cancels its pending hold if unmounted mid-beat, so onSettled never fires on a dead beat', () => {
    const onSettled = vi.fn()
    const { unmount } = render(
      <PhaseBeat label="STRIKE" tone="strike" order={ORDER} probabilities={PROBS} result="Caught" onSettled={onSettled} />,
    )
    act(() => { vi.advanceTimersByTime(PHASE_SWEEP_MS) })
    unmount()
    act(() => { vi.advanceTimersByTime(PHASE_GAP_MS + 100) })
    expect(onSettled).not.toHaveBeenCalled()
  })
})
