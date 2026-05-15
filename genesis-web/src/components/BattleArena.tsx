// BattleArena — React wrapper for the Phaser BattleScene.
//
// Mounts a Phaser Game instance into the container div.
// Exposes an imperative handle so BattleContext can trigger unit display (Stage 2)
// and drive phase-gated animations (Stage 3+).
//
// React owns all battle interaction — Phaser input is disabled entirely.
// The battle log lives in BattleLogOverlay (React), not in the canvas.

import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react'
import Phaser from 'phaser'
import type { AnimationManifest, AnimationProjectileDef, AnimPhase } from '../core/types'
import { BattleScene } from '../scenes/BattleScene'
import styles from './BattleArena.module.css'

// ── Exported data types for Stage 5 (TurnDisplayPanel) ───────────────────────

export interface TurnDisplayUnitData {
  name:        string
  className:   string
  rarity:      number
  hp:          number
  maxHp:       number
  ap:          number
  maxAp:       number
  statusSlots: Array<{ id: string; name: string }>
}

export interface TurnDisplayData {
  actor:      TurnDisplayUnitData | null  // null = player turn (actor row hidden)
  skillName:  string
  tuCost:     number
  apCost:     number
  skillLevel: number
  target:     TurnDisplayUnitData
  isAlly:     boolean  // true = player attacking; drives accent colour
}

// ── Public handle — all canvas commands go through this ───────────────────────

export interface BattleArenaHandle {
  // Stage 2
  setTurnState(
    actingDefId:    string,
    targetDefId:    string,
    actingManifest?: AnimationManifest | null,
    targetManifest?: AnimationManifest | null,
    isDamaged?:      { acting: boolean; target: boolean },
  ): void
  clearTurn(): void
  // Stage 3 — phase-gated: React awaits onDone before advancing
  playDice(outcome: string, onDone: () => void): void
  skipActiveDice(): void
  playAttack(
    actingDefId:     string,
    targetDefId:     string,
    outcome:         string,
    damage:          number,
    isMelee:         boolean,
    dashDx:          number,
    projectile:      AnimationProjectileDef | null,
    feedbackText:    string,
    feedbackColour:  string,
    onDone:          () => void,
    customSequence?: AnimPhase[],
  ): void
  // Stage 4 — death collapse (phase-gated: clearTurn should be called inside onDone)
  playDeath(defId: string, onDone: () => void): void
  // Stage 5 — turn display overlay (fire-and-forget; BattleContext drives timing)
  showTurnDisplay(data: TurnDisplayData): void
  hideTurnDisplay(): void
}

export const BattleArena = forwardRef<BattleArenaHandle>(
  function BattleArena(_props, ref) {
    const containerRef      = useRef<HTMLDivElement>(null)
    const gameRef           = useRef<Phaser.Game | null>(null)
    const sceneRef          = useRef<BattleScene | null>(null)
    // Buffers a setTurnState call that arrived before Phaser was ready.
    const pendingTurnState  = useRef<Parameters<BattleArenaHandle['setTurnState']> | null>(null)

    useEffect(() => {
      const container = containerRef.current
      if (!container) return

      // Wait for the container to have real dimensions (flex layout may not
      // have settled on the first synchronous render).
      // Scale.NONE: we own all resize calls — no CSS/Phaser inline-style conflict.
      const ro = new ResizeObserver(() => {
        const w = container.clientWidth
        const h = container.clientHeight
        if (w === 0 || h === 0) return

        if (gameRef.current) {
          // Forward subsequent container resizes into Phaser manually.
          gameRef.current.scale.resize(w, h)
          return
        }

        const game = new Phaser.Game({
          type:   Phaser.AUTO,
          parent: container,
          width:  w,
          height: h,
          scene:  BattleScene,
          scale: {
            mode:       Phaser.Scale.NONE,
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
          if (pendingTurnState.current) {
            const [ad, td, am, tm, dmg] = pendingTurnState.current
            sceneRef.current.setTurnState(ad, td, am, tm, dmg)
            pendingTurnState.current = null
          }
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
      setTurnState(actingDefId, targetDefId, actingManifest, targetManifest, isDamaged) {
        if (sceneRef.current) {
          sceneRef.current.setTurnState(actingDefId, targetDefId, actingManifest, targetManifest, isDamaged)
        } else {
          pendingTurnState.current = [actingDefId, targetDefId, actingManifest, targetManifest, isDamaged]
        }
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
      skipActiveDice() {
        sceneRef.current?.skipActiveDice()
      },
      playAttack(actingDefId, targetDefId, outcome, damage, isMelee, dashDx, projectile, feedbackText, feedbackColour, onDone, customSequence) {
        if (sceneRef.current) {
          sceneRef.current.playAttack(actingDefId, targetDefId, outcome, damage, isMelee, dashDx, projectile, feedbackText, feedbackColour, onDone, customSequence)
        } else {
          onDone()
        }
      },
      playDeath(defId, onDone) {
        if (sceneRef.current) {
          sceneRef.current.playDeath(defId, onDone)
        } else {
          onDone()
        }
      },
      showTurnDisplay(data) {
        sceneRef.current?.showTurnDisplay(data)
      },
      hideTurnDisplay() {
        sceneRef.current?.hideTurnDisplay()
      },
    }))

    return <div ref={containerRef} className={styles.arena} />
  },
)
