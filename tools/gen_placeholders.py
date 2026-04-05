"""
gen_placeholders.py — dev tool to generate labelled placeholder image assets.

Run once before launching the app for the first time:
    python tools/gen_placeholders.py

Requires Pillow (pip install Pillow). Not added to requirements.txt — dev-only.

Output structure:
    assets/images/
        3x/   — 1080px reference (xxhdpi); primary source
        2x/   — 720px (xhdpi)
        1x/   — 360px (mdpi)

All sizes below are 3x pixel values. 2x and 1x are auto-downscaled.
"""
from __future__ import annotations

import sys
from pathlib import Path
from typing import Callable


# ---------------------------------------------------------------------------
# Pillow bootstrap
# ---------------------------------------------------------------------------

def _ensure_pillow() -> None:
    try:
        from PIL import Image, ImageDraw, ImageFont  # noqa: F401
    except ImportError:
        print("Pillow is required.  pip install Pillow")
        sys.exit(1)


# ---------------------------------------------------------------------------
# Drawing primitives
# ---------------------------------------------------------------------------

def _font(size: int):
    """Return a PIL font — falls back to default bitmap font if no TTF found."""
    from PIL import ImageFont
    repo_root = Path(__file__).resolve().parent.parent
    candidates = [
        repo_root / "assets" / "fonts" / "Nunito-Bold.ttf",
        repo_root / "assets" / "fonts" / "Nunito-Regular.ttf",
    ]
    for path in candidates:
        if path.exists():
            return ImageFont.truetype(str(path), size)
    # Pillow built-in bitmap font — always available
    return ImageFont.load_default()


def _label_on(draw, text: str, canvas_size: int, colour: str = "#FFFFFF") -> None:
    """Draw centred text label onto an ImageDraw canvas."""
    font_size = max(12, canvas_size // 8)
    fnt = _font(font_size)
    # Measure text bounding box
    bbox = draw.textbbox((0, 0), text, font=fnt)
    tw = bbox[2] - bbox[0]
    th = bbox[3] - bbox[1]
    x = (canvas_size - tw) // 2
    y = (canvas_size - th) // 2
    # Dark shadow for legibility on any background
    draw.text((x + 1, y + 1), text, font=fnt, fill="#00000088")
    draw.text((x, y), text, font=fnt, fill=colour)


def _circle(path: Path, size: int, fill: str, label: str) -> None:
    from PIL import Image, ImageDraw
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    draw.ellipse((0, 0, size - 1, size - 1), fill=fill)
    _label_on(draw, label, size)
    img.save(path)


def _rounded_square(path: Path, size: int, fill: str, label: str) -> None:
    from PIL import Image, ImageDraw
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    radius = size // 6
    draw.rounded_rectangle((0, 0, size - 1, size - 1), radius=radius, fill=fill)
    _label_on(draw, label, size)
    img.save(path)


def _gradient_circle(path: Path, size: int, colour_a: str, colour_b: str, label: str) -> None:
    """Horizontal linear gradient inside a circle mask."""
    from PIL import Image, ImageDraw
    import struct

    def hex_to_rgb(h: str) -> tuple[int, int, int]:
        h = h.lstrip("#")
        return struct.unpack("BBB", bytes.fromhex(h))

    ra, ga, ba = hex_to_rgb(colour_a)
    rb, gb, bb = hex_to_rgb(colour_b)

    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    pixels = img.load()
    for x in range(size):
        t = x / (size - 1)
        r = int(ra + (rb - ra) * t)
        g = int(ga + (gb - ga) * t)
        b = int(ba + (bb - ba) * t)
        for y in range(size):
            cx, cy = size // 2, size // 2
            if (x - cx) ** 2 + (y - cy) ** 2 <= cx ** 2:
                pixels[x, y] = (r, g, b, 255)

    draw = ImageDraw.Draw(img)
    _label_on(draw, label, size)
    img.save(path)


def _downscale(src: Path, dst: Path, scale: float) -> None:
    from PIL import Image
    img = Image.open(src)
    new_size = (max(1, int(img.width * scale)), max(1, int(img.height * scale)))
    img = img.resize(new_size, Image.LANCZOS)
    img.save(dst)


# ---------------------------------------------------------------------------
# Asset specs
# ---------------------------------------------------------------------------
# Each entry: (subdir, filename, draw_fn, size_3x, *args)
# draw_fn signature: (path, size, *args) -> None

_SPECS: list[tuple] = [

    # ── Portraits ────────────────────────────────────────────────────────────
    # Sizes in dp: xl=120, lg=80, md=56, sm=32 → 3x: 360, 240, 168, 96

    ("portraits", "portrait_ally_xl.png",    _circle, 360, "#3A7BD5", "ALLY"),
    ("portraits", "portrait_ally_lg.png",    _circle, 240, "#3A7BD5", "ALLY"),
    ("portraits", "portrait_ally_md.png",    _circle, 168, "#3A7BD5", "ALLY"),
    ("portraits", "portrait_ally_sm.png",    _circle,  96, "#3A7BD5", "A"),

    ("portraits", "portrait_enemy_xl.png",   _circle, 360, "#C0392B", "ENEMY"),
    ("portraits", "portrait_enemy_lg.png",   _circle, 240, "#C0392B", "ENEMY"),
    ("portraits", "portrait_enemy_md.png",   _circle, 168, "#C0392B", "ENEMY"),
    ("portraits", "portrait_enemy_sm.png",   _circle,  96, "#C0392B", "E"),

    ("portraits", "portrait_neutral_xl.png", _circle, 360, "#566573", "NPC"),
    ("portraits", "portrait_neutral_lg.png", _circle, 240, "#566573", "NPC"),

    # ── Skill icons  (28dp → 84px) ──────────────────────────────────────────
    ("icons/skills", "icon_skill_atk.png",     _rounded_square, 84, "#E67E22", "ATK"),
    ("icons/skills", "icon_skill_def.png",     _rounded_square, 84, "#2980B9", "DEF"),
    ("icons/skills", "icon_skill_heal.png",    _rounded_square, 84, "#27AE60", "HEAL"),
    ("icons/skills", "icon_skill_buff.png",    _rounded_square, 84, "#F59E0B", "BUFF"),
    ("icons/skills", "icon_skill_debuff.png",  _rounded_square, 84, "#8B5CF6", "DEBF"),
    ("icons/skills", "icon_skill_dot.png",     _rounded_square, 84, "#C0392B", "DoT"),
    ("icons/skills", "icon_skill_aoe.png",     _rounded_square, 84, "#D35400", "AoE"),
    ("icons/skills", "icon_skill_empty.png",   _rounded_square, 84, "#2C2C3E", "—"),
    ("icons/skills", "icon_basic_atk.png",     _rounded_square, 84, "#E67E22", "BASIC"),
    ("icons/skills", "icon_end_turn.png",      _rounded_square, 84, "#566573", "END"),

    # ── Status icons  (24dp → 72px) ─────────────────────────────────────────
    ("icons/status", "icon_status_burn.png",   _rounded_square, 72, "#E25822", "BRN"),
    ("icons/status", "icon_status_stun.png",   _rounded_square, 72, "#F1C40F", "STN"),
    ("icons/status", "icon_status_poison.png", _rounded_square, 72, "#27AE60", "PSN"),
    ("icons/status", "icon_status_shield.png", _rounded_square, 72, "#2980B9", "SHD"),
    ("icons/status", "icon_status_boost.png",  _rounded_square, 72, "#F59E0B", "BST"),
    ("icons/status", "icon_status_bleed.png",  _rounded_square, 72, "#922B21", "BLD"),
    ("icons/status", "icon_status_regen.png",  _rounded_square, 72, "#1ABC9C", "RGN"),
    ("icons/status", "icon_status_slow.png",   _rounded_square, 72, "#5D6D7E", "SLW"),
    ("icons/status", "icon_status_taunt.png",  _rounded_square, 72, "#C0392B", "TNT"),
    ("icons/status", "icon_status_evasion.png",_rounded_square, 72, "#06B6D4", "EVD"),

    # ── Class icons  (24dp → 72px) ──────────────────────────────────────────
    ("icons/classes", "icon_class_warrior.png", _rounded_square, 72, "#C0392B", "WAR"),
    ("icons/classes", "icon_class_mage.png",    _rounded_square, 72, "#8B5CF6", "MAG"),
    ("icons/classes", "icon_class_rogue.png",   _rounded_square, 72, "#27AE60", "ROG"),
    ("icons/classes", "icon_class_healer.png",  _rounded_square, 72, "#1ABC9C", "HLR"),
    ("icons/classes", "icon_class_tank.png",    _rounded_square, 72, "#2980B9", "TNK"),
    ("icons/classes", "icon_class_archer.png",  _rounded_square, 72, "#E67E22", "ARC"),

    # ── Rarity gems  (16dp → 48px) ──────────────────────────────────────────
    ("icons/rarity", "icon_rarity_1.png", _circle, 48, "#6B7280", "C"),
    ("icons/rarity", "icon_rarity_2.png", _circle, 48, "#10B981", "U"),
    ("icons/rarity", "icon_rarity_3.png", _circle, 48, "#3B82F6", "R"),
    ("icons/rarity", "icon_rarity_4.png", _circle, 48, "#8B5CF6", "E"),
    ("icons/rarity", "icon_rarity_5.png", _circle, 48, "#F59E0B", "L"),
    ("icons/rarity", "icon_rarity_6.png", _circle, 48, "#F97316", "M"),
    # Tier 7 — Omega uses gradient helper (different signature — handled below)
]

# Omega rarity handled separately (gradient)
_OMEGA = ("icons/rarity", "icon_rarity_7.png", 48, "#8B5CF6", "#F59E0B", "Ω")


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def _write(spec: tuple, out_3x: Path, out_2x: Path, out_1x: Path, force: bool) -> None:
    subdir, filename, draw_fn, size, *args = spec
    for scale_dir, scale in ((out_3x, 1.0), (out_2x, 2 / 3), (out_1x, 1 / 3)):
        dest = scale_dir / subdir / filename
        dest.parent.mkdir(parents=True, exist_ok=True)
        if dest.exists() and not force:
            print(f"  skip  {dest.relative_to(dest.parent.parent.parent.parent)}")
            continue
        if scale == 1.0:
            draw_fn(dest, size, *args)
        else:
            # Generate 3x first into a temp location, then downscale
            tmp = out_3x / subdir / filename
            if not tmp.exists():
                draw_fn(tmp, size, *args)
            scaled_size = max(1, int(size * scale))
            _downscale(tmp, dest, scale)
        print(f"  wrote {dest.relative_to(dest.parent.parent.parent.parent)}")


def main(force: bool = False) -> None:
    _ensure_pillow()

    repo_root = Path(__file__).resolve().parent.parent
    out_3x = repo_root / "assets" / "images" / "3x"
    out_2x = repo_root / "assets" / "images" / "2x"
    out_1x = repo_root / "assets" / "images" / "1x"

    print("Generating placeholder assets…")

    for spec in _SPECS:
        _write(spec, out_3x, out_2x, out_1x, force)

    # Omega gradient portrait — special case
    subdir, filename, size, ca, cb, label = _OMEGA
    for scale_dir, scale in ((out_3x, 1.0), (out_2x, 2 / 3), (out_1x, 1 / 3)):
        dest = scale_dir / subdir / filename
        dest.parent.mkdir(parents=True, exist_ok=True)
        if dest.exists() and not force:
            print(f"  skip  {dest.relative_to(dest.parent.parent.parent.parent)}")
            continue
        if scale == 1.0:
            _gradient_circle(dest, size, ca, cb, label)
        else:
            tmp = out_3x / subdir / filename
            if not tmp.exists():
                _gradient_circle(tmp, size, ca, cb, label)
            _downscale(tmp, dest, scale)
        print(f"  wrote {dest.relative_to(dest.parent.parent.parent.parent)}")

    print("\nDone.")
    print(f"  3x → {out_3x}")
    print(f"  2x → {out_2x}")
    print(f"  1x → {out_1x}")


if __name__ == "__main__":
    force_flag = "--force" in sys.argv
    main(force=force_flag)
