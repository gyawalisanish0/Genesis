// @vitest-environment jsdom
//
// Sheet behaviour — the backdrop/dismissal/animation contract the four migrated
// overlays now depend on. Visual chrome is covered by validate:ui; this covers
// the logic: what renders, and every path that does or does not close it.

import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, cleanup, fireEvent } from '@testing-library/react'
import { Sheet } from '../Sheet'

afterEach(cleanup)

/** A scroll-aware "tap": pointer down then up with no movement. */
function tap(el: Element) {
  fireEvent.pointerDown(el, { clientX: 0, clientY: 0 })
  fireEvent.pointerUp(el, { clientX: 0, clientY: 0 })
}

describe('Sheet', () => {
  it('renders nothing when open is false', () => {
    const { container } = render(<Sheet open={false}><p>hi</p></Sheet>)
    expect(container.firstChild).toBeNull()
  })

  it('renders children and is a labelled modal dialog', () => {
    render(<Sheet title="BATTLE LOG"><p>entry</p></Sheet>)
    expect(screen.getByText('entry')).toBeTruthy()
    const dialog = screen.getByRole('dialog')
    expect(dialog.getAttribute('aria-modal')).toBe('true')
    expect(dialog.getAttribute('aria-label')).toBe('BATTLE LOG')
    expect(screen.getByText('BATTLE LOG')).toBeTruthy()
  })

  it('closes on ✕ when dismissible', () => {
    const onClose = vi.fn()
    render(<Sheet onClose={onClose}><p>body</p></Sheet>)
    tap(screen.getByRole('button', { name: 'Close' }))
    expect(onClose).toHaveBeenCalledOnce()
  })

  it('closes on backdrop tap when dismissible', () => {
    const onClose = vi.fn()
    const { container } = render(<Sheet onClose={onClose}><p>body</p></Sheet>)
    tap(container.firstElementChild!)   // the backdrop
    expect(onClose).toHaveBeenCalledOnce()
  })

  it('does NOT close when the panel itself is tapped (stopPropagation)', () => {
    const onClose = vi.fn()
    render(<Sheet onClose={onClose}><p>body</p></Sheet>)
    tap(screen.getByRole('dialog'))
    expect(onClose).not.toHaveBeenCalled()
  })

  it('closes on Escape when dismissible', () => {
    const onClose = vi.fn()
    render(<Sheet onClose={onClose}><p>body</p></Sheet>)
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(onClose).toHaveBeenCalledOnce()
  })

  it('is inert when not dismissible — no ✕, and backdrop/Esc do nothing', () => {
    const onClose = vi.fn()
    const { container } = render(
      <Sheet dismissible={false} onClose={onClose}><p>must act</p></Sheet>,
    )
    expect(screen.queryByRole('button', { name: 'Close' })).toBeNull()
    tap(container.firstElementChild!)
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(onClose).not.toHaveBeenCalled()
  })

  it('applies the placement class', () => {
    const { container, rerender } = render(<Sheet><p>b</p></Sheet>)
    expect(container.firstElementChild!.className).toMatch(/bottom/)
    rerender(<Sheet placement="centre"><p>b</p></Sheet>)
    expect(container.firstElementChild!.className).toMatch(/centre/)
  })

  it('applies an accent as an inline --panel-outer override', () => {
    render(<Sheet accent="var(--accent-gold)"><p>b</p></Sheet>)
    const dialog = screen.getByRole('dialog') as HTMLElement
    expect(dialog.style.getPropertyValue('--panel-outer')).toBe('var(--accent-gold)')
  })

  it('renders a floating ✕ (no header bar) when there is no title', () => {
    render(<Sheet onClose={() => {}}><p>b</p></Sheet>)
    // Close button exists, but no title text node
    expect(screen.getByRole('button', { name: 'Close' })).toBeTruthy()
  })
})
