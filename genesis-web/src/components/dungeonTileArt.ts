// Computational 32×32 ASCII tile art for the dungeon grid.
// Each tile is a 32-char × 32-row block. At 0.5rem / line-height 0.6 each
// char pixel is ~4.8 × 4.8 px, making the block ~153.6 px square before scaling.

export interface TileArt {
  pattern: string[]   // 32 rows, each 32 chars wide
  color:   string     // inline CSS colour
}

const N = 32  // tile size in char-pixels

// Seeded hash: deterministic pseudo-random 0–255 from (seed, x, y).
function h(seed: number, x: number, y: number): number {
  let n = (seed ^ (x * 374761393) ^ (y * 1013904223)) | 0
  n = Math.imul((n >>> 16) ^ n, 0x45d9f3b)
  n = Math.imul((n >>> 16) ^ n, 0x45d9f3b)
  return ((n >>> 16) ^ n) & 0xff
}

// ── Pattern builders ──────────────────────────────────────────────────────────

function buildFloor(): string[] {
  return Array.from({ length: N }, (_, y) =>
    Array.from({ length: N }, (_, x) => h(42, x, y) < 38 ? '·' : ' ').join('')
  )
}

function buildHill(): string[] {
  return Array.from({ length: N }, (_, y) =>
    Array.from({ length: N }, (_, x) => {
      const density = 220 - y * 6
      const v = h(17, x, y)
      if (v < density - 40) return '▓'
      if (v < density)      return '▒'
      if (v < density + 30) return '░'
      return ' '
    }).join('')
  )
}

function buildCrater(): string[] {
  const cx = 15.5, cy = 15.5
  const innerR = 9.5, wallR = 12.5, outerR = 14.5
  return Array.from({ length: N }, (_, y) =>
    Array.from({ length: N }, (_, x) => {
      const d = Math.sqrt((x - cx) ** 2 + (y - cy) ** 2)
      if (d < innerR)  return h(77, x, y) < 22 ? '·' : ' '
      if (d < wallR)   return '░'
      if (d < outerR)  return '▓'
      return h(99, x, y) < 18 ? '·' : ' '
    }).join('')
  )
}

function buildRift(): string[] {
  return Array.from({ length: N }, (_, y) => {
    if (y <= 2 || y >= N - 3) {
      return '═'.repeat(N)
    }
    const mid = Math.floor(N / 2)
    return Array.from({ length: N }, (_, x) => {
      const distFromMid = Math.abs(y - mid)
      if (distFromMid <= 1) return ' '
      return h(55, x, y) < 25 ? '░' : ' '
    }).join('')
  })
}

function buildEdge(rotation: number): string[] {
  return Array.from({ length: N }, (_, y) =>
    Array.from({ length: N }, (_, x) => {
      switch (rotation) {
        case 0:   return x < 4  ? '│' : (h(11, x - 4, y) < 30 ? '·' : ' ')
        case 90:  return y < 4  ? '─' : (h(22, x, y - 4) < 30 ? '·' : ' ')
        case 180: return x >= N - 4 ? '│' : (h(33, x, y) < 30 ? '·' : ' ')
        case 270: return y >= N - 4 ? '─' : (h(44, x, y) < 30 ? '·' : ' ')
        default:  return ' '
      }
    }).join('')
  )
}

function buildSurfaceCorner(rotation: number): string[] {
  return Array.from({ length: N }, (_, y) =>
    Array.from({ length: N }, (_, x) => {
      switch (rotation) {
        case 0: {
          if (x < 4 && y < 4)  return '┌'
          if (x < 4)           return '│'
          if (y < 4)           return '─'
          return h(61, x, y) < 28 ? '·' : ' '
        }
        case 90: {
          if (x >= N - 4 && y < 4)  return '┐'
          if (x >= N - 4)           return '│'
          if (y < 4)                return '─'
          return h(62, x, y) < 28 ? '·' : ' '
        }
        case 180: {
          if (x >= N - 4 && y >= N - 4) return '┘'
          if (x >= N - 4)               return '│'
          if (y >= N - 4)               return '─'
          return h(63, x, y) < 28 ? '·' : ' '
        }
        case 270: {
          if (x < 4 && y >= N - 4) return '└'
          if (x < 4)               return '│'
          if (y >= N - 4)          return '─'
          return h(64, x, y) < 28 ? '·' : ' '
        }
        default: return ' '
      }
    }).join('')
  )
}

function buildRiftCorner(rotation: number): string[] {
  return Array.from({ length: N }, (_, y) =>
    Array.from({ length: N }, (_, x) => {
      switch (rotation) {
        case 0: {
          if (x < 4 && y < 4)  return '╔'
          if (x < 4)           return '║'
          if (y < 4)           return '═'
          return h(71, x, y) < 20 ? '░' : ' '
        }
        case 90: {
          if (x >= N - 4 && y < 4)  return '╗'
          if (x >= N - 4)           return '║'
          if (y < 4)                return '═'
          return h(72, x, y) < 20 ? '░' : ' '
        }
        case 180: {
          if (x >= N - 4 && y >= N - 4) return '╝'
          if (x >= N - 4)               return '║'
          if (y >= N - 4)               return '═'
          return h(73, x, y) < 20 ? '░' : ' '
        }
        case 270: {
          if (x < 4 && y >= N - 4) return '╚'
          if (x < 4)               return '║'
          if (y >= N - 4)          return '═'
          return h(74, x, y) < 20 ? '░' : ' '
        }
        default: return ' '
      }
    }).join('')
  )
}

// ── Pre-computed patterns ─────────────────────────────────────────────────────

const FLOOR_PATTERN   = buildFloor()
const HILL_PATTERN    = buildHill()
const CRATER_PATTERN  = buildCrater()
const RIFT_PATTERN    = buildRift()

const EDGE_PATTERNS: Record<number, string[]> = {
  0: buildEdge(0), 90: buildEdge(90), 180: buildEdge(180), 270: buildEdge(270),
}
const SURFACE_CORNER_PATTERNS: Record<number, string[]> = {
  0: buildSurfaceCorner(0), 90: buildSurfaceCorner(90),
  180: buildSurfaceCorner(180), 270: buildSurfaceCorner(270),
}
const RIFT_CORNER_PATTERNS: Record<number, string[]> = {
  0: buildRiftCorner(0), 90: buildRiftCorner(90),
  180: buildRiftCorner(180), 270: buildRiftCorner(270),
}

// ── Public API ────────────────────────────────────────────────────────────────

export function getTileArt(tileId: string, rotation = 0): TileArt {
  switch (tileId) {
    case 'floor':
      return { pattern: FLOOR_PATTERN,  color: '#cc7040' }
    case 'hill':
      return { pattern: HILL_PATTERN,   color: '#cc7040' }
    case 'crater':
      return { pattern: CRATER_PATTERN, color: '#cc7040' }
    case 'rift':
      return { pattern: RIFT_PATTERN,   color: '#cc7040' }
    case 'edge':
      return { pattern: EDGE_PATTERNS[rotation] ?? EDGE_PATTERNS[0],   color: '#cc7040' }
    case 'surface_corner':
      return { pattern: SURFACE_CORNER_PATTERNS[rotation] ?? SURFACE_CORNER_PATTERNS[0], color: '#cc7040' }
    case 'rift_corner':
      return { pattern: RIFT_CORNER_PATTERNS[rotation] ?? RIFT_CORNER_PATTERNS[0],       color: '#cc7040' }
    default:
      return { pattern: FLOOR_PATTERN,  color: '#cc7040' }
  }
}
