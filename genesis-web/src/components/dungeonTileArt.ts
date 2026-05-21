// Fallback ASCII tile art — 8-char × 4-row patterns, used when no tileset loads.
// Matches the AsciiFixedTile / AsciiRotatedTile shapes in core/types.ts.

export interface TileArt {
  pattern: string[]   // 4 rows, each 8 chars wide
  color:   string     // inline CSS colour
}

const FLOOR: string[] = [
  '·  ·  · ',
  '  ·  ·  ',
  ' ·  · · ',
  '·   ·   ',
]

const HILL: string[] = [
  '▓▓▓▓▓▓▓▓',
  '▒▓▓▓▓▓▒▒',
  '░▒▒▓▓▒▒░',
  ' ░░░░░░ ',
]

const CRATER: string[] = [
  '┌──────┐',
  '│  ··  │',
  '│  ··  │',
  '└──────┘',
]

const RIFT: string[] = [
  '════════',
  ' ░░  ░░ ',
  '        ',
  '════════',
]

const EDGE_PATTERNS: Record<number, string[]> = {
  0:   ['│ ·   · ', '│       ', '│   ·   ', '│ ·     '],
  90:  ['────────', '        ', ' ·    · ', '        '],
  180: [' ·   · │', '       │', '   ·   │', ' ·     │'],
  270: ['        ', ' ·    · ', '        ', '────────'],
}

const SURFACE_CORNER_PATTERNS: Record<number, string[]> = {
  0:   ['┌───────', '│       ', '│ ·     ', '│       '],
  90:  ['───────┐', '       │', '     · │', '       │'],
  180: ['│       ', '│ ·     ', '│       ', '└───────'],
  270: ['       │', '     · │', '       │', '───────┘'],
}

const RIFT_CORNER_PATTERNS: Record<number, string[]> = {
  0:   ['╔═══════', '║ ░   ░ ', '║       ', '║ ░     '],
  90:  ['═══════╗', ' ░   ░ ║', '       ║', '     ░ ║'],
  180: ['       ║', '     ░ ║', '       ║', '═══════╝'],
  270: ['║ ░     ', '║       ', '║ ░   ░ ', '╚═══════'],
}

export function getTileArt(tileId: string, rotation = 0): TileArt {
  switch (tileId) {
    case 'floor':
      return { pattern: FLOOR,                                       color: '#5a2412' }
    case 'hill':
      return { pattern: HILL,                                        color: '#a85c28' }
    case 'crater':
      return { pattern: CRATER,                                      color: '#d07838' }
    case 'rift':
      return { pattern: RIFT,                                        color: '#2d0a06' }
    case 'edge':
      return { pattern: EDGE_PATTERNS[rotation] ?? EDGE_PATTERNS[0], color: '#8c4820' }
    case 'surface_corner':
      return { pattern: SURFACE_CORNER_PATTERNS[rotation] ?? SURFACE_CORNER_PATTERNS[0], color: '#8c4820' }
    case 'rift_corner':
      return { pattern: RIFT_CORNER_PATTERNS[rotation] ?? RIFT_CORNER_PATTERNS[0], color: '#3d1408' }
    default:
      return { pattern: FLOOR,                                       color: '#5a2412' }
  }
}
