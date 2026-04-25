// AttackPanel — animates acting unit toward target, applies hit effects.
// Stage 4: camera shake on impact; particle burst on hit; evasion dodge for target.

import Phaser from 'phaser'
import { UnitStage }       from './UnitStage'
import { ParticleEmitter } from './ParticleEmitter'

const HIT_COLOUR: Record<string, number> = {
  Boosted:  0xf59e0b,  // gold
  Success:  0xef4444,  // danger
  GuardUp:  0x3b82f6,  // info
  Tumbling: 0xf97316,  // warn
  Evasion:  0x06b6d4,  // evasion (unused — no flash on evade)
  Fail:     0x5c5480,  // muted
}

// Shake: [durationMs, intensity] — only applied on damaging outcomes.
const SHAKE: Record<string, [number, number]> = {
  Boosted:  [320, 0.024],
  Success:  [160, 0.010],
  GuardUp:  [120, 0.007],
  Tumbling: [160, 0.010],
}

export class AttackPanel {
  private scene:    Phaser.Scene
  private unitStage: UnitStage
  private particles: ParticleEmitter

  constructor(scene: Phaser.Scene, unitStage: UnitStage, particles: ParticleEmitter) {
    this.scene     = scene
    this.unitStage = unitStage
    this.particles = particles
  }

  play(
    _casterId: string,
    _targetId: string,
    outcome:   string,
    _damage:   number,
    onDone:    () => void,
  ): void {
    if (!this.unitStage.isVisible) { onDone(); return }

    const dx = Math.floor(this.scene.scale.width * 0.33)

    if (outcome === 'Evasion') {
      // Attacker shoves and misses; target dodges sideways simultaneously.
      let completed = 0
      const both = () => { if (++completed >= 2) onDone() }
      this.unitStage.shoveActing(dx, both)
      this.unitStage.evasionDodge(both)
      return
    }

    this.unitStage.shoveActing(dx, () => {
      const isHit = outcome !== 'Fail'
      if (isHit) {
        this.unitStage.flashTarget(HIT_COLOUR[outcome] ?? 0xef4444)
        this.particles.burst(this.unitStage.targetX(), this.unitStage.targetY(), outcome)
        const shake = SHAKE[outcome]
        if (shake) this.scene.cameras.main.shake(shake[0], shake[1])
      }
      onDone()
    })
  }
}
