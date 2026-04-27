// ResolutionAdaptor — Phaser helper that monitors in-battle FPS.
//
// If the game sustains ≥QUALITY_STEP_UP_FPS for QUALITY_STEP_UP_CHECKS
// consecutive 1-second intervals, it promotes the quality tier one step.
// The promotion is persisted to localStorage via ResolutionService and takes
// effect the next time BattleArena creates a fresh Phaser game instance.

import Phaser from 'phaser'
import { ResolutionService } from '../../services/ResolutionService'
import { QUALITY_STEP_UP_FPS, QUALITY_STEP_UP_CHECKS } from '../../core/constants'

export class ResolutionAdaptor {
  private sustainedCount = 0
  private done = false

  constructor(scene: Phaser.Scene) {
    // Only monitor when already below High — nothing to step up to from High.
    if (ResolutionService.currentTier === 'High') {
      this.done = true
      return
    }

    scene.time.addEvent({
      delay:    1000,
      loop:     true,
      callback: () => this.checkFPS(scene),
    })
  }

  private checkFPS(scene: Phaser.Scene): void {
    if (this.done) return
    const fps = scene.game.loop.actualFps
    if (fps >= QUALITY_STEP_UP_FPS) {
      this.sustainedCount++
      if (this.sustainedCount >= QUALITY_STEP_UP_CHECKS) {
        ResolutionService.stepUp()
        this.done = true
      }
    } else {
      this.sustainedCount = 0
    }
  }
}
