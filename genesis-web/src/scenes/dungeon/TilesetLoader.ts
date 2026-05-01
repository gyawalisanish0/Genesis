// TilesetLoader — fetches tile PNG assets and builds a textureMap for TilemapLayer.
//
// Quality-tier downsampling:
//   High   → 512×512 source used as-is (full GPU texture)
//   Medium → source downsampled to 256×256 canvas texture
//   Low    → source downsampled to 128×128 canvas texture
//
// Downsampled textures are cached in Phaser's TextureManager under a suffixed
// key (e.g. "tileset_dungeon_classic_floor_ds256") so re-entering the dungeon
// avoids redundant network fetches and canvas redraws.
//
// On load error: the failed tile type is removed from textureMap so TilemapLayer
// falls back to a colored rectangle for that type. onTilesetError is called once
// with a human-readable message so the UI can surface a warning chip.

import type { TilesetDef } from '../../core/types'
import { ResolutionService } from '../../services/ResolutionService'

const RAW_BASE = import.meta.env.BASE_URL
const BASE_URL = RAW_BASE.endsWith('/') ? RAW_BASE : `${RAW_BASE}/`

const QUALITY_TEXTURE_SIZES: Record<string, number> = {
  High:   512,
  Medium: 256,
  Low:    128,
}

type TextureMap    = Map<string, string>  // tileTypeId → final Phaser texture key
type ReadyCallback = (textureMap: TextureMap) => void
type ErrorCallback = (message: string) => void

export class TilesetLoader {
  constructor(private scene: Phaser.Scene) {}

  // Resolves texture keys for all tile types in the definition, loading any
  // missing source PNGs from the network, then downsampling for the current
  // quality tier. Calls onReady with the completed textureMap when done.
  loadForScene(
    tilesetDef:     TilesetDef,
    onReady:        ReadyCallback,
    onTilesetError: ErrorCallback | undefined,
  ): void {
    const targetSize = QUALITY_TEXTURE_SIZES[ResolutionService.currentTier] ?? 512
    const textureMap = this.buildTextureMap(tilesetDef, targetSize)
    const toFetch    = this.findMissingSourceTextures(tilesetDef, textureMap, targetSize)

    if (toFetch.length === 0) {
      this.finalize(textureMap, targetSize, onReady)
      return
    }

    this.fetchAndFinalize(tilesetDef, textureMap, toFetch, targetSize, onReady, onTilesetError)
  }

  // ── Private helpers ──────────────────────────────────────────────────────

  // Build the initial typeId → finalKey map (keys may not exist yet in Phaser).
  private buildTextureMap(tilesetDef: TilesetDef, targetSize: number): TextureMap {
    const map = new Map<string, string>()
    for (const typeId of Object.keys(tilesetDef.tiles)) {
      const sourceKey = this.sourceKey(tilesetDef.key, typeId)
      const finalKey  = targetSize < 512 ? `${sourceKey}_ds${targetSize}` : sourceKey
      map.set(typeId, finalKey)
    }
    return map
  }

  // Return source-fetch entries only for tile types whose final (or source)
  // texture doesn't already exist in the Phaser TextureManager.
  private findMissingSourceTextures(
    tilesetDef:  TilesetDef,
    textureMap:  TextureMap,
    targetSize:  number,
  ): Array<{ sourceKey: string; url: string }> {
    const toFetch: Array<{ sourceKey: string; url: string }> = []
    for (const [typeId, filename] of Object.entries(tilesetDef.tiles)) {
      const srcKey  = this.sourceKey(tilesetDef.key, typeId)
      const finalKey = textureMap.get(typeId)!
      const alreadyReady =
        this.scene.textures.exists(finalKey) ||
        (targetSize < 512 && this.scene.textures.exists(srcKey))
      if (!alreadyReady) {
        toFetch.push({ sourceKey: srcKey, url: `${BASE_URL}images/tilesets/${tilesetDef.key}/${filename}` })
      }
    }
    return toFetch
  }

  // Load missing source PNGs, then downsample + call onReady.
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
      this.finalize(textureMap, targetSize, onReady)
    })

    for (const { sourceKey, url } of toFetch) {
      this.scene.load.image(sourceKey, url)
    }
    this.scene.load.start()
  }

  // Downsample remaining source textures (Medium/Low), then call onReady.
  private finalize(textureMap: TextureMap, targetSize: number, onReady: ReadyCallback): void {
    if (targetSize < 512) this.downsampleAll(textureMap, targetSize)
    onReady(textureMap)
  }

  // Remove tile types whose source PNG failed so TilemapLayer falls back to rects.
  private removeFailed(key: string, textureMap: TextureMap, failedKeys: Set<string>): void {
    for (const [typeId] of Array.from(textureMap.entries())) {
      if (failedKeys.has(this.sourceKey(key, typeId))) textureMap.delete(typeId)
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

  // Draw the source image into a canvas at targetSize×targetSize, register it
  // as a new Phaser texture, then release the full-res source from GPU memory.
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
