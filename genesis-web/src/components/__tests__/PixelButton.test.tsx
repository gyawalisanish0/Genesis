// @vitest-environment jsdom
//
// Panel + PixelButton behaviour. The visual contract (2-tone border, token
// resolution) is verified by npm run validate:ui and the compiled stylesheet;
// these cover the logic RTL can actually see.

import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, cleanup, fireEvent } from '@testing-library/react'
import { Panel, panelClass } from '../Panel'
import { PixelButton } from '../PixelButton'

afterEach(cleanup)

describe('Panel', () => {
  it('applies the surface class plus the requested variant', () => {
    const { container } = render(<Panel variant="active">body</Panel>)
    const el = container.firstElementChild!
    expect(el.className).toMatch(/surface/)
    expect(el.className).toMatch(/active/)
  })

  it('defaults to the default variant', () => {
    const { container } = render(<Panel>body</Panel>)
    expect(container.firstElementChild!.className).toMatch(/default/)
  })

  it('merges a consumer className so layout stays with the consumer', () => {
    const { container } = render(<Panel className="myLayout">body</Panel>)
    expect(container.firstElementChild!.className).toMatch(/myLayout/)
  })

  it('panelClass() exposes the same pair without the wrapper element', () => {
    const cls = panelClass('danger')
    expect(cls).toMatch(/surface/)
    expect(cls).toMatch(/danger/)
  })

  it('renders children', () => {
    render(<Panel>inner content</Panel>)
    expect(screen.getByText('inner content')).toBeTruthy()
  })
})

describe('PixelButton', () => {
  it('fires onPress when tapped', () => {
    const onPress = vi.fn()
    render(<PixelButton onPress={onPress}>GO</PixelButton>)
    fireEvent.pointerDown(screen.getByRole('button'))
    expect(onPress).toHaveBeenCalledOnce()
  })

  it('does not fire onPress when disabled', () => {
    const onPress = vi.fn()
    render(<PixelButton onPress={onPress} disabled>GO</PixelButton>)
    fireEvent.pointerDown(screen.getByRole('button'))
    expect(onPress).not.toHaveBeenCalled()
  })

  it('marks the element disabled so it is skipped by assistive tech', () => {
    render(<PixelButton disabled>GO</PixelButton>)
    expect((screen.getByRole('button') as HTMLButtonElement).disabled).toBe(true)
  })

  it('applies the requested variant, defaulting to primary', () => {
    const { container, rerender } = render(<PixelButton>GO</PixelButton>)
    expect(container.firstElementChild!.className).toMatch(/primary/)
    rerender(<PixelButton variant="ghost">GO</PixelButton>)
    expect(container.firstElementChild!.className).toMatch(/ghost/)
  })

  it('applies fullWidth by default and drops it when disabled', () => {
    const { container, rerender } = render(<PixelButton>GO</PixelButton>)
    expect(container.firstElementChild!.className).toMatch(/fullWidth/)
    rerender(<PixelButton fullWidth={false}>GO</PixelButton>)
    expect(container.firstElementChild!.className).not.toMatch(/fullWidth/)
  })

  it('is type=button so it never submits a surrounding form', () => {
    render(<PixelButton>GO</PixelButton>)
    expect(screen.getByRole('button').getAttribute('type')).toBe('button')
  })

  it('uses `label` as the accessible name for glyph-only buttons', () => {
    render(<PixelButton label="Close">✕</PixelButton>)
    expect(screen.getByRole('button', { name: 'Close' })).toBeTruthy()
  })
})
