// AttackPanel — animates the attack sequence for both melee and ranged skills.
//
// Melee: acting unit shoves toward the target (manifest-driven dashDx).
// Ranged: a projectile travels from the acting unit to the target via ProjectilePanel.
//
// Impact effects (flash, particles, shake) fire at the moment of impact in
// both paths — via shoveActing's onImpact for melee, or ProjectilePanel's
// onImpact for ranged. Fail emits a small dust puff on both paths.

import Phaser from 'phaser'
import type { AnimationProjectileDef } from '../../core/types'
import { UnitStage }        from './UnitStage'
import { ParticleEmitter }  from './ParticleEmitter'
import { ProjectilePanel }  from './ProjectilePanel'

const HIT_COLOUR: Record<string, number> = {
  Boosted: 0xf59e0b,
  Hit:     0xef4444,
  Evade:   0x06b6d4,
  Fail:    0x5c5480,
}

// Shake: [durationMs, intensity] — only applied on damaging outcomes.
const SHAKE: Record<string, [number, number]> = {
  Boosted: [320, 0.024],
  Hit:     [160, 0.010],
}

const DEFAULT_MELEE_DX_FRACTION = 0.33   // fallback when dashDx is 0

export class AttackPanel {
  private scene:           Phaser.Scene
  private unitStage:       UnitStage
  private particles:       ParticleEmitter
  private projectilePanel: ProjectilePanel

  constructor(
    scene:           Phaser.Scene,
    unitStage:       UnitStage,
    particles:       ParticleEmitter,
    projectilePanel: ProjectilePanel,
  ) {
    this.scene           = scene
    this.unitStage       = unitStage
    this.particles       = particles
    this.projectilePanel = projectilePanel
  }

  play(
    actingDefId: string,
    _targetDefId: string,
    outcome:     string,
    _damage:     number,
    isMelee:     boolean,
    dashDx:      number,
    projectile:  AnimationProjectileDef | null,
    onDone:      () => void,
  ): void {
    if (!this.unitStage.isVisible) { onDone(); return }

    if (isMelee) {
      this.playMelee(outcome, dashDx, onDone)
    } else {
      this.playRanged(actingDefId, outcome, projectile, onDone)
    }
  }

  // ── Private helpers ────────────────────────────────────────────────────────

  private playMelee(outcome: string, dashDx: number, onDone: () => void): void {
    const dx = dashDx > 0
      ? dashDx
      : Math.floor(this.scene.scale.width * DEFAULT_MELEE_DX_FRACTION)

    if (outcome === 'Evade') {
      let completed = 0
      const both = () => { if (++completed >= 2) onDone() }
      this.unitStage.shoveActing(dx, () => {
        this.particles.burst(this.unitStage.targetX(), this.unitStage.targetY(), 'Evade')
      }, both)
      this.unitStage.evasionDodge(both)
      return
    }

    this.unitStage.shoveActing(dx, () => {
      this.applyImpactFx(outcome)
    }, onDone)
  }

  private playRanged(
    actingDefId: string,
    outcome:     string,
    projectile:  AnimationProjectileDef | null,
    onDone:      () => void,
  ): void {
    if (outcome === 'Evade') {
      // Projectile launches but target dodges simultaneously; burst fires on miss.
      let completed = 0
      const both = () => { if (++completed >= 2) onDone() }

      this.projectilePanel.fire(
        actingDefId, projectile,
        this.unitStage.actingX(), this.unitStage.actingY(),
        this.unitStage.targetX(), this.unitStage.targetY(),
        () => {
          this.particles.burst(this.unitStage.targetX(), this.unitStage.targetY(), 'Evade')
        },
        both,
      )
      this.unitStage.evasionDodge(both)
      return
    }

    this.projectilePanel.fire(
      actingDefId, projectile,
      this.unitStage.actingX(), this.unitStage.actingY(),
      this.unitStage.targetX(), this.unitStage.targetY(),
      () => { this.applyImpactFx(outcome) },
      onDone,
    )
  }

  private applyImpactFx(outcome: string): void {
    if (outcome !== 'Fail') {
      this.unitStage.flashTarget(HIT_COLOUR[outcome] ?? 0xef4444)
      this.particles.burst(this.unitStage.targetX(), this.unitStage.targetY(), outcome)
      const shake = SHAKE[outcome]
      if (shake) this.scene.cameras.main.shake(shake[0], shake[1])
    } else {
      this.particles.burst(this.unitStage.targetX(), this.unitStage.targetY(), 'Fail')
    }
  }
}
