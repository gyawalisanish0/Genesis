import { useRef, useEffect, useImperativeHandle, forwardRef } from 'react'
import Phaser from 'phaser'
import type { MapDef, TilesetDef } from '../core/types'
import { DungeonScene } from '../scenes/DungeonScene'
import type { DungeonTapCallback } from '../scenes/DungeonScene'
import styles from './DungeonArena.module.css'

export interface DungeonArenaHandle {
  loadMap(mapDef: MapDef, tilesetDef?: TilesetDef | null): void
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

export const DungeonArena = forwardRef<DungeonArenaHandle>(function DungeonArena(_, ref) {
  const containerRef = useRef<HTMLDivElement>(null)
  const sceneRef     = useRef<DungeonScene | null>(null)

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const observer = new ResizeObserver((entries) => {
      const entry = entries[0]
      if (!entry) return
      const { width, height } = entry.contentRect
      if (width === 0 || height === 0) return
      observer.disconnect()

      const config: Phaser.Types.Core.GameConfig = {
        type:            Phaser.AUTO,
        width,
        height,
        backgroundColor: '#0a0a14',
        parent:          container,
        scene:           DungeonScene,
        scale:           { mode: Phaser.Scale.NONE, autoCenter: Phaser.Scale.NO_CENTER },
        input:           { mouse: { target: container }, touch: { target: container } },
        audio:           { noAudio: true },
      }

      const game = new Phaser.Game(config)
      game.events.once('ready', () => {
        sceneRef.current = game.scene.getScene('DungeonScene') as DungeonScene
      })
    })
    observer.observe(container)

    return () => {
      observer.disconnect()
      sceneRef.current = null
    }
  }, [])

  useImperativeHandle(ref, () => ({
    loadMap: (mapDef, tilesetDef) => sceneRef.current?.loadMap(mapDef, tilesetDef),
    setPartyTile: (tx, ty, animated, onDone) => {
      if (sceneRef.current) sceneRef.current.setPartyTile(tx, ty, animated, onDone)
      else onDone?.()
    },
    revealTiles:       (cx, cy, r)           => sceneRef.current?.revealTiles(cx, cy, r),
    setEntityPosition: (id, tx, ty, a, done) => {
      if (sceneRef.current) sceneRef.current.setEntityPosition(id, tx, ty, a, done)
      else done?.()
    },
    setEntityVisible:  (id, v)               => sceneRef.current?.setEntityVisible(id, v),
    setEntityGreyscale:(id, g)               => sceneRef.current?.setEntityGreyscale(id, g),
    removeEntity:      (id)                  => sceneRef.current?.removeEntity(id),
    activateWavePhase: (ids)                 => sceneRef.current?.activateWavePhase(ids),
    deactivateWavePhase:()                   => sceneRef.current?.deactivateWavePhase(),
    setTapCallback:    (cb)                  => sceneRef.current?.setTapCallback(cb),
  }))

  return <div ref={containerRef} className={styles.arena} />
})
