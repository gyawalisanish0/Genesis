// TilesetLoader — fetches tile PNG assets and builds a textureMap for TilemapLayer.
//
// Source size is declared per-tileset in tileset.json (e.g. 1024 for 1024×1024
// PNGs). Quality-tier downsampling divides by a factor of 2 per step down:
//   High   → sourceSize     (full GPU texture, e.g. 1024×1024)
//   Medium → sourceSize / 2 (e.g. 512×512)
//   Low    → sourceSize / 4 (e.g. 256×256)
//
// Downsampled textures are cached under a suffixed key (e.g.
// "tileset_mars_floor_ds512") so re-entering the dungeon avoids redundant
// network fetches and canvas redraws.
//
// On load error: the failed tile type is removed from textureMap so TilemapLayer
// falls back to a colored rectangle for that type. onTilesetError is called once
// with a human-readable message so the UI can surface a warning chip.
//
// "pending" tile types in the tileset definition are intentionally ignored here
// — they have no PNG yet and should never trigger a load attempt or error.

import type { TilesetDef } from '../../core/types'
import { ResolutionService } from '../../services/ResolutionService'

const RAW_BASE = import.meta.env.BASE_URL
const BASE_URL = RAW_BASE.endsWith('/') ? RAW_BASE : `${RAW_BASE}/`

type TextureMap    = Map<string, string>  // tileTypeId → final Phaser texture key
type ReadyCallback = (textureMap: TextureMap) => void
type ErrorCallback = (message: string) => void

export class TilesetLoader {
  constructor(private scene: Phaser.Scene) {}

  // Resolves texture keys for all active (non-pending) tile types, loading any
  // missing source PNGs from the network, then downsampling for the current
  // quality tier. Calls onReady with the completed textureMap when done.
  loadForScene(
    tilesetDef:     TilesetDef,
    onReady:        ReadyCallback,
    onTilesetError: ErrorCallback | undefined,
  ): void {
    const targetSize = this.computeTargetSize(tilesetDef.sourceSize)
    const textureMap = this.buildTextureMap(tilesetDef, targetSize)
    const toFetch    = this.findMissingSourceTextures(tilesetDef, textureMap, targetSize)

    if (toFetch.length === 0) {
      this.finalize(textureMap, targetSize, tilesetDef.sourceSize, onReady)
      return
    }

    this.fetchAndFinalize(tilesetDef, textureMap, toFetch, targetSize, onReady, onTilesetError)
  }

  // ── Private helpers ──────────────────────────────────────────────────────

  // High = full source; Medium = half; Low = quarter. Min 64 to avoid degenerate sizes.
  private computeTargetSize(sourceSize: number): number {
    switch (ResolutionService.currentTier) {
      case 'High':   return sourceSize
      case 'Medium': return Math.max(64, sourceSize >> 1)
      case 'Low':    return Math.max(64, sourceSize >> 2)
    }
  }

  // Build the initial typeId → finalKey map. Only iterates tiles[], not pending[].
  private buildTextureMap(tilesetDef: TilesetDef, targetSize: number): TextureMap {
    const map = new Map<string, string>()
    for (const typeId of Object.keys(tilesetDef.tiles)) {
      const srcKey   = this.sourceKey(tilesetDef.key, typeId)
      const finalKey = targetSize < tilesetDef.sourceSize ? `${srcKey}_ds${targetSize}` : srcKey
      map.set(typeId, finalKey)
    }
    return map
  }

  // Return source-fetch entries for tile types whose final (or source) texture
  // doesn't already exist in the Phaser TextureManager.
  private findMissingSourceTextures(
    tilesetDef: TilesetDef,
    textureMap: TextureMap,
    targetSize: number,
  ): Array<{ sourceKey: string; url: string }> {
    const toFetch: Array<{ sourceKey: string; url: string }> = []
    for (const [typeId, filename] of Object.entries(tilesetDef.tiles)) {
      const srcKey   = this.sourceKey(tilesetDef.key, typeId)
      const finalKey = textureMap.get(typeId)!
      const alreadyReady =
        this.scene.textures.exists(finalKey) ||
        (targetSize < tilesetDef.sourceSize && this.scene.textures.exists(srcKey))
      if (!alreadyReady) {
        toFetch.push({ sourceKey: srcKey, url: `${BASE_URL}images/tilesets/${tilesetDef.key}/${filename}` })
      }
    }
    return toFetch
  }

  // Load missing source PNGs, track failures, then downsample + call onReady.
  private fetchAndFinalize(
    tilesetDef:     TilesetDef,
    textureMap:     TextureMap,
    toFetch:        Array<{ sourceKey: string; url: string }>,
    targetSize:     number,
    onReady:        ReadyCallback,
    onTilesetError: ErrorCallback | undefined,
  ): void {
    const failedKeys = new Set<string>()
    const onError    = (file: Phaser.Loader.File) => failedKeys.add(file.key)

    this.scene.load.on('loaderror', onError)
    this.scene.load.once('complete', () => {
      this.scene.load.off('loaderror', onError)
      this.removeFailed(tilesetDef.key, textureMap, failedKeys)
      if (failedKeys.size > 0 && onTilesetError) {
        const word = failedKeys.size === toFetch.length ? 'Tile art' : 'Some tile art'
        onTilesetError(`${word} failed to load — using fallback graphics`)
      }
      this.finalize(textureMap, targetSize, tilesetDef.sourceSize, onReady)
    })

    for (const { sourceKey, url } of toFetch) {
      this.scene.load.image(sourceKey, url)
    }
    this.scene.load.start()
  }

  // Downsample remaining source textures when below full-res, then call onReady.
  private finalize(
    textureMap:  TextureMap,
    targetSize:  number,
    sourceSize:  number,
    onReady:     ReadyCallback,
  ): void {
    if (targetSize < sourceSize) this.downsampleAll(textureMap, targetSize)
    onReady(textureMap)
  }

  // Remove tile types whose source PNG failed so TilemapLayer falls back to rects.
  private removeFailed(tilesetKey: string, textureMap: TextureMap, failedKeys: Set<string>): void {
    for (const [typeId] of Array.from(textureMap.entries())) {
      if (failedKeys.has(this.sourceKey(tilesetKey, typeId))) textureMap.delete(typeId)
    }
  }

  // Create downsampled canvas textures for each entry that still needs one.
  private downsampleAll(textureMap: TextureMap, targetSize: number): void {
    for (const [, finalKey] of Array.from(textureMap.entries())) {
      if (this.scene.textures.exists(finalKey)) continue
      const sourceKey = finalKey.replace(`_ds${targetSize}`, '')
      if (!this.scene.textures.exists(sourceKey)) continue
      this.downsampleTexture(sourceKey, finalKey, targetSize)
    }
  }

  // Draw source image onto a canvas at targetSize, register as a Phaser texture,
  // then release the full-res source from GPU memory.
  private downsampleTexture(sourceKey: string, targetKey: string, size: number): void {
    const src    = this.scene.textures.get(sourceKey).source[0].image as HTMLImageElement
    const canvas = document.createElement('canvas')
    canvas.width  = size
    canvas.height = size
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.imageSmoothingEnabled = true
    ctx.imageSmoothingQuality = 'high'
    ctx.drawImage(src, 0, 0, size, size)
    this.scene.textures.addCanvas(targetKey, canvas)
    this.scene.textures.remove(sourceKey)
  }

  private sourceKey(tilesetKey: string, typeId: string): string {
    return `tileset_${tilesetKey}_${typeId}`
  }
}
