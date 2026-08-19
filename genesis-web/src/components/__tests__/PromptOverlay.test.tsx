// @vitest-environment jsdom
//
// PromptOverlay — the blocking-decision contract. The engine waits on these,
// so the safety-critical property is that they CANNOT be dismissed: no ✕, no
// Esc, no incidental backdrop close.

import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, cleanup, fireEvent } from '@testing-library/react'
import { PromptOverlay } from '../PromptOverlay'

afterEach(cleanup)

function tap(el: Element) {
  fireEvent.pointerDown(el, { clientX: 0, clientY: 0 })
  fireEvent.pointerUp(el, { clientX: 0, clientY: 0 })
}

describe('PromptOverlay', () => {
  it('renders title, subtitle, and body', () => {
    render(
      <PromptOverlay title="SIMULTANEOUS TURN" subtitle="1 of 2">
        <p>Act now or wait?</p>
      </PromptOverlay>,
    )
    expect(screen.getByText('SIMULTANEOUS TURN')).toBeTruthy()
    expect(screen.getByText('1 of 2')).toBeTruthy()
    expect(screen.getByText('Act now or wait?')).toBeTruthy()
  })

  it('is a labelled modal dialog', () => {
    render(<PromptOverlay title="CLASH">x</PromptOverlay>)
    const d = screen.getByRole('dialog')
    expect(d.getAttribute('aria-modal')).toBe('true')
    expect(d.getAttribute('aria-label')).toBe('CLASH')
  })

  it('offers NO close affordance — the player must decide', () => {
    render(<PromptOverlay title="CLASH">x</PromptOverlay>)
    expect(screen.queryByRole('button', { name: 'Close' })).toBeNull()
  })

  it('ignores Escape (a prompt is not dismissible)', () => {
    const onPress = vi.fn()
    render(<PromptOverlay title="T" actions={[{ label: 'NOW', onPress }]}>x</PromptOverlay>)
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(onPress).not.toHaveBeenCalled()
    expect(screen.getByRole('dialog')).toBeTruthy()   // still open
  })

  it('renders actions as buttons and fires the right one', () => {
    const now = vi.fn(); const later = vi.fn()
    render(
      <PromptOverlay title="T" actions={[
        { label: 'NOW', onPress: now },
        { label: 'LATER', variant: 'secondary', onPress: later },
      ]}>body</PromptOverlay>,
    )
    tap(screen.getByRole('button', { name: 'LATER' }))
    expect(later).toHaveBeenCalledOnce()
    expect(now).not.toHaveBeenCalled()
  })

  it('renders no actions row when actions are omitted (QTE-style prompt)', () => {
    render(<PromptOverlay title="CLASH">knob</PromptOverlay>)
    expect(screen.queryAllByRole('button')).toHaveLength(0)
  })

  it('fires onBackdropTap when the surface itself is the input', () => {
    const onBackdropTap = vi.fn()
    const { container } = render(
      <PromptOverlay title="CLASH" onBackdropTap={onBackdropTap}>knob</PromptOverlay>,
    )
    tap(container.firstElementChild!)
    expect(onBackdropTap).toHaveBeenCalledOnce()
  })

  it('does not fire anything on backdrop tap when onBackdropTap is absent', () => {
    const onPress = vi.fn()
    const { container } = render(
      <PromptOverlay title="T" actions={[{ label: 'NOW', onPress }]}>body</PromptOverlay>,
    )
    tap(container.firstElementChild!)
    expect(onPress).not.toHaveBeenCalled()
  })
})
