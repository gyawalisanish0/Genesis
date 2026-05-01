// DicePanel — dice face spins through random outcomes then lands on the actual result.
// Calls onDone after the hold period so React can advance the phase.

import Phaser from 'phaser'
import { tokenToHex } from '../BattleScene'

const SPIN_MS  = 2000  // total spin duration
const TICK_MS  = 75    // interval between face changes
const HOLD_MS  = 800   // pause on final face before onDone

const FACE: Record<string, string> = {
  Boosted:  '★ BOOSTED',
  Success:  '⚔ HIT',
  GuardUp:  '⛊ GUARD',
  Tumbling: '↻ TUMBLE',
  Evasion:  '◎ EVADE',
  Fail:     '✕ MISS',
}

const COLOUR: Record<string, string> = {
  Boosted:  'var(--accent-gold)',
  Success:  'var(--text-primary)',
  GuardUp:  'var(--accent-info)',
  Tumbling: 'var(--accent-warn)',
  Evasion:  'var(--accent-evasion)',
  Fail:     'var(--text-muted)',
}

const OUTCOMES = Object.keys(FACE)

export class DicePanel {
  private scene:    Phaser.Scene
  private topInset: number
  private panel:    Phaser.GameObjects.Container | null = null
  private spinEvent:   Phaser.Time.TimerEvent | null = null
  private landTimer:   Phaser.Time.TimerEvent | null = null
  private holdTimer:   Phaser.Time.TimerEvent | null = null
  private pendingDone: (() => void) | null = null

  constructor(scene: Phaser.Scene, topInset = 0) {
    this.scene    = scene
    this.topInset = topInset
  }

  spin(outcome: string, onDone: () => void): void {
    this.destroy()
    this.pendingDone = onDone
    const { width, height } = this.scene.scale
    const cx = Math.floor(width / 2)
    const cy = Math.floor(this.topInset + (height - this.topInset) * 0.27)

    this.panel = this.scene.add.container(cx, cy)

    const bg = this.scene.add.rectangle(0, 0, 168, 70, 0x1a1a2e).setStrokeStyle(1, 0x8b5cf6)
    this.panel.add(bg)

    const label = this.scene.add.text(0, -16, 'ROLLING…', {
      fontFamily: 'system-ui,sans-serif', fontSize: '9px', color: '#5c5480',
    }).setOrigin(0.5)
    this.panel.add(label)

    const face = this.scene.add.text(0, 12, FACE[OUTCOMES[0]], {
      fontFamily: 'system-ui,sans-serif', fontSize: '16px', color: '#f1f0ff', fontStyle: 'bold',
    }).setOrigin(0.5)
    this.panel.add(face)

    // Spin: cycle through random faces
    this.spinEvent = this.scene.time.addEvent({
      delay: TICK_MS,
      repeat: Math.floor(SPIN_MS / TICK_MS) - 1,
      callback: () => {
        const r = OUTCOMES[Math.floor(Math.random() * OUTCOMES.length)]
        face.setText(FACE[r]).setColor(tokenToHex(COLOUR[r] ?? 'var(--text-primary)'))
      },
    })

    // Land on actual outcome
    this.landTimer = this.scene.time.delayedCall(SPIN_MS, () => {
      this.spinEvent?.destroy()
      this.spinEvent = null
      label.setText('OUTCOME')
      face.setText(FACE[outcome] ?? outcome.toUpperCase())
        .setColor(tokenToHex(COLOUR[outcome] ?? 'var(--text-primary)'))
      this.scene.tweens.add({
        targets: face,
        scaleX: { from: 1.5, to: 1 },
        scaleY: { from: 1.5, to: 1 },
        duration: 220,
        ease: 'Back.easeOut',
      })
      // Hold then signal done
      this.holdTimer = this.scene.time.delayedCall(HOLD_MS, () => {
        this.fire()
      })
    })
  }

  // Skip the animation: cancel timers, fire onDone immediately.
  // Safe to call when no animation is active — it's a no-op.
  skip(): void {
    if (!this.pendingDone) return
    this.fire()
  }

  private fire(): void {
    const cb = this.pendingDone
    this.pendingDone = null
    this.destroy()
    cb?.()
  }

  destroy(): void {
    this.spinEvent?.destroy()
    this.spinEvent = null
    this.landTimer?.destroy()
    this.landTimer = null
    this.holdTimer?.destroy()
    this.holdTimer = null
    this.panel?.destroy()
    this.panel = null
  }
}
