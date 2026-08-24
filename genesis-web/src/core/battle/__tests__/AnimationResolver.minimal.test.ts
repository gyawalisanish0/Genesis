// The "minimum viable sprite set" contract.
//
// Art is the scarcest resource on this project, so the engine must stay fully
// playable with a Pokémon-sized sprite budget: ONE idle pose and ONE attack
// pose per character. Everything richer (dash, dodge, death, per-skill poses,
// damaged variants) is optional polish that degrades cleanly.
//
// These tests pin that contract. If a change here starts requiring more states,
// the art budget for every character just went up — that should be deliberate.

import { describe, it, expect } from 'vitest'
import type { AnimationManifest, AnimationStateDef } from '../../types'
import {
  resolveAttackAnimation, resolveIdleAnimation,
  resolveReactionAnimation, resolveDashAnimation, resolveDeathAnimation,
} from '../AnimationResolver'

const pose = (frames = 2): AnimationStateDef => ({ frames, frameRate: 6, repeat: 0 })

// `animations` is an index signature intersected with an optional `skills` key,
// which TypeScript cannot re-widen after a spread. One cast at that seam keeps
// the tests readable; the shape is still checked by the helper's parameters.
type Anims = AnimationManifest['animations']
const anims = (
  base:    Record<string, AnimationStateDef>,
  skills?: Record<string, AnimationStateDef>,
): Anims => ({ ...base, ...(skills ? { skills } : {}) }) as Anims

/** The whole art budget: two poses. `tagMap` points every combat tag at `attack`. */
const MINIMAL: AnimationManifest = {
  type: 'animations',
  defId: 'budget_001',
  display: { sourceWidth: 48, sourceHeight: 48, scale: 1, anchorX: 0.5, anchorY: 1 },
  idleSwapBelowHpPercent: 0.4,
  meleeDashDx: 80,
  tagMap: { melee: 'attack', ranged: 'attack', energy: 'attack', physical: 'attack' },
  animations: anims({ idle: { ...pose(), repeat: -1 }, attack: pose(3) }),
  projectile: null,
}

describe('minimum viable sprite set — idle + attack only', () => {
  it('resolves idle', () => {
    expect(resolveIdleAnimation(MINIMAL, false)?.stateKey).toBe('idle')
  })

  it('falls back to base idle when no damaged variant is authored', () => {
    expect(resolveIdleAnimation(MINIMAL, true)?.stateKey).toBe('idle')
  })

  it('routes EVERY skill through the shared attack pose via tagMap', () => {
    for (const [skill, tags] of [
      ['hugo_001_hammer_bash',  ['physical', 'melee']],
      ['husty_001_arc_bolt',    ['energy', 'ranged']],
      ['tara_001_unknown_move', ['melee']],
    ] as const) {
      const r = resolveAttackAnimation(MINIMAL, skill, [...tags], false)
      expect(r?.stateKey, `${skill} should reuse the shared pose`).toBe('attack')
    }
  })

  it('still reuses the attack pose when damaged (no damaged variant authored)', () => {
    expect(resolveAttackAnimation(MINIMAL, 'any_skill', ['melee'], true)?.stateKey).toBe('attack')
  })

  it('carries melee dash distance so the engine can fake the lunge', () => {
    const melee = resolveAttackAnimation(MINIMAL, 's', ['melee'], false)
    expect(melee?.isMelee).toBe(true)
    expect(melee?.dashDx).toBe(80)   // engine-driven motion, not extra frames
  })

  it('returns null — never throws — for unauthored optional states', () => {
    expect(resolveDashAnimation(MINIMAL, false)).toBeNull()
    expect(resolveDeathAnimation(MINIMAL, false)).toBeNull()
    expect(resolveReactionAnimation(MINIMAL, 'hurt', false)).toBeNull()
    expect(resolveReactionAnimation(MINIMAL, 'dodge', false)).toBeNull()
  })

  it('returns null for an untagged skill with no tagMap match (engine default)', () => {
    expect(resolveAttackAnimation(MINIMAL, 'odd', ['utility'], false)).toBeNull()
  })
})

describe('optional polish layers on without touching the minimum', () => {
  const WITH_HURT: AnimationManifest = {
    ...MINIMAL,
    animations: anims({ idle: pose(), attack: pose(3), hurt: pose(), death: pose(4) }),
  }

  it('picks up hurt/death once authored', () => {
    expect(resolveReactionAnimation(WITH_HURT, 'hurt', false)?.stateKey).toBe('hurt')
    expect(resolveDeathAnimation(WITH_HURT, false)?.stateKey).toBe('death')
  })

  it('prefers a per-skill pose over the shared one when authored', () => {
    const WITH_SIGNATURE: AnimationManifest = {
      ...MINIMAL,
      animations: anims({ idle: pose(), attack: pose(3) }, { hugo_001_hammer_bash: pose(4) }),
    }
    expect(resolveAttackAnimation(WITH_SIGNATURE, 'hugo_001_hammer_bash', ['melee'], false)?.stateKey)
      .toBe('hugo_001_hammer_bash')
    // …while everything else still shares the budget pose.
    expect(resolveAttackAnimation(WITH_SIGNATURE, 'other', ['melee'], false)?.stateKey).toBe('attack')
  })

  it('prefers a damaged variant only when it exists', () => {
    const WITH_DAMAGED: AnimationManifest = {
      ...MINIMAL,
      animations: anims({ idle: pose(), attack: pose(3), idle_damaged: pose() }),
    }
    expect(resolveIdleAnimation(WITH_DAMAGED, true)?.stateKey).toBe('idle_damaged')
    expect(resolveIdleAnimation(WITH_DAMAGED, false)?.stateKey).toBe('idle')
  })
})
