# Migration — current code → documented target

`docs/ui/01-components.md` describes the target. This file records what
actually exists today and the order to converge them.

Convert **incrementally**: when a task touches a screen, migrate that screen's
share of the current step. Do not attempt a big-bang rewrite — the battle
screen alone is 800 lines and every conversion risks the engine contract.

---

## Current → target

| Exists today | Becomes | Notes |
|---|---|---|
| ~~`PrimaryButton`~~ | **`PixelButton`** ✅ | Done. Had one call site (`ChestOverlay`); `PrimaryButton` deleted. |
| ~~`SkillInfoOverlay`, `StatusInfoOverlay`, `ChestOverlay`, `BattleLogOverlay`~~ | **`Sheet` + content** ✅ | Done. All four now wrap `Sheet`; their bespoke backdrop/card/animation/close CSS is gone. `Sheet` gained `placement: bottom\|centre` and `accent`; back button stays a screen concern (see below). |
| ~~`TeamCollisionOverlay`, `ClashQteOverlay`~~ | **`PromptOverlay` + content** ✅ | Done. Chrome shared; bodies kept. `PromptOverlay` takes input via `actions` (NOW/LATER) *or* `onBackdropTap` (QTE needle) — a prompt whose body *is* the interaction gets no buttons. |
| ~~`HintToaster`, `ErrorToaster`, inline AP chip~~ | **`Toaster` (3 tones)** ✅ | Done. A *fourth* duplicate was found inline in `BattleScreen`. `BattleErrorToast` did **not** become a Toaster tone — it blocks, so it composes `PromptOverlay` instead. |
| Battle screen's own portrait circle | `UnitPortrait size="lg"` | Already swapped; the bespoke circle CSS can go once glow moves onto the component. |
| ~~`ResourceBar` continuous fill~~ | **segmented fill** ✅ | Done. Fixed `RESOURCE_BAR_SEGMENT_COUNT` (20) grid of blocks with `var(--px)` gaps, not a measured pixel width. HP fill retones at the low/critical thresholds; shield draws extra segments past value. `--r-pill` on the old track/fill is gone too — one more consumer off the retired radii. |
| ~~`--r-sm` … `--r-xl` in `tokens.css`~~ | **deleted** ✅ | Done. All 32 consumers converted: decorative rounded rects square off (`0`, i.e. the declaration is removed), true chip/badge shapes (`skillCdChip`, `objectivePill`, `hpPill`) move to `var(--r-pill)`. `--r-pill` stays permanently. |
| ~~flat hex in `tokens.css`~~ | **ramp steps** ✅ | Done. Ten ramps added; every semantic token repointed; names unchanged. |
| ~~`--font-sans` only~~ | **`--font-pixel` + `--font-sans`** ✅ | Done. Neither face is bundled yet — both degrade to system stacks. |

Already done: ASCII render layer removed; `SpriteArena` owns
`BattleArenaHandle`; `UnitPortrait` renders `portrait.png`; tiles fill from
`TilesetDef.tiles[id].color`. **Steps 1–8 below are complete** — ramps and
`--font-pixel` shipped; `Panel` exists with all five variants; `PixelButton`
replaced `PrimaryButton`; `Sheet` replaced the four info overlays;
`PromptOverlay` replaced the two decision overlays and now also backs the
blocking battle error; `Toaster` replaced three toasts plus an inline chip;
`ResourceBar` draws a segmented grid instead of a continuous fill; `--r-sm`
… `--r-xl` are gone from `tokens.css` and `no-border-radius` is at zero.
`--px` (1 art pixel = 2 dp) was added so grid multiples are expressible.
`reduceAnimations` is now mirrored to the root element so the stepped-motion
tokens actually collapse.

---

## Order

Dependency-driven. Each step should end with `npm run validate:ui:baseline`
so the ratchet tightens.

1. ~~**Tokens**~~ ✅ — add the ten ramps, repoint every semantic token at a ramp
   step, add `--font-pixel`. Nothing else can be correct until colour is
   token-only. No component changes yet; purely additive plus repointing.
2. ~~**`Panel`**~~ ✅ — the nine-slice box. Everything visual composes from it.
   Ship it with the five variants before converting any consumer.
3. ~~**`PixelButton`**~~ ✅ — replaces `PrimaryButton`. Mechanical: same props, new
   surface. Migrate all call sites in one pass; there are few.
4. ~~**`Sheet`**~~ ✅ — collapsed all four overlays (skill/status/log/chest).
   Key finding: `backButtonRegistry` holds one handler at a time, so `Sheet`
   must NOT self-register — `BattleScreen`'s single `useBackButton` still owns
   the priority chain (skill → chip → log → pause). `Sheet` is presentational;
   the screen wires hardware-back to `onClose`.
5. ~~**`PromptOverlay`**~~ ✅ — collapsed both battle decision overlays. Never
   dismissible (no ✕/Esc/backdrop-close) because the engine blocks on the
   choice; that is pinned by tests. Input arrives via `actions` **or**
   `onBackdropTap`, never forced into buttons.
6. ~~**`Toaster`**~~ ✅ — collapsed three toasts *plus* an inline one-off found
   during the work. Key call: the spec's `fatal` tone was dropped. A blocking
   message needs a backdrop and an actions row, so implementing it inside
   `Toaster` would have duplicated `PromptOverlay` — the exact anti-pattern
   this migration exists to remove. `BattleErrorToast` composes `PromptOverlay`
   and keeps its countdown + auto-navigate.
7. ~~**`ResourceBar` segmentation**~~ ✅ — visual only, no API change. A fixed
   20-block CSS grid (`RESOURCE_BAR_SEGMENT_COUNT`) replaced the percentage-width
   fill; `gap: var(--px)` draws the block seams, so no gradient or measured
   pixel math was needed. HP retones (`flare-3` under 50%, `blood-2` under 25%)
   via a class on the track, matching `01-components.md`'s fill table. Track
   chrome switched from `--bg-elevated` to the `Panel` sunken tokens.
8. ~~**Retire radii**~~ ✅ — deleted `--r-sm`…`--r-xl` from `tokens.css`.
   32 consumers converted across 15 files: decorative rects square off,
   genuine chip/badge shapes (`skillCdChip`, `objectivePill`, `hpPill`,
   `StatusChipBar.chipCompact` — the last one squared, matching its full-size
   sibling) move to `var(--r-pill)`. Along the way, `ALLOWED_RADIUS` in
   `uiRules.ts` turned out to be unanchored — `border-radius: 0.25rem`
   satisfied it because the bare `0` alternative matched as a prefix with no
   boundary check. Fixed and re-baselined; that surfaced (and this step also
   fixed) 9 previously-invisible violations in `CampaignScreen` and
   `DungeonScreen` that predate this migration entirely. `no-border-radius`
   is genuinely empty in `ui-baseline.json` now, not just empty-looking.
9. **Per-screen sweep** — remaining hardcoded colours, gradients, and the
   oversized modules (`BattleScreen` 805, `BattleContext` 668,
   `DungeonContext` 527 lines). Two hand-rolled HP bars turned up during step
   8 (`BattleScreen.targetPickerBarTrack/Fill`, `DungeonScreen.hpBarTrack/Fill`)
   that duplicate `ResourceBar` and should compose it instead — good first
   items for this step.

Steps 1–8 are complete — every duplicated component in the original
consolidation table is gone, `ResourceBar` draws as blocks instead of a bar,
and `no-border-radius` is at zero. **Step 9 (the per-screen sweep) is next.**

---

## Rules while migrating

- **Never** write against a primitive that doesn't exist yet. If the task
  needs `Sheet` and `Sheet` isn't built, either build it (step 4) or follow
  the current pattern and leave a note — do not invent a third pattern.
- Keep the engine contract intact. `BattleArenaHandle`, `DungeonArenaHandle`,
  and `BattleEngineCallbacks` are driven by `core/`; UI changes must not
  alter their shapes. Full battle suite (`npx vitest run`) must stay green.
- Overlays register back-button handlers. When collapsing them into `Sheet`,
  verify pause/resume in battle still cannot be escaped by the back button —
  only LEAVE BATTLE exits (CLAUDE.md § Input Handling).
- A migration that reduces violations **must** be followed by
  `npm run validate:ui:baseline`, or the stale-baseline check fails.
