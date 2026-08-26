// @vitest-environment jsdom
//
// ScriptPlayer — the opening is the first thing a new player sees, and three of
// its behaviours are the kind that break silently: a tap eating text nobody
// read, an authored [NAME] token reaching the screen unresolved, and a name
// field appearing without the question it answers.

import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, cleanup, fireEvent, act } from '@testing-library/react'
import { ScriptPlayer } from '../ScriptPlayer'
import type { ScriptLine } from '../../core/script/types'
import { SCRIPT_TYPE_MS } from '../../core/constants'

afterEach(() => { cleanup(); vi.useRealTimers() })

const SCRIPT: ScriptLine[] = [
  { kind: 'dialogue', who: 'creator', text: 'What is it?' },
  { kind: 'input',    inputKey: 'commanderName', placeholder: 'your name...' },
  { kind: 'dialogue', who: 'creator', text: '[NAME].' },
]

function renderPlayer(over: Partial<Parameters<typeof ScriptPlayer>[0]> = {}) {
  const onInput    = vi.fn()
  const onComplete = vi.fn()
  render(
    <ScriptPlayer
      lines={SCRIPT}
      speakerName={(who) => who.toUpperCase()}
      resolveText={(text) => text.split('[NAME]').join('SANISH')}
      onInput={onInput}
      onComplete={onComplete}
      {...over}
    />,
  )
  return { onInput, onComplete }
}

/**
 * Drain the typewriter.
 *
 * One long `advanceTimersByTime` does not work: each character's timeout is
 * scheduled by an effect that only runs on commit, so the chain has to be
 * stepped one act() at a time.
 */
function finishTyping(steps = 200) {
  for (let i = 0; i < steps; i++) act(() => { vi.advanceTimersByTime(SCRIPT_TYPE_MS) })
}

function tapScreen() {
  fireEvent.pointerDown(document.querySelector('[class*="root"]')!)
}

describe('ScriptPlayer', () => {
  it('completes the line on the first tap instead of skipping it', () => {
    vi.useFakeTimers()
    renderPlayer()

    // Mid-line: one tap must reveal the rest, not advance past it.
    tapScreen()
    expect(screen.getByText('What is it?')).toBeTruthy()
  })

  it('advances only once the line is finished', () => {
    vi.useFakeTimers()
    renderPlayer()
    finishTyping()
    expect(screen.getByText('What is it?')).toBeTruthy()

    tapScreen()
    expect(screen.queryByPlaceholderText('your name...')).toBeTruthy()
  })

  it('keeps the question on screen while the player answers it', () => {
    vi.useFakeTimers()
    renderPlayer()
    finishTyping()
    tapScreen()

    // Without this the player faces a bare text box with no idea what it wants.
    expect(screen.getByText('What is it?')).toBeTruthy()
  })

  it('reports the answer and moves on', () => {
    vi.useFakeTimers()
    const { onInput } = renderPlayer()
    finishTyping()
    tapScreen()

    const field = screen.getByPlaceholderText('your name...')
    fireEvent.change(field, { target: { value: '  SANISH  ' } })
    fireEvent.click(screen.getByText('OK'))

    expect(onInput).toHaveBeenCalledWith('commanderName', 'SANISH')
  })

  it('refuses an empty answer rather than advancing past the question', () => {
    vi.useFakeTimers()
    const { onInput } = renderPlayer()
    finishTyping()
    tapScreen()

    fireEvent.change(screen.getByPlaceholderText('your name...'), { target: { value: '   ' } })
    fireEvent.click(screen.getByText('OK'))

    expect(onInput).not.toHaveBeenCalled()
    expect(screen.getByPlaceholderText('your name...')).toBeTruthy()
  })

  it('substitutes authored tokens before the typewriter can spell them out', () => {
    vi.useFakeTimers()
    renderPlayer()
    finishTyping()
    tapScreen()
    fireEvent.change(screen.getByPlaceholderText('your name...'), { target: { value: 'SANISH' } })
    fireEvent.click(screen.getByText('OK'))
    finishTyping()

    expect(screen.getByText('SANISH.')).toBeTruthy()
    expect(screen.queryByText('[NAME].')).toBeNull()
  })

  it('calls onComplete at the end of the script', () => {
    vi.useFakeTimers()
    const { onComplete } = renderPlayer()
    finishTyping()
    tapScreen()
    fireEvent.change(screen.getByPlaceholderText('your name...'), { target: { value: 'SANISH' } })
    fireEvent.click(screen.getByText('OK'))
    finishTyping()
    tapScreen()

    expect(onComplete).toHaveBeenCalled()
  })

  it('self-advances through a transition without waiting for a tap', () => {
    vi.useFakeTimers()
    const onComplete = vi.fn()
    render(
      <ScriptPlayer
        lines={[{ kind: 'transition', style: 'white_flash' }]}
        speakerName={(w) => w}
        resolveText={(t) => t}
        onInput={vi.fn()}
        onComplete={onComplete}
      />,
    )
    expect(onComplete).not.toHaveBeenCalled()
    finishTyping()
    expect(onComplete).toHaveBeenCalled()
  })
})
