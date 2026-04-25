// UnitStage — manages the two placeholder unit figures shown during a turn.
// Acting unit slides in from the left, target from the right.
// Stage 4: evasion dodge, death collapse. Art slots in by replacing
// the bg rectangle with a loaded image — no other change needed.

import Phaser from 'phaser'
import { tokenToHex } from '../BattleScene'

const UNIT_W        = 128
const UNIT_H        = 92
const SLIDE_MS      = 300
const ACTING_STROKE = 0x8b5cf6  // --accent-genesis
const TARGET_STROKE = 0xef4444  // --accent-danger
const UNIT_BG       = 0x12121e

interface FigureRef {
  container: Phaser.GameObjects.Container
  bg:        Phaser.GameObjects.Rectangle
}

export class UnitStage {
  private scene:        Phaser.Scene
  private acting:       FigureRef | null = null
  private target:       FigureRef | null = null
  private actingDefId:  string = ''
  private targetDefId:  string = ''
  private visible:      boolean = false

  constructor(scene: Phaser.Scene) {
    this.scene = scene
  }

  get isVisible(): boolean { return this.visible }

  targetX(): number { return this.target?.container.x ?? 0 }
  targetY(): number { return this.target?.container.y ?? 0 }

  show(actingDefId: string, targetDefId: string): void {
    this.destroyAll()
    this.actingDefId = actingDefId
    this.targetDefId = targetDefId

    const { width, height } = this.scene.scale
    const stageH = Math.floor(height * 0.55)
    const cy     = Math.floor(stageH * 0.48)

    const ax = Math.floor(width * 0.22)
    this.acting = this.buildFigure(actingDefId, cy, 'acting')
    this.acting.container.setPosition(-UNIT_W, cy)
    this.scene.tweens.add({ targets: this.acting.container, x: ax, duration: SLIDE_MS, ease: 'Back.easeOut' })

    const tx = Math.floor(width * 0.78)
    this.target = this.buildFigure(targetDefId, cy, 'target')
    this.target.container.setPosition(width + UNIT_W, cy)
    this.scene.tweens.add({ targets: this.target.container, x: tx, duration: SLIDE_MS, ease: 'Back.easeOut' })

    this.visible = true
  }

  hide(onDone?: () => void): void {
    if (!this.visible) { onDone?.(); return }
    const { width } = this.scene.scale
    let done = 0
    const total = (this.acting ? 1 : 0) + (this.target ? 1 : 0)
    if (!total) { this.destroyAll(); onDone?.(); return }

    const each = () => { if (++done >= total) { this.destroyAll(); onDone?.() } }
    if (this.acting) {
      this.scene.tweens.add({ targets: this.acting.container, x: -UNIT_W,     duration: SLIDE_MS, ease: 'Back.easeIn', onComplete: each })
    }
    if (this.target) {
      this.scene.tweens.add({ targets: this.target.container, x: width + UNIT_W, duration: SLIDE_MS, ease: 'Back.easeIn', onComplete: each })
    }
  }

  flashTarget(hitColour: number): void {
    if (!this.target) return
    const bg   = this.target.bg
    const orig = bg.fillColor
    bg.setFillStyle(hitColour)
    this.scene.tweens.add({
      targets: bg, alpha: { from: 0.3, to: 1 }, duration: 110, yoyo: true,
      onComplete: () => bg.setFillStyle(orig),
    })
  }

  shoveActing(dx: number, onDone: () => void): void {
    if (!this.acting) { onDone(); return }
    const c = this.acting.container
    this.scene.tweens.add({
      targets: c, x: { from: c.x, to: c.x + dx },
      duration: 190, ease: 'Sine.easeIn', yoyo: true, hold: 50,
      onComplete: () => onDone(),
    })
  }

  // Stage 4 — target slides away from the attack then returns.
  evasionDodge(onDone: () => void): void {
    if (!this.target) { onDone(); return }
    const c      = this.target.container
    const dodgeDx = Math.floor(this.scene.scale.width * 0.09)
    this.scene.tweens.add({
      targets: c, x: { from: c.x, to: c.x + dodgeDx },
      duration: 170, ease: 'Sine.easeOut', yoyo: true, hold: 40,
      onComplete: () => onDone(),
    })
  }

  // Stage 4 — matching unit figure tilts and falls, then calls onDone.
  collapseByDefId(defId: string, onDone: () => void): void {
    const fig = defId === this.actingDefId ? this.acting
              : defId === this.targetDefId ? this.target
              : null
    if (!fig) { onDone(); return }

    const c = fig.container
    this.scene.tweens.add({
      targets:  c,
      angle:    85,
      alpha:    0,
      y:        c.y + 44,
      duration: 580,
      ease:     'Sine.easeIn',
      onComplete: () => {
        c.destroy()
        if (fig === this.acting) this.acting = null
        else                      this.target = null
        onDone()
      },
    })
  }

  private destroyAll(): void {
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
