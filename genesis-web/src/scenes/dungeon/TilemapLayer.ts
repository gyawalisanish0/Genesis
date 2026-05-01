// TilemapLayer — renders the dungeon tile grid and fog-of-war overlay.
//
// tileSize is passed in on load() (computed by DungeonScene from canvas ÷ grid),
// so the whole map always fits the canvas regardless of device screen size.
//
// Sprite mode: when a textureMap is supplied (tileTypeId → Phaser texture key),
// each tile renders as a scaled Image. Falls back to a colored rectangle for any
// tile type with no matching texture key, and when no textureMap is given at all.

import type { MapDef } from '../../core/types'

const FLOOR_COLOUR      = 0x1a1a2e
const WALL_COLOUR       = 0x0a0a14
const GRID_COLOUR       = 0x2a2a3e
const FOG_COLOUR        = 0x000000
const FOG_ALPHA_HIDDEN  = 1.0
const FOG_ALPHA_SEEN    = 0.55
const FOG_ALPHA_VISIBLE = 0.0

export class TilemapLayer {
  private scene:        Phaser.Scene
  private mapDef:       MapDef | null = null
  private tileSize:     number = 48   // set by load(); computed from canvas + grid
  private tileGraphics: Phaser.GameObjects.Graphics | null = null
  private tileImages:   Phaser.GameObjects.Image[] = []
  private fogGraphics:  Phaser.GameObjects.Graphics | null = null
  private fogState:     Map<string, 'hidden' | 'seen' | 'visible'> = new Map()

  constructor(scene: Phaser.Scene) {
    this.scene = scene
  }

  // tileSize: computed by DungeonScene (canvas ÷ grid cols/rows, take min).
  // textureMap: tileTypeId → Phaser texture key. Absent = graphics-only mode.
  load(mapDef: MapDef, tileSize: number, textureMap?: Map<string, string>): void {
    this.mapDef   = mapDef
    this.tileSize = tileSize

    this.tileGraphics?.destroy()
    this.tileGraphics = null
    this.destroyTileImages()
    this.fogGraphics?.destroy()
    this.fogState.clear()

    this.fogGraphics = this.scene.add.graphics()
    this.fogGraphics.setDepth(10)

    if (textureMap && textureMap.size > 0) {
      this.drawSpriteTiles(textureMap)
    } else {
      this.tileGraphics = this.scene.add.graphics()
      this.drawGraphicTiles()
    }

    this.drawFog()
  }

  revealAround(cx: number, cy: number, radius: number): void {
    if (!this.mapDef) return
    const { cols, rows } = this.mapDef.grid
    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        const dx = Math.abs(x - cx)
        const dy = Math.abs(y - cy)
        if (Math.max(dx, dy) <= radius) {
          this.fogState.set(`${x},${y}`, 'visible')
        } else if (this.fogState.get(`${x},${y}`) === 'visible') {
          this.fogState.set(`${x},${y}`, 'seen')
        }
      }
    }
    this.drawFog()
  }

  tileToWorld(tx: number, ty: number): { x: number; y: number } {
    return { x: tx * this.tileSize + this.tileSize / 2, y: ty * this.tileSize + this.tileSize / 2 }
  }

  worldToTile(wx: number, wy: number): { x: number; y: number } {
    return { x: Math.floor(wx / this.tileSize), y: Math.floor(wy / this.tileSize) }
  }

  isPassable(tx: number, ty: number): boolean {
    if (!this.mapDef) return false
    const { cols, rows } = this.mapDef.grid
    if (tx < 0 || ty < 0 || tx >= cols || ty >= rows) return false
    const tileCode = this.mapDef.tiles[ty][tx]
    return this.mapDef.tileTypes[String(tileCode)]?.passable ?? false
  }

  getTileSize(): number {
    return this.tileSize
  }

  // ── Private helpers ────────────────────────────────────────────────────────

  // Sprite mode: each tile is a scaled Image. Falls back to a colored rect for
  // any tile type whose id has no matching entry in textureMap.
  private drawSpriteTiles(textureMap: Map<string, string>): void {
    if (!this.mapDef) return
    const { cols, rows } = this.mapDef.grid
    const size = this.tileSize
    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        const tileCode = this.mapDef.tiles[y][x]
        const typeInfo = this.mapDef.tileTypes[String(tileCode)]
        const typeId   = typeInfo?.id ?? ''
        const texKey   = textureMap.get(typeId)
        if (texKey) {
          const img = this.scene.add.image(
            x * size + size / 2,
            y * size + size / 2,
            texKey,
          ).setDisplaySize(size, size)
          this.tileImages.push(img)
        } else {
          if (!this.tileGraphics) this.tileGraphics = this.scene.add.graphics()
          const colour = typeInfo?.passable ? FLOOR_COLOUR : WALL_COLOUR
          this.tileGraphics.fillStyle(colour)
          this.tileGraphics.fillRect(x * size, y * size, size, size)
          this.tileGraphics.lineStyle(1, GRID_COLOUR, 0.3)
          this.tileGraphics.strokeRect(x * size, y * size, size, size)
        }
      }
    }
  }

  private destroyTileImages(): void {
    for (const img of this.tileImages) img.destroy()
    this.tileImages = []
  }

  private drawGraphicTiles(): void {
    if (!this.mapDef || !this.tileGraphics) return
    const { cols, rows } = this.mapDef.grid
    const size = this.tileSize
    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        const tileCode = this.mapDef.tiles[y][x]
        const passable = this.mapDef.tileTypes[String(tileCode)]?.passable ?? false
        const colour   = passable ? FLOOR_COLOUR : WALL_COLOUR
        this.tileGraphics.fillStyle(colour)
        this.tileGraphics.fillRect(x * size, y * size, size, size)
        this.tileGraphics.lineStyle(1, GRID_COLOUR, 0.3)
        this.tileGraphics.strokeRect(x * size, y * size, size, size)
      }
    }
  }

  private drawFog(): void {
    if (!this.mapDef || !this.fogGraphics) return
    this.fogGraphics.clear()
    const { cols, rows } = this.mapDef.grid
    const size = this.tileSize
    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        const state = this.fogState.get(`${x},${y}`) ?? 'hidden'
        const alpha =
          state === 'visible' ? FOG_ALPHA_VISIBLE :
          state === 'seen'    ? FOG_ALPHA_SEEN    :
                                FOG_ALPHA_HIDDEN
        if (alpha === 0) continue
        this.fogGraphics.fillStyle(FOG_COLOUR, alpha)
        this.fogGraphics.fillRect(x * size, y * size, size, size)
      }
    }
  }

  destroy(): void {
    this.tileGraphics?.destroy()
    this.destroyTileImages()
    this.fogGraphics?.destroy()
  }
}
