// Mirrors src/styles/tokens.css so Phaser objects match the React UI exactly.

const TOKEN: Record<string, string> = {
  'var(--accent-genesis)': '#8b5cf6',
  'var(--accent-gold)':    '#f59e0b',
  'var(--accent-info)':    '#3b82f6',
  'var(--accent-heal)':    '#10b981',
  'var(--accent-warn)':    '#f97316',
  'var(--accent-danger)':  '#ef4444',
  'var(--accent-evasion)': '#06b6d4',
  'var(--text-primary)':   '#f1f0ff',
  'var(--text-secondary)': '#9b8ec4',
  'var(--text-muted)':     '#5c5480',
}

/** Resolve a CSS token or pass-through a plain hex string. */
export function tokenToHex(colour: string): string {
  return TOKEN[colour] ?? colour
}

/** Resolve a CSS token or hex string to a Phaser-compatible integer. */
export function tokenToInt(colour: string): number {
  return parseInt(tokenToHex(colour).replace('#', ''), 16)
}
