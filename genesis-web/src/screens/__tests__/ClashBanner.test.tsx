// @vitest-environment jsdom
//
// The banner must never restate the clash maths itself — it echoes the line the
// engine already wrote, so the two cannot drift. These pin that, and pin the
// rule that reads wrong without it: losing a clash costs order, not the turn.

import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, cleanup, screen } from '@testing-library/react'
import { ClashBanner } from '../ClashBanner'
import type { BattleStep } from '../../core/battle/BattleStepMachine'
import type { LogEntry } from '../../core/battle/EngineTypes'

const mockCtx = vi.hoisted(() => ({ value: {} as Record<string, unknown> }))
vi.mock('../BattleContext', () => ({ useBattleScreen: () => mockCtx.value }))

afterEach(cleanup)

const CLASH_LINE: LogEntry = {
  id: '1',
  text: 'CLASH — Hugo Rekrot acts first (avg. speed 42 vs 31)',
  colour: 'var(--accent-info)',
} as LogEntry

function mount(battleStep: BattleStep, log: LogEntry[] = [CLASH_LINE]) {
  mockCtx.value = { battleStep, log }
  return render(<ClashBanner />)
}

describe('ClashBanner', () => {
  it('renders nothing outside the announcement step', () => {
    for (const step of ['player_turn', 'enemy_acting', 'advance_tick'] as BattleStep[]) {
      cleanup()
      const { container } = mount(step)
      expect(container.firstChild).toBeNull()
    }
  })

  it('shows during clash_announcing', () => {
    mount('clash_announcing')
    expect(screen.getByRole('status')).not.toBeNull()
  })

  it('echoes the engine line, including both faction speeds', () => {
    mount('clash_announcing')
    const text = screen.getByRole('status').textContent!
    expect(text).toContain('Hugo Rekrot acts first')
    expect(text).toContain('42')
    expect(text).toContain('31')
  })

  it('does not repeat the CLASH prefix already used as the title', () => {
    mount('clash_announcing')
    const detail = screen.getByRole('status').textContent!
    expect(detail).not.toContain('CLASH — Hugo')
  })

  it('states that losing costs order, not the turn', () => {
    // Without this the announcement reads as "the loser is skipped", which is
    // the opposite of what the engine does.
    mount('clash_announcing')
    expect(screen.getByRole('status').textContent).toContain('Both sides still act this tick')
  })

  it('renders nothing when no clash line has been logged', () => {
    const { container } = mount('clash_announcing', [
      { id: '9', text: 'Hugo hits the Grunt', colour: '#fff' } as LogEntry,
    ])
    expect(container.firstChild).toBeNull()
  })

  it('uses the most recent clash line when several have accumulated', () => {
    const older: LogEntry = { id: '0', text: 'CLASH — Old Foe acts first (avg. speed 9 vs 8)', colour: '#fff' } as LogEntry
    mount('clash_announcing', [older, CLASH_LINE])
    const text = screen.getByRole('status').textContent!
    expect(text).toContain('Hugo Rekrot')
    expect(text).not.toContain('Old Foe')
  })
})
