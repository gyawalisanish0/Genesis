// UI convention rules — pure scanning, no assertions.
//
// The codebase predates docs/ui/00-design-system.md, so these rules are
// enforced against a **ratcheting baseline** (ui-baseline.json): existing
// violations are recorded per file, and only NEW ones fail. As migration
// proceeds the baseline shrinks; it must never grow.

import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'

export interface UiRule {
  id:      string
  applies: (relPath: string) => boolean
  /** Returns one entry per violation found in `source`. */
  scan:    (source: string) => string[]
  /** Shown when a new violation appears. */
  fix:     string
}

const isModuleCss = (p: string) => p.endsWith('.module.css')
const isSource    = (p: string) => (p.endsWith('.ts') || p.endsWith('.tsx')) && !p.includes('__tests__')

/** Strips comments so rules never fire on documentation or commented-out code. */
function stripComments(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
}

function matchLines(src: string, re: RegExp): string[] {
  const out: string[] = []
  stripComments(src).split('\n').forEach((line, i) => {
    if (re.test(line)) out.push(`${i + 1}: ${line.trim()}`)
  })
  return out
}

// Radii are retired in favour of nine-slice panels. Functional circles survive.
const ALLOWED_RADIUS = /border-radius:\s*(var\(--r-pill\)|50%|999px|inherit|0)\s*;?/

export const MODULE_LINE_LIMIT = 150

export const RULES: UiRule[] = [
  {
    id:      'no-hardcoded-colour',
    applies: p => isModuleCss(p),
    scan:    src => matchLines(src, /(#[0-9a-fA-F]{3,8}\b|\brgba?\()/),
    fix:     'Use a semantic token from tokens.css (var(--bg-*), var(--accent-*), var(--text-*)). See docs/ui/00-design-system.md § 3.',
  },
  {
    id:      'no-border-radius',
    applies: p => isModuleCss(p),
    scan:    src => matchLines(src, /border-radius:/).filter(l => !ALLOWED_RADIUS.test(l)),
    fix:     'Corners are drawn into the nine-slice Panel, not rounded. Allowed: var(--r-pill), 50%, 0. See docs/ui/00-design-system.md § 5.',
  },
  {
    id:      'no-gradient',
    applies: p => isModuleCss(p),
    scan:    src => matchLines(src, /(linear|radial|conic)-gradient\(/),
    fix:     'Gradients are banned in pixel art — use a 2-colour ordered dither or a flat ramp step. See docs/ui/00-design-system.md § 2 rule 2.',
  },
  {
    id:      'module-line-limit',
    applies: p => isSource(p),
    scan:    src => {
      const n = src.split('\n').length
      return n > MODULE_LINE_LIMIT ? [`file is ${n} lines (limit ${MODULE_LINE_LIMIT})`] : []
    },
    fix:     'Split into focused submodules — CLAUDE.md § Modular Design Rules.',
  },
]

// ── Scanning ──────────────────────────────────────────────────────────────────

export type Findings = Record<string, Record<string, number>>  // ruleId → relPath → count

export function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    if (entry === 'node_modules' || entry === 'dist') continue
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) walk(full, out)
    else out.push(full)
  }
  return out
}

/** Scans `root` and returns violation counts keyed by rule then file. */
export function scanTree(root: string): Findings {
  const findings: Findings = {}
  for (const full of walk(root)) {
    const rel = relative(root, full).split(/[\\/]/).join('/')
    for (const rule of RULES) {
      if (!rule.applies(rel)) continue
      const hits = rule.scan(readFileSync(full, 'utf-8'))
      if (hits.length === 0) continue
      findings[rule.id] ??= {}
      findings[rule.id][rel] = hits.length
    }
  }
  return findings
}

/** Detailed hits for one rule in one file — used to print actionable failures. */
export function detail(root: string, ruleId: string, relPath: string): string[] {
  const rule = RULES.find(r => r.id === ruleId)
  if (!rule) return []
  return rule.scan(readFileSync(join(root, relPath), 'utf-8'))
}
