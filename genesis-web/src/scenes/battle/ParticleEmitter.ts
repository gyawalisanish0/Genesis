// ParticleEmitter — one-shot burst effects for hit, boosted hit, guard, and miss outcomes.
// Requires 'battle_particle' texture generated in BattleScene.create().
// gravityY pulls particles downward after the initial radial burst.

import Phaser from 'phaser'
import { tokenToInt } from './tokens'

export const PARTICLE_KEY = 'battle_particle'

const BURST: Record<string, { count: number; colour: string; speed: number }> = {
  Boosted: { count: 22, colour: 'var(--accent-gold)',    speed: 160 },
  Hit:     { count: 12, colour: 'var(--accent-danger)',  speed: 110 },
  Evade:   { count:  8, colour: 'var(--accent-evasion)', speed:  80 },
  Fail:    { count:  5, colour: 'var(--text-muted)',     speed:  50 },
}

export class ParticleEmitter {
  private scene: Phaser.Scene

  constructor(scene: Phaser.Scene) {
    this.scene = scene
  }

  burst(x: number, y: number, outcome: string): void {
    const cfg = BURST[outcome]
    if (!cfg) return

    const colour = tokenToInt(cfg.colour)

    const emitter = this.scene.add.particles(x, y, PARTICLE_KEY, {
      speed:    { min: cfg.speed * 0.3, max: cfg.speed },
      angle:    { min: 0, max: 360 },
      lifespan: { min: 280, max: 550 },
      scale:    { start: 1.4, end: 0 },
      alpha:    { start: 1,   end: 0 },
      gravityY: 180,
      tint:     colour,
      emitting: false,
    })

    emitter.explode(cfg.count)
    this.scene.time.delayedCall(700, () => emitter.destroy())
  }
}
