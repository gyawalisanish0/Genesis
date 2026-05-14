// FeedbackPanel — outcome label and damage number pop from the target's position
// and rise upward while fading out.
//
// Two text layers fire simultaneously in parallel:
//   show()            — outcome label ("BOOSTED!", "EVADED!"), 20 px, spawns high
//   showDamageNumber()— damage value  ("★ −42", "−18"),        26 px, spawns low
//
// Scale-pop: text starts at a larger scale and shrinks to 1.0 during the rise,
// making numbers feel like they burst off the impact point.
// Spawn position: uses unitStage.targetY() when figures are visible so the text
// follows the figure rather than a hardcoded zone.

import Phaser from 'phaser'
import type { UnitStage } from './UnitStage'
import { tokenToHex } from '../BattleScene'

const LABEL_RISE_PX  = 54
const LABEL_FLOAT_MS = 1100
const NUMBER_RISE_PX  = 48
const NUMBER_FLOAT_MS = 900

export class FeedbackPanel {
  private scene:     Phaser.Scene
  private topInset:  number
  private unitStage: UnitStage | undefined

  constructor(scene: Phaser.Scene, topInset = 0, unitStage?: UnitStage) {
    this.scene     = scene
    this.topInset  = topInset
    this.unitStage = unitStage
  }

  /** Floating outcome label — "BOOSTED!", "EVADED!", "MISS!", etc. */
  show(text: string, colour: string): void {
    const cy = this.targetCY() - 18   // spawns above the figure centre
    const t  = this.scene.add.text(this.centreX(), cy, text, {
      fontFamily:      'system-ui,sans-serif',
      fontSize:        '20px',
      color:           tokenToHex(colour),
      fontStyle:       'bold',
      stroke:          '#000000',
      strokeThickness: 3,
    }).setOrigin(0.5)

    this.scene.tweens.add({
      targets:    t,
      y:          cy - LABEL_RISE_PX,
      alpha:      0,
      scaleX:     { from: 1.4, to: 1 },
      scaleY:     { from: 1.4, to: 1 },
      duration:   LABEL_FLOAT_MS,
      ease:       'Sine.easeOut',
      onComplete: () => t.destroy(),
    })
  }

  /**
   * Floating damage value — "★ −42", "−18".
   * `text` is pre-formatted by the caller; `colour` is a CSS token string.
   */
  showDamageNumber(text: string, colour: string): void {
    const cy = this.targetCY() + 14   // spawns below the figure centre
    const t  = this.scene.add.text(this.centreX(), cy, text, {
      fontFamily:      'system-ui,sans-serif',
      fontSize:        '26px',
      color:           tokenToHex(colour),
      fontStyle:       'bold',
      stroke:          '#000000',
      strokeThickness: 4,
    }).setOrigin(0.5)

    this.scene.tweens.add({
      targets:    t,
      y:          cy - NUMBER_RISE_PX,
      alpha:      0,
      scaleX:     { from: 1.8, to: 1 },
      scaleY:     { from: 1.8, to: 1 },
      duration:   NUMBER_FLOAT_MS,
      ease:       'Sine.easeOut',
      onComplete: () => t.destroy(),
    })
  }

  // ── Private helpers ────────────────────────────────────────────────────────

  private centreX(): number {
    return Math.floor(this.scene.scale.width / 2)
  }

  private targetCY(): number {
    const { height } = this.scene.scale
    return this.unitStage?.isVisible && this.unitStage.targetY() > this.topInset
      ? this.unitStage.targetY()
      : Math.floor(this.topInset + (height - this.topInset) * 0.43)
  }
}
