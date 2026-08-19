// UI convention rules — pure scanning, no assertions.
//
// The codebase predates docs/ui/00-design-system.md, so these rules are
// enforced against a **ratcheting baseline** (ui-baseline.json): existing
// violations are recorded per file, and only NEW ones fail. As migration
// proceeds the baseline shrinks; it must never grow.

import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'

/** Cross-file facts a rule may need. Built once per scan. */
export interface ScanContext {
  /** Every custom property defined anywhere — tokens.css plus local ones. */
  knownTokens: Set<string>
}

export interface UiRule {
  id:      string
  applies: (relPath: string) => boolean
  /** Returns one entry per violation found in `source`. */
  scan:    (source: string, ctx: ScanContext) => string[]
  /** Shown when a new violation appears. */
  fix:     string
}

const isModuleCss = (p: string) => p.endsWith('.module.css')
const isCss       = (p: string) => p.endsWith('.css')
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
    // An undefined var() with NO fallback silently invalidates its declaration
    // — and inside an `animation`/`transition` shorthand it kills the whole
    // effect. A var() WITH a fallback (`var(--x, 1rem)`) is safe by design, so
    // only the no-fallback form is flagged.
    id:      'no-undefined-token',
    applies: p => isCss(p) && !p.endsWith('tokens.css'),
    scan:    (src, ctx) => {
      const out: string[] = []
      stripComments(src).split('\n').forEach((line, i) => {
        // `var(--x)` — closing paren straight after the name means no fallback.
        for (const [, name] of line.matchAll(/var\(\s*(--[a-z0-9-]+)\s*\)/g)) {
          if (!ctx.knownTokens.has(name)) out.push(`${i + 1}: ${name} — ${line.trim()}`)
        }
      })
      return out
    },
    fix:     'This custom property is defined nowhere and the var() has no fallback. Add it to tokens.css, correct the name, or give it a fallback — otherwise the whole declaration is invalid.',
  },
  {
    // `--bg-overlay` exists for exactly one purpose: the modal backdrop owned by
    // Sheet / PromptOverlay. Using it anywhere else means a screen is
    // re-implementing shared chrome — the mistake that produced six different
    // modal backdrops before consolidation.
    id:      'no-duplicate-chrome',
    applies: p => isModuleCss(p) && !p.startsWith('components/'),
    scan:    src => matchLines(src, /var\(--bg-overlay\)/),
    fix:     'Compose <Sheet> (dismissible) or <PromptOverlay> (blocking) instead of hand-rolling a backdrop. --bg-overlay belongs to those two components. See docs/ui/01-components.md § Sheet.',
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

/** Collects every custom property defined in CSS or set inline from TSX. */
function buildContext(files: string[]): ScanContext {
  const knownTokens = new Set<string>()
  for (const f of files) {
    if (!f.endsWith('.css') && !f.endsWith('.tsx')) continue
    const src = readFileSync(f, 'utf-8')
    // A custom-property *definition* is `--x:` at a rule's start — line start or
    // just after `{`/`;` (inline `.x { --y: … }`). `var(--x)` usages never match
    // (no colon follows the name inside var()).
    for (const [, n] of src.matchAll(/(?:^|[{;])\s*(--[a-z0-9-]+)\s*:/gm)) knownTokens.add(n)
    if (f.endsWith('.tsx')) {
      for (const [, n] of src.matchAll(/['"](--[a-z0-9-]+)['"]/g)) knownTokens.add(n)
    }
  }
  return { knownTokens }
}

/** Scans `root` and returns violation counts keyed by rule then file. */
export function scanTree(root: string): Findings {
  const files    = walk(root)
  const ctx      = buildContext(files)
  const findings: Findings = {}
  for (const full of files) {
    const rel = relative(root, full).split(/[\\/]/).join('/')
    for (const rule of RULES) {
      if (!rule.applies(rel)) continue
      const hits = rule.scan(readFileSync(full, 'utf-8'), ctx)
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
  return rule.scan(readFileSync(join(root, relPath), 'utf-8'), buildContext(walk(root)))
}
