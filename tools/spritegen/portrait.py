"""The 32 x 32 portrait.

Not a crop of the battle sprite. A 48 px figure carries a 9 px head; blowing
that up would double the pixel size, and the design system's premise is that
one art pixel is two dp everywhere — a portrait with 4 dp pixels would sit next
to the sprite looking like a different game. So the bust is drawn at portrait
scale from the same materials.

This is the only place in Genesis where a character is legible as a *person*
rather than as a silhouette — the HUD panel, timeline markers, roster and
result screen all read from here — so it gets a real face rather than a head
shape with two dots on it.

A face is not a pale slab with eyes. What makes 32 px read as a person, in
rough order of how much each one buys:

    brow line   sets the expression; without it the eyes are punctuation
    nose        one shaded column, breaking the flat middle of the face
    cheek/jaw   shadow down both sides, turning the slab into a volume
    mouth       one short dark line
    parting     an uneven hair edge; a straight bar reads as a helmet

All five are placed explicitly, in a darker step of the character's own skin
ramp, rather than left to the canvas rim rule — the rim only knows about
silhouette edges, and every one of these is interior.
"""

from canvas import Canvas
from character import Character

PORTRAIT_SIZE = 32

CENTRE      = 15
HEAD_HALF   = 7
HEAD_TOP    = 3
HEAD_BOTTOM = 21
NECK_BOTTOM = 25

BROW_ROW  = 11
EYE_ROW   = 13
NOSE_ROW  = 15
MOUTH_ROW = 18


def draw_portrait(character: Character) -> Canvas:
    """A head-and-shoulders bust in the character's own materials."""
    canvas = Canvas(PORTRAIT_SIZE)
    kit    = character.kits['front']
    shade  = 'skin_dark' if 'skin_dark' in character.materials else kit.head
    eye    = 'eye' if 'eye' in character.materials else kit.hair

    _shoulders(canvas, kit)
    _neck(canvas, kit, shade)
    _skull(canvas, kit)
    _hair(canvas, kit)
    _face(canvas, kit, shade, eye)
    return canvas


def _shoulders(canvas: Canvas, kit) -> None:
    """A trapezoid running off both sides and the bottom.

    A plain rectangle reads as a table the head is sitting on; the taper is
    what makes it a body.
    """
    for row in range(NECK_BOTTOM, PORTRAIT_SIZE):
        spread = 6 + (row - NECK_BOTTOM) * 2
        canvas.rect(CENTRE - spread, row, CENTRE + spread, row, kit.torso)
    canvas.rect(CENTRE - 6, NECK_BOTTOM, CENTRE + 6, NECK_BOTTOM, 'vest'
                if kit.torso != 'vest' else kit.torso)


def _neck(canvas: Canvas, kit, shade: str) -> None:
    canvas.rect(CENTRE - 3, HEAD_BOTTOM + 1, CENTRE + 3, NECK_BOTTOM - 1, kit.head)
    # The jaw casts onto the neck. Without it the head floats on a pale column.
    canvas.rect(CENTRE - 3, HEAD_BOTTOM + 1, CENTRE + 3, HEAD_BOTTOM + 1, shade)


def _skull(canvas: Canvas, kit) -> None:
    canvas.rect(CENTRE - HEAD_HALF, HEAD_TOP, CENTRE + HEAD_HALF, HEAD_BOTTOM, kit.head)
    for dx in (-HEAD_HALF, HEAD_HALF):
        canvas.erase(CENTRE + dx, HEAD_TOP, CENTRE + dx, HEAD_TOP)
        # Jaw: two steps in over the last three rows, so the face has a chin.
        canvas.erase(CENTRE + dx, HEAD_BOTTOM - 2, CENTRE + dx, HEAD_BOTTOM)
        canvas.erase(CENTRE + dx - (1 if dx > 0 else -1), HEAD_BOTTOM, CENTRE + dx - (1 if dx > 0 else -1), HEAD_BOTTOM)


def _hair(canvas: Canvas, kit) -> None:
    """Cap, temples, and an off-centre parting.

    The parting is the point. A flat horizontal hairline reads as a helmet
    brim, and every character generated from this rig would wear the same one.
    """
    if not kit.hair_depth:
        return
    canvas.rect(CENTRE - HEAD_HALF, HEAD_TOP, CENTRE + HEAD_HALF, HEAD_TOP + 5, kit.hair)
    # Fringe: lower on one side than the other.
    canvas.rect(CENTRE - HEAD_HALF, HEAD_TOP + 6, CENTRE - 1, HEAD_TOP + 6, kit.hair)
    canvas.rect(CENTRE - HEAD_HALF, HEAD_TOP + 7, CENTRE - 4, HEAD_TOP + 7, kit.hair)
    # Temples down past the eyeline, so the cap wraps the skull.
    for dx in (-HEAD_HALF, HEAD_HALF):
        canvas.rect(CENTRE + dx, HEAD_TOP, CENTRE + dx, EYE_ROW - 1, kit.hair)
        canvas.erase(CENTRE + dx, HEAD_TOP, CENTRE + dx, HEAD_TOP)


def _face(canvas: Canvas, kit, shade: str, eye: str) -> None:
    _brows(canvas, kit)
    _eyes(canvas, eye)
    _nose(canvas, shade)
    _mouth(canvas, shade)
    _cheeks(canvas, shade)


def _brows(canvas: Canvas, kit) -> None:
    canvas.rect(CENTRE - 5, BROW_ROW, CENTRE - 2, BROW_ROW, kit.hair)
    canvas.rect(CENTRE + 2, BROW_ROW, CENTRE + 5, BROW_ROW, kit.hair)


def _eyes(canvas: Canvas, eye: str) -> None:
    canvas.rect(CENTRE - 5, EYE_ROW, CENTRE - 3, EYE_ROW + 1, eye)
    canvas.rect(CENTRE + 3, EYE_ROW, CENTRE + 5, EYE_ROW + 1, eye)


def _nose(canvas: Canvas, shade: str) -> None:
    """One shaded column down the middle, flaring at the base.

    Lit from the upper left, so the shadow sits on the right of the ridge —
    the same light direction the sprites use.
    """
    canvas.rect(CENTRE + 1, NOSE_ROW, CENTRE + 1, NOSE_ROW + 2, shade)
    canvas.rect(CENTRE, NOSE_ROW + 2, CENTRE + 1, NOSE_ROW + 2, shade)


def _mouth(canvas: Canvas, shade: str) -> None:
    """Four pixels, off to the shadowed side of the nose."""
    canvas.rect(CENTRE - 2, MOUTH_ROW, CENTRE + 1, MOUTH_ROW, shade)


def _cheeks(canvas: Canvas, shade: str) -> None:
    """Shadow down both sides below the cheekbone, and under the jaw.

    Kept clear of the mouth row: run together they read as one dark bar across
    the lower face rather than as a mouth above a chin.
    """
    for dx in (-HEAD_HALF + 1, HEAD_HALF - 1):
        canvas.rect(CENTRE + dx, NOSE_ROW, CENTRE + dx, MOUTH_ROW - 1, shade)
    canvas.rect(CENTRE - 4, HEAD_BOTTOM - 1, CENTRE + 4, HEAD_BOTTOM - 1, shade)
