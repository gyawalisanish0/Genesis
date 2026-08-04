import {
  forwardRef, useImperativeHandle, useReducer, useRef, useCallback,
} from 'react'
import type { MapDef, TilesetDef, EntityDef, InteractableEntityDef } from '../core/types'
import { DUNGEON_MOVE_ANIM_MS, DUNGEON_PATROL_ANIM_MS } from '../core/constants'
import styles from './DungeonArena.module.css'

// ── Public types ──────────────────────────────────────────────────────────────

export interface DungeonTapCallback {
  onTileTap: (tx: number, ty: number, entityId: string | null) => void
}

export interface DungeonArenaHandle {
  loadMap(mapDef: MapDef, tilesetDef?: TilesetDef | null, onTilesetError?: (msg: string) => void): void
  setPartyTile(tx: number, ty: number, animated: boolean, onDone?: () => void): void
  revealTiles(cx: number, cy: number, radius: number): void
  setEntityPosition(entityId: string, tx: number, ty: number, animated: boolean, onDone?: () => void): void
  setEntityVisible(entityId: string, visible: boolean): void
  setEntityGreyscale(entityId: string, greyscale: boolean): void
  removeEntity(entityId: string): void
  activateWavePhase(selectableEntityIds: string[]): void
  deactivateWavePhase(): void
  spotEntity(entityId: string): void
  unspotEntity(entityId: string): void
  setTapCallback(cb: DungeonTapCallback | null): void
}

// Fixed cell size — 7.5 tiles across a 360dp canvas.
const CELL_PX = 48

const FALLBACK_TILE_COLOR = '#2a1a12'

// ── Tile art resolution ───────────────────────────────────────────────────────
//
// Tiles render as flat colour fills until pixel tile sheets are authored.
// TilesetDef.tiles[id].color is the authored base colour; `art` (the future
// PNG reference) is documented in docs/ui/00-design-system.md § Tilesets.

function resolveTileColor(tileset: TilesetDef | null, tileId: string): string {
  return tileset?.tiles[tileId]?.color ?? FALLBACK_TILE_COLOR
}

// ── Entity char + CSS class ───────────────────────────────────────────────────

function entityChar(def: EntityDef): string {
  switch (def.type) {
    case 'enemy':        return '◆'
    case 'npc':          return '●'
    case 'exit':         return '▶'
    case 'interactable': return (def as InteractableEntityDef).subtype === 'chest' ? '▣' : '◇'
    default:             return '?'
  }
}

function entityColorClass(def: EntityDef): string {
  switch (def.type) {
    case 'enemy':        return styles.enemy
    case 'exit':         return styles.exit
    case 'interactable': return styles.chest
    default:             return styles.npc
  }
}

// ── Component ─────────────────────────────────────────────────────────────────

interface Props { bgColor?: string }

export const DungeonArena = forwardRef<DungeonArenaHandle, Props>(
function DungeonArena({ bgColor }, ref) {
  const [, bump] = useReducer((n: number) => n + 1, 0)

  const mapRef        = useRef<MapDef | null>(null)
  const tilesetRef    = useRef<TilesetDef | null>(null)
  const revealedRef   = useRef<Set<string>>(new Set())
  const entityPosRef  = useRef<Record<string, { x: number; y: number }>>({})
  const entityVisRef  = useRef<Record<string, boolean>>({})
  const entityGrayRef = useRef<Record<string, boolean>>({})
  const entityDefsRef = useRef<Record<string, EntityDef>>({})
  const waveRef       = useRef<Set<string>>(new Set())
  const spottedRef    = useRef<Set<string>>(new Set())
  const partyRef      = useRef<{ x: number; y: number } | null>(null)
  const tapRef        = useRef<DungeonTapCallback | null>(null)

  const rerender = useCallback(() => bump(), [])

  useImperativeHandle(ref, () => ({
    loadMap(mapDef, tilesetDef) {
      mapRef.current        = mapDef
      tilesetRef.current    = tilesetDef ?? null
      revealedRef.current   = new Set()
      entityPosRef.current  = {}
      entityVisRef.current  = {}
      entityGrayRef.current = {}
      entityDefsRef.current = {}
      waveRef.current       = new Set()
      partyRef.current      = null
      for (const e of mapDef.entities) {
        if (e.type === 'trigger') continue
        entityPosRef.current[e.entityId]  = { x: e.x, y: e.y }
        entityVisRef.current[e.entityId]  = false
        entityDefsRef.current[e.entityId] = e
      }
      rerender()
    },
    setPartyTile(tx, ty, animated, onDone) {
      partyRef.current = { x: tx, y: ty }
      rerender()
      animated ? setTimeout(() => onDone?.(), DUNGEON_MOVE_ANIM_MS) : onDone?.()
    },
    revealTiles(cx, cy, radius) {
      const map = mapRef.current
      if (!map) return
      for (let dy = -radius; dy <= radius; dy++) {
        for (let dx = -radius; dx <= radius; dx++) {
          const tx = cx + dx
          const ty = cy + dy
          if (tx >= 0 && ty >= 0 && tx < map.grid.cols && ty < map.grid.rows)
            revealedRef.current.add(`${tx},${ty}`)
        }
      }
      rerender()
    },
    setEntityPosition(entityId, tx, ty, animated, onDone) {
      entityPosRef.current[entityId] = { x: tx, y: ty }
      rerender()
      animated ? setTimeout(() => onDone?.(), DUNGEON_PATROL_ANIM_MS) : onDone?.()
    },
    setEntityVisible(entityId, visible) {
      entityVisRef.current[entityId] = visible
      rerender()
    },
    setEntityGreyscale(entityId, greyscale) {
      entityGrayRef.current[entityId] = greyscale
      rerender()
    },
    removeEntity(entityId) {
      delete entityPosRef.current[entityId]
      delete entityVisRef.current[entityId]
      delete entityGrayRef.current[entityId]
      delete entityDefsRef.current[entityId]
      rerender()
    },
    activateWavePhase(ids) {
      waveRef.current = new Set(ids)
      rerender()
    },
    deactivateWavePhase() {
      waveRef.current = new Set()
      rerender()
    },
    spotEntity(entityId) {
      spottedRef.current = new Set([...spottedRef.current, entityId])
      rerender()
    },
    unspotEntity(entityId) {
      const next = new Set(spottedRef.current)
      next.delete(entityId)
      spottedRef.current = next
      rerender()
    },
    setTapCallback(cb) { tapRef.current = cb },
  }))

  function handleCellTap(tx: number, ty: number) {
    if (!tapRef.current) return
    let entityId: string | null = null
    for (const [id, pos] of Object.entries(entityPosRef.current)) {
      if (pos.x === tx && pos.y === ty && entityVisRef.current[id]) {
        entityId = id
        break
      }
    }
    tapRef.current.onTileTap(tx, ty, entityId)
  }

  const map = mapRef.current
  if (!map) {
    return <div className={styles.arena} style={{ backgroundColor: bgColor ?? '#1a0a05' }} />
  }

  // Build cell → entity lookup (visible entities only)
  const cellEntity: Record<string, string> = {}
  for (const [id, pos] of Object.entries(entityPosRef.current)) {
    if (entityVisRef.current[id]) cellEntity[`${pos.x},${pos.y}`] = id
  }

  const party = partyRef.current
  const cells = []

  for (let ty = 0; ty < map.grid.rows; ty++) {
    for (let tx = 0; tx < map.grid.cols; tx++) {
      const key      = `${tx},${ty}`
      const revealed = !map.fogOfWar || revealedRef.current.has(key)

      if (!revealed) {
        cells.push(<div key={key} className={styles.cellHidden} />)
        continue
      }

      const tileCode  = map.tiles[ty]?.[tx] ?? 0
      const tileDef   = map.tileTypes[String(tileCode)]
      const tileColor = resolveTileColor(tilesetRef.current, tileDef?.id ?? 'floor')

      const isParty    = party?.x === tx && party?.y === ty
      const entityId   = isParty ? undefined : cellEntity[key]
      const entityDef  = entityId ? entityDefsRef.current[entityId] : null
      const isWave     = entityId ? waveRef.current.has(entityId) : false
      const isGray     = entityId ? !!entityGrayRef.current[entityId] : false
      const isSpotted  = entityId ? spottedRef.current.has(entityId) : false

      cells.push(
        <div key={key} className={styles.cell} onPointerDown={() => handleCellTap(tx, ty)}>
          <div className={styles.tileWrapper} style={{ backgroundColor: tileColor }} />
          {isParty && <span className={styles.party}>◈</span>}
          {entityDef && (
            <span className={[
              styles.entity,
              entityColorClass(entityDef),
              isWave    ? styles.wave    : '',
              isGray    ? styles.gray    : '',
              isSpotted ? styles.spotted : '',
            ].filter(Boolean).join(' ')}>
              {entityChar(entityDef)}
            </span>
          )}
        </div>
      )
    }
  }

  // Camera: offset so party tile lands at arena center (top:50% left:50%)
  const camX = party ? party.x * CELL_PX + CELL_PX / 2 : (map.grid.cols * CELL_PX) / 2
  const camY = party ? party.y * CELL_PX + CELL_PX / 2 : (map.grid.rows * CELL_PX) / 2

  return (
    <div
      className={styles.arena}
      style={{ backgroundColor: bgColor ?? '#1a0a05' }}
    >
      <div
        className={styles.grid}
        style={{
          width:               `${map.grid.cols * CELL_PX}px`,
          height:              `${map.grid.rows * CELL_PX}px`,
          gridTemplateColumns: `repeat(${map.grid.cols}, ${CELL_PX}px)`,
          gridTemplateRows:    `repeat(${map.grid.rows}, ${CELL_PX}px)`,
          transform:           `translate(${-camX}px, ${-camY}px)`,
        }}
      >
        {cells}
      </div>
    </div>
  )
})
