"""
gen_placeholders.py — one-time dev tool to generate placeholder image assets.

Run once before launching the app for the first time:
    python tools/gen_placeholders.py

Requires Pillow (pip install Pillow). Not added to requirements.txt — dev-only.
Outputs PNG files to assets/images/3x/ (3× / xxhdpi reference scale).
"""
from __future__ import annotations

import os
import sys
from pathlib import Path


def _ensure_pillow() -> None:
    try:
        from PIL import Image, ImageDraw  # noqa: F401
    except ImportError:
        print('Pillow is required. Install it with:  pip install Pillow')
        sys.exit(1)


def _draw_circle_image(path: Path, size: int, colour: str) -> None:
    from PIL import Image, ImageDraw

    img = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    draw.ellipse((0, 0, size - 1, size - 1), fill=colour)
    img.save(path)
    print(f'  Created: {path}')


def _draw_square_image(path: Path, size: int, colour: str) -> None:
    from PIL import Image, ImageDraw

    img = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    radius = size // 8
    draw.rounded_rectangle((0, 0, size - 1, size - 1), radius=radius, fill=colour)
    img.save(path)
    print(f'  Created: {path}')


_PLACEHOLDERS: list[dict] = [
    {
        'filename': 'portrait_placeholder_ally.png',
        'shape': 'circle',
        'size': 156,
        'colour': '#3A7BD5',
    },
    {
        'filename': 'portrait_placeholder_enemy.png',
        'shape': 'circle',
        'size': 156,
        'colour': '#C0392B',
    },
    {
        'filename': 'icon_skill_placeholder.png',
        'shape': 'square',
        'size': 84,
        'colour': '#6C3483',
    },
    {
        'filename': 'icon_basic_atk.png',
        'shape': 'square',
        'size': 84,
        'colour': '#E67E22',
    },
    {
        'filename': 'icon_end_turn.png',
        'shape': 'square',
        'size': 84,
        'colour': '#566573',
    },
]


def main() -> None:
    _ensure_pillow()

    repo_root = Path(__file__).resolve().parent.parent
    out_dir = repo_root / 'assets' / 'images' / '3x'
    out_dir.mkdir(parents=True, exist_ok=True)

    print(f'Writing placeholder images to {out_dir}/')
    for spec in _PLACEHOLDERS:
        dest = out_dir / spec['filename']
        if dest.exists():
            print(f'  Skipped (exists): {dest}')
            continue
        if spec['shape'] == 'circle':
            _draw_circle_image(dest, spec['size'], spec['colour'])
        else:
            _draw_square_image(dest, spec['size'], spec['colour'])

    print('Done.')


if __name__ == '__main__':
    main()
