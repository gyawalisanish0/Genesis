"""Generate a character's sprite set and its manifest.

    python3 tools/spritegen/generate.py hugo_001
    python3 tools/spritegen/generate.py --all --sheet

Writes into genesis-web/public/ at the paths CLAUDE.md § Data Architecture
fixes. The manifest is generated from the same pose table the frames are, so
`animations.json` cannot claim a frame count the folder does not have.
"""

import argparse
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))

from PIL import Image

from canvas import Canvas
from character import VIEWS, Character
from characters import ROSTER
from portrait import PORTRAIT_SIZE, draw_portrait
from poses import STATES
from rig import draw_figure

REPO_ROOT  = Path(__file__).resolve().parents[2]
IMAGE_ROOT = REPO_ROOT / 'genesis-web' / 'public' / 'images' / 'characters'
DATA_ROOT  = REPO_ROOT / 'genesis-web' / 'public' / 'data' / 'characters'

# The engine reads `{state}_back` for the ally slot; see AnimationResolver.
BACK_SUFFIX = '_back'


def frame_image(character: Character, view: str, state: str, index: int) -> Image.Image:
    """One finished frame: rig, overrides, then the flip onto the stage.

    Poses are authored facing right because that is how the pose table in
    docs/art/sprite-prompt.md reads, but both slots need art that faces *left*.
    The arena puts the enemy upper-right and the ally lower-left, and
    SpriteActor.module.css already mirrors the ally with `scaleX(-1)` — so
    left-facing art gives an enemy looking down at the ally and, after that
    mirror, an ally looking up at the enemy. Authored facing right, the two of
    them stand back to back.
    """
    _, pose_fn = STATES[state]
    pose   = pose_fn(index)
    canvas = Canvas(light_from_right=(view == 'back'))
    draw_figure(canvas, pose, character.kits[view])
    character.decorate(canvas, pose, state, index, view)
    return canvas.mirrored().to_image(character.materials)


def state_key(state: str, view: str) -> str:
    return state if view == 'front' else f'{state}{BACK_SUFFIX}'


def write_character(character: Character) -> list[str]:
    """Write every frame, the portrait and the manifest. Returns what it wrote."""
    written: list[str] = []
    root = IMAGE_ROOT / character.def_id

    for view in VIEWS:
        for state, (count, _) in STATES.items():
            folder = root / state_key(state, view)
            folder.mkdir(parents=True, exist_ok=True)
            for index in range(count):
                path = folder / f'{index}.png'
                frame_image(character, view, state, index).save(path)
                written.append(str(path.relative_to(REPO_ROOT)))

    portrait_path = root / 'portrait.png'
    draw_portrait(character).to_image(character.materials).save(portrait_path)
    written.append(str(portrait_path.relative_to(REPO_ROOT)))

    manifest_path = DATA_ROOT / character.def_id / 'animations.json'
    manifest_path.parent.mkdir(parents=True, exist_ok=True)
    manifest_path.write_text(json.dumps(build_manifest(character), indent=2) + '\n')
    written.append(str(manifest_path.relative_to(REPO_ROOT)))

    return written


def build_manifest(character: Character) -> dict:
    """The AnimationManifest for what was just written.

    `display.scale` is 1 and ignored by the renderer either way — the slot is a
    fixed 96 dp and the frame is fitted to it. See docs/art/sprite-prompt.md.
    """
    animations = {}
    for state, (count, _) in STATES.items():
        rate, repeat = _playback(state)
        for view in VIEWS:
            animations[state_key(state, view)] = {
                'frames': count, 'frameRate': rate, 'repeat': repeat,
            }

    return {
        'type':  'animations',
        'defId': character.def_id,
        'display': {
            'sourceWidth': 48, 'sourceHeight': 48,
            'scale': 1, 'anchorX': 0.5, 'anchorY': 1.0,
        },
        'idleSwapBelowHpPercent': 0.3,
        'meleeDashDx': 50,
        # Every skill resolves to the one attack pose. A skill that later earns
        # its own frames gets an `animations.skills` entry and overrides this.
        'tagMap': {'melee': 'attack', 'ranged': 'attack', 'energy': 'attack',
                   'physical': 'attack'},
        'animations': animations,
        'projectile': None,
    }


def _playback(state: str) -> tuple[float, int]:
    """Frame rate and repeat per state. Idle loops slowly; everything else
    plays once and holds its last frame."""
    if state == 'idle':
        return 1.25, -1
    return (12, 0) if state == 'attack' else (8, 0)


def contact_sheet(character: Character, scale: int = 6) -> Image.Image:
    """Every frame in one image, for looking at the whole set at once.

    Nearest-neighbour by an integer factor, so what you are looking at is the
    real pixels — a smoothed preview would hide exactly the defects worth
    catching.
    """
    columns = max(count for count, _ in STATES.values())
    rows    = len(STATES) * len(VIEWS)
    sheet   = Image.new('RGBA', (columns * 48 * scale, rows * 48 * scale), (6, 20, 34, 255))

    row = 0
    for view in VIEWS:
        for state, (count, _) in STATES.items():
            for index in range(count):
                frame = frame_image(character, view, state, index)
                frame = frame.resize((48 * scale, 48 * scale), Image.NEAREST)
                sheet.alpha_composite(frame, (index * 48 * scale, row * 48 * scale))
            row += 1
    return sheet


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('def_ids', nargs='*', help='character ids; omit with --all')
    parser.add_argument('--all', action='store_true', help='every character in the roster')
    parser.add_argument('--sheet', metavar='PATH', help='also write a contact sheet here')
    parser.add_argument('--dry-run', action='store_true', help='draw but write nothing')
    args = parser.parse_args()

    ids = list(ROSTER) if args.all else args.def_ids
    if not ids:
        parser.error('name at least one character, or pass --all')

    for def_id in ids:
        if def_id not in ROSTER:
            parser.error(f'unknown character {def_id!r}; roster is {", ".join(ROSTER)}')
        character = ROSTER[def_id]

        if args.dry_run:
            print(f'{def_id}: {sum(c for c, _ in STATES.values()) * len(VIEWS)} frames (dry run)')
        else:
            for path in write_character(character):
                print(path)

        if args.sheet:
            contact_sheet(character).save(args.sheet)
            print(args.sheet)


if __name__ == '__main__':
    main()
