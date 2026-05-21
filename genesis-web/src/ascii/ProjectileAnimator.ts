// ProjectileAnimator — interpolates a projectile symbol from acting to target.
// Driven by AsciiAnimEngine.update(dt); no rAF calls of its own.

import type { AsciiProjectileDef, ProjectileFrame } from './types'

export class ProjectileAnimator {
  private active = false
  private def: AsciiProjectileDef | null = null
  private progress = 0          // 0..1 acting→target
  private onImpactCallback: (() => void) | null = null
  private impactFired = false

  launch(def: AsciiProjectileDef, onImpact?: () => void): void {
    this.def = def
    this.progress = 0
    this.active = true
    this.impactFired = false
    this.onImpactCallback = onImpact ?? null
  }

  cancel(): void {
    this.active = false
    this.def = null
    this.onImpactCallback = null
  }

  // Returns true if position changed.
  update(dt: number): boolean {
    if (!this.active || !this.def) return false

    const prev = this.progress
    this.progress = Math.min(1, this.progress + dt / this.def.speedMs)

    if (this.progress >= 1 && !this.impactFired) {
      this.impactFired = true
      this.onImpactCallback?.()
      this.active = false
    }

    return this.progress !== prev
  }

  getFrame(): ProjectileFrame | null {
    if (!this.active || !this.def) return null

    const y = this.def.path === 'arc'
      ? Math.sin(this.progress * Math.PI)  // 0→1→0 arc
      : 0

    return {
      symbol:    this.def.symbol,
      progressX: this.progress,
      progressY: y,
      visible:   true,
    }
  }

  isActive(): boolean {
    return this.active
  }
}
