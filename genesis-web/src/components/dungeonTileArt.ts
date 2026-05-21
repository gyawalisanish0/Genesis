// Fallback ASCII tile art — used when no tileset is loaded.
// Mirrors the structure of AsciiTileDef in core/types.ts but resolved
// to a concrete { char, color } for immediate use in the renderer.

export interface TileArt {
  char:  string
  color: string   // inline CSS colour
}

const EDGE_CHARS: Record<number, string> = {
  0:   '│',   // left wall   (entity stands right)
  90:  '─',   // top ledge   (entity stands below)
  180: '│',   // right wall  (entity stands left)
  270: '─',   // bottom ledge (entity stands above)
}

const SURFACE_CORNER_CHARS: Record<number, string> = {
  0: '╔', 90: '╗', 180: '╚', 270: '╝',
}

const RIFT_CORNER_CHARS: Record<number, string> = {
  0: '╔', 90: '╗', 180: '╝', 270: '╚',
}

export function getTileArt(tileId: string, rotation = 0): TileArt {
  switch (tileId) {
    case 'floor':
      return { char: '·',                                     color: '#5a2412' }
    case 'hill':
      return { char: '▓',                                     color: '#a85c28' }
    case 'crater':
      return { char: '◎',                                     color: '#d07838' }
    case 'rift':
      return { char: '═',                                     color: '#2d0a06' }
    case 'edge':
      return { char: EDGE_CHARS[rotation] ?? '─',             color: '#8c4820' }
    case 'surface_corner':
      return { char: SURFACE_CORNER_CHARS[rotation] ?? '╔',   color: '#8c4820' }
    case 'rift_corner':
      return { char: RIFT_CORNER_CHARS[rotation] ?? '╔',      color: '#3d1408' }
    default:
      return { char: ' ',                                     color: '#5a2412' }
  }
}
