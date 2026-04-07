// Pure functions for tick-timeline calculations.
// Port of app/core/combat/tick_calculator.py

import { CLASS_TICK_RANGES } from '../constants'

// Determine a unit's starting tick based on speed and class.
// Formula mirrors Python: class_min + randint(0, round((max-min) × (1 - speed/100)))
export function calculateStartingTick(speed: number, className: string): number {
  const [min, max] = CLASS_TICK_RANGES[className] ?? [6, 14]
  const spread = Math.round((max - min) * (1 - speed / 100))
  return min + Math.floor(Math.random() * (spread + 1))
}

// Advance a unit's tick position after taking an action.
export function advanceTick(currentTick: number, tuCost: number): number {
  return currentTick + tuCost
}

// AP regenerated over a number of elapsed ticks.
export function calculateApGained(ticksElapsed: number, apRegenRate: number): number {
  return ticksElapsed * apRegenRate
}
