// ASCII tile art for the dungeon arena.
// Maps tile type id + optional rotation → char + color key.

export type TileColorKey = 'floor' | 'hill' | 'crater' | 'rift' | 'edge'

export interface TileArt {
  char:     string
  colorKey: TileColorKey
}

const EDGE_CHARS: Record<number, string> = {
  0:   '│',   // left wall   (entity stands right)
  90:  '─',   // top ledge   (entity stands below)
  180: '│',   // right wall  (entity stands left)
  270: '─',   // bottom ledge (entity stands above)
}

const SURFACE_CORNER_CHARS: Record<number, string> = {
  0:   '╔',
  90:  '╗',
  180: '╚',
  270: '╝',
}

const RIFT_CORNER_CHARS: Record<number, string> = {
  0:   '╔',
  90:  '╗',
  180: '╝',
  270: '╚',
}

export function getTileArt(tileId: string, rotation = 0): TileArt {
  switch (tileId) {
    case 'floor':
      return { char: '·',                                  colorKey: 'floor'  }
    case 'hill':
      return { char: '▓',                                  colorKey: 'hill'   }
    case 'crater':
      return { char: '◎',                                  colorKey: 'crater' }
    case 'rift':
      return { char: '═',                                  colorKey: 'rift'   }
    case 'edge':
      return { char: EDGE_CHARS[rotation] ?? '─',          colorKey: 'edge'   }
    case 'surface_corner':
      return { char: SURFACE_CORNER_CHARS[rotation] ?? '╔', colorKey: 'edge'  }
    case 'rift_corner':
      return { char: RIFT_CORNER_CHARS[rotation] ?? '╔',   colorKey: 'rift'  }
    default:
      return { char: ' ',                                  colorKey: 'floor'  }
  }
}
