/**
 * Dungeon tile layer — fog and floor, no entities.
 *
 * Tiles fill with their authored base colour until pixel tile sheets are
 * authored. A flat fill alone makes a run of floor tiles read as one colour
 * slab with no sense of stepping between them, so each tile takes a small
 * deterministic tonal offset and an edge seam.
 */

import type { MapDef, TilesetDef } from '../core/types'
import { sightBand } from '../core/dungeon/sight'
import styles from './DungeonArena.module.css'

const FALLBACK_TILE_COLOR = '#2a1a12'

/** Widest tonal swing between neighbouring tiles, as a brightness multiplier. */
const TILE_TONE_RANGE = 0.14

function resolveTileColor(tileset: TilesetDef | null, tileId: string): string {
  return tileset?.tiles[tileId]?.color ?? FALLBACK_TILE_COLOR
}

/**
 * Stable per-tile brightness in [1 - range/2, 1 + range/2].
 *
 * Hashed from the coordinates rather than randomised so a tile keeps its tone
 * across re-renders — a tile that shimmered on every repaint would be worse
 * than the flat slab it replaces.
 */
function tileTone(tx: number, ty: number): number {
  const hash = Math.sin(tx * 12.9898 + ty * 78.233) * 43758.5453
  const unit = hash - Math.floor(hash)
  return 1 + (unit - 0.5) * TILE_TONE_RANGE
}

interface Props {
  map:      MapDef
  tileset:  TilesetDef | null
  revealed: Set<string>
  /** Null before the party is placed — everything revealed lights uniformly. */
  party:    { x: number; y: number } | null
  radius:   number
  onTap:    (tx: number, ty: number) => void
}

export function DungeonTileLayer({ map, tileset, revealed, party, radius, onTap }: Props) {
  const cells = []

  for (let ty = 0; ty < map.grid.rows; ty++) {
    for (let tx = 0; tx < map.grid.cols; tx++) {
      const key = `${tx},${ty}`

      if (map.fogOfWar && !revealed.has(key)) {
        cells.push(<div key={key} className={styles.cellHidden} />)
        continue
      }

      const tileCode = map.tiles[ty]?.[tx] ?? 0
      const tileDef  = map.tileTypes[String(tileCode)]
      const color    = resolveTileColor(tileset, tileDef?.id ?? 'floor')
      const band     = party ? sightBand(tx - party.x, ty - party.y, radius) : 1

      cells.push(
        <div key={key} className={styles.cell} onPointerDown={() => onTap(tx, ty)}>
          <div
            className={styles.tileWrapper}
            style={{ backgroundColor: color, filter: `brightness(${tileTone(tx, ty).toFixed(3)})` }}
          />
          <div className={styles.tileShade} data-band={band} />
        </div>,
      )
    }
  }

  return <>{cells}</>
}
