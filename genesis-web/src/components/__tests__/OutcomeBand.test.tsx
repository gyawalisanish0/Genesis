// @vitest-environment jsdom
//
// The odds band is the same component at rest on a skill card and under the
// needle during a roll. Its zone widths ARE the probabilities, so a rendering
// bug here misinforms the player about what is about to happen.

import { describe, it, expect, afterEach } from 'vitest'
import { render, cleanup, screen } from '@testing-library/react'
import { OutcomeBand } from '../OutcomeBand'
import { DiceRoll } from '../DiceRoll'
import { forecastOutcomes } from '../../core/combat/OutcomeForecast'
import type { Unit } from '../../core/types'
import type { SkillDef } from '../../core/effects/types'

afterEach(cleanup)

const BASELINE = { Boosted: 0.10, Hit: 0.40, Evade: 0.20, Fail: 0.30 }
const zones = (c: HTMLElement) => Array.from(c.querySelectorAll('span[style*="width"]'))

describe('OutcomeBand', () => {
  it('sizes each zone to its probability', () => {
    const { container } = render(<OutcomeBand probabilities={BASELINE} />)
    const widths = zones(container).map(z => (z as HTMLElement).style.width)
    expect(widths).toEqual(['10%', '40%', '20%', '30%'])
  })

  it('orders zones best to worst', () => {
    const { container } = render(<OutcomeBand probabilities={BASELINE} size="roll" />)
    expect(container.textContent).toMatch(/HIT.*EVADE.*FAIL/s)
  })

  it('omits a zone with zero probability rather than drawing a sliver', () => {
    const { container } = render(<OutcomeBand probabilities={{ ...BASELINE, Boosted: 0 }} />)
    expect(zones(container)).toHaveLength(3)
  })

  it('drops the name of a zone too narrow to hold it, keeping the percentage', () => {
    // Boosted is 10% at baseline — the word would clip mid-render.
    const { container } = render(<OutcomeBand probabilities={BASELINE} size="roll" />)
    expect(container.textContent).toContain('10%')
    expect(container.textContent).not.toContain('BOOSTED')
  })

  it('shows the name once the zone is wide enough', () => {
    const wide = { Boosted: 0.5, Hit: 0.2, Evade: 0.15, Fail: 0.15 }
    const { container } = render(<OutcomeBand probabilities={wide} size="roll" />)
    expect(container.textContent).toContain('BOOSTED')
  })

  it('renders no labels at card size — it is a shape, not a readout', () => {
    const { container } = render(<OutcomeBand probabilities={BASELINE} size="card" />)
    expect(container.textContent).toBe('')
  })

  it('dims every zone except the one landed on', () => {
    const { container } = render(<OutcomeBand probabilities={BASELINE} landedOn="Hit" />)
    const dimmed = zones(container).filter(z => z.className.includes('dimmed'))
    expect(dimmed).toHaveLength(3)
  })
})

describe('DiceRoll', () => {
  it('announces the outcome the engine rolled', () => {
    render(<DiceRoll probabilities={BASELINE} outcome="Evade" />)
    expect(screen.getByRole('status').getAttribute('aria-label')).toBe('Roll: Evade')
    expect(screen.getByRole('status').textContent).toContain('EVADE')
  })

  it('the result callout carries the rolled outcome and nothing else', () => {
    // The needle reveals a decided result; it must never appear to decide one.
    // Asserted on the callout element specifically, since zone labels legitimately
    // print other outcome names inside the band.
    for (const outcome of ['Boosted', 'Hit', 'Evade', 'Fail'] as const) {
      cleanup()
      const { container } = render(<DiceRoll probabilities={BASELINE} outcome={outcome} />)
      const callout = container.querySelector('[class*="result"]')!
      expect(callout.textContent).toBe(outcome.toUpperCase())
    }
  })
})

describe('band ↔ engine agreement', () => {
  it('renders the exact table the resolver would roll against', () => {
    const caster = {
      stats: { precision: 72 }, statusSlots: [], apRegenRate: 0.6,
    } as unknown as Unit
    const skill = { tags: [], resolution: { baseChance: 1 } } as unknown as SkillDef
    const p = forecastOutcomes(caster, skill)

    const { container } = render(<OutcomeBand probabilities={p} />)
    const widths = zones(container).map(z => parseFloat((z as HTMLElement).style.width))
    const sum = widths.reduce((a, b) => a + b, 0)
    expect(sum).toBeCloseTo(100, 6)
    expect(widths[0]).toBeCloseTo(p.Boosted * 100, 6)
  })
})
