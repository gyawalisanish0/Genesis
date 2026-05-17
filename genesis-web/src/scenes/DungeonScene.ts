// DungeonScene — Phaser 3 scene that owns the dungeon canvas.
//
// Tile size is computed at runtime from canvas dimensions ÷ grid size so the
// entire map always fits the screen on any device — no fixed tileSize in JSON.
//
// Tileset art: TilesetLoader handles fetching, quality-tier downsampling
// (512→256→128 per Medium/Low tier), per-tile error fallback, and Phaser
// texture caching. DungeonScene just calls loadForScene and receives a ready
// textureMap to pass into TilemapLayer.

import type { MapDef, TilesetDef } from '../core/types'
import { TilemapLayer }  from './dungeon/TilemapLayer'
import { EntityLayer }   from './dungeon/EntityLayer'
import { PartyMarker }   from './dungeon/PartyMarker'
import { WaveOverlay }   from './dungeon/WaveOverlay'
import { TilesetLoader } from './dungeon/TilesetLoader'

export interface DungeonTapCallback {
  onTileTap: (tx: number, ty: number, entityId: string | null) => void
}

export class DungeonScene extends Phaser.Scene {
  private tilemap!:       TilemapLayer
  private entityLayer!:   EntityLayer
  private party!:         PartyMarker
  private wave!:          WaveOverlay
  private tilesetLoader!: TilesetLoader
  private tapCallback:    DungeonTapCallback | null = null
  private canvasW:        number = 360
  private canvasH:        number = 400
  private pendingReveal:  { cx: number; cy: number; radius: number } | null = null

  constructor() {
    super({ key: 'DungeonScene' })
  }

  create(): void {
    this.tilemap       = new TilemapLayer(this)
    this.entityLayer   = new EntityLayer(this)
    this.party         = new PartyMarker(this)
    this.wave          = new WaveOverlay(this)
    this.tilesetLoader = new TilesetLoader(this)

    this.input.on('pointerdown', (ptr: Phaser.Input.Pointer) => {
      this.handlePointer(ptr.x, ptr.y)
    })
  }

  // ── Public command interface (called via DungeonArenaHandle) ─────────────────

  loadMap(mapDef: MapDef, tilesetDef?: TilesetDef | null, onTilesetError?: (msg: string) => void): void {
    this.canvasW = this.scale.width
    this.canvasH = this.scale.height

    const tileSize = this.computeTileSize(mapDef)
    this.cameras.main.setBackgroundColor(tilesetDef?.bgColor ?? '#0a0a14')
    this.entityLayer.setTileSize(tileSize)
    this.entityLayer.setMapDef(mapDef)
    this.party.setTileSize(tileSize)
    this.party.setMapDef(mapDef)

    if (!tilesetDef) {
      this.tilemap.load(mapDef, tileSize)
      this.entityLayer.loadEntities(mapDef.entities)
      return
    }

    this.tilesetLoader.loadForScene(
      tilesetDef,
      (textureMap) => {
        this.tilemap.load(mapDef, tileSize, textureMap)
        this.entityLayer.loadEntities(mapDef.entities)
        if (this.pendingReveal) {
          const { cx, cy, radius } = this.pendingReveal
          this.tilemap.revealAround(cx, cy, radius)
          this.pendingReveal = null
        }
      },
      onTilesetError,
    )
  }

  setPartyTile(tx: number, ty: number, animated: boolean, onDone?: () => void): void {
    if (animated) {
      this.party.moveTo(tx, ty, onDone ?? (() => {}))
    } else {
      this.party.place(tx, ty)
      onDone?.()
    }
  }

  revealTiles(cx: number, cy: number, radius: number): void {
    this.pendingReveal = { cx, cy, radius }
    this.tilemap.revealAround(cx, cy, radius)
  }

  setEntityPosition(entityId: string, tx: number, ty: number, animated: boolean, onDone?: () => void): void {
    this.entityLayer.setPosition(entityId, tx, ty, animated, onDone)
  }

  setEntityVisible(entityId: string, visible: boolean): void {
    this.entityLayer.setVisible(entityId, visible)
  }

  setEntityGreyscale(entityId: string, greyscale: boolean): void {
    this.entityLayer.setGreyscale(entityId, greyscale)
  }

  removeEntity(entityId: string): void {
    this.entityLayer.remove(entityId)
  }

  activateWavePhase(selectableEntityIds: string[]): void {
    this.wave.show(this.canvasW, this.canvasH)
    this.entityLayer.setWaveHighlights(selectableEntityIds)
  }

  deactivateWavePhase(): void {
    this.wave.hide()
    this.entityLayer.clearWaveHighlights()
  }

  setTapCallback(cb: DungeonTapCallback | null): void {
    this.tapCallback = cb
  }

  isPassable(tx: number, ty: number): boolean {
    return this.tilemap.isPassable(tx, ty)
  }

  // ── Private ──────────────────────────────────────────────────────────────────

  // Compute the largest square tile size that fits the entire grid on screen.
  // Taking min(floor(W/cols), floor(H/rows)) ensures both axes fit fully.
  private computeTileSize(mapDef: MapDef): number {
    const tileW = Math.floor(this.canvasW / mapDef.grid.cols)
    const tileH = Math.floor(this.canvasH / mapDef.grid.rows)
    return Math.min(tileW, tileH)
  }

  private handlePointer(wx: number, wy: number): void {
    if (!this.tapCallback) return
    const size     = this.tilemap.getTileSize()
    const tx       = Math.floor(wx / size)
    const ty       = Math.floor(wy / size)
    const entityId = this.entityLayer.entityAt(tx, ty)
    this.tapCallback.onTileTap(tx, ty, entityId)
  }
}
