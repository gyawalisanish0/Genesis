import {
  createContext, useContext, useRef, useState, useCallback,
  useEffect, type RefObject,
} from 'react'
import type { StageDef, MapDef, TilesetDef, EnemyEntityDef, InteractableEntityDef, DungeonState } from '../core/types'
import type { DungeonArenaHandle } from '../components/DungeonArena'
import { useGameStore }     from '../core/GameContext'
import { useScreen }        from '../navigation/useScreen'
import { SCREEN_IDS }       from '../navigation/screenRegistry'
import { NarrativeService } from '../services/NarrativeService'
import { NarrativeUnits }   from '../components/NarrativeLayer'
import { loadStageDef, loadMapDef, loadTilesetDef, loadCharacterWithSkills, loadLevelNarrative } from '../services/DataService'
import { createUnit }       from '../core/unit'
import {
  DUNGEON_DEFAULT_VISUAL_RANGE,
  DUNGEON_REVEAL_RADIUS,
  DUNGEON_ENCOUNTER_PAUSE_MS,
  DUNGEON_SPOT_FLASH_MS,
  DUNGEON_ENCOUNTER_FLASH_MS,
} from '../core/constants'

// ── Types ─────────────────────────────────────────────────────────────────────

export type DungeonPhase = 'loading' | 'exploring' | 'wave' | 'transitioning'

export interface EnemyParty {
  partyId: string
  spotted: EnemyEntityDef   // the member in visual range that triggered detection
  members: EnemyEntityDef[] // all map-defined members of this party
}

interface DungeonContextValue {
  stageDef:          StageDef | null
  mapDef:            MapDef | null
  phase:             DungeonPhase
  partyTile:         { x: number; y: number }
  entityPositions:   Record<string, { x: number; y: number }>
  defeatedEntityIds: Set<string>
  waveParties:       EnemyParty[]
  // Party leader summary — shown in the persistent HP pill so the player can
  // see at a glance whose perspective is on screen.
  partyLeader:      { name: string; hp: number; maxHp: number } | null
  // True during the rapid white-flash overlay that plays before battle launches.
  encounterFlashing: boolean
  // Non-null when one or more tile textures failed to load. Cleared once the
  // ErrorToaster auto-dismisses; set to the same message string on each new
  // map load that has failures.
  tilesetError:     string | null
  bgColor:          string | null   // from tileset.json — drives arena container + Phaser camera
  openChest:        InteractableEntityDef | null
  arenaRef:         RefObject<DungeonArenaHandle | null>
  moveParty:        (dx: number, dy: number) => void
  selectWaveParty:  (partyId: string) => void
  collectChest:     () => void
}

// ── Context ───────────────────────────────────────────────────────────────────

const DungeonContext = createContext<DungeonContextValue | null>(null)

export function useDungeonScreen(): DungeonContextValue {
  const ctx = useContext(DungeonContext)
  if (!ctx) throw new Error('useDungeonScreen must be used inside DungeonProvider')
  return ctx
}

// ── Provider ──────────────────────────────────────────────────────────────────

export function DungeonProvider({ children }: { children: React.ReactNode }) {
  const { navigateTo }   = useScreen()
  const arenaRef         = useRef<DungeonArenaHandle | null>(null)

  const {
    setSelectedMode, setSelectedTeamIds,
    setCurrentEncounterEnemies, setCurrentEncounterEntityIds,
    setReturnScreen, setDungeonState,
    dungeonState,
  } = useGameStore()

  const [stageDef,  setStageDef]  = useState<StageDef | null>(null)
  const [mapDef,    setMapDef]    = useState<MapDef | null>(null)
  const [phase,     setPhase]     = useState<DungeonPhase>('loading')
  const [partyTile, setPartyTile] = useState({ x: 0, y: 0 })
  const [entityPositions, setEntityPositions] = useState<Record<string, { x: number; y: number }>>({})
  const [defeatedEntityIds, setDefeatedEntityIds] = useState<Set<string>>(new Set())
  const [waveParties, setWaveParties] = useState<EnemyParty[]>([])
  const [encounterFlashing, setEncounterFlashing] = useState(false)
  const [partyLeader, setPartyLeader]   = useState<{ name: string; hp: number; maxHp: number } | null>(null)
  const [tilesetError, setTilesetError] = useState<string | null>(null)
  const [bgColor,      setBgColor]      = useState<string | null>(null)
  const [openChest,    setOpenChestState] = useState<InteractableEntityDef | null>(null)

  const moveQueueRef   = useRef(false)   // true while animation in flight
  const openChestRef   = useRef<InteractableEntityDef | null>(null)
  const stageDefRef    = useRef<StageDef | null>(null)
  const mapDefRef      = useRef<MapDef | null>(null)
  const tilesetRef     = useRef<TilesetDef | null>(null)
  const partyRef       = useRef({ x: 0, y: 0 })
  const entityPosRef   = useRef<Record<string, { x: number; y: number }>>({})
  const defeatedRef    = useRef<Set<string>>(new Set())

  function setOpenChest(chest: InteractableEntityDef | null) {
    openChestRef.current = chest
    setOpenChestState(chest)
  }

  // ── Load stage on mount ────────────────────────────────────────────────────

  useEffect(() => {
    loadStage()
  }, [])

  async function loadStage() {
    const stageId = 'stage_001'
    const [stage, map] = await Promise.all([loadStageDef(stageId), loadMapDef(stageId)])
    if (!stage || !map) return

    setStageDef(stage)
    setMapDef(map)
    stageDefRef.current  = stage
    mapDefRef.current    = map

    // Load the tileset definition if the map references one. Null = graphics fallback.
    tilesetRef.current = map.tilesetKey ? await loadTilesetDef(map.tilesetKey) : null
    setBgColor(tilesetRef.current?.bgColor ?? null)

    // Register narrative
    const narrative = await loadLevelNarrative(stageId)
    if (narrative) NarrativeService.registerEntries(stageId, narrative.entries)

    // Build initial entity positions
    const positions: Record<string, { x: number; y: number }> = {}
    for (const e of map.entities) {
      if (e.type !== 'trigger') positions[e.entityId] = { x: e.x, y: e.y }
    }

    // Always load player units so the party HP pill + narrative registry are
    // populated, regardless of whether we're resuming or starting fresh.
    await registerPlayerUnits(stage)

    // Restore saved dungeon state or start fresh
    if (dungeonState?.stageId === stageId) {
      restoreState(dungeonState, map, positions)
    } else {
      const start = map.playerStart
      setPartyTile(start)
      partyRef.current = start
      setEntityPositions(positions)
      entityPosRef.current = positions

      // Wait for arena ref to attach + Phaser scene ready, then init + play intro
      waitForArenaReady(() => {
        initArena(map, positions, start)
        NarrativeService.play('stage_001_intro')
      })
    }

    setPhase('exploring')
  }

  function waitForArenaReady(cb: () => void): void {
    const start = Date.now()
    const tick = () => {
      // arenaRef.current is set when DungeonArena mounts (almost instantly).
      // The internal sceneRef is set after Phaser's 'ready' event — we can't
      // observe it from here, so poll a short interval.
      if (arenaRef.current) {
        // Give Phaser a moment to finish 'ready' event after mount
        if (Date.now() - start > 300) { cb(); return }
      }
      if (Date.now() - start > 5000) { cb(); return }  // safety bail
      setTimeout(tick, 50)
    }
    tick()
  }

  function restoreState(
    saved: DungeonState,
    map: MapDef,
    defaultPositions: Record<string, { x: number; y: number }>,
  ) {
    const positions = { ...defaultPositions, ...saved.entityPositions }
    const defeated  = new Set(saved.defeatedEntityIds)
    setPartyTile(saved.partyTile)
    partyRef.current = saved.partyTile
    setEntityPositions(positions)
    entityPosRef.current = positions
    setDefeatedEntityIds(defeated)
    defeatedRef.current = defeated

    setTimeout(() => initArena(map, positions, saved.partyTile, undefined, saved.lastSeenPositions), 500)
  }

  function initArena(
    map: MapDef,
    positions: Record<string, { x: number; y: number }>,
    start: { x: number; y: number },
    _revealedTiles?: string[],
    lastSeen?: Record<string, { x: number; y: number }>,
  ) {
    const arena = arenaRef.current
    if (!arena) return
    arena.loadMap(map, tilesetRef.current, (msg) => setTilesetError(msg))
    arena.setPartyTile(start.x, start.y, false)
    arena.revealTiles(start.x, start.y, DUNGEON_REVEAL_RADIUS)

    for (const e of map.entities) {
      if (e.type === 'trigger') continue
      const pos = positions[e.entityId]
      if (!pos) continue
      if (defeatedRef.current.has(e.entityId)) {
        arena.removeEntity(e.entityId)
        continue
      }
      arena.setEntityPosition(e.entityId, pos.x, pos.y, false)
    }

    // Compute initial visibility from the party's starting position — mirrors
    // the in-range check applied on every subsequent move, so entities within
    // the starting reveal radius render immediately instead of staying hidden
    // until the first step.
    updateEntityVisibility(start.x, start.y)

    // Previously-spotted entities remain visible as greyscale "memory"
    // markers even when currently out of range.
    for (const id of Object.keys(lastSeen ?? {})) {
      if (defeatedRef.current.has(id)) continue
      arena.setEntityGreyscale(id, true)
      arena.setEntityVisible(id, true)
    }
  }

  async function registerPlayerUnits(stage: StageDef) {
    const loaded = await Promise.all(stage.playerUnits.units.map(loadCharacterWithSkills))
    const units  = loaded.map(({ characterDef }) => createUnit(characterDef, true))
    NarrativeUnits.register(units)
    // Cache leader summary for the persistent HP pill. The first unit in
    // stage.playerUnits.units is the party leader by convention.
    const leader = units[0]
    if (leader) {
      setPartyLeader({ name: leader.name, hp: leader.hp, maxHp: leader.maxHp })
    }
  }

  // ── Move party ─────────────────────────────────────────────────────────────

  const moveParty = useCallback((dx: number, dy: number) => {
    if (phase !== 'exploring' || moveQueueRef.current || openChestRef.current) return
    const map = mapDefRef.current
    if (!map) return

    const arena = arenaRef.current
    if (!arena) return

    const cur = partyRef.current
    const nx  = cur.x + dx
    const ny  = cur.y + dy

    if (!isTilePassable(map, nx, ny)) return
    if (hasBlockingEntity(nx, ny)) return

    moveQueueRef.current = true
    // Watchdog: force-release the queue if no chain completes within 3 seconds.
    const watchdog = setTimeout(() => { moveQueueRef.current = false }, 3000)

    const next = { x: nx, y: ny }
    partyRef.current = next
    setPartyTile(next)

    arena.setPartyTile(nx, ny, true, () => {
      arena.revealTiles(nx, ny, DUNGEON_REVEAL_RADIUS)
      updateEntityVisibility(nx, ny)
      checkTriggers(nx, ny)
      advanceEnemyPatrols(() => {
        clearTimeout(watchdog)
        // Brief pause so patrols visually settle before encounter check fires.
        // checkWavePhase owns the lock from here: it releases it if clear,
        // or keeps it held through the entire spotted→flash→battle sequence.
        setTimeout(checkWavePhase, DUNGEON_ENCOUNTER_PAUSE_MS)
      })
    })
  }, [phase])

  function isTilePassable(map: MapDef, tx: number, ty: number): boolean {
    if (tx < 0 || ty < 0 || tx >= map.grid.cols || ty >= map.grid.rows) return false
    const code = map.tiles[ty]?.[tx]
    if (code === undefined) return false
    return map.tileTypes[String(code)]?.passable ?? false
  }

  function hasBlockingEntity(tx: number, ty: number): boolean {
    const map = mapDefRef.current
    if (!map) return false
    for (const e of map.entities) {
      if (e.type === 'trigger') continue
      if (defeatedRef.current.has(e.entityId)) continue
      const pos = entityPosRef.current[e.entityId]
      if (!pos) continue
      if (pos.x === tx && pos.y === ty) {
        // NPCs block by default; enemies block
        if (e.type === 'enemy') return true
        if (e.type === 'npc')   return (e as any).blocksMovement !== false
      }
    }
    return false
  }

  function updateEntityVisibility(partyX: number, partyY: number) {
    const map = mapDefRef.current
    if (!map) return
    for (const e of map.entities) {
      if (e.type === 'trigger') continue
      if (defeatedRef.current.has(e.entityId)) continue
      const pos = entityPosRef.current[e.entityId]
      if (!pos) continue
      const dx    = Math.abs(pos.x - partyX)
      const dy    = Math.abs(pos.y - partyY)
      const inRange = Math.max(dx, dy) <= DUNGEON_REVEAL_RADIUS
      arenaRef.current?.setEntityVisible(e.entityId, inRange)
      if (!inRange) arenaRef.current?.setEntityGreyscale(e.entityId, true)
      else          arenaRef.current?.setEntityGreyscale(e.entityId, false)
    }
  }

  function checkTriggers(tx: number, ty: number) {
    const map = mapDefRef.current
    if (!map) return
    for (const e of map.entities) {
      if (e.type !== 'trigger') continue
      if (e.x === tx && e.y === ty && e.narrativeId) {
        NarrativeService.play(e.narrativeId)
      }
    }
    // Also check static interactables (auto-trigger on step)
    for (const e of map.entities) {
      if (e.type !== 'interactable' && e.type !== 'exit') continue
      if (defeatedRef.current.has(e.entityId)) continue
      const pos = entityPosRef.current[e.entityId]
      if (!pos || pos.x !== tx || pos.y !== ty) continue

      if (e.type === 'interactable' && (e as InteractableEntityDef).subtype === 'chest') {
        setOpenChest(e as InteractableEntityDef)
        continue
      }

      if (e.narrativeId) NarrativeService.play(e.narrativeId)
      if (e.type === 'exit') handleExit(e as any)
    }
  }

  function collectChest() {
    const chest = openChestRef.current
    if (!chest) return
    defeatedRef.current = new Set([...defeatedRef.current, chest.entityId])
    setDefeatedEntityIds(new Set(defeatedRef.current))
    arenaRef.current?.removeEntity(chest.entityId)
    setOpenChest(null)
  }

  function handleExit(_e: { leadsTo?: string }) {
    setPhase('transitioning')
    setTimeout(() => navigateTo(SCREEN_IDS.CAMPAIGN), 1200)
  }

  // ── Enemy patrol advancement ───────────────────────────────────────────────

  function advanceEnemyPatrols(onDone: () => void) {
    const map = mapDefRef.current
    if (!map) { onDone(); return }

    const enemies = map.entities.filter(
      (e) => e.type === 'enemy' && !defeatedRef.current.has(e.entityId),
    ) as EnemyEntityDef[]

    if (enemies.length === 0) { onDone(); return }

    let pending = enemies.length
    const newPositions = { ...entityPosRef.current }

    for (const enemy of enemies) {
      const patrol = enemy.patrol
      if (!patrol || patrol.length === 0) { pending--; if (pending === 0) finish(); continue }

      const cur     = newPositions[enemy.entityId] ?? { x: enemy.x, y: enemy.y }
      const curIdx  = patrol.findIndex((p) => p.x === cur.x && p.y === cur.y)
      const nextIdx = (curIdx + 1) % patrol.length
      const next    = patrol[nextIdx]

      const tileBlocked    = !isTilePassable(map, next.x, next.y)
      const partyBlocking  = partyRef.current?.x === next.x && partyRef.current?.y === next.y
      const entityBlocking = Object.entries(newPositions).some(
        ([id, pos]) => id !== enemy.entityId && pos.x === next.x && pos.y === next.y,
      )

      if (tileBlocked || partyBlocking || entityBlocking) {
        pending--
        if (pending === 0) finish()
        continue
      }

      newPositions[enemy.entityId] = next
      arenaRef.current?.setEntityPosition(enemy.entityId, next.x, next.y, true, () => {
        pending--
        if (pending === 0) finish()
      })
    }

    function finish() {
      entityPosRef.current = newPositions
      setEntityPositions({ ...newPositions })
      onDone()
    }
  }

  // ── Wave phase ─────────────────────────────────────────────────────────────

  function resolvePartyId(e: EnemyEntityDef): string {
    return e.partyId ?? e.entityId
  }

  function checkWavePhase() {
    const map        = mapDefRef.current
    const partyTile  = partyRef.current
    if (!map) return

    const allEnemies = (map.entities.filter((e) => e.type === 'enemy') as EnemyEntityDef[])
      .filter((e) => !defeatedRef.current.has(e.entityId))

    // Collect individual enemies currently in visual range
    const inRange = allEnemies.filter((e) => {
      const pos   = entityPosRef.current[e.entityId] ?? { x: e.x, y: e.y }
      const range = e.visualRange ?? DUNGEON_DEFAULT_VISUAL_RANGE
      return Math.max(Math.abs(pos.x - partyTile.x), Math.abs(pos.y - partyTile.y)) <= range
    })

    if (inRange.length === 0) {
      moveQueueRef.current = false  // no encounter — unlock movement
      return
    }

    // Group spotted enemies into distinct parties.
    // One spotted member is enough to pull the entire defined party into battle.
    const seenPartyIds = new Set<string>()
    const visibleParties: EnemyParty[] = []
    for (const spotted of inRange) {
      const pid = resolvePartyId(spotted)
      if (seenPartyIds.has(pid)) continue
      seenPartyIds.add(pid)
      const members = allEnemies.filter((e) => resolvePartyId(e) === pid)
      visibleParties.push({ partyId: pid, spotted, members })
    }

    if (visibleParties[0].spotted.narrativeId) {
      NarrativeService.play(visibleParties[0].spotted.narrativeId)
    }

    if (visibleParties.length === 1) {
      const party = visibleParties[0]
      // moveQueueRef stays true — locked through the entire spotted→flash→battle sequence.
      arenaRef.current?.spotEntity(party.spotted.entityId)
      setTimeout(() => {
        arenaRef.current?.unspotEntity(party.spotted.entityId)
        setEncounterFlashing(true)
        setTimeout(() => {
          setEncounterFlashing(false)
          launchBattle(party)
        }, DUNGEON_ENCOUNTER_FLASH_MS)
      }, DUNGEON_SPOT_FLASH_MS)
    } else {
      moveQueueRef.current = false  // wave phase — phase gate blocks moves; queue lock not needed
      setWaveParties(visibleParties)
      setPhase('wave')
      arenaRef.current?.activateWavePhase(visibleParties.map((p) => p.spotted.entityId))
    }
  }

  const selectWaveParty = useCallback((partyId: string) => {
    const party = waveParties.find((p) => p.partyId === partyId)
    if (!party) return
    arenaRef.current?.deactivateWavePhase()
    setPhase('transitioning')
    launchBattle(party)
  }, [waveParties])

  function launchBattle(party: EnemyParty) {
    const stage = stageDefRef.current
    if (!stage) return

    // Save dungeon state
    const state: DungeonState = {
      stageId:           stage.id,
      partyTile:         partyRef.current,
      entityPositions:   entityPosRef.current,
      defeatedEntityIds: [...defeatedRef.current],
      revealedTiles:     [],
      lastSeenPositions: {},
    }
    setDungeonState(state)

    // Build a ModeDef from stage settings for BattleContext
    const modeDef = {
      type:        'mode' as const,
      id:          stage.id,
      name:        stage.name,
      description: stage.description,
      settings: {
        ...stage.settings,
        enemies: [],  // overridden by currentEncounterEnemies
      },
    }

    setSelectedMode(modeDef)
    setSelectedTeamIds(stage.playerUnits.units)
    setCurrentEncounterEnemies(party.members.map((m) => m.defId))
    setCurrentEncounterEntityIds(party.members.map((m) => m.entityId))
    setReturnScreen(SCREEN_IDS.DUNGEON)

    setPhase('transitioning')
    navigateTo(SCREEN_IDS.BATTLE)
  }

  // ── Resume after battle ────────────────────────────────────────────────────

  useEffect(() => {
    if (phase !== 'exploring') return
    // Check if we just returned from a party battle — mark all members as defeated
    const store = useGameStore.getState()
    if (store.battleResult?.outcome === 'victory' && store.currentEncounterEntityIds.length > 0) {
      const defeated = store.currentEncounterEntityIds
      const updated  = new Set([...defeatedRef.current, ...defeated])
      defeatedRef.current = updated
      setDefeatedEntityIds(new Set(updated))
      for (const id of defeated) arenaRef.current?.removeEntity(id)
      setCurrentEncounterEntityIds([])
      setCurrentEncounterEnemies([])
    }
  }, [phase])

  const value: DungeonContextValue = {
    stageDef, mapDef, phase, partyTile, entityPositions,
    defeatedEntityIds, waveParties, partyLeader, encounterFlashing, tilesetError, bgColor,
    openChest, arenaRef, moveParty, selectWaveParty, collectChest,
  }

  return <DungeonContext.Provider value={value}>{children}</DungeonContext.Provider>
}
