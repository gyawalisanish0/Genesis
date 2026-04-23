// Cross-team clash QTE: spinning knob + tug-of-war bar.
// Rendered when pendingClash is set in BattleContext.
// Player taps to stop the rotating pointer; landing in the 60° target arc
// shifts the bar toward the player side. AI auto-taps after a delay.
// After QTE_ROUNDS each, the higher-fill side wins.

import { useState, useRef, useEffect, useCallback } from 'react'
import { useBattleScreen } from './BattleContext'
import {
  QTE_KNOB_RPM, QTE_TARGET_ZONE_DEG, QTE_ROUNDS,
  QTE_BAR_FILL_PER_HIT, QTE_BAR_ALLY_WEIGHT_BONUS,
  AI_QTE_ACCURACY, QTE_AI_TAP_DELAY_MS,
} from '../core/constants'
import { useScrollAwarePointer } from '../utils/useScrollAwarePointer'
import styles from './ClashQteOverlay.module.css'

const QTE_PERIOD_MS  = 60_000 / QTE_KNOB_RPM     // ms per full revolution
const ZONE_START_DEG = 90                          // target arc starts at 90° (right side of dial)
const RESOLVE_DELAY_MS = 1200                      // pause after final round before calling resolveClash

interface QteRound {
  playerHit: boolean
  aiHit:     boolean
}

function computeAngle(startTime: number): number {
  const elapsed = (Date.now() - startTime) % QTE_PERIOD_MS
  return (elapsed / QTE_PERIOD_MS) * 360
}

function isHit(angleAtStop: number, zoneStart: number, zoneDeg: number): boolean {
  const normalised = ((angleAtStop - zoneStart) % 360 + 360) % 360
  return normalised <= zoneDeg
}

export function ClashQteOverlay() {
  const { pendingClash, resolveClash } = useBattleScreen()
  const createHandler = useScrollAwarePointer()

  const [rounds, setRounds]           = useState<QteRound[]>([])
  const [barValue, setBarValue]       = useState(0.5)
  const [frozenAngle, setFrozenAngle] = useState(0)
  const [knobStopped, setKnobStopped] = useState(false)
  const [phase, setPhase]             = useState<'player_tap' | 'ai_tap' | 'done'>('player_tap')

  const startTimeRef = useRef(Date.now())
  const aiTimerRef   = useRef<ReturnType<typeof setTimeout> | null>(null)
  const resolveRef   = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Reset when pendingClash appears (new clash starts).
  useEffect(() => {
    if (!pendingClash) return
    setRounds([])
    setBarValue(0.5)
    setFrozenAngle(0)
    setKnobStopped(false)
    setPhase('player_tap')
    startTimeRef.current = Date.now()
    return () => {
      if (aiTimerRef.current) clearTimeout(aiTimerRef.current)
      if (resolveRef.current) clearTimeout(resolveRef.current)
    }
  }, [pendingClash])

  // Resolve when phase reaches 'done'.
  useEffect(() => {
    if (phase !== 'done') return
    resolveRef.current = setTimeout(() => {
      const winner = barValue > 0.5 ? 'player' : barValue < 0.5 ? 'enemy' : (Math.random() < 0.5 ? 'player' : 'enemy')
      resolveClash(winner)
    }, RESOLVE_DELAY_MS)
    return () => {
      if (resolveRef.current) clearTimeout(resolveRef.current)
    }
  }, [phase, barValue, resolveClash])

  const computeBarShift = useCallback((hit: boolean, teamSize: number) => {
    if (!hit) return 0
    return QTE_BAR_FILL_PER_HIT + (teamSize - 1) * QTE_BAR_ALLY_WEIGHT_BONUS
  }, [])

  const advanceRound = useCallback((playerHit: boolean, aiHit: boolean) => {
    if (!pendingClash) return
    const playerShift = computeBarShift(playerHit, pendingClash.playerUnits.length)
    const aiShift     = computeBarShift(aiHit, pendingClash.enemyUnits.length)
    const newBar      = Math.max(0, Math.min(1, barValue + playerShift - aiShift))
    const newRounds   = [...rounds, { playerHit, aiHit }]

    setBarValue(newBar)
    setRounds(newRounds)

    if (newRounds.length >= QTE_ROUNDS) {
      setPhase('done')
    } else {
      // Start the next round.
      startTimeRef.current = Date.now()
      setKnobStopped(false)
      setPhase('player_tap')
    }
  }, [pendingClash, barValue, rounds, computeBarShift])

  const handlePlayerTap = useCallback(() => {
    if (phase !== 'player_tap' || knobStopped) return
    const angle = computeAngle(startTimeRef.current)
    const hit   = isHit(angle, ZONE_START_DEG, QTE_TARGET_ZONE_DEG)
    setFrozenAngle(angle)
    setKnobStopped(true)
    setPhase('ai_tap')

    aiTimerRef.current = setTimeout(() => {
      const aiHit = Math.random() < AI_QTE_ACCURACY
      advanceRound(hit, aiHit)
    }, QTE_AI_TAP_DELAY_MS)
  }, [phase, knobStopped, advanceRound])

  if (!pendingClash) return null

  const roundNum   = rounds.length + (phase === 'done' ? 0 : 1)
  const playerFill = barValue * 100
  const enemyFill  = (1 - barValue) * 100

  return (
    <div
      className={styles.overlay}
      onPointerDown={createHandler({ onTap: handlePlayerTap })}
    >
      <div className={styles.card}>
        <span className={styles.title}>CLASH</span>
        <span className={styles.roundLabel}>
          {phase === 'done' ? 'Resolved!' : `Round ${roundNum} of ${QTE_ROUNDS}`}
        </span>

        {/* Tug-of-war bar */}
        <div className={styles.barTrack}>
          <div className={styles.barEnemy}  style={{ width: `${enemyFill}%` }} />
          <div className={styles.barPlayer} style={{ width: `${playerFill}%` }} />
          <div className={styles.barCentre} />
        </div>
        <div className={styles.barLabels}>
          <span>Enemy</span>
          <span>Player</span>
        </div>

        {/* Knob */}
        <div className={styles.knobWrap}>
          {/* Target zone arc rendered behind the knob */}
          <div className={styles.zoneArc} />
          <div
            className={[styles.knob, knobStopped ? styles.knobStopped : ''].join(' ')}
            style={knobStopped ? { transform: `rotate(${frozenAngle}deg)` } : undefined}
          >
            <div className={styles.pointer} />
          </div>
        </div>

        <span className={styles.hint}>
          {phase === 'player_tap' ? 'TAP to stop the needle' :
           phase === 'ai_tap'     ? 'AI is tapping…' :
           barValue > 0.5         ? 'Player wins!' :
           barValue < 0.5         ? 'Enemy wins!' : 'Tie — rolling…'}
        </span>
      </div>
    </div>
  )
}
