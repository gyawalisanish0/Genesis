// @vitest-environment jsdom
//
// The strike/reaction odds strip. Same contract as OutcomeBand's zone sizing —
// zone widths ARE the probabilities — over a 3-band phase table instead of the
// 4 final outcomes.

import { describe, it, expect, afterEach } from 'vitest'
import { render, cleanup } from '@testing-library/react'
import { PhaseBand } from '../PhaseBand'

afterEach(cleanup)

const STRIKE_ORDER = ['Clean', 'Solid', 'Loose'] as const
const STRIKE_PROBS  = { Clean: 0.2, Solid: 0.5, Loose: 0.3 }

const zones = (c: HTMLElement) => Array.from(c.querySelectorAll('span'))

describe('PhaseBand', () => {
  it('sizes each zone to its probability', () => {
    const { container } = render(
      <PhaseBand order={STRIKE_ORDER} probabilities={STRIKE_PROBS} landedOn={null} tone="strike" />,
    )
    const widths = zones(container).map(z => z.style.width)
    expect(widths).toEqual(['20%', '50%', '30%'])
  })

  it('dims every zone except the one landed on', () => {
    const { container } = render(
      <PhaseBand order={STRIKE_ORDER} probabilities={STRIKE_PROBS} landedOn="Solid" tone="strike" />,
    )
    const dimmed = zones(container).filter(z => z.className.includes('dimmed'))
    expect(dimmed).toHaveLength(2)
  })

  it('dims nothing while nobody has landed yet', () => {
    const { container } = render(
      <PhaseBand order={STRIKE_ORDER} probabilities={STRIKE_PROBS} landedOn={null} tone="strike" />,
    )
    expect(zones(container).some(z => z.className.includes('dimmed'))).toBe(false)
  })

  it('omits a zone with zero probability', () => {
    const { container } = render(
      <PhaseBand order={STRIKE_ORDER} probabilities={{ ...STRIKE_PROBS, Loose: 0 }} landedOn={null} tone="strike" />,
    )
    expect(zones(container)).toHaveLength(2)
  })
})
