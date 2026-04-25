// BattleArena — React wrapper for the Phaser BattleScene.
//
// Mounts a Phaser Game instance into the container div.
// Exposes an imperative handle so BattleScreen can forward log entries and
// later (Stage 2+) trigger unit display and attack animations.
//
// React input handling is untouched — Phaser input is disabled entirely;
// all battle interaction stays in the existing React skill grid and buttons.

import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react'
import Phaser from 'phaser'
import { BattleScene } from '../scenes/BattleScene'
import type { BattleSceneCallbacks } from '../scenes/BattleScene'
import styles from './BattleArena.module.css'

// ── Public handle — all canvas commands go through this ───────────────────────

export interface BattleArenaHandle {
  // Stage 1
  addLog(text: string, colour: string): void
  // Stage 2
  setTurnState(actingDefId: string, targetDefId: string): void
  clearTurn(): void
  // Stage 3
  playDice(outcome: string, onDone: () => void): void
  playAttack(casterId: string, targetId: string, outcome: string, damage: number, onDone: () => void): void
  playFeedback(text: string, colour: string): void
}

interface Props {
  callbacks?: BattleSceneCallbacks
}

export const BattleArena = forwardRef<BattleArenaHandle, Props>(
  function BattleArena({ callbacks: _callbacks = {} }, ref) {
    const containerRef = useRef<HTMLDivElement>(null)
    const gameRef      = useRef<Phaser.Game | null>(null)
    const sceneRef     = useRef<BattleScene | null>(null)

    useEffect(() => {
      const container = containerRef.current
      if (!container) return

      // Wait for the container to have real dimensions (flex layout may not
      // have settled on the first synchronous render).
      const ro = new ResizeObserver(() => {
        if (gameRef.current) return  // already initialised
        const w = container.clientWidth
        const h = container.clientHeight
        if (w === 0 || h === 0) return

        const config: Phaser.Types.Core.GameConfig = {
          type:   Phaser.AUTO,
          parent: container,
          scene:  BattleScene,
          scale: {
            mode:          Phaser.Scale.RESIZE,
            autoCenter:    Phaser.Scale.NO_CENTER,
          },
          backgroundColor: '#0a0a14',
          banner:          false,
          // Disable Phaser input — all interaction stays in React.
          input: {
            mouse:    { preventDefaultDown: false, preventDefaultUp: false, preventDefaultMove: false },
            touch:    { capture: false },
            keyboard: false,
            gamepad:  false,
          },
          audio: { noAudio: true },
          render: {
            antialias:       true,
            pixelArt:        false,
            roundPixels:     false,
            transparent:     false,
          },
        }

        const game = new Phaser.Game(config)
        gameRef.current = game

        // Grab the scene reference once the game is ready.
        game.events.once('ready', () => {
          const scene = game.scene.scenes[0] as BattleScene
          sceneRef.current = scene
        })
      })

      ro.observe(container)
      return () => {
        ro.disconnect()
        gameRef.current?.destroy(true)
        gameRef.current = null
        sceneRef.current = null
      }
    // callbacks intentionally excluded — passed at scene init, not re-wired
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
        sceneRef.current?.playDice(outcome, onDone) ?? onDone()
      },
      playAttack(casterId, targetId, outcome, damage, onDone) {
        sceneRef.current?.playAttack(casterId, targetId, outcome, damage, onDone) ?? onDone()
      },
      playFeedback(text, colour) {
        sceneRef.current?.playFeedback(text, colour)
      },
    }))

    return <div ref={containerRef} className={styles.arena} />
  },
)
