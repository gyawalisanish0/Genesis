// AttackPanel — animates acting unit toward target, applies hit effects.
// Stage 4: camera shake on impact; particle burst on hit; evasion dodge for target.
//
// Impact effects (flash, particles, shake) now fire at the moment the attacker
// reaches the target via shoveActing's onImpact callback — not after the return.
// Fail outcome emits a small dust puff so misses feel distinct from hits.

import Phaser from 'phaser'
import { UnitStage }       from './UnitStage'
import { ParticleEmitter } from './ParticleEmitter'

const HIT_COLOUR: Record<string, number> = {
  Boosted:  0xf59e0b,
  Success:  0xef4444,
  GuardUp:  0x3b82f6,
  Tumbling: 0xf97316,
  Evasion:  0x06b6d4,
  Fail:     0x5c5480,
}

// Shake: [durationMs, intensity] — only applied on damaging outcomes.
const SHAKE: Record<string, [number, number]> = {
  Boosted:  [320, 0.024],
  Success:  [160, 0.010],
  GuardUp:  [120, 0.007],
  Tumbling: [160, 0.010],
}

export class AttackPanel {
  private scene:     Phaser.Scene
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
      // Attacker shoves and misses; target dodges simultaneously.
      // Evasion burst fires at impact moment — at the now-empty target position.
      let completed = 0
      const both = () => { if (++completed >= 2) onDone() }
      this.unitStage.shoveActing(dx, () => {
        this.particles.burst(this.unitStage.targetX(), this.unitStage.targetY(), 'Evasion')
      }, both)
      this.unitStage.evasionDodge(both)
      return
    }

    this.unitStage.shoveActing(dx, () => {
      // onImpact: fires at the moment the attacker reaches the target position.
      if (outcome !== 'Fail') {
        this.unitStage.flashTarget(HIT_COLOUR[outcome] ?? 0xef4444)
        this.particles.burst(this.unitStage.targetX(), this.unitStage.targetY(), outcome)
        const shake = SHAKE[outcome]
        if (shake) this.scene.cameras.main.shake(shake[0], shake[1])
      } else {
        // Fail: small dust puff where the swing landed on empty air.
        this.particles.burst(this.unitStage.targetX(), this.unitStage.targetY(), 'Fail')
      }
    }, onDone)
  }
}
