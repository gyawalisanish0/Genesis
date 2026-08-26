# spritegen — Genesis character art

Draws Genesis battle sprites, portraits and their `animations.json` from Python.

```bash
python3 tools/spritegen/generate.py hugo_001
python3 tools/spritegen/generate.py --all --sheet /tmp/sheet.png
python3 tools/spritegen/generate.py hugo_001 --dry-run --sheet /tmp/sheet.png
```

Requires Pillow. Nothing else.

---

## Why a program and not a model

`docs/art/sprite-prompt.md` is four sections of scaffolding built to drag a
generated image back onto the pixel grid — draw the grid itself at 20× so the
downscale is a decimation, remap onto a ramp strip, count the colours, re-prompt
when the count is wrong. Every one of those steps exists because the model can
anti-alias, invent a colour, or land a pixel off the lattice.

This cannot. It places logical pixels from named ramp steps, so:

- no anti-aliasing, gradient, or soft edge is representable
- no colour outside `docs/ui/00-design-system.md` § 3 can appear
- every pixel is on the grid by construction

Which means there is no verification step. There is nothing to check.

The other half is consistency. The pose table in the prompt doc describes most
frames as *changes to another frame* — "identical to the previous idle pose,
raised by exactly one logical pixel", "frame n of a four-step fall". Written as
derivations in `poses.py` those come out exactly consistent every time, which is
the first property a hand-drawn or generated frame set loses.

What it does **not** give you is an expressive, hand-drawn face. It gives
systematic, readable silhouettes. The two approaches can coexist: art authored
another way drops into the same paths and this retires quietly.

---

## Layout

| File | Holds |
|---|---|
| `palette.py` | the ten ramps, transcribed from the design doc; `Material` |
| `canvas.py` | the 48×48 grid, drawing primitives, the shading pass |
| `rig.py` | the shared humanoid skeleton and how a body is laid down |
| `poses.py` | idle / attack / hurt / death, as derivations of a rest pose |
| `portrait.py` | the 32×32 bust — drawn at portrait scale, not scaled up |
| `character.py` | what a character definition has to provide |
| `characters/` | one module per character, plus the roster |
| `generate.py` | CLI: writes the PNGs and the manifest |

Layered like the app is: `palette → canvas → rig → poses → characters →
generate`. Nothing imports leftward.

---

## How a character is defined

Three things, in `characters/<name>.py`:

**Materials** — a surface is a ramp step, not a colour, so shading can walk one
step either way. A tone may cross ramps: Genesis renders on `hull-1`/`hull-2`
backgrounds, and a dark garment shaded only within `hull` reads as a hole in the
screen, so the outfit's lit step borrows `bone-1` as a rim.

```python
'outfit': Material('hull', 4, lit=('bone', 1), shade=2),
```

**A kit per view** — which material each body part uses, plus proportions. The
back view is its own kit, not a mirrored front one: no face, and hair over the
whole skull.

**A `decorate` hook** — anything the rig cannot express. It gets the canvas
after the body is drawn and may put anything anywhere. Hugo's ANBOT blade is the
case it exists for: nanites that form out of the forearm on the strike frame and
are not there on any other. No `weapon` concept in the rig, because exactly one
character needs that one.

---

## Two things that are easy to get wrong

**Facing.** Poses are authored facing right, but both slots ship facing *left*.
The arena puts the enemy upper-right and the ally lower-left, and
`SpriteActor.module.css` already mirrors the ally with `scaleX(-1)`. So
left-facing art gives an enemy looking down at the ally and, after that mirror,
an ally looking up at the enemy. Authored facing right, the two stand back to
back. `frame_image` applies the flip.

**Light.** That same CSS mirror flips the ally's lighting with it. The back view
is therefore drawn lit from the *right*, which the mirror turns back into the
upper-left light the enemy has. Without it the two fighters are lit from
opposite sides on the same stage.

---

## Iterating

`--sheet` writes every frame of a character in one image at 6×, nearest
neighbour, on the arena's background colour. Look at that, not at a single
frame — most defects are only visible as an inconsistency across a set.

```bash
python3 tools/spritegen/generate.py hugo_001 --dry-run --sheet /tmp/hugo.png
```

`--dry-run` draws without writing into `public/`, so you can look before you
commit anything.

To judge the on-screen result, remember the ally is mirrored: flip the `_back`
frames yourself before comparing the two.

---

## Where the output goes

Paths are fixed by `CLAUDE.md` § Data Architecture.

```
genesis-web/public/images/characters/{defId}/{state}/{n}.png       48 × 48
genesis-web/public/images/characters/{defId}/{state}_back/{n}.png  48 × 48
genesis-web/public/images/characters/{defId}/portrait.png          32 × 32
genesis-web/public/data/characters/{defId}/animations.json
```

The manifest is generated from the same pose table the frames are, so it cannot
claim a frame count the folder does not have.

---

## Adding a character

1. Read `docs/characters/in-game/<unit>.md` first. The appearance section is the
   spec — Hugo carries no weapon at rest because his document says the danger is
   invisible until it isn't, not because a weapon was hard to draw.
2. Copy `characters/hugo.py`, replace the materials and the kit.
3. Add it to `ROSTER` in `characters/__init__.py`.
4. `--dry-run --sheet` until it reads, then generate for real.

The accent ramp suggestions per character are in `docs/art/sprite-prompt.md`
§ Roster. They exist so two characters on screen together do not read as the
same silhouette in the same colour.
