// @vitest-environment jsdom
//
// The GBA duel frame. What matters is that the engine's (acting, target) pair
// always sorts into the correct side — the previous arena fell back to
// "acting = ally", which put an attacking enemy in the player's slot.

import { describe, it, expect, vi, afterEach } from 'vitest'
import { createRef } from 'react'
import { render, cleanup } from '@testing-library/react'
import { act } from 'react'
import { SpriteArena } from '../SpriteArena'
import type { BattleArenaHandle } from '../SpriteArena'
import type { TurnDisplayUnitData } from '../../core/battle/EngineTypes'

afterEach(cleanup)

const unit = (name: string, over: Partial<TurnDisplayUnitData> = {}): TurnDisplayUnitData => ({
  name, className: 'Warrior', rarity: 3, hp: 80, maxHp: 120, ap: 40, maxAp: 100,
  secondaryResource: 0, statusSlots: [], shieldHp: 0, ...over,
})

const ALLIES = new Set(['hugo_001', 'tara_001'])

function mount(allyDefIds: ReadonlySet<string> = ALLIES) {
  const ref = createRef<BattleArenaHandle>()
  const view = render(<SpriteArena ref={ref} allyDefIds={allyDefIds} />)
  return { ref, ...view }
}

/** The sprite slot carries an aria-label; the plate does not. */
const slotNames = (c: HTMLElement, side: 'enemyRow' | 'allyRow') => {
  const row = c.querySelector(`[class*="${side}"]`)
  return Array.from(row?.querySelectorAll('[aria-label]') ?? []).map(e => e.getAttribute('aria-label'))
}

describe('SpriteArena — duel frame', () => {
  it('renders no combatant before the engine sets a turn', () => {
    const { container } = mount()
    expect(container.querySelectorAll('[aria-label]')).toHaveLength(0)
  })

  it('puts a player attacker in the ally slot and its target in the enemy slot', () => {
    const { ref, container } = mount()
    act(() => { ref.current!.setTurnState('hugo_001', 'grunt_001') })
    expect(slotNames(container, 'allyRow')).toContain('hugo_001')
    expect(slotNames(container, 'enemyRow')).toContain('grunt_001')
  })

  it('puts an ENEMY attacker in the enemy slot, not the ally slot', () => {
    // The regression the old arena had: acting was assumed to be the ally.
    const { ref, container } = mount()
    act(() => { ref.current!.setTurnState('grunt_001', 'hugo_001') })
    expect(slotNames(container, 'enemyRow')).toContain('grunt_001')
    expect(slotNames(container, 'allyRow')).toContain('hugo_001')
    expect(slotNames(container, 'allyRow')).not.toContain('grunt_001')
  })

  it('faces the ally away and the enemy toward the camera', () => {
    const { ref, container } = mount()
    act(() => { ref.current!.setTurnState('hugo_001', 'grunt_001') })
    const ally  = container.querySelector('[class*="allyRow"] [aria-label]')
    const enemy = container.querySelector('[class*="enemyRow"] [aria-label]')
    expect(ally!.className).toMatch(/back/)
    expect(enemy!.className).toMatch(/front/)
  })

  it('shows a damage number over the unit that was hit', () => {
    const { ref, container } = mount()
    act(() => { ref.current!.setTurnState('hugo_001', 'grunt_001') })
    act(() => { ref.current!.playAttack('hugo_001', 'grunt_001', 'Hit', 17, true, 0, null, 'HIT!', '#fff') })
    const row = container.querySelector('[class*="enemyRow"]')
    expect(row!.textContent).toContain('17')
  })

  it('marks a dead combatant without removing it from the stage', () => {
    const { ref, container } = mount()
    act(() => { ref.current!.setTurnState('hugo_001', 'grunt_001') })
    act(() => { ref.current!.playDeath('grunt_001') })
    const enemy = container.querySelector('[class*="enemyRow"] [aria-label]')
    expect(enemy!.className).toMatch(/dead/)
  })

  it('clearTurn empties both slots', () => {
    const { ref, container } = mount()
    act(() => { ref.current!.setTurnState('hugo_001', 'grunt_001') })
    act(() => { ref.current!.clearTurn() })
    expect(container.querySelectorAll('[aria-label]')).toHaveLength(0)
  })

  it('renders the fallback letter when a character has no manifest', () => {
    const { ref, container } = mount()
    act(() => { ref.current!.setTurnState('hugo_001', 'grunt_001') })
    expect(container.querySelector('img')).toBeNull()
    expect(container.textContent).toContain('H')
  })

  it('renders a real frame image once a manifest arrives', () => {
    const { ref, container } = mount()
    const manifest = {
      type: 'animations', defId: 'hugo_001',
      display: { sourceWidth: 512, sourceHeight: 512, scale: 1, anchorX: 0.5, anchorY: 1 },
      tagMap: {}, animations: { idle: { frames: 2, frameRate: 1.25, repeat: -1 } }, projectile: null,
    } as never
    act(() => { ref.current!.setTurnState('hugo_001', 'grunt_001', manifest, null) })
    const img = container.querySelector('[class*="allyRow"] img')
    expect(img).not.toBeNull()
    expect(img!.getAttribute('src')).toContain('characters/hugo_001/idle/0.png')
  })

  it('shows the turn display actor and target on the correct sides', () => {
    const { ref, container } = mount()
    act(() => { ref.current!.setTurnState('grunt_001', 'hugo_001') })
    act(() => {
      ref.current!.showTurnDisplay({
        actor: unit('Grunt'), skillName: 'Slash', tuCost: 8, apCost: 0,
        skillLevel: 1, target: unit('Hugo'), isAlly: false,
      })
    })
    expect(container.querySelector('[class*="enemyRow"]')!.textContent).toContain('Grunt')
    expect(container.querySelector('[class*="allyRow"]')!.textContent).toContain('Hugo')
  })

  it('clears pending timers on unmount without warning', () => {
    vi.useFakeTimers()
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const ref = createRef<BattleArenaHandle>()
    const { unmount } = render(<SpriteArena ref={ref} allyDefIds={ALLIES} />)
    act(() => { ref.current!.playDice('Boosted') })
    unmount()
    act(() => { vi.runAllTimers() })
    expect(spy).not.toHaveBeenCalled()
    spy.mockRestore()
    vi.useRealTimers()
  })
})
