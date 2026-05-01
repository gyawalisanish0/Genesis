// FeedbackPanel — outcome text and damage number pop from the target's position
// and rise upward while fading out.
//
// Scale-pop: text starts at 1.4× and shrinks to 1.0× during the first part of
// the rise, making numbers feel like they're bursting off the impact point.
// Spawn position: uses unitStage.targetY() when the unit figures are visible
// so the number appears at the figure rather than a hardcoded zone.

import Phaser from 'phaser'
import type { UnitStage } from './UnitStage'
import { tokenToHex } from '../BattleScene'

const RISE_PX  = 58
const FLOAT_MS = 1100

export class FeedbackPanel {
  private scene:     Phaser.Scene
  private topInset:  number
  private unitStage: UnitStage | undefined

  constructor(scene: Phaser.Scene, topInset = 0, unitStage?: UnitStage) {
    this.scene     = scene
    this.topInset  = topInset
    this.unitStage = unitStage
  }

  show(text: string, colour: string): void {
    const { width, height } = this.scene.scale
    const cx = Math.floor(width / 2)

    // Prefer the target figure's centre; fall back to the hardcoded content zone.
    const cy = this.unitStage?.isVisible && this.unitStage.targetY() > this.topInset
      ? this.unitStage.targetY()
      : Math.floor(this.topInset + (height - this.topInset) * 0.43)

    const t = this.scene.add.text(cx, cy, text, {
      fontFamily:      'system-ui,sans-serif',
      fontSize:        '20px',
      color:           tokenToHex(colour),
      fontStyle:       'bold',
      stroke:          '#000000',
      strokeThickness: 3,
    }).setOrigin(0.5)

    this.scene.tweens.add({
      targets:    t,
      y:          cy - RISE_PX,
      alpha:      0,
      scaleX:     { from: 1.4, to: 1 },
      scaleY:     { from: 1.4, to: 1 },
      duration:   FLOAT_MS,
      ease:       'Sine.easeOut',
      onComplete: () => t.destroy(),
    })
  }
}
