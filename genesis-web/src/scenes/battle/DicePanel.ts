// DicePanel — dice face spins through random outcomes then lands on the actual result.
//
// Spin uses slot-machine deceleration: the interval between face changes widens
// linearly from MIN_TICK_MS to MAX_TICK_MS over TOTAL_SPIN_TICKS changes. This
// creates a "slowing reel" feel that builds tension as the outcome approaches.
//
// The panel slides in from 16 px above its resting position before spinning begins.
// Calls onDone after the hold period so React can advance the phase.

import Phaser from 'phaser'
import { tokenToHex } from '../BattleScene'

const MIN_TICK_MS      = 40    // fastest face-change interval (start of spin)
const MAX_TICK_MS      = 130   // slowest face-change interval (near landing)
const TOTAL_SPIN_TICKS = 26    // total face changes before landing
const HOLD_MS          = 800   // pause on final face before onDone fires
const ENTER_MS         = 160   // panel slide-in animation duration

const FACE: Record<string, string> = {
  Boosted: '★ BOOSTED',
  Hit:     '⚔ HIT',
  Evade:   '◎ EVADE',
  Fail:    '✕ MISS',
}

const COLOUR: Record<string, string> = {
  Boosted: 'var(--accent-gold)',
  Hit:     'var(--text-primary)',
  Evade:   'var(--accent-evasion)',
  Fail:    'var(--text-muted)',
}

const OUTCOMES = Object.keys(FACE)

export class DicePanel {
  private scene:       Phaser.Scene
  private topInset:    number
  private panel:       Phaser.GameObjects.Container | null = null
  private spinTimer:   Phaser.Time.TimerEvent | null = null
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

    // Panel starts 16 px above target and fades in.
    this.panel = this.scene.add.container(cx, cy - 16).setAlpha(0)

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

    // Slide-in entrance, then begin slot-machine spin.
    this.scene.tweens.add({
      targets: this.panel, y: cy, alpha: 1, duration: ENTER_MS, ease: 'Back.easeOut',
      onComplete: () => {
        if (!this.panel) return  // skip() was called during entrance
        this.scheduleSpin(face, label, outcome, TOTAL_SPIN_TICKS, MIN_TICK_MS)
      },
    })
  }

  // Skip the animation: cancel timers, fire onDone immediately.
  skip(): void {
    if (!this.pendingDone) return
    this.fire()
  }

  // ── Private helpers ────────────────────────────────────────────────────────

  // Recursive slot-machine tick: fires a face change then schedules the next
  // with a slightly wider interval, decelerating to a stop at the result.
  private scheduleSpin(
    face:      Phaser.GameObjects.Text,
    label:     Phaser.GameObjects.Text,
    outcome:   string,
    ticksLeft: number,
    delayMs:   number,
  ): void {
    if (!this.panel) return  // panel destroyed (skip called)

    if (ticksLeft <= 0) {
      this.land(face, label, outcome)
      return
    }

    const r = OUTCOMES[Math.floor(Math.random() * OUTCOMES.length)]
    face.setText(FACE[r]).setColor(tokenToHex(COLOUR[r] ?? 'var(--text-primary)'))

    const step   = (MAX_TICK_MS - MIN_TICK_MS) / TOTAL_SPIN_TICKS
    const nextMs = Math.min(delayMs + step, MAX_TICK_MS)

    this.spinTimer = this.scene.time.delayedCall(delayMs, () => {
      this.scheduleSpin(face, label, outcome, ticksLeft - 1, nextMs)
    })
  }

  private land(
    face:    Phaser.GameObjects.Text,
    label:   Phaser.GameObjects.Text,
    outcome: string,
  ): void {
    if (!this.panel) return
    this.spinTimer = null
    label.setText('OUTCOME')
    face.setText(FACE[outcome] ?? outcome.toUpperCase())
      .setColor(tokenToHex(COLOUR[outcome] ?? 'var(--text-primary)'))
    // Scale-slam: face bursts large then snaps back to normal size.
    this.scene.tweens.add({
      targets: face,
      scaleX: { from: 2.0, to: 1 },
      scaleY: { from: 2.0, to: 1 },
      duration: 220,
      ease: 'Back.easeOut',
    })
    this.holdTimer = this.scene.time.delayedCall(HOLD_MS, () => this.fire())
  }

  private fire(): void {
    const cb = this.pendingDone
    this.pendingDone = null
    this.destroy()
    cb?.()
  }

  destroy(): void {
    this.spinTimer?.destroy()
    this.spinTimer = null
    this.holdTimer?.destroy()
    this.holdTimer = null
    this.panel?.destroy()
    this.panel = null
  }
}
