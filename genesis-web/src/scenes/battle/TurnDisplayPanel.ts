// TurnDisplayPanel — overlaid at the top of the Phaser canvas (Stage 5).
// Slides in from above with Back.easeOut; slides out with Back.easeIn.
// Canvas dimensions never change when this panel appears or disappears.

import Phaser from 'phaser'

// ── Layout constants ──────────────────────────────────────────────────────────
const PAD_X   = 10
const PAD_Y   = 6
const LINE_H  = 14
const BAR_H   = 5
const BAR_GAP = 3
const CHIP_H  = 13
const LABEL_W = 56   // pixels reserved for "HP NNN/NNN" value text
const SLIDE   = 250

// ── Colour palette ────────────────────────────────────────────────────────────
const BG_COL       = 0x0d0d1a
const DIVIDER_COL  = 0x2a2440
const TRACK_COL    = 0x1e1e2e
const HP_COL       = 0xef4444
const AP_COL       = 0x3b82f6
const CHIP_BG_COL  = 0x222240
const ACCENT_ALLY  = 0x3b82f6   // info/blue — player side
const ACCENT_ENEMY = 0xef4444   // danger/red — enemy side

const TEXT_PRI = '#f1f0ff'
const TEXT_MUT = '#9b8ec4'

const RARITY_COL: Record<number, string> = {
  1: '#9ca3af', 2: '#22c55e', 3: '#3b82f6',
  4: '#a855f7', 5: '#f59e0b', 6: '#ef4444',
}

// ── Text styles ───────────────────────────────────────────────────────────────
const BOLD_STYLE: Phaser.Types.GameObjects.Text.TextStyle = {
  fontFamily: 'system-ui,sans-serif', fontSize: '11px', fontStyle: 'bold',
}
const SMALL_STYLE: Phaser.Types.GameObjects.Text.TextStyle = {
  fontFamily: 'system-ui,sans-serif', fontSize: '10px', color: TEXT_MUT,
}
const CHIP_STYLE: Phaser.Types.GameObjects.Text.TextStyle = {
  fontFamily: 'system-ui,sans-serif', fontSize: '9px', color: TEXT_PRI,
}

// ── Types ─────────────────────────────────────────────────────────────────────
// Structurally identical to TurnDisplayUnitData / TurnDisplayData in BattleArena.tsx.
// Defined locally to keep scenes/ free of cross-layer imports.

export interface TurnPanelUnit {
  name: string; className: string; rarity: number
  hp: number; maxHp: number; ap: number; maxAp: number
  statusSlots: Array<{ id: string; name: string }>
}

export interface TurnPanelData {
  actor: TurnPanelUnit | null
  skillName: string; tuCost: number; apCost: number; skillLevel: number
  target: TurnPanelUnit; isAlly: boolean
}

// ── TurnDisplayPanel ──────────────────────────────────────────────────────────

export class TurnDisplayPanel {
  private scene:   Phaser.Scene
  private panel:   Phaser.GameObjects.Container | null = null
  private storedH: number = 0

  constructor(scene: Phaser.Scene) {
    this.scene = scene
  }

  show(data: TurnPanelData): void {
    this.panel?.destroy()
    const { width } = this.scene.scale
    const panelH = this.calcH(data)
    this.storedH = panelH

    this.panel = this.scene.add.container(0, -panelH)
    const gfx   = this.scene.add.graphics()
    this.panel.add(gfx)

    gfx.fillStyle(BG_COL).fillRect(0, 0, width, panelH)

    let y = 0
    if (data.actor) {
      y = this.drawUnitRow(data.actor, y, width, gfx, data.isAlly ? ACCENT_ALLY : ACCENT_ENEMY)
      gfx.fillStyle(DIVIDER_COL).fillRect(0, y, width, 1)
      y += 1
    }
    y = this.drawSkillRow(data, y)
    gfx.fillStyle(DIVIDER_COL).fillRect(0, y, width, 1)
    y += 1
    this.drawUnitRow(data.target, y, width, gfx, data.isAlly ? ACCENT_ENEMY : ACCENT_ALLY)

    this.scene.tweens.add({ targets: this.panel, y: 0, duration: SLIDE, ease: 'Back.easeOut' })
  }

  hide(): void {
    if (!this.panel) return
    const c = this.panel
    this.panel = null
    this.scene.tweens.add({
      targets: c, y: -this.storedH, duration: SLIDE, ease: 'Back.easeIn',
      onComplete: () => c.destroy(),
    })
  }

  // ── Private helpers ───────────────────────────────────────────────────────

  private calcH(data: TurnPanelData): number {
    let h = this.skillH() + 1 + this.unitH(data.target.statusSlots.length)
    if (data.actor) h += this.unitH(data.actor.statusSlots.length) + 1
    return h
  }

  private unitH(statusCount: number): number {
    const base = PAD_Y + LINE_H + BAR_GAP + BAR_H + BAR_GAP + BAR_H + PAD_Y
    return base + (statusCount > 0 ? BAR_GAP + CHIP_H : 0)
  }

  private skillH(): number {
    return PAD_Y + LINE_H + 4 + LINE_H + PAD_Y
  }

  private drawUnitRow(
    unit: TurnPanelUnit, startY: number, width: number,
    gfx: Phaser.GameObjects.Graphics, accent: number,
  ): number {
    gfx.fillStyle(accent, 0.7).fillRect(0, startY, 3, this.unitH(unit.statusSlots.length))

    const cx = PAD_X + 4
    let y = startY + PAD_Y

    const rarityCol = RARITY_COL[unit.rarity] ?? TEXT_PRI
    this.panel!.add(this.scene.add.text(cx, y, unit.name, { ...BOLD_STYLE, color: rarityCol }))
    this.panel!.add(
      this.scene.add.text(width - PAD_X, y, `${unit.className} ${'★'.repeat(unit.rarity)}`, SMALL_STYLE)
        .setOrigin(1, 0),
    )
    y += LINE_H

    const barX = cx
    const barW  = width - cx - LABEL_W - PAD_X

    y += BAR_GAP
    const hpFrac = Math.min(1, unit.hp / Math.max(1, unit.maxHp))
    gfx.fillStyle(TRACK_COL).fillRect(barX, y, barW, BAR_H)
       .fillStyle(HP_COL).fillRect(barX, y, Math.round(barW * hpFrac), BAR_H)
    this.panel!.add(this.scene.add.text(barX + barW + 4, y - 1, `HP ${unit.hp}/${unit.maxHp}`, SMALL_STYLE))
    y += BAR_H

    y += BAR_GAP
    const apFrac = Math.min(1, unit.ap / Math.max(1, unit.maxAp))
    gfx.fillStyle(TRACK_COL).fillRect(barX, y, barW, BAR_H)
       .fillStyle(AP_COL).fillRect(barX, y, Math.round(barW * apFrac), BAR_H)
    this.panel!.add(this.scene.add.text(barX + barW + 4, y - 1, `AP ${unit.ap}/${unit.maxAp}`, SMALL_STYLE))
    y += BAR_H

    if (unit.statusSlots.length > 0) {
      y += BAR_GAP
      let chipX = cx
      for (const slot of unit.statusSlots) {
        const chipTxt = this.scene.add.text(chipX + 3, y + 2, slot.name, CHIP_STYLE)
        const chipW   = chipTxt.width + 6
        gfx.fillStyle(CHIP_BG_COL).fillRoundedRect(chipX, y, chipW, CHIP_H, 2)
        this.panel!.add(chipTxt)
        chipX += chipW + 4
      }
    }

    return startY + this.unitH(unit.statusSlots.length)
  }

  private drawSkillRow(data: TurnPanelData, startY: number): number {
    const cx = PAD_X + 4
    const y  = startY + PAD_Y
    this.panel!.add(
      this.scene.add.text(cx, y,
        `⚔ ${data.skillName}  ·  TU ${data.tuCost}  ·  AP ${data.apCost}`,
        { ...BOLD_STYLE, color: TEXT_PRI }),
    )
    this.panel!.add(this.scene.add.text(cx, y + LINE_H + 4, `Lv ${data.skillLevel}`, SMALL_STYLE))
    return startY + this.skillH()
  }
}
