# Character sprite generation — Gemini (Nano Banana)

How to produce Genesis battle sprites with Gemini's image model and land them
on the 2 dp pixel grid the design system requires.

> For the procedural alternative — Python drawing straight onto the grid, no
> downsample, no remap, no colour count to verify — see
> `tools/spritegen/README.md`. The roster table at the bottom of this file
> (accent ramp per character) applies to both.

Sizes and palette come from `docs/ui/00-design-system.md`; the sprite budget
comes from the `genesis-ui` skill's `references/assets.md`. This file is the
prompting procedure.

---

## The core problem

Gemini does not emit a 48 × 48 image. It emits a large, smoothly-shaded picture.
Downscaling that directly produces mush: anti-aliased edges, hundreds of
colours, and a silhouette that dissolves at 48 px.

The fix is to make the model draw **the pixel grid itself** — each logical pixel
as a large flat square of uniform colour — so the downscale is a lossless
integer decimation rather than a resample.

```
ask for 960 × 960  →  48 × 48 logical grid  →  each pixel is a 20 × 20 flat block
                   →  nearest-neighbour decimate by 20  →  exact 48 × 48
```

Everything in the prompt below exists to protect that property.

---

## Prompt template

Fill the four `{{...}}` slots. Send the **Style contract** every time — models
drift across turns, and a partial restatement drifts fastest.

````text
Draw a single character as TRUE PIXEL ART on an explicit pixel grid.

═══ CANVAS AND GRID (highest priority — violating this makes the output unusable)
• Output a 960 × 960 image representing a 48 × 48 logical pixel grid.
• Every logical pixel is EXACTLY a 20 × 20 block of ONE flat, uniform colour.
• Block edges are perfectly axis-aligned and align to a strict 20 px lattice.
• NO anti-aliasing. NO gradients. NO soft edges. NO blur. NO noise. NO texture.
• Two adjacent blocks either share a colour exactly or differ sharply. Never
  blend between them.
• Background: fully transparent. If transparency is unavailable, use pure
  magenta #FF00FF as a flat key colour and nothing else.

═══ PALETTE (hard limit)
• Use AT MOST 6 opaque colours plus transparency, chosen ONLY from this list:
{{PALETTE}}
• Shade by stepping to a neighbouring entry in the same ramp. Never invent or
  mix a new colour. Never use black or white unless listed above.

═══ SUBJECT
{{CHARACTER}}

═══ POSE
{{POSE}}

═══ FRAMING
• Full body, centred horizontally, feet resting on the bottom edge of the grid.
• The figure fills 40–46 of the 48 rows. Leave 1–2 empty rows of margin.
• Orthographic, eye-level, no perspective, no cast shadow, no ground plane.
• {{FACING}}

═══ READABILITY AT 48 PX (this is a 48-pixel-tall character — act accordingly)
• Silhouette first: the pose must be identifiable as a black shape alone.
• No detail smaller than one logical pixel. No thin outlines, no single-pixel
  filigree, no text, no small insignia.
• Head roughly 8–10 logical pixels tall. Hands and weapons are chunky blocks,
  not tapered points.
• High contrast between the figure and empty space, and between adjacent
  materials (skin / armour / weapon).

═══ DO NOT
• No drop shadows, glows, bloom, outer light, rim light, or lens effects.
• No painterly, cel-shaded, vector, 3D-rendered, or "HD pixel" styles.
• No background scenery, ground, frame, border, grid lines, label, watermark,
  colour swatch, or reference sheet layout.
• No multiple views, no turnaround, no extra characters. Exactly one figure.
````

### `{{PALETTE}}`

Paste the ramps the character needs — hull plus one accent is usually enough.
Fewer ramps offered means fewer colours invented.

```
hull  (chrome, dark neutrals)  #02080e #061422 #0a1d30 #0f2840 #1e4060
bone  (skin, light neutrals)   #3a6a92 #5a9dc0 #8fc4dd #d8f0ff #ffffff
cyan  (brand, energy)          #004a5c #0089a8 #00c2e6 #00e5ff #9df4ff
azure (information)            #002d4d #0067b3 #0099ff #7ac6ff
blood (damage, hostility)      #4d0a1c #a3123a #ff2257 #ff7a99
moss  (healing, growth)        #00432c #009962 #00ff9f #8fffd0
amber (elite, legendary)       #4d3d00 #b39a00 #ffe100 #fff08a
flare (warning, heat)          #4d2a00 #b36200 #ff8c00 #ffbe73
void  (arcane, evasion)        #390049 #8000ad #bf00ff #dd8aff
rust  (Mars terrain)           #1c0d06 #3d1f10 #5c2f18 #8a4526 #cc7040
```

### `{{FACING}}`

Two views per character. The ally slot shows the party from behind, the enemy
slot faces the player — the GBA duel framing.

| Slot | Line to paste |
|---|---|
| Enemy / front | `Facing the viewer, front three-quarter view. Face visible.` |
| Ally / back | `Seen from directly behind, back view. Face NOT visible; read the character from hair, shoulders, and gear silhouette alone.` |

### `{{POSE}}`

Author poses in this order and stop when the character is playable. Only
`playAnim` needs art — the other fourteen `AnimPhase` types are free motion.

| Pose | Frames | `{{POSE}}` text |
|---|---|---|
| `idle` 0 | 1 | `Standing at rest, weight settled, weapon lowered but ready. Neutral combat stance.` |
| `idle` 1 | 1 | `Identical to the previous idle pose, with the whole body raised by exactly one logical pixel and the shoulders one pixel higher. A breathing frame — no other change.` |
| `attack` 0 | 1 | `Wind-up: weight shifted back, weapon drawn back, torso coiled.` |
| `attack` 1 | 1 | `Strike: full extension toward the right edge, weapon at the furthest reach of the swing.` |
| `attack` 2 | 1 | `Follow-through: weapon past the target, body rotated through, off-balance forward.` |
| `hurt` 0–1 | 2 | `Recoiling from a blow — head snapped back, arms loose, weight on the back foot.` |
| `death` 0–3 | 4 | `Collapsing: frame {{n}} of a four-step fall from standing to lying flat.` |

**Consistency across frames matters more than any single frame.** Generate a
pose set in one conversation, referring back to the first image, and state the
exact palette each time. Re-prompting from scratch produces a different
character.

---

## Post-processing

The model's output is a 960 × 960 render of a grid. These steps make it the
actual asset. Nothing here is optional — step 2 is what guarantees the file is
on-grid rather than merely looking like it.

```bash
# 1. If a magenta key was used instead of alpha, make it transparent.
magick in.png -transparent '#FF00FF' keyed.png

# 2. Decimate to the logical grid. -filter point is nearest-neighbour: it
#    samples one pixel per block instead of averaging, so no new colours appear.
magick keyed.png -filter point -resize 48x48 small.png

# 3. Snap to the ramps. Build ramp.png as a 1-px-tall strip of the exact
#    hex values offered in {{PALETTE}}, then map onto it.
magick small.png -dither None -remap ramp.png sprite.png

# 4. Verify: colour count must be <= 7 (6 opaque + transparent).
magick identify -format '%k unique colours\n' sprite.png
```

If step 4 reports more than 7, the model anti-aliased. Re-prompt with the
CANVAS AND GRID block restated first — do not try to fix it by quantising
harder, which eats the silhouette.

---

## Where files go

Paths and the manifest contract are fixed; see `CLAUDE.md` § Data Architecture.

```
public/images/characters/{defId}/{state}/{n}.png   48 × 48, 0-indexed
public/images/characters/{defId}/portrait.png      32 × 32
public/images/characters/{defId}/UI/Status/{key}.png  16 × 16
public/data/characters/{defId}/animations.json     AnimationManifest
```

Minimum viable manifest — one attack pose serving every skill via `tagMap`:

```jsonc
{
  "type": "animations",
  "defId": "{{defId}}",
  "display": { "sourceWidth": 48, "sourceHeight": 48,
               "scale": 1, "anchorX": 0.5, "anchorY": 1.0 },
  "tagMap": { "melee": "attack", "ranged": "attack", "energy": "attack" },
  "animations": {
    "idle":   { "frames": 2, "frameRate": 1.25, "repeat": -1 },
    "attack": { "frames": 3, "frameRate": 12,   "repeat": 0  }
  },
  "projectile": null
}
```

`display.scale` is authored as `1` and ignored by the renderer regardless: the
slot is a fixed 96 dp and the frame is fitted to it. The previous manifest
carried `sourceWidth: 512, scale: 0.32` from the deleted Phaser renderer.

Every unauthored state resolves to `null` and falls back cleanly — pinned by
`core/battle/__tests__/AnimationResolver.minimal.test.ts`.

---

## Roster

| defId | Name | Class | Rarity | Suggested accent ramp |
|---|---|---|---|---|
| `hugo_001` | Hugo Rekrot | Warrior | 4 | void — rarity-4 is purple |
| `husty_001` | Husty | Caster | 3 | cyan |
| `tara_001` | Tara Kuronage | Caster | 6 | blood — rarity-6 |
| `celan_001` | Celan | Commander | 5 | flare — rarity-5 |
| `kiragen_combatant_001` | Kiragen Combatant | Ranger | 3 | moss |
| `kiragen_controller_001` | Kiragen Controller | Enchanter | 3 | azure |
| `netrolume_elite_001` | Netrolume Elite | Warrior | 2 | amber |
| `netrolume_grunt_001` | Netrolume Grunt | Warrior | 1 | rust |

Accent choice is a starting point, not a rule — it exists so two characters on
screen together do not read as the same silhouette in the same colour.

---

## Worked example

`{{CHARACTER}}` for the grunt, front-facing idle:

```text
A low-ranking Netrolume soldier. Bulky matte armour over a dark bodysuit,
blank full-face visor, short energy carbine held across the chest. Heavy
shoulders, thick boots, no cape or loose cloth. Anonymous and mass-produced —
this is the weakest enemy in the game and should look disposable.
Build it from the hull ramp with rust as the single accent.
```

Keep `{{CHARACTER}}` to material, silhouette and role. Describing mood or
lighting invites the shading the grid rules are there to prevent.
