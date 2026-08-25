import {
  forwardRef, useImperativeHandle, useReducer, useRef, useCallback,
} from 'react'
import type { MapDef, TilesetDef, EntityDef, InteractableEntityDef } from '../core/types'
import {
  DUNGEON_MOVE_ANIM_MS, DUNGEON_PATROL_ANIM_MS, DUNGEON_REVEAL_RADIUS,
} from '../core/constants'
import { isWithinSight } from '../core/dungeon/sight'
import { DungeonTileLayer }  from './DungeonTileLayer'
import { DungeonTokenLayer } from './DungeonTokenLayer'
import type { DungeonToken, TokenKind } from './DungeonTokenLayer'
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

const FALLBACK_BG = '#1a0a05'

// ── Entity → token mapping ────────────────────────────────────────────────────

function tokenKind(def: EntityDef): TokenKind {
  switch (def.type) {
    case 'enemy':        return 'enemy'
    case 'exit':         return 'exit'
    case 'interactable': return (def as InteractableEntityDef).subtype === 'chest' ? 'chest' : 'npc'
    default:             return 'npc'
  }
}

function tokenGlyph(def: EntityDef): string {
  switch (def.type) {
    case 'enemy':        return '◆'
    case 'npc':          return '●'
    case 'exit':         return '▶'
    case 'interactable': return (def as InteractableEntityDef).subtype === 'chest' ? '▣' : '◇'
    default:             return '?'
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
      spottedRef.current    = new Set()
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
          if (!isWithinSight(dx, dy, radius)) continue
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

  /** The visible entity standing on a tile, if any — drives tap targeting. */
  const entityAt = useCallback((tx: number, ty: number): string | null => {
    for (const [id, pos] of Object.entries(entityPosRef.current)) {
      if (pos.x === tx && pos.y === ty && entityVisRef.current[id]) return id
    }
    return null
  }, [])

  const handleCellTap = useCallback((tx: number, ty: number) => {
    tapRef.current?.onTileTap(tx, ty, entityAt(tx, ty))
  }, [entityAt])

  const map = mapRef.current
  if (!map) {
    return <div className={styles.arena} style={{ backgroundColor: bgColor ?? FALLBACK_BG }} />
  }

  const tokens = buildTokens()

  // Camera: offset so the party tile lands at the arena centre (top/left: 50%).
  const party = partyRef.current
  const camX = party ? party.x * CELL_PX + CELL_PX / 2 : (map.grid.cols * CELL_PX) / 2
  const camY  = party ? party.y * CELL_PX + CELL_PX / 2 : (map.grid.rows * CELL_PX) / 2

  return (
    <div className={styles.arena} style={{ backgroundColor: bgColor ?? FALLBACK_BG }}>
      <div
        className={styles.camera}
        style={{
          width:     `${map.grid.cols * CELL_PX}px`,
          height:    `${map.grid.rows * CELL_PX}px`,
          transform: `translate(${-camX}px, ${-camY}px)`,
        }}
      >
        <div
          className={styles.grid}
          style={{
            gridTemplateColumns: `repeat(${map.grid.cols}, ${CELL_PX}px)`,
            gridTemplateRows:    `repeat(${map.grid.rows}, ${CELL_PX}px)`,
          }}
        >
          <DungeonTileLayer
            map={map}
            tileset={tilesetRef.current}
            revealed={revealedRef.current}
            party={party}
            radius={DUNGEON_REVEAL_RADIUS}
            onTap={handleCellTap}
          />
        </div>
        <DungeonTokenLayer tokens={tokens} cellPx={CELL_PX} />
      </div>
    </div>
  )

  function buildTokens(): DungeonToken[] {
    const out: DungeonToken[] = []
    for (const [id, pos] of Object.entries(entityPosRef.current)) {
      if (!entityVisRef.current[id]) continue
      const def = entityDefsRef.current[id]
      if (!def) continue
      out.push({
        id,
        x: pos.x, y: pos.y,
        kind:    tokenKind(def),
        glyph:   tokenGlyph(def),
        gray:    !!entityGrayRef.current[id],
        wave:    waveRef.current.has(id),
        spotted: spottedRef.current.has(id),
      })
    }
    // Party last so it draws over anything sharing its tile.
    const p = partyRef.current
    if (p) out.push({ id: '__party', x: p.x, y: p.y, kind: 'party', glyph: '◈' })
    return out
  }
})
