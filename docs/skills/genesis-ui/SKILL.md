---
name: genesis-ui
description: UI design and implementation for the Genesis game (genesis-web) — GBA-era pixel art on a strict 2dp pixel grid, built from centralised reusable components. Use when building or changing any screen, component, or CSS module in genesis-web; auditing existing UI against the design system; mocking up a screen before coding; or authoring sprite/tile art and their manifests. Also use when `npm run validate:ui` fails.
---

# Genesis UI

Genesis is a portrait-only mobile tactical RPG rendered as **GBA-era pixel
art**, assembled from a **small set of centralised components**. The visual
style is load-bearing: `docs/design/design-philosophy.md` argues the pixel grid
*is* the fiction's perception model, so breaking the grid quietly breaks the
premise. Treat the rules here as correctness, not taste.

## Read first

| Need | File |
|---|---|
| Grid, palette ramps, type, panels, motion, assets | `docs/ui/00-design-system.md` |
| Component catalogue — anatomy, props, states | `docs/ui/01-components.md` |
| Screen composition + navigation map | `docs/ui/02-screens.md` |
| What's built vs. still to migrate | `references/migration.md` |
| Sprite budget, palettes, manifests | `references/assets.md` |
| Routing, safe-area, input, module limits | `CLAUDE.md` |

Never duplicate those docs into code comments or new files. Link to them.

---

## Reuse first — the decision ladder

**Before writing a single line of UI, walk this ladder top-down and stop at the
first rung that works.** Skipping it is how this codebase previously grew six
modal backdrops, three toasts, three portrait renderings, and a palette that
disagreed with its own documentation.

| # | Rung | Ask |
|---|---|---|
| **1** | **Use an existing component as-is** | Is it already in the inventory below? |
| **2** | **Add a prop to an existing component** | Is this a *variant* of something built? (`Sheet` gained `placement`; `PromptOverlay` gained `onBackdropTap`) |
| **3** | **Compose existing components** | Can `Panel` + `PixelButton` + `ResourceBar` express it without anything new? |
| **4** | **Extract a new shared component** | Will ≥ 2 places want this? Then catalogue it in `01-components.md`, build it once in `components/`, and consume it. |
| **5** | **Screen-local content styling** | Genuinely one-of-a-kind *content* (reward rows, stat chips). Content only — never chrome. |

There is no sixth rung. "Just inline it here for now" is not an option; that is
precisely the debt this system exists to pay down.

**Prefer rung 2 over rung 4.** A new prop on a proven component beats a new
component almost every time — it keeps the surface small and the behaviour
consistent. Only extract when the shapes genuinely diverge.

### Inventory — what already exists

| Component | Covers | Don't hand-roll |
|---|---|---|
| `Panel` | Every bordered surface, 5 variants | Any `border` + `background` card |
| `PixelButton` | All action buttons, 4 variants | `<button>` with custom styling |
| `Sheet` | Dismissible overlays — info, detail, log, reward | A backdrop, a modal card, a close ✕ |
| `PromptOverlay` | Blocking decisions the engine waits on | A blocking backdrop, an actions row |
| `ResourceBar` | HP / AP / XP / shield | A `<div>` with a percentage width |
| `UnitPortrait` | Any character likeness, 4 sizes | A circle with a border and an image |
| `Toaster` | Transient chips — hints, warnings, errors | A floating message div with a timer |
| `StatusChipBar` | Status effect chips | A row of small labelled squares |
| `PagedGrid` | Any paged card grid | Pagination, swipe, dot indicators |
| `ScreenShell` | Safe-area padding | `padding: env(safe-area-inset-*)` |
| `useScrollAwarePointer` | Tap vs. scroll vs. hold | A raw `onPointerDown` in a scroller |

Every component in the original consolidation table now exists,
`ResourceBar` draws as segmented blocks, and the retired radii (`--r-sm`…
`--r-xl`) are gone from `tokens.css` — `no-border-radius` is at zero.
Remaining migration work is the per-screen sweep (step 9). See
`references/migration.md`.

### Anti-patterns, with the receipts

Each of these actually happened here.

- **Six modal backdrops.** Four info overlays + two decision overlays each
  declared `position:absolute; inset:0; background:var(--bg-overlay)`. Now
  `Sheet` and `PromptOverlay`. *The `no-duplicate-chrome` rule now fails the
  build if a screen reaches for `--bg-overlay` again.*
- **Four toast implementations.** `HintToaster`, `ErrorToaster`,
  `BattleErrorToast`, and an inline chip in `BattleScreen` that no audit had
  even listed. Two already shared a stylesheet — that should have been the
  signal to extract. *Consolidating usually finds more duplicates than the
  audit predicted; go looking.*
- **Three portrait renderings.** `UnitPortrait`, a bespoke circle in
  `BattleScreen`, and a timeline marker — the same thing three times.
- **A palette the code never used.** The design doc specified purple; the app
  shipped cyan for months. Docs that aren't the source of truth rot.
- **Three tokens defined nowhere.** `--font-display`, `--t-subtitle-size`,
  `--motion-modal` silently killed three animations, because an undefined
  `var()` invalidates its whole declaration with no console warning.

---

## The non-negotiables

Violating any of these is a bug. Most are machine-checked (see § Validator).

**Centralisation** — the rule everything else serves
- Walk the ladder above. Reuse > extend > compose > extract > local content.
- **Shared chrome, local content.** A screen owns its content CSS (reward rows,
  stat chips) and nothing else. Backdrop, border, animation, dismissal, and
  press behaviour live in the shared component. Writing
  `.backdrop { position:absolute; inset:0 }` in a screen module means you have
  skipped rung 1 — that is `Sheet`.
- **Catalogue before code.** A visual that isn't in `01-components.md` gets
  added there first. The catalogue is the contract; the code implements it.
- **Cross-cutting behaviour stays with its owner.** `backButtonRegistry` holds
  one handler at a time, so a shared overlay must *not* self-register — the
  screen owns its back chain and wires it to the component's `onClose`.
  Generalise: if a behaviour is global-singleton, the shared component takes a
  callback rather than seizing the singleton.

**Grid**
- 1 art pixel = **2 dp** (`var(--px)`); the art canvas is 180 art px wide.
- Every size, offset, and gap is a multiple of 2 dp.
- Assets are authored at **1×** and displayed at exactly **2×**.

**Colour**
- Semantic tokens only — `var(--bg-*)`, `var(--accent-*)`, `var(--text-*)`,
  `var(--rarity-*)`. No hex, no `rgb()`, no `rgba()` in a `.module.css`.
- Need a shade that doesn't exist? Add a ramp step to `tokens.css`. Never
  inline a one-off colour.
- **A misspelled token is silently fatal.** `var(--nope)` invalidates its whole
  declaration; inside an `animation`/`transition` shorthand it kills the effect
  entirely, with no warning. `no-undefined-token` catches it.

**Pixel discipline**
- No gradients — use a 2-colour ordered dither or a flat ramp step.
- No `border-radius`. Corners belong to the `Panel` border. Only
  `var(--r-pill)`, `50%`, and `0` survive, for functional circles.
- No blurred shadows. Depth is one hard 1-art-px offset in a darker step.
- `image-rendering: pixelated` on every element that shows art.
- Glow (`--glow-*`) is licensed on **UI chrome only** — never on sprite art.

**Motion**
- Anything made of pixels animates with `steps(n)`.
- Only non-art chrome (backdrop dim, glow pulse) may use a continuous ease.
- `reduceAnimations` collapses every duration to `0ms` (wired via
  `data-reduce-animations` on the root).

**Structure**
- One screen/component = one `.tsx` + one `.module.css` beside it.
- Module ≤ 150 lines, component ≤ 100, function ≤ 30 (CLAUDE.md).
- Layout lives in the CSS module, not a React `style` prop — except genuinely
  dynamic values (computed scale, camera offset, a per-instance accent).
- Every screen renders `<ScreenShell>` outermost; navigate via `SCREEN_IDS`.
- Minimum touch target 48 dp (`var(--touch-min)`), including padded hit areas.
- Any tappable element inside a scroll container uses `useScrollAwarePointer`.

---

## Workflows

### 1. Build or change UI

1. **Walk the reuse ladder.** Stop at the first rung that works.
2. If you land on rung 4, **update `docs/ui/01-components.md` first**, then
   build it in `components/`, then consume it.
3. Check `references/migration.md` — is the thing you're touching mid-migration?
   Convert it as part of the change rather than extending the old shape.
4. Write `.tsx` + `.module.css`. Tokens only, grid-multiple sizes.
5. `npm run validate:ui`, then `npx tsc --noEmit -p tsconfig.app.json`.
6. If you removed violations, ratchet: `npm run validate:ui:baseline`.
7. Verify it *looks* right. The validator cannot see layout — render the real
   compiled CSS and screenshot it before claiming done.

### 2. Audit existing UI

`npm run validate:ui` reports mechanical violations against the baseline.
Then read the file against § non-negotiables — the validator cannot see
touch-target sizes, `style`-prop layout, missing `ScreenShell`, non-stepped
sprite motion, or **duplicated component logic that doesn't touch
`--bg-overlay`**.

Report findings grouped by file with the fix. Prefer migrating a whole file to
clean so its baseline entry disappears entirely.

### 3. Mock up before coding

For a new screen or significant relayout, lay it out visually first — cheaper
to move a panel on a canvas than to rewrite JSX and CSS. Invoke the `design`
skill, artboards at **360 × 640**, reflecting the real grid (48 dp cells, 96 dp
sprites, 8 dp panel borders). Skip for small changes.

### 4. Author pixel art assets

`references/assets.md` leads with the **sprite budget** — a character is fully
playable on two poses. Read that before drawing anything.

---

## Validator

```
npm run validate:ui            # check — fails on NEW violations only
npm run validate:ui:baseline   # re-record after improving a file
```

`ui-baseline.json` records the violations that predate the design system. The
check is a **ratchet**: a new violation fails, and a file that improved without
the baseline being tightened also fails. The baseline can only shrink. When it
empties, wire `validate:ui` into `prebuild` beside `validate:data`.

| Rule | Catches |
|---|---|
| `no-duplicate-chrome` | A screen re-implementing `Sheet`/`PromptOverlay` backdrop |
| `no-hardcoded-colour` | hex / `rgb()` / `rgba()` outside `tokens.css` |
| `no-undefined-token` | `var(--x)` with no definition and no fallback |
| `no-border-radius` | Rounded corners outside functional circles |
| `no-gradient` | Any gradient |
| `module-line-limit` | Files over 150 lines |

Rules live in `genesis-web/src/__tests__/uiRules.ts`. Add one when a convention
becomes mechanically checkable — **but only with zero false positives**. A noisy
check gets ignored, which is worse than no check. Prefer a precise semantic
signal (a token that means one thing) over a structural guess (`inset: 0`,
which legitimately appears on backgrounds and vignettes).

---

## Migration stance

`docs/ui/01-components.md` describes the target, not today.
Built: ramp/pixel-font tokens, `Panel`, `PixelButton`, `Sheet`,
`PromptOverlay`, `Toaster`, segmented `ResourceBar` — the whole
consolidation table — plus retiring `--r-sm`…`--r-xl`.
Next: the per-screen sweep (step 9 in `references/migration.md`) — two
hand-rolled HP bars (`BattleScreen`, `DungeonScreen`) that should compose
`ResourceBar` instead are the first candidates.

**A shape that blocks is not a variant of a shape that doesn't.** `Toaster`'s
spec originally carried a blocking `fatal` tone; implementing it would have
duplicated `PromptOverlay` inside `Toaster`. When a "variant" needs its own
backdrop, actions, or focus behaviour, it is a different component — compose,
do not overload.

Do not write against primitives that don't exist yet, and do not rewrite the
whole UI at once. Convert incrementally in dependency order, ratcheting the
baseline down as you go.
