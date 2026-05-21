import {
  forwardRef, useImperativeHandle, useReducer, useRef, useCallback,
} from 'react'
import type { MapDef, TilesetDef, AsciiTileDef, EntityDef, InteractableEntityDef } from '../core/types'
import { getTileArt }                                   from './dungeonTileArt'
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
  setTapCallback(cb: DungeonTapCallback | null): void
}

// ── Tile art resolution ───────────────────────────────────────────────────────

function resolveTileArt(
  tileset: TilesetDef | null,
  tileId:  string,
  rotation: number,
): { char: string; color: string } {
  const entry: AsciiTileDef | undefined = tileset?.tiles[tileId]
  if (!entry) return getTileArt(tileId, rotation)
  const char = 'chars' in entry
    ? (entry.chars[String(rotation)] ?? entry.chars['0'] ?? '?')
    : entry.char
  return { char, color: entry.color }
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

      const tileCode = map.tiles[ty]?.[tx] ?? 0
      const tileDef  = map.tileTypes[String(tileCode)]
      const art      = resolveTileArt(tilesetRef.current, tileDef?.id ?? 'floor', tileDef?.rotation ?? 0)

      const isParty   = party?.x === tx && party?.y === ty
      const entityId  = isParty ? undefined : cellEntity[key]
      const entityDef = entityId ? entityDefsRef.current[entityId] : null
      const isWave    = entityId ? waveRef.current.has(entityId) : false
      const isGray    = entityId ? !!entityGrayRef.current[entityId] : false

      cells.push(
        <div key={key} className={styles.cell} onPointerDown={() => handleCellTap(tx, ty)}>
          <span className={styles.tile} style={{ color: art.color }}>{art.char}</span>
          {isParty && <span className={styles.party}>◈</span>}
          {entityDef && (
            <span className={[
              styles.entity,
              entityColorClass(entityDef),
              isWave ? styles.wave : '',
              isGray ? styles.gray : '',
            ].filter(Boolean).join(' ')}>
              {entityChar(entityDef)}
            </span>
          )}
        </div>
      )
    }
  }

  return (
    <div className={styles.arena} style={{ backgroundColor: bgColor ?? '#1a0a05' }}>
      <div
        className={styles.grid}
        style={{
          gridTemplateColumns: `repeat(${map.grid.cols}, 1fr)`,
          gridTemplateRows:    `repeat(${map.grid.rows}, 1fr)`,
        }}
      >
        {cells}
      </div>
    </div>
  )
})
