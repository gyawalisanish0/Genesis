---
name: genesis-ui
description: UI design and implementation for the Genesis game (genesis-web) — GBA-era pixel art on a strict 2dp pixel grid. Use when building or changing any screen, component, or CSS module in genesis-web; auditing existing UI against the design system; mocking up a screen before coding; or authoring sprite/tile art and their manifests. Also use when `npm run validate:ui` fails.
---

# Genesis UI

Genesis is a portrait-only mobile tactical RPG rendered as **GBA-era pixel
art**. The visual style is load-bearing: `docs/design/design-philosophy.md`
argues the pixel grid *is* the fiction's perception model, so breaking the
grid quietly breaks the premise. Treat the rules below as correctness, not
taste.

## Read first

| Need | File |
|---|---|
| Grid, palette ramps, type, panels, motion, assets | `docs/ui/00-design-system.md` |
| Component catalogue — anatomy, props, states | `docs/ui/01-components.md` |
| Screen composition + navigation map | `docs/ui/02-screens.md` |
| Routing, safe-area, input, module limits | `CLAUDE.md` |

Never duplicate those docs into code comments or new files. Link to them.

---

## The non-negotiables

Violating any of these is a bug. Most are machine-checked (see § Validator).

**Grid**
- 1 art pixel = **2 dp**; the art canvas is 180 art px wide.
- Every size, offset, and gap is a multiple of 2 dp.
- Assets are authored at **1×** and displayed at exactly **2×**. Never author
  pre-scaled; never scale by a non-integer factor.

**Colour**
- Semantic tokens only — `var(--bg-*)`, `var(--accent-*)`, `var(--text-*)`,
  `var(--rarity-*)`. No hex, no `rgb()`, no `rgba()` in a `.module.css`.
- Tokens resolve to palette ramp steps. If a shade you need doesn't exist,
  add a ramp step to `tokens.css` — do not inline a one-off colour.

**Pixel discipline**
- No gradients. Use a 2-colour ordered dither or a flat ramp step.
- No `border-radius`. Corners are drawn into the nine-slice `Panel`.
  Only `var(--r-pill)`, `50%`, and `0` survive, for functional circles.
- No blurred shadows. Depth is one hard 1-art-px offset in a darker step.
- `image-rendering: pixelated` on every element that shows art.
- Glow (`--glow-*`) is licensed on **UI chrome only** — never on sprite art.

**Motion**
- Anything made of pixels (sprites, resource bars) animates with `steps(n)`.
- Only non-art chrome (backdrop dim, glow pulse) may use a continuous ease.
- `AppSettings.reduceAnimations` must collapse durations to `0ms`.

**Structure**
- One screen/component = one `.tsx` + one `.module.css` beside it.
- Module ≤ 150 lines, component ≤ 100, function ≤ 30 (CLAUDE.md). Split, don't sprawl.
- Layout lives in the CSS module, not a React `style` prop — except genuinely
  dynamic values (computed scale, camera offset).
- Every screen renders `<ScreenShell>` outermost and navigates via `SCREEN_IDS`.
- Minimum touch target 48 dp (`var(--touch-min)`), including padded hit areas
  for smaller glyphs.
- Any tappable element inside a scroll container uses `useScrollAwarePointer`.

---

## Workflows

### 1. Build or change UI

1. Check `docs/ui/01-components.md` — does a component already cover this?
   If a screen needs a visual that isn't catalogued, **add it to the
   catalogue first**, then implement. One-offs inside screen files are how
   the previous system grew six different modal backdrops.
2. Check `references/migration.md` — is the thing you're touching mid-migration?
   If so, convert it as part of the change rather than extending the old shape.
3. Write `.tsx` + `.module.css`. Tokens only, grid-multiple sizes.
4. Run `npm run validate:ui`, then `npx tsc --noEmit -p tsconfig.app.json`.
5. If you removed violations from a file, ratchet:
   `npm run validate:ui:baseline`.

### 2. Audit existing UI

`npm run validate:ui` reports mechanical violations against the baseline.
For a deeper pass, read the target file against § non-negotiables — the
validator cannot see everything (it does not check touch-target sizes,
`style`-prop layout, missing `ScreenShell`, or non-stepped sprite motion).

Report findings grouped by file with the fix, and offer to apply them.
Prefer migrating a whole file to clean rather than fixing one line, so the
baseline entry disappears entirely.

### 3. Mock up before coding

For a new screen or a significant relayout, lay it out visually first — it is
much cheaper to move a panel on a canvas than to rewrite JSX and CSS.

Invoke the `design` skill and build artboards at **360 × 640** (the dp canvas).
Reflect the real grid: 48 dp cells, 96 dp battle sprites, 8 dp panel borders.
Once the composition is agreed, implement from it via workflow 1.

Skip this for small changes — it is overhead for a copy tweak or a colour fix.

### 4. Author pixel art assets

See `references/assets.md` for sizes, palette indexing, manifest authoring,
and the export rule. Content JSON is Zod-validated — `npm run validate:data`
must pass, and it runs automatically on `npm run build`.

---

## Validator

```
npm run validate:ui            # check — fails on NEW violations only
npm run validate:ui:baseline   # re-record after improving a file
```

The codebase predates the design system, so `ui-baseline.json` records the
violations that already existed. The check is a **ratchet**:

- A new violation in any file → fail.
- A file that *improved* without the baseline being tightened → fail.

So the baseline can only shrink. When it reaches empty, wire `validate:ui`
into `prebuild` alongside `validate:data`.

Rules live in `genesis-web/src/__tests__/uiRules.ts`. Add one there when a
convention becomes mechanically checkable — but only if it produces no false
positives; a noisy check gets ignored and is worse than none.

---

## Migration stance

`docs/ui/01-components.md` specifies `Panel`, `PixelButton`, `Sheet`,
`Toaster`, `PromptOverlay` and ramp/pixel-font tokens that **do not exist in
code yet**. The docs are the target, not a description of today.

Do not write against primitives that are missing, and do not rewrite the whole
UI at once. Convert incrementally, in the dependency order in
`references/migration.md`, and ratchet the baseline down as you go.
