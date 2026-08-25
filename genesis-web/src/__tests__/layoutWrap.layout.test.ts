// Wrap regression guard.
//
// Three separate display strings shipped broken because nothing could see text
// layout: the splash wordmark rendered "G E N E S I" / "S", the result banner
// rendered "V I C T O" / "R Y", and unit names wrapped mid-row. tsc, the unit
// suite and validate:ui all passed every time — jsdom has no layout engine, so
// a line box is invisible to them.
//
// This drives a real browser and counts how many distinct LINES each text node
// occupies, from the vertical positions of its client rects. That is exact: no
// guessing from heights, line-heights or character counts.
//
// Counting rects alone is not enough — Chromium emits several rects on a single
// line for ellipsis-truncated text (the full string plus the visible part) and
// for inline fragments split around a nested element. Grouping by rounded top
// distinguishes "wrapped onto another line" from "fragmented on the same one".
//
// Only SHORT strings are judged. Prose is supposed to wrap; a title, a label,
// a stat value and a unit name are not.
//
// Not part of `npm test` — it needs a browser. `npm run validate:layout`.
//
// The browser comes from Playwright's own install (`npx playwright install
// chromium`). Sandboxes that ship a preinstalled build whose revision does not
// match the installed Playwright can point at it directly with
// PLAYWRIGHT_CHROMIUM_EXECUTABLE.

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { createServer, type ViteDevServer } from 'vite'
import { chromium, type Browser } from 'playwright'

/** Strings at or under this length are single-line by intent. */
const SHORT_STRING_MAX = 26

const PORT = 51731

/** Every route reachable without a battle in progress. */
const ROUTES = [
  '/', '/main-menu', '/campaign', '/roster',
  '/settings', '/pre-battle', '/dungeon', '/battle-result',
]

/** Narrowest supported, the design width, and the widest phone. */
const VIEWPORTS: Array<[number, number, string]> = [
  [240, 320, 'narrowest'],
  [360, 640, 'design'],
  [430, 932, 'widest phone'],
]

interface Wrap { route: string; viewport: string; detail: string }

let server: ViteDevServer
let browser: Browser

beforeAll(async () => {
  server = await createServer({
    configFile: false,
    root: process.cwd(),
    server: { port: PORT, strictPort: true },
    logLevel: 'error',
  })
  await server.listen()
  const executablePath = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE
  browser = await chromium.launch(executablePath ? { executablePath } : {})
}, 120_000)

afterAll(async () => {
  await browser?.close()
  await server?.close()
})

/**
 * Short text nodes rendered on more than one line.
 *
 * Runs in the page: walks every text node, selects its contents with a Range
 * and counts the resulting client rects.
 */
async function findWraps(route: string, w: number, h: number, label: string): Promise<Wrap[]> {
  const ctx  = await browser.newContext({ viewport: { width: w, height: h } })
  const page = await ctx.newPage()
  try {
    await page.goto(`http://localhost:${PORT}/#${route}`, { waitUntil: 'load' })
    // Splash auto-advances; sample it before it navigates and give the other
    // screens time to finish their DataService fetches.
    await page.waitForTimeout(route === '/' ? 350 : 1400)
    await page.evaluate(() => document.fonts.ready)

    const details: string[] = await page.evaluate((maxLen) => {
      const out: string[] = []
      const walk = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT)
      let node: Node | null
      while ((node = walk.nextNode())) {
        const text = node.textContent?.trim() ?? ''
        if (!text || text.length > maxLen) continue

        const range = document.createRange()
        range.selectNodeContents(node)
        const rects = [...range.getClientRects()].filter((r) => r.width > 0 && r.height > 0)
        // Distinct baselines, not distinct rects. Rounded to absorb sub-pixel
        // jitter between fragments that are really on the same line.
        const lines = new Set(rects.map((r) => Math.round(r.top))).size
        if (lines <= 1) continue

        const el  = node.parentElement
        const cls = (el?.className ?? '').toString().replace(/_[a-z0-9]{5,}/g, '').trim()
        out.push(`<${el?.tagName.toLowerCase()} class="${cls || '-'}"> "${text}" on ${lines} lines`)
      }
      return [...new Set(out)]
    }, SHORT_STRING_MAX)

    return details.map((detail) => ({ route, viewport: label, detail }))
  } finally {
    await ctx.close()
  }
}

describe('text layout', () => {
  it('never wraps a short string on any supported viewport', async () => {
    const wraps: Wrap[] = []
    for (const [w, h, label] of VIEWPORTS) {
      for (const route of ROUTES) {
        wraps.push(...await findWraps(route, w, h, label))
      }
    }

    const report = wraps.map((v) => `  ${v.viewport.padEnd(13)} ${v.route.padEnd(15)} ${v.detail}`)
    expect(
      report,
      `Short strings wrapped onto multiple lines.\n\n${report.join('\n')}\n\n` +
      `Give the element white-space: nowrap (plus overflow/text-overflow if it can\n` +
      `genuinely run long), or reduce its size or letter-spacing. If a string is\n` +
      `spelled with real spaces to fake tracking — "V I C T O R Y" — remove them and\n` +
      `use letter-spacing: real spaces are legal break points.\n`,
    ).toEqual([])
  }, 180_000)
})
