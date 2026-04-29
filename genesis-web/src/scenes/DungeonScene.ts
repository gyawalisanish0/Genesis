import type { MapDef } from '../core/types'
import { TilemapLayer } from './dungeon/TilemapLayer'
import { EntityLayer }  from './dungeon/EntityLayer'
import { PartyMarker }  from './dungeon/PartyMarker'
import { WaveOverlay }  from './dungeon/WaveOverlay'

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

  loadMap(mapDef: MapDef): void {
    this.canvasW = this.scale.width
    this.canvasH = this.scale.height
    const size   = mapDef.tileSize
    this.tilemap.load(mapDef)
    this.entityLayer.setTileSize(size)
    this.party.setTileSize(size)
    this.entityLayer.loadEntities(mapDef.entities)
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

  private handlePointer(wx: number, wy: number): void {
    if (!this.tapCallback) return
    const size     = this.tilemap.getTileSize()
    const tx       = Math.floor(wx / size)
    const ty       = Math.floor(wy / size)
    const entityId = this.entityLayer.entityAt(tx, ty)
    this.tapCallback.onTileTap(tx, ty, entityId)
  }
}
