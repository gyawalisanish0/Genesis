// UI convention check — enforces docs/ui/00-design-system.md mechanically.
//
// Ratcheting baseline: ui-baseline.json records the violations that existed
// when the design system landed. This test fails only on violations *beyond*
// that baseline, so new code must be clean while migration proceeds file by
// file. The baseline may shrink, never grow.
//
//   npm run validate:ui            — check
//   npm run validate:ui:baseline   — re-record after migrating a file
//
// See ~/.claude/skills/genesis-ui (or docs/skills/genesis-ui) for the workflow.

import { describe, it, expect } from 'vitest'
import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { RULES, scanTree, detail, type Findings } from './uiRules'

const SRC_ROOT     = join(fileURLToPath(import.meta.url), '../..')
const BASELINE_PATH = join(SRC_ROOT, '../ui-baseline.json')
const UPDATING      = process.env.UI_BASELINE_UPDATE === '1'

function loadBaseline(): Findings {
  if (!existsSync(BASELINE_PATH)) return {}
  return JSON.parse(readFileSync(BASELINE_PATH, 'utf-8')) as Findings
}

describe('UI conventions (docs/ui/00-design-system.md)', () => {
  const found    = scanTree(SRC_ROOT)
  const baseline = loadBaseline()

  if (UPDATING) {
    it('re-records the baseline', () => {
      writeFileSync(BASELINE_PATH, `${JSON.stringify(found, null, 2)}\n`)
      expect(true).toBe(true)
    })
    return
  }

  it('adds no new design-system violations', () => {
    const regressions: string[] = []

    for (const rule of RULES) {
      const now  = found[rule.id]    ?? {}
      const were = baseline[rule.id] ?? {}
      for (const [file, count] of Object.entries(now)) {
        const allowed = were[file] ?? 0
        if (count <= allowed) continue
        regressions.push(
          `\n✖ ${rule.id} — ${file}` +
          `\n  ${count} violation(s), baseline allows ${allowed}` +
          `\n  ${rule.fix}` +
          detail(SRC_ROOT, rule.id, file).map(d => `\n    · ${d}`).join(''),
        )
      }
    }

    expect(
      regressions,
      `${regressions.join('\n')}\n\nIf a violation is genuinely unavoidable, run ` +
      `\`npm run validate:ui:baseline\` — but prefer fixing it.\n`,
    ).toEqual([])
  })

  it('baseline contains no stale entries (migrated files must be removed from it)', () => {
    const stale: string[] = []

    for (const [ruleId, files] of Object.entries(baseline)) {
      for (const [file, count] of Object.entries(files)) {
        const actual = found[ruleId]?.[file] ?? 0
        if (actual < count) stale.push(`${ruleId} — ${file}: baseline ${count}, actual ${actual}`)
      }
    }

    expect(
      stale,
      `Baseline is looser than reality — these improved and the baseline must be tightened.\n` +
      `Run \`npm run validate:ui:baseline\` to ratchet it down:\n  ${stale.join('\n  ')}\n`,
    ).toEqual([])
  })
})
