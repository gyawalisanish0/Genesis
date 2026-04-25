// BattleArena — React wrapper for the Phaser BattleScene.
//
// Mounts a Phaser Game instance into the container div.
// Exposes an imperative handle so BattleContext can forward log entries,
// trigger unit display (Stage 2), and drive phase-gated animations (Stage 3+).
//
// React owns all battle interaction — Phaser input is disabled entirely.

import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react'
import Phaser from 'phaser'
import { BattleScene } from '../scenes/BattleScene'
import styles from './BattleArena.module.css'

// ── Public handle — all canvas commands go through this ───────────────────────

export interface BattleArenaHandle {
  // Stage 1
  addLog(text: string, colour: string): void
  // Stage 2
  setTurnState(actingDefId: string, targetDefId: string): void
  clearTurn(): void
  // Stage 3 — phase-gated: React awaits onDone before advancing
  playDice(outcome: string, onDone: () => void): void
  playAttack(casterId: string, targetId: string, outcome: string, damage: number, onDone: () => void): void
  playFeedback(text: string, colour: string): void
  // Stage 4 — death collapse (phase-gated: clearTurn should be called inside onDone)
  playDeath(defId: string, onDone: () => void): void
}

export const BattleArena = forwardRef<BattleArenaHandle>(
  function BattleArena(_props, ref) {
    const containerRef = useRef<HTMLDivElement>(null)
    const gameRef      = useRef<Phaser.Game | null>(null)
    const sceneRef     = useRef<BattleScene | null>(null)

    useEffect(() => {
      const container = containerRef.current
      if (!container) return

      // Wait for the container to have real dimensions (flex layout may not
      // have settled on the first synchronous render).
      const ro = new ResizeObserver(() => {
        if (gameRef.current) return
        const w = container.clientWidth
        const h = container.clientHeight
        if (w === 0 || h === 0) return

        const game = new Phaser.Game({
          type:   Phaser.AUTO,
          parent: container,
          scene:  BattleScene,
          scale: {
            mode:       Phaser.Scale.RESIZE,
            autoCenter: Phaser.Scale.NO_CENTER,
          },
          backgroundColor: '#0a0a14',
          banner: false,
          input: {
            mouse:    { preventDefaultDown: false, preventDefaultUp: false, preventDefaultMove: false },
            touch:    { capture: false },
            keyboard: false,
            gamepad:  false,
          },
          audio:  { noAudio: true },
          render: { antialias: true, pixelArt: false, roundPixels: false, transparent: false },
        })
        gameRef.current = game

        game.events.once('ready', () => {
          sceneRef.current = game.scene.scenes[0] as BattleScene
        })
      })

      ro.observe(container)
      return () => {
        ro.disconnect()
        gameRef.current?.destroy(true)
        gameRef.current = null
        sceneRef.current = null
      }
    }, [])

    useImperativeHandle(ref, () => ({
      addLog(text, colour) {
        sceneRef.current?.addLogEntry(text, colour)
      },
      setTurnState(actingDefId, targetDefId) {
        sceneRef.current?.setTurnState(actingDefId, targetDefId)
      },
      clearTurn() {
        sceneRef.current?.clearTurn()
      },
      playDice(outcome, onDone) {
        if (sceneRef.current) {
          sceneRef.current.playDice(outcome, onDone)
        } else {
          onDone()
        }
      },
      playAttack(casterId, targetId, outcome, damage, onDone) {
        if (sceneRef.current) {
          sceneRef.current.playAttack(casterId, targetId, outcome, damage, onDone)
        } else {
          onDone()
        }
      },
      playFeedback(text, colour) {
        sceneRef.current?.playFeedback(text, colour)
      },
      playDeath(defId, onDone) {
        if (sceneRef.current) {
          sceneRef.current.playDeath(defId, onDone)
        } else {
          onDone()
        }
      },
    }))

    return <div ref={containerRef} className={styles.arena} />
  },
)
