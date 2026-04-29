import type { EntityDef } from '../../core/types'
import { DUNGEON_PATROL_ANIM_MS } from '../../core/constants'

const COLOURS: Record<string, number> = {
  enemy:        0xe74c3c,
  npc:          0x3498db,
  interactable: 0xf1c40f,
  exit:         0x2ecc71,
  trigger:      0x000000,
}

const ICONS: Record<string, string> = {
  enemy:        '!',
  npc:          '?',
  interactable: '★',
  exit:         '▶',
  trigger:      '',
}

interface EntitySprite {
  entityId:  string
  type:      string
  graphics:  Phaser.GameObjects.Graphics
  label:     Phaser.GameObjects.Text
  tx:        number
  ty:        number
  greyscale: boolean
}

export class EntityLayer {
  private scene:    Phaser.Scene
  private tileSize: number = 48
  private sprites:  Map<string, EntitySprite> = new Map()
  // entityIds currently highlighted for wave selection
  private highlighted: Set<string> = new Set()

  constructor(scene: Phaser.Scene) {
    this.scene = scene
  }

  setTileSize(size: number): void {
    this.tileSize = size
  }

  loadEntities(entities: EntityDef[]): void {
    this.sprites.forEach((s) => { s.graphics.destroy(); s.label.destroy() })
    this.sprites.clear()
    for (const e of entities) {
      if (e.type === 'trigger') continue
      this.createSprite(e.entityId, e.type, e.x, e.y)
    }
  }

  setPosition(entityId: string, tx: number, ty: number, animated: boolean, onDone?: () => void): void {
    const sprite = this.sprites.get(entityId)
    if (!sprite) { onDone?.(); return }
    sprite.tx = tx
    sprite.ty = ty
    if (!animated) {
      this.drawSprite(sprite)
      onDone?.()
      return
    }
    const wx = tx * this.tileSize + this.tileSize / 2
    const wy = ty * this.tileSize + this.tileSize / 2
    this.scene.tweens.add({
      targets:    sprite.label,
      x:          wx,
      y:          wy,
      duration:   DUNGEON_PATROL_ANIM_MS,
      ease:       'Sine.easeInOut',
      onUpdate:   () => {
        const cx = sprite.label.x
        const cy = sprite.label.y
        sprite.graphics.clear()
        this.drawSpriteAt(sprite, cx, cy)
      },
      onComplete: () => onDone?.(),
    })
  }

  setVisible(entityId: string, visible: boolean): void {
    const sprite = this.sprites.get(entityId)
    if (!sprite) return
    sprite.graphics.setVisible(visible)
    sprite.label.setVisible(visible)
  }

  setGreyscale(entityId: string, greyscale: boolean): void {
    const sprite = this.sprites.get(entityId)
    if (!sprite) return
    sprite.greyscale = greyscale
    this.drawSprite(sprite)
  }

  remove(entityId: string): void {
    const sprite = this.sprites.get(entityId)
    if (!sprite) return
    sprite.graphics.destroy()
    sprite.label.destroy()
    this.sprites.delete(entityId)
  }

  setWaveHighlights(entityIds: string[]): void {
    this.highlighted = new Set(entityIds)
    this.sprites.forEach((s) => this.drawSprite(s))
    // Pulse animation on highlighted entities
    this.highlighted.forEach((id) => {
      const sprite = this.sprites.get(id)
      if (!sprite) return
      this.scene.tweens.add({
        targets:    sprite.label,
        alpha:      0.3,
        duration:   500,
        yoyo:       true,
        repeat:     -1,
        ease:       'Sine.easeInOut',
      })
    })
  }

  clearWaveHighlights(): void {
    this.highlighted.forEach((id) => {
      const sprite = this.sprites.get(id)
      if (!sprite) return
      this.scene.tweens.killTweensOf(sprite.label)
      sprite.label.setAlpha(1)
    })
    this.highlighted.clear()
    this.sprites.forEach((s) => this.drawSprite(s))
  }

  /** Returns the entityId at tile (tx, ty), or null. */
  entityAt(tx: number, ty: number): string | null {
    for (const [id, s] of this.sprites) {
      if (s.tx === tx && s.ty === ty) return id
    }
    return null
  }

  private createSprite(entityId: string, type: string, tx: number, ty: number): void {
    const graphics = this.scene.add.graphics().setDepth(4)
    const wx = tx * this.tileSize + this.tileSize / 2
    const wy = ty * this.tileSize + this.tileSize / 2
    const label = this.scene.add.text(wx, wy, ICONS[type] ?? '', {
      fontSize: '16px', color: '#ffffff', fontFamily: 'monospace',
    }).setOrigin(0.5).setDepth(5)

    const sprite: EntitySprite = { entityId, type, graphics, label, tx, ty, greyscale: false }
    this.sprites.set(entityId, sprite)
    this.drawSprite(sprite)
  }

  private drawSprite(sprite: EntitySprite): void {
    const wx = sprite.tx * this.tileSize + this.tileSize / 2
    const wy = sprite.ty * this.tileSize + this.tileSize / 2
    sprite.graphics.clear()
    this.drawSpriteAt(sprite, wx, wy)
    sprite.label.setPosition(wx, wy)
  }

  private drawSpriteAt(sprite: EntitySprite, wx: number, wy: number): void {
    const raw     = COLOURS[sprite.type] ?? 0x888888
    const colour  = sprite.greyscale ? 0x666666 : raw
    const alpha   = sprite.greyscale ? 0.5 : 1
    const isWave  = this.highlighted.has(sprite.entityId)
    sprite.graphics.fillStyle(colour, alpha)
    sprite.graphics.fillRect(wx - 14, wy - 14, 28, 28)
    if (isWave) {
      sprite.graphics.lineStyle(2, 0xff0000, 1)
      sprite.graphics.strokeRect(wx - 14, wy - 14, 28, 28)
    }
  }

  destroy(): void {
    this.sprites.forEach((s) => { s.graphics.destroy(); s.label.destroy() })
    this.sprites.clear()
  }
}
