// Pure clash-ordering logic. No UI, no React.
//
// Clash = two or more units from different teams at the same tick.
// Resolution: compare average effective speed per faction.
//   - Higher average acts first.
//   - Tie → weighted dice where each faction's weight = factionSize / totalUnits.
//
// This scales to any N-faction, M-units-per-faction configuration:
//   1v1  → simple speed compare; D2 (50/50) on tie
//   2v1  → avg(team) vs single; D3 weighted 2:1 on tie
//   2v2  → avg(team A) vs avg(team B); D2 (50/50) on tie
//   3v1  → avg(team) vs single; D4 weighted 3:1 on tie
//   1v1v1 → three solo factions; D3 (1/3 each) on tie
//   … and so on

import type { Unit } from '../types'

// ── Types ─────────────────────────────────────────────────────────────────────

export interface ClashFaction {
  units:        Unit[]
  avgSpeed:     number
  isPlayerSide: boolean
}

// ── Speed helpers ─────────────────────────────────────────────────────────────

/** Unit's effective speed including any clash-specific modifier. */
export function effectiveClashSpeed(unit: Unit): number {
  return unit.stats.speed + unit.clashSpeedModifier
}

/** Average effective speed for a group of units. */
export function factionAvgSpeed(units: Unit[]): number {
  return units.reduce((sum, u) => sum + effectiveClashSpeed(u), 0) / units.length
}

// ── Faction construction ──────────────────────────────────────────────────────

export function buildFactions(playerUnits: Unit[], enemyUnits: Unit[]): ClashFaction[] {
  const factions: ClashFaction[] = []
  if (playerUnits.length > 0) {
    factions.push({ units: playerUnits, avgSpeed: factionAvgSpeed(playerUnits), isPlayerSide: true })
  }
  if (enemyUnits.length > 0) {
    factions.push({ units: enemyUnits, avgSpeed: factionAvgSpeed(enemyUnits), isPlayerSide: false })
  }
  return factions
}

// ── Resolution ────────────────────────────────────────────────────────────────

/**
 * Returns the faction that acts first.
 * When avgSpeeds differ, higher wins outright.
 * When tied, a weighted dice is rolled: each tied faction's weight = its unit
 * count divided by the total number of units in the tie.
 */
export function resolveClashOrder(factions: ClashFaction[]): ClashFaction[] {
  const sorted = [...factions].sort((a, b) => b.avgSpeed - a.avgSpeed)
  const topSpeed = sorted[0].avgSpeed
  const tied = sorted.filter((f) => f.avgSpeed === topSpeed)

  if (tied.length === 1) return sorted

  const totalInTie = tied.reduce((sum, f) => sum + f.units.length, 0)
  const weights    = tied.map((f) => f.units.length / totalInTie)
  const winnerIdx  = rollWeightedDice(weights)
  const winner     = tied[winnerIdx]

  return [winner, ...sorted.filter((f) => f !== winner)]
}

/** Convenience wrapper for the standard two-faction case. */
export function resolveClashWinner(playerUnits: Unit[], enemyUnits: Unit[]): 'player' | 'enemy' {
  const factions = buildFactions(playerUnits, enemyUnits)
  const ordered  = resolveClashOrder(factions)
  return ordered[0].isPlayerSide ? 'player' : 'enemy'
}

// ── Dice ──────────────────────────────────────────────────────────────────────

/** Returns the index of the winning faction via cumulative-weight sampling. */
function rollWeightedDice(weights: number[]): number {
  const r = Math.random()
  let cumulative = 0
  for (let i = 0; i < weights.length; i++) {
    cumulative += weights[i]
    if (r < cumulative) return i
  }
  return weights.length - 1  // floating-point edge guard
}
