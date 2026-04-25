// AttackPanel — animates the acting unit toward the target; flashes the target on hit.
// Calls onDone when the acting unit returns to its original position.

import Phaser from 'phaser'
import { UnitStage } from './UnitStage'

const HIT_COLOUR: Record<string, number> = {
  Boosted:  0xf59e0b,  // gold
  Success:  0xef4444,  // danger (red flash)
  GuardUp:  0x3b82f6,  // info (blue — guard absorbed some)
  Tumbling: 0xf97316,  // warn (orange — staggered hit)
  Evasion:  0x06b6d4,  // evasion (cyan — glancing)
  Fail:     0x5c5480,  // muted (miss)
}

export class AttackPanel {
  private scene:     Phaser.Scene
  private unitStage: UnitStage

  constructor(scene: Phaser.Scene, unitStage: UnitStage) {
    this.scene     = scene
    this.unitStage = unitStage
  }

  play(
    _casterId: string,
    _targetId: string,
    outcome:   string,
    _damage:   number,
    onDone:    () => void,
  ): void {
    if (!this.unitStage.isVisible) { onDone(); return }
    const isHit   = outcome !== 'Fail' && outcome !== 'Evasion'
    const hitCol  = HIT_COLOUR[outcome] ?? 0xef4444
    const dx      = Math.floor(this.scene.scale.width * 0.33)

    this.unitStage.shoveActing(dx, () => {
      if (isHit) this.unitStage.flashTarget(hitCol)
      onDone()
    })
  }
}
