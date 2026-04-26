// FeedbackPanel — outcome text and damage number rise from the centre and fade out.

import Phaser from 'phaser'
import { tokenToHex } from '../BattleScene'

const RISE_PX  = 48
const FLOAT_MS = 1100

export class FeedbackPanel {
  private scene:    Phaser.Scene
  private topInset: number

  constructor(scene: Phaser.Scene, topInset = 0) {
    this.scene    = scene
    this.topInset = topInset
  }

  show(text: string, colour: string): void {
    const { width, height } = this.scene.scale
    const cx = Math.floor(width / 2)
    const cy = Math.floor(this.topInset + (height - this.topInset) * 0.43)

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
      duration:   FLOAT_MS,
      ease:       'Sine.easeOut',
      onComplete: () => t.destroy(),
    })
  }
}
