import { DUNGEON_WAVE_VIGNETTE_OPACITY } from '../../core/constants'

export class WaveOverlay {
  private scene:    Phaser.Scene
  private graphics: Phaser.GameObjects.Graphics
  private label:    Phaser.GameObjects.Text
  private active:   boolean = false

  constructor(scene: Phaser.Scene) {
    this.scene    = scene
    this.graphics = scene.add.graphics().setDepth(15).setVisible(false)
    this.label    = scene.add.text(180, 20, 'WAVE PHASE — TAP AN ENEMY', {
      fontSize:   '11px',
      color:      '#ff4444',
      fontFamily: 'monospace',
      fontStyle:  'bold',
    }).setOrigin(0.5, 0).setDepth(16).setVisible(false)
  }

  show(canvasWidth: number, canvasHeight: number): void {
    if (this.active) return
    this.active = true
    this.graphics.clear()
    this.graphics.fillStyle(0x000000, DUNGEON_WAVE_VIGNETTE_OPACITY)
    this.graphics.fillRect(0, 0, canvasWidth, canvasHeight)
    this.graphics.setVisible(true)
    this.label.setVisible(true)
    this.scene.tweens.add({
      targets:  this.graphics,
      alpha:    { from: 0, to: 1 },
      duration: 300,
      ease:     'Sine.easeOut',
    })
  }

  hide(): void {
    if (!this.active) return
    this.active = false
    this.scene.tweens.add({
      targets:    this.graphics,
      alpha:      0,
      duration:   200,
      ease:       'Sine.easeIn',
      onComplete: () => {
        this.graphics.setVisible(false)
        this.graphics.setAlpha(1)
      },
    })
    this.label.setVisible(false)
  }

  destroy(): void {
    this.graphics.destroy()
    this.label.destroy()
  }
}
