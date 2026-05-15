// SequenceRunner — executes an AnimPhase[] sequence with full parallel, branch,
// and skip support. Replaces the hardcoded AttackPanel logic.
//
// Usage:
//   runner.run(phases, ctx, onDone)  — start a sequence
//   runner.skip()                    — cancel pending waits and advance onDone

import Phaser from 'phaser'
import type { AnimPhase, SequenceContext } from './SequenceTypes'
import type { UnitStage }      from './UnitStage'
import type { ParticleEmitter } from './ParticleEmitter'
import type { ProjectilePanel } from './ProjectilePanel'
import type { FeedbackPanel }   from './FeedbackPanel'

const HIT_COLOUR: Record<string, number> = {
  Boosted: 0xf59e0b,
  Hit:     0xef4444,
  Evade:   0x06b6d4,
  Fail:    0x5c5480,
}

const SHAKE: Record<string, [number, number]> = {
  Boosted: [320, 0.024],
  Hit:     [160, 0.010],
}

// CSS token colour for damage number text per outcome.
const DAMAGE_COLOUR: Record<string, string> = {
  Boosted: 'var(--accent-gold)',
  Hit:     'var(--accent-danger)',
}

const DEFAULT_MELEE_DX_FRACTION = 0.33

export class SequenceRunner {
  private scene:          Phaser.Scene
  private unitStage:      UnitStage
  private particles:      ParticleEmitter
  private projectile:     ProjectilePanel
  private feedbackPanel:  FeedbackPanel

  private skipped     = false
  private topOnDone:  (() => void) | null = null
  private pendingTimers: Phaser.Time.TimerEvent[] = []

  constructor(
    scene:         Phaser.Scene,
    unitStage:     UnitStage,
    particles:     ParticleEmitter,
    projectile:    ProjectilePanel,
    feedbackPanel: FeedbackPanel,
  ) {
    this.scene         = scene
    this.unitStage     = unitStage
    this.particles     = particles
    this.projectile    = projectile
    this.feedbackPanel = feedbackPanel
  }

  run(phases: AnimPhase[], ctx: SequenceContext, onDone: () => void): void {
    this.skipped      = false
    this.topOnDone    = onDone
    this.pendingTimers = []
    this.runSequence(phases, ctx, () => {
      const cb = this.topOnDone
      this.topOnDone = null
      cb?.()
    })
  }

  /** Cancel pending wait timers and fire onDone immediately. In-flight tweens
   *  (shove, projectile) continue visually but gameplay logic advances. */
  skip(): void {
    if (this.skipped || !this.topOnDone) return
    this.skipped = true
    for (const t of this.pendingTimers) t.destroy()
    this.pendingTimers = []
    const cb = this.topOnDone
    this.topOnDone = null
    cb()
  }

  // ── Sequence execution ────────────────────────────────────────────────────

  private runSequence(phases: AnimPhase[], ctx: SequenceContext, onDone: () => void): void {
    if (this.skipped || phases.length === 0) { onDone(); return }
    const [first, ...rest] = phases
    this.runPhase(first, ctx, () => this.runSequence(rest, ctx, onDone))
  }

  private runPhase(phase: AnimPhase, ctx: SequenceContext, onDone: () => void): void {
    if (this.skipped) { onDone(); return }

    switch (phase.type) {

      case 'wait': {
        const timer = this.scene.time.delayedCall(phase.ms, () => {
          this.pendingTimers = this.pendingTimers.filter(t => t !== timer)
          onDone()
        })
        this.pendingTimers.push(timer)
        break
      }

      case 'parallel': {
        if (!phase.phases.length) { onDone(); return }
        let done = 0
        const each = () => { if (++done >= phase.phases.length) onDone() }
        for (const sub of phase.phases) this.runPhase(sub, ctx, each)
        break
      }

      case 'branch': {
        const seq = phase.cases[ctx.outcome] ?? phase.cases['default'] ?? []
        this.runSequence(seq, ctx, onDone)
        break
      }

      case 'shove': {
        const dx = ctx.dashDx > 0
          ? ctx.dashDx
          : Math.floor(this.scene.scale.width * DEFAULT_MELEE_DX_FRACTION)
        this.unitStage.shoveActing(dx, () => this.fireImpact(ctx), onDone)
        break
      }

      case 'evasionDodge': {
        this.unitStage.evasionDodge(onDone)
        break
      }

      case 'projectile': {
        this.projectile.fire(
          ctx.actingDefId, ctx.projectile,
          this.unitStage.actingX(), this.unitStage.actingY(),
          this.unitStage.targetX(), this.unitStage.targetY(),
          () => this.fireImpact(ctx),
          onDone,
        )
        break
      }

      case 'impact': {
        this.fireImpact(ctx)
        onDone()
        break
      }

      // ── Granular feedback phases (fire-and-forget) ──────────────────────

      case 'flash': {
        this.unitStage.pureFlash(phase.figure, phase.colour)
        onDone()
        break
      }

      case 'particles': {
        const x = phase.figure === 'acting' ? this.unitStage.actingX() : this.unitStage.targetX()
        const y = phase.figure === 'acting' ? this.unitStage.actingY() : this.unitStage.targetY()
        this.particles.burst(x, y, ctx.outcome)
        onDone()
        break
      }

      case 'damageNumber': {
        if (ctx.damage > 0) {
          const prefix = ctx.outcome === 'Boosted' ? '★ ' : ''
          const text   = `${prefix}−${ctx.damage}`
          const colour = DAMAGE_COLOUR[ctx.outcome] ?? 'var(--text-primary)'
          this.feedbackPanel.showDamageNumber(text, colour)
        }
        onDone()
        break
      }

      case 'statusText': {
        this.feedbackPanel.show(phase.text, phase.colour)
        onDone()
        break
      }

      case 'feedback': {
        if (ctx.feedbackText) {
          this.feedbackPanel.show(ctx.feedbackText, ctx.feedbackColour)
        }
        onDone()
        break
      }

      // ── Other ─────────────────────────────────────────────────────────────

      case 'playAnim': {
        this.unitStage.playFigureAnim(phase.figure, phase.stateKey, onDone)
        break
      }

      case 'cameraShake': {
        this.scene.cameras.main.shake(phase.duration, phase.intensity)
        onDone()
        break
      }

      case 'aura': {
        // Fire-and-forget — advances immediately.
        this.unitStage.setAura(phase.figure, phase.show)
        onDone()
        break
      }
    }
  }

  // ── Impact helpers ────────────────────────────────────────────────────────

  private fireImpact(ctx: SequenceContext): void {
    const { outcome } = ctx
    if (outcome === 'Fail') {
      this.particles.burst(this.unitStage.targetX(), this.unitStage.targetY(), 'Fail')
      return
    }
    this.unitStage.flashTarget(HIT_COLOUR[outcome] ?? 0xef4444)
    this.particles.burst(this.unitStage.targetX(), this.unitStage.targetY(), outcome)
    const shake = SHAKE[outcome]
    if (shake) this.scene.cameras.main.shake(shake[0], shake[1])
  }
}
