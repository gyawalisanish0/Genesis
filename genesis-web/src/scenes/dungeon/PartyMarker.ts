import { DUNGEON_MOVE_ANIM_MS } from '../../core/constants'

const MARKER_COLOUR  = 0x8b5cf6  // --accent-genesis
const MARKER_RADIUS  = 14

export class PartyMarker {
  private scene:    Phaser.Scene
  private graphics: Phaser.GameObjects.Graphics
  private label:    Phaser.GameObjects.Text
  private tileSize: number = 48

  constructor(scene: Phaser.Scene) {
    this.scene    = scene
    this.graphics = scene.add.graphics()
    this.graphics.setDepth(5)
    this.label    = scene.add.text(0, 0, '▲', {
      fontSize: '14px', color: '#ffffff', fontFamily: 'monospace',
    }).setOrigin(0.5).setDepth(6)
  }

  setTileSize(size: number): void {
    this.tileSize = size
  }

  place(tx: number, ty: number): void {
    const wx = tx * this.tileSize + this.tileSize / 2
    const wy = ty * this.tileSize + this.tileSize / 2
    this.graphics.clear()
    this.graphics.fillStyle(MARKER_COLOUR, 1)
    this.graphics.fillCircle(wx, wy, MARKER_RADIUS)
    this.graphics.lineStyle(2, 0xffffff, 0.6)
    this.graphics.strokeCircle(wx, wy, MARKER_RADIUS)
    this.label.setPosition(wx, wy)
  }

  moveTo(tx: number, ty: number, onDone: () => void): void {
    const wx = tx * this.tileSize + this.tileSize / 2
    const wy = ty * this.tileSize + this.tileSize / 2
    // Tween label position as a proxy; redraw graphics each step
    this.scene.tweens.add({
      targets:  this.label,
      x:        wx,
      y:        wy,
      duration: DUNGEON_MOVE_ANIM_MS,
      ease:     'Sine.easeInOut',
      onUpdate: () => {
        const cx = this.label.x
        const cy = this.label.y
        this.graphics.clear()
        this.graphics.fillStyle(MARKER_COLOUR, 1)
        this.graphics.fillCircle(cx, cy, MARKER_RADIUS)
        this.graphics.lineStyle(2, 0xffffff, 0.6)
        this.graphics.strokeCircle(cx, cy, MARKER_RADIUS)
      },
      onComplete: onDone,
    })
  }

  destroy(): void {
    this.graphics.destroy()
    this.label.destroy()
  }
}
