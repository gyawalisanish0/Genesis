// @vitest-environment jsdom
//
// Toaster — the transient chip that replaced three implementations plus an
// inline one-off. The behaviours that differed between those four (persistence,
// auto-expiry, tap-dismissal, placement) are exactly what needs pinning here.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, cleanup, fireEvent, act } from '@testing-library/react'
import { Toaster } from '../Toaster'
import { HINT_TOASTER_DURATION_MS, HINT_STORAGE_PREFIX } from '../../core/constants'

beforeEach(() => { localStorage.clear(); vi.useFakeTimers() })
afterEach(() => { vi.useRealTimers(); cleanup() })

const advance = (ms: number) => act(() => { vi.advanceTimersByTime(ms) })

describe('Toaster', () => {
  it('renders nothing when message is null', () => {
    const { container } = render(<Toaster message={null} />)
    expect(container.firstChild).toBeNull()
  })

  it('renders the message with a status role', () => {
    render(<Toaster message="Tap a skill" />)
    expect(screen.getByRole('status').textContent).toContain('Tap a skill')
  })

  it('auto-dismisses after the duration and reports it', () => {
    const onDismiss = vi.fn()
    render(<Toaster message="gone soon" onDismiss={onDismiss} />)
    expect(screen.queryByRole('status')).not.toBeNull()

    advance(HINT_TOASTER_DURATION_MS)

    expect(screen.queryByRole('status')).toBeNull()
    expect(onDismiss).toHaveBeenCalledOnce()
  })

  it('honours a custom durationMs', () => {
    render(<Toaster message="brief" durationMs={500} />)
    advance(499)
    expect(screen.queryByRole('status')).not.toBeNull()
    advance(1)
    expect(screen.queryByRole('status')).toBeNull()
  })

  it('dismisses on tap and reports it', () => {
    const onDismiss = vi.fn()
    render(<Toaster message="tap me" onDismiss={onDismiss} />)
    fireEvent.pointerDown(screen.getByRole('status'))
    expect(screen.queryByRole('status')).toBeNull()
    expect(onDismiss).toHaveBeenCalledOnce()
  })

  it('ignores taps when not dismissible (must not eat taps meant for the UI below)', () => {
    const onDismiss = vi.fn()
    render(<Toaster message="inert" dismissible={false} onDismiss={onDismiss} />)
    fireEvent.pointerDown(screen.getByRole('status'))
    expect(screen.queryByRole('status')).not.toBeNull()
    expect(onDismiss).not.toHaveBeenCalled()
  })

  // ── onceId persistence ────────────────────────────────────────────────────

  it('shows a once-only hint the first time and records it', () => {
    render(<Toaster message="first run" onceId="tut-1" />)
    expect(screen.queryByRole('status')).not.toBeNull()
    expect(localStorage.getItem(`${HINT_STORAGE_PREFIX}tut-1`)).toBe('1')
  })

  it('never shows the same once-only hint again', () => {
    localStorage.setItem(`${HINT_STORAGE_PREFIX}tut-1`, '1')
    render(<Toaster message="first run" onceId="tut-1" />)
    expect(screen.queryByRole('status')).toBeNull()
  })

  it('a different onceId is unaffected by another hint being seen', () => {
    localStorage.setItem(`${HINT_STORAGE_PREFIX}tut-1`, '1')
    render(<Toaster message="other hint" onceId="tut-2" />)
    expect(screen.queryByRole('status')).not.toBeNull()
  })

  // ── Presentation ──────────────────────────────────────────────────────────

  it('applies the tone class', () => {
    const { container, rerender } = render(<Toaster message="m" />)
    expect(container.firstElementChild!.className).toMatch(/hint/)
    rerender(<Toaster message="m" tone="warn" />)
    expect(container.firstElementChild!.className).toMatch(/warn/)
    rerender(<Toaster message="m" tone="error" />)
    expect(container.firstElementChild!.className).toMatch(/error/)
  })

  it('applies the placement class, defaulting to top', () => {
    const { container, rerender } = render(<Toaster message="m" />)
    expect(container.firstElementChild!.className).toMatch(/top/)
    rerender(<Toaster message="m" position="inline" />)
    expect(container.firstElementChild!.className).toMatch(/inline/)
  })

  it('shows a glyph when screen-level but not inline (panel chips stay compact)', () => {
    const { rerender } = render(<Toaster message="hello" />)
    expect(screen.getByRole('status').textContent).toContain('💡')
    rerender(<Toaster message="hello" position="inline" />)
    expect(screen.getByRole('status').textContent).toBe('hello')
  })
})
