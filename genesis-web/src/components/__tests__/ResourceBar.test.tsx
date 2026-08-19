// @vitest-environment jsdom
//
// ResourceBar — segmented HP/AP/XP fill. The behaviour that matters is the
// discrete block count (not a continuous width) and the HP colour tiers,
// since those are the two things migration step 7 changed.

import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import { ResourceBar } from '../ResourceBar'
import { RESOURCE_BAR_SEGMENT_COUNT } from '../../core/constants'

function segments(container: HTMLElement) {
  return container.querySelector('[role="progressbar"]')!.querySelectorAll('span')
}

function countByClass(spans: NodeListOf<Element>, key: 'filled' | 'shielded' | 'empty') {
  return Array.from(spans).filter(s => s.className.toLowerCase().includes(key)).length
}

describe('ResourceBar', () => {
  it('renders a fixed number of segments regardless of max', () => {
    const { container } = render(<ResourceBar variant="hp" value={40} max={100} />)
    expect(segments(container)).toHaveLength(RESOURCE_BAR_SEGMENT_COUNT)
  })

  it('fills segments proportional to value/max', () => {
    const { container } = render(<ResourceBar variant="hp" value={50} max={100} />)
    const spans = segments(container)
    expect(countByClass(spans, 'filled')).toBe(RESOURCE_BAR_SEGMENT_COUNT / 2)
  })

  it('fills every segment at full value', () => {
    const { container } = render(<ResourceBar variant="ap" value={30} max={30} />)
    expect(countByClass(segments(container), 'filled')).toBe(RESOURCE_BAR_SEGMENT_COUNT)
  })

  it('fills no segment at zero value', () => {
    const { container } = render(<ResourceBar variant="xp" value={0} max={30} />)
    expect(countByClass(segments(container), 'filled')).toBe(0)
  })

  it('clamps a value above max to a full bar', () => {
    const { container } = render(<ResourceBar variant="hp" value={999} max={100} />)
    expect(countByClass(segments(container), 'filled')).toBe(RESOURCE_BAR_SEGMENT_COUNT)
  })

  it('draws shielded segments past the value fill', () => {
    const { container } = render(<ResourceBar variant="hp" value={50} max={100} shieldHp={20} />)
    const spans = segments(container)
    expect(countByClass(spans, 'filled')).toBe(RESOURCE_BAR_SEGMENT_COUNT / 2)
    expect(countByClass(spans, 'shielded')).toBe(RESOURCE_BAR_SEGMENT_COUNT / 5)
  })

  it('caps shield segments at the bar end when value + shield exceed max', () => {
    const { container } = render(<ResourceBar variant="hp" value={90} max={100} shieldHp={50} />)
    const spans = segments(container)
    const filled = countByClass(spans, 'filled')
    const shielded = countByClass(spans, 'shielded')
    expect(filled + shielded).toBe(RESOURCE_BAR_SEGMENT_COUNT)
  })

  it('applies no tone modifier above the low threshold', () => {
    const { container } = render(<ResourceBar variant="hp" value={80} max={100} />)
    const track = container.querySelector('[role="progressbar"]')!
    expect(track.className).not.toMatch(/low|critical/)
  })

  it('applies the low tone under 50% hp', () => {
    const { container } = render(<ResourceBar variant="hp" value={40} max={100} />)
    const track = container.querySelector('[role="progressbar"]')!
    expect(track.className).toMatch(/low/)
  })

  it('applies the critical tone under 25% hp', () => {
    const { container } = render(<ResourceBar variant="hp" value={10} max={100} />)
    const track = container.querySelector('[role="progressbar"]')!
    expect(track.className).toMatch(/critical/)
  })

  it('never applies hp tone classes to ap or xp bars', () => {
    const { container } = render(<ResourceBar variant="ap" value={5} max={100} />)
    const track = container.querySelector('[role="progressbar"]')!
    expect(track.className).not.toMatch(/low|critical/)
  })

  it('renders the value/max label only when showLabel is set', () => {
    const { queryByText, rerender } = render(<ResourceBar variant="hp" value={7} max={10} />)
    expect(queryByText('7/10')).toBeNull()
    rerender(<ResourceBar variant="hp" value={7} max={10} showLabel />)
    expect(queryByText('7/10')).not.toBeNull()
  })

  it('exposes progressbar aria attributes for accessibility', () => {
    const { container } = render(<ResourceBar variant="hp" value={7} max={10} />)
    const track = container.querySelector('[role="progressbar"]')!
    expect(track.getAttribute('aria-valuenow')).toBe('7')
    expect(track.getAttribute('aria-valuemax')).toBe('10')
  })
})
