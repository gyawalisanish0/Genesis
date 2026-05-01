// DungeonScene — Phaser 3 scene that owns the dungeon canvas.
//
// Tileset support: loadMap() accepts an optional TilesetDef. When present, tile
// PNGs are loaded dynamically (this.load.image + load.start) then TilemapLayer
// renders Images scaled to tileSize. When loading fails for a tile type, that
// type falls back to a colored rectangle — the map never hard-errors on missing art.

import type { MapDef, TilesetDef } from '../core/types'
import { TilemapLayer } from './dungeon/TilemapLayer'
import { EntityLayer }  from './dungeon/EntityLayer'
import { PartyMarker }  from './dungeon/PartyMarker'
import { WaveOverlay }  from './dungeon/WaveOverlay'

// Normalize BASE_URL so image paths are always correct, matching the DataService
// pattern. Vite's --base flag may produce a value without a trailing slash.
const RAW_BASE = import.meta.env.BASE_URL
const BASE_URL = RAW_BASE.endsWith('/') ? RAW_BASE : `${RAW_BASE}/`

export interface DungeonTapCallback {
  onTileTap: (tx: number, ty: number, entityId: string | null) => void
}

export class DungeonScene extends Phaser.Scene {
  private tilemap!:     TilemapLayer
  private entityLayer!: EntityLayer
  private party!:       PartyMarker
  private wave!:        WaveOverlay
  private tapCallback: DungeonTapCallback | null = null
  private canvasW:     number = 360
  private canvasH:     number = 400

  constructor() {
    super({ key: 'DungeonScene' })
  }

  create(): void {
    this.tilemap     = new TilemapLayer(this)
    this.entityLayer = new EntityLayer(this)
    this.party       = new PartyMarker(this)
    this.wave        = new WaveOverlay(this)

    // React owns input — forward pointer events via callback
    this.input.on('pointerdown', (ptr: Phaser.Input.Pointer) => {
      this.handlePointer(ptr.x, ptr.y)
    })
  }

  // ── Public command interface (called via DungeonArenaHandle) ─────────────────

  loadMap(mapDef: MapDef, tilesetDef?: TilesetDef | null): void {
    this.canvasW = this.scale.width
    this.canvasH = this.scale.height
    const size   = mapDef.tileSize
    this.entityLayer.setTileSize(size)
    this.party.setTileSize(size)

    if (!tilesetDef) {
      this.tilemap.load(mapDef)
      this.entityLayer.loadEntities(mapDef.entities)
      return
    }

    this.loadTilesetThenRender(mapDef, tilesetDef)
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

  // Build a textureMap for TilemapLayer, loading any missing tile PNGs first.
  // Failed loads are excluded from textureMap so those tile types fall back
  // to colored rectangles — the dungeon never hard-errors on missing art.
  private loadTilesetThenRender(mapDef: MapDef, tilesetDef: TilesetDef): void {
    const textureMap = new Map<string, string>()
    const toLoad: Array<{ key: string; url: string }> = []

    for (const [typeId, filename] of Object.entries(tilesetDef.tiles)) {
      const texKey = `tileset_${tilesetDef.key}_${typeId}`
      textureMap.set(typeId, texKey)
      if (!this.textures.exists(texKey)) {
        toLoad.push({
          key: texKey,
          url: `${BASE_URL}images/tilesets/${tilesetDef.key}/${filename}`,
        })
      }
    }

    if (toLoad.length === 0) {
      this.tilemap.load(mapDef, textureMap)
      this.entityLayer.loadEntities(mapDef.entities)
      return
    }

    const failedKeys = new Set<string>()
    const onError    = (file: Phaser.Loader.File) => failedKeys.add(file.key)

    this.load.on('loaderror', onError)
    this.load.once('complete', () => {
      this.load.off('loaderror', onError)
      // Remove any tile type whose texture failed to load.
      for (const [typeId, texKey] of Array.from(textureMap.entries())) {
        if (failedKeys.has(texKey)) textureMap.delete(typeId)
      }
      this.tilemap.load(mapDef, textureMap)
      this.entityLayer.loadEntities(mapDef.entities)
    })

    for (const { key, url } of toLoad) {
      this.load.image(key, url)
    }
    this.load.start()
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
