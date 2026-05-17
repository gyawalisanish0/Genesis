// AnimationResolver — pure manifest lookup with fallback chain.
// No Phaser imports. No side effects. Returns the animation state entry
// to play for a given skill + tags + damaged state, or null for fallback.

import type { AnimationManifest, AnimationStateDef } from '../../core/types'

export interface ResolvedAnimation {
  stateKey:  string            // the resolved state name (for folder path construction)
  entry:     AnimationStateDef // frame/rate/repeat config
  isMelee:   boolean           // drives container shove vs projectile in AttackPanel
  dashDx:    number            // meleeDashDx from manifest (0 for ranged)
}

export function resolveAttackAnimation(
  manifest:  AnimationManifest,
  skillId:   string,
  tags:      string[],
  isDamaged: boolean,
): ResolvedAnimation | null {
  const isMelee = tags.includes('melee')
  const dashDx  = isMelee ? (manifest.meleeDashDx ?? 50) : 0

  // 1. Skill-specific damaged variant
  if (isDamaged) {
    const damagedKey = `${skillId}_damaged`
    const entry = manifest.animations.skills?.[damagedKey]
    if (entry) return { stateKey: `skills/${damagedKey}`, entry, isMelee, dashDx }
  }

  // 2. Skill-specific base
  const skillEntry = manifest.animations.skills?.[skillId]
  if (skillEntry) {
    // if damaged variant doesn't exist, fall through to tag resolution
    if (!isDamaged || !manifest.animations.skills?.[`${skillId}_damaged`]) {
      return { stateKey: `skills/${skillId}`, entry: skillEntry, isMelee, dashDx }
    }
  }

  // 3. Tag-mapped state (damaged variant first)
  const firstMatchingTag = tags.find(t => manifest.tagMap[t])
  if (firstMatchingTag) {
    const baseName = manifest.tagMap[firstMatchingTag]!
    if (isDamaged) {
      const damagedName  = `${baseName}_damaged`
      const damagedEntry = manifest.animations[damagedName]
      if (damagedEntry) return { stateKey: damagedName, entry: damagedEntry, isMelee, dashDx }
    }
    const baseEntry = manifest.animations[baseName]
    if (baseEntry) return { stateKey: baseName, entry: baseEntry, isMelee, dashDx }
  }

  return null  // caller uses engine default
}

export function resolveIdleAnimation(
  manifest:  AnimationManifest,
  isDamaged: boolean,
): ResolvedAnimation | null {
  if (isDamaged) {
    const entry = manifest.animations['idle_damaged']
    if (entry) return { stateKey: 'idle_damaged', entry, isMelee: false, dashDx: 0 }
  }
  const entry = manifest.animations['idle']
  if (entry) return { stateKey: 'idle', entry, isMelee: false, dashDx: 0 }
  return null
}

export function resolveReactionAnimation(
  manifest:  AnimationManifest,
  reaction:  'hurt' | 'dodge',
  isDamaged: boolean,
): ResolvedAnimation | null {
  if (isDamaged) {
    const damagedEntry = manifest.animations[`${reaction}_damaged`]
    if (damagedEntry) return { stateKey: `${reaction}_damaged`, entry: damagedEntry, isMelee: false, dashDx: 0 }
  }
  const entry = manifest.animations[reaction]
  if (entry) return { stateKey: reaction, entry, isMelee: false, dashDx: 0 }
  return null
}

export function resolveDashAnimation(
  manifest:  AnimationManifest,
  isDamaged: boolean,
): ResolvedAnimation | null {
  if (isDamaged) {
    const entry = manifest.animations['dash_damaged']
    if (entry) return { stateKey: 'dash_damaged', entry, isMelee: false, dashDx: 0 }
  }
  const entry = manifest.animations['dash']
  if (entry) return { stateKey: 'dash', entry, isMelee: false, dashDx: 0 }
  return null
}

export function resolveDeathAnimation(
  manifest:  AnimationManifest,
  isDamaged: boolean,
): ResolvedAnimation | null {
  if (isDamaged) {
    const entry = manifest.animations['death_damaged']
    if (entry) return { stateKey: 'death_damaged', entry, isMelee: false, dashDx: 0 }
  }
  const entry = manifest.animations['death']
  if (entry) return { stateKey: 'death', entry, isMelee: false, dashDx: 0 }
  return null
}
