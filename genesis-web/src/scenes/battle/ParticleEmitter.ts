// ParticleEmitter — one-shot burst effects for hit, boosted hit, and guard outcomes.
// Requires 'battle_particle' texture generated in BattleScene.create().

import Phaser from 'phaser'
import { tokenToHex } from '../BattleScene'

export const PARTICLE_KEY = 'battle_particle'

const BURST: Record<string, { count: number; colour: string; speed: number }> = {
  Boosted:  { count: 22, colour: 'var(--accent-gold)',   speed: 160 },
  Success:  { count: 12, colour: 'var(--accent-danger)', speed: 110 },
  GuardUp:  { count: 10, colour: 'var(--accent-info)',   speed: 90  },
  Tumbling: { count: 12, colour: 'var(--accent-warn)',   speed: 110 },
}

export class ParticleEmitter {
  private scene: Phaser.Scene

  constructor(scene: Phaser.Scene) {
    this.scene = scene
  }

  burst(x: number, y: number, outcome: string): void {
    const cfg = BURST[outcome]
    if (!cfg) return  // Evasion / Fail / unknown — no particles

    const colour = parseInt(tokenToHex(cfg.colour).replace('#', ''), 16)

    const emitter = this.scene.add.particles(x, y, PARTICLE_KEY, {
      speed:    { min: cfg.speed * 0.3, max: cfg.speed },
      angle:    { min: 0, max: 360 },
      lifespan: { min: 280, max: 550 },
      scale:    { start: 1.4, end: 0 },
      alpha:    { start: 1,   end: 0 },
      tint:     colour,
      emitting: false,
    })

    emitter.explode(cfg.count)
    this.scene.time.delayedCall(700, () => emitter.destroy())
  }
}
