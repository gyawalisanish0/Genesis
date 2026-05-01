// UnitStage — manages the two placeholder unit figures shown during a turn.
// Acting unit slides in from the left, target from the right.
//
// Idle animation: after both figures finish sliding in, a subtle scale-pulse
// (1.0 → 1.015, 1.8 s loop) keeps the arena alive while the player chooses.
// This is the fallback default; it cancels the moment any action tween begins.
//
// shoveActing now accepts an onImpact callback fired at the moment the attacker
// reaches the target position, plus the existing onDone fired after the return.
// Art slots in by replacing the bg rectangle with a loaded image — no other
// change needed.

import Phaser from 'phaser'
import { tokenToHex } from '../BattleScene'

const UNIT_W        = 128
const UNIT_H        = 92
const SLIDE_MS      = 300
const SHOVE_MS      = 190   // forward-shove duration
const SHOVE_HOLD_MS = 60    // hold at impact position before returning
const ACTING_STROKE = 0x8b5cf6  // --accent-genesis
const TARGET_STROKE = 0xef4444  // --accent-danger
const UNIT_BG       = 0x12121e

interface FigureRef {
  container: Phaser.GameObjects.Container
  bg:        Phaser.GameObjects.Rectangle
}

export class UnitStage {
  private scene:       Phaser.Scene
  private topInset:    number
  private acting:      FigureRef | null = null
  private target:      FigureRef | null = null
  private actingDefId: string = ''
  private targetDefId: string = ''
  private visible:     boolean = false
  private idleTweens:  Phaser.Tweens.Tween[] = []
  private impactTimer: Phaser.Time.TimerEvent | null = null

  constructor(scene: Phaser.Scene, topInset = 0) {
    this.scene    = scene
    this.topInset = topInset
  }

  get isVisible(): boolean { return this.visible }

  targetX(): number { return this.target?.container.x ?? 0 }
  targetY(): number { return this.target?.container.y ?? 0 }

  show(actingDefId: string, targetDefId: string): void {
    this.destroyAll()
    this.actingDefId = actingDefId
    this.targetDefId = targetDefId

    const { width, height } = this.scene.scale
    const contentH = height - this.topInset
    const stageH   = Math.floor(contentH * 0.55)
    const cy       = this.topInset + Math.floor(stageH * 0.48)

    const ax = Math.floor(width * 0.22)
    this.acting = this.buildFigure(actingDefId, cy, 'acting')
    this.acting.container.setPosition(-UNIT_W, cy)

    const tx = Math.floor(width * 0.78)
    this.target = this.buildFigure(targetDefId, cy, 'target')
    this.target.container.setPosition(width + UNIT_W, cy)

    this.visible = true

    // Start idle breathing once both figures have finished sliding in.
    let entered = 0
    const afterSlide = () => { if (++entered >= 2) this.startIdle() }
    this.scene.tweens.add({ targets: this.acting.container, x: ax, duration: SLIDE_MS, ease: 'Back.easeOut', onComplete: afterSlide })
    this.scene.tweens.add({ targets: this.target.container, x: tx, duration: SLIDE_MS, ease: 'Back.easeOut', onComplete: afterSlide })
  }

  hide(onDone?: () => void): void {
    if (!this.visible) { onDone?.(); return }
    this.stopIdle()

    const { width } = this.scene.scale
    const oldActing = this.acting
    const oldTarget = this.target
    this.acting = null
    this.target = null
    this.visible = false

    const total = (oldActing ? 1 : 0) + (oldTarget ? 1 : 0)
    if (!total) { onDone?.(); return }

    let done = 0
    const each = () => { if (++done >= total) onDone?.() }

    if (oldActing) {
      this.scene.tweens.add({
        targets: oldActing.container, x: -UNIT_W,
        duration: SLIDE_MS, ease: 'Back.easeIn',
        onComplete: () => { oldActing.container.destroy(); each() },
      })
    }
    if (oldTarget) {
      this.scene.tweens.add({
        targets: oldTarget.container, x: width + UNIT_W,
        duration: SLIDE_MS, ease: 'Back.easeIn',
        onComplete: () => { oldTarget.container.destroy(); each() },
      })
    }
  }

  // Flash a bright colour overlay on the target that fades out to transparent.
  // The overlay is layered on top so both the border and fill stay visible beneath.
  flashTarget(hitColour: number): void {
    if (!this.target) return
    const flash = this.scene.add.rectangle(0, 0, UNIT_W, UNIT_H, hitColour, 1)
    this.target.container.add(flash)
    this.scene.tweens.add({
      targets: flash, alpha: 0, duration: 140, ease: 'Sine.easeOut',
      onComplete: () => flash.destroy(),
    })
  }

  // Shove the acting unit toward the target.
  // onImpact fires when the attacker reaches peak position (after SHOVE_MS).
  // onDone fires after the full return cycle (forward + hold + reverse).
  shoveActing(dx: number, onImpact: (() => void) | null, onDone: () => void): void {
    if (!this.acting) { onImpact?.(); onDone(); return }
    const c = this.acting.container
    this.stopIdle()

    this.impactTimer?.destroy()
    if (onImpact) {
      this.impactTimer = this.scene.time.delayedCall(SHOVE_MS, () => {
        this.impactTimer = null
        onImpact()
      })
    }

    this.scene.tweens.add({
      targets: c, x: c.x + dx, duration: SHOVE_MS,
      ease: 'Sine.easeIn', yoyo: true, hold: SHOVE_HOLD_MS,
      onComplete: () => onDone(),
    })
  }

  // Target slides away from the attacker and snaps back.
  // Direction is derived from which side of centre the target container sits.
  evasionDodge(onDone: () => void): void {
    if (!this.target) { onDone(); return }
    const c         = this.target.container
    this.stopIdle()
    const direction = c.x >= this.scene.scale.width / 2 ? 1 : -1
    const dodgeDx   = direction * Math.floor(this.scene.scale.width * 0.09)
    this.scene.tweens.add({
      targets: c, x: c.x + dodgeDx,
      duration: 170, ease: 'Sine.easeOut', yoyo: true, hold: 40,
      onComplete: () => onDone(),
    })
  }

  // Matching unit figure tilts and falls, then calls onDone.
  collapseByDefId(defId: string, onDone: () => void): void {
    const fig = defId === this.actingDefId ? this.acting
              : defId === this.targetDefId ? this.target
              : null
    if (!fig) { onDone(); return }
    this.stopIdle()

    const c = fig.container
    this.scene.tweens.add({
      targets: c, angle: 85, alpha: 0, y: c.y + 44,
      duration: 580, ease: 'Sine.easeIn',
      onComplete: () => {
        c.destroy()
        if (fig === this.acting) this.acting = null
        else                      this.target = null
        onDone()
      },
    })
  }

  // ── Private helpers ────────────────────────────────────────────────────────

  private startIdle(): void {
    if (!this.acting || !this.target) return
    const containers = [this.acting.container, this.target.container]
    containers.forEach((c, i) => {
      const t = this.scene.tweens.add({
        targets:  c,
        scaleX:   { from: 1, to: 1.015 },
        scaleY:   { from: 1, to: 1.015 },
        duration: 1800,
        ease:     'Sine.easeInOut',
        yoyo:     true,
        repeat:   -1,
        delay:    i * 400,  // offset phases so figures don't pulse in sync
      })
      this.idleTweens.push(t)
    })
  }

  private stopIdle(): void {
    for (const t of this.idleTweens) t.stop()
    this.idleTweens = []
    // Reset scale in case the tween stopped mid-pulse.
    this.acting?.container.setScale(1)
    this.target?.container.setScale(1)
    this.impactTimer?.destroy()
    this.impactTimer = null
  }

  private destroyAll(): void {
    this.stopIdle()
    this.acting?.container.destroy()
    this.acting = null
    this.target?.container.destroy()
    this.target = null
    this.visible = false
  }

  private buildFigure(defId: string, cy: number, role: 'acting' | 'target'): FigureRef {
    const stroke   = role === 'acting' ? ACTING_STROKE : TARGET_STROKE
    const roleText = role === 'acting' ? '▲ ACTING'    : '◎ TARGET'
    const roleTint = role === 'acting' ? tokenToHex('var(--accent-genesis)') : tokenToHex('var(--accent-danger)')
    const parts    = defId.replace(/_/g, ' ').toUpperCase().split(' ')
    const line1    = parts.slice(0, -1).join(' ') || parts[0]
    const line2    = parts.length > 1 ? parts[parts.length - 1] : ''

    const container = this.scene.add.container(0, cy)
    const bg        = this.scene.add.rectangle(0, 0, UNIT_W, UNIT_H, UNIT_BG).setStrokeStyle(2, stroke)
    container.add(bg)

    container.add(this.scene.add.text(0, -UNIT_H / 2 + 8, roleText, {
      fontFamily: 'system-ui,sans-serif', fontSize: '9px', color: roleTint,
    }).setOrigin(0.5, 0))

    container.add(this.scene.add.text(0, -10, line1, {
      fontFamily: 'system-ui,sans-serif', fontSize: '13px', color: '#f1f0ff', fontStyle: 'bold',
    }).setOrigin(0.5))

    if (line2) {
      container.add(this.scene.add.text(0, 7, line2, {
        fontFamily: 'system-ui,sans-serif', fontSize: '10px', color: '#9b8ec4',
      }).setOrigin(0.5))
    }

    container.add(this.scene.add.text(0, UNIT_H / 2 - 12, '[ art ]', {
      fontFamily: 'system-ui,sans-serif', fontSize: '8px', color: '#5c5480',
    }).setOrigin(0.5))

    return { container, bg }
  }
}
