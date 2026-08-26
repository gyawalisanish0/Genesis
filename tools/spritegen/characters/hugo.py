"""Hugo Rekrot — hugo_001.

Authored from docs/characters/in-game/hugo-rekrot.md § Appearance. Two things
in that document drive every decision here:

  "He wears a tactical outfit in the field — the ANBOT nanite layer sits
   underneath it, as underwear. The outfit is what you see."

  "The visual identity is intentionally understated: Hugo looks like a tactical
   operator, not a powered-armour unit. The danger is invisible until it isn't."

So the idle frames carry no weapon at all — no blade, no hammer, nothing on the
belt. He is a man standing there. The nanites exist only in the attack frames,
where they extend from the forearm and retract again. That is not a shortcut;
it is the character, and it happens to be the one thing a static sprite sheet
can say about him that a drawing of a man holding a sword cannot.

The rarity-4 accent is void (purple), per the roster table in
docs/art/sprite-prompt.md.
"""

from canvas import Canvas
from character import Character
from palette import Material
from rig import HEAD_HEIGHT, Kit, Skeleton

# ── Materials ─────────────────────────────────────────────────────────────
# Hull for the outfit, bone for skin, void for the nanites.
#
# The outfit's lit step crosses into the bone ramp on purpose. Genesis renders
# on hull-1/hull-2 backgrounds, so a dark garment shaded only within the hull
# ramp has nothing to separate it from the room — the figure reads as a hole.
# One pale rim along the lit edge is what a GBA sprite uses to sit on a dark
# stage, and it costs one colour.

MATERIALS = {
    'skin':    Material('bone', 2, lit=3, shade=1),
    # One step down the same ramp, flat. Used for the interior modelling on the
    # portrait — brow shadow, nose, cheeks, jaw — which the canvas rim rule
    # cannot reach because none of it sits on a silhouette edge.
    'skin_dark': Material('bone', 1, lit=1, shade=1),
    # Hair needs the same pale rim the outfit gets. Shaded only within the hull
    # ramp it is the background colour, and the head reads as a face floating
    # under a smudge rather than as a skull with hair on it.
    'hair':    Material('hull', 1, lit=('bone', 1), shade=1),
    # Torso, sleeves and trousers share a ramp but sit on different steps, so
    # the arms separate from the chest and the legs from the hips.
    'outfit':  Material('hull', 4, lit=('bone', 1), shade=2),
    'sleeve':  Material('hull', 3, lit=('bone', 1), shade=1),
    'trouser': Material('hull', 3, lit=5,           shade=1),
    'vest':    Material('hull', 2, lit=4,           shade=1),   # chest rig
    'boot':    Material('hull', 2, lit=('bone', 1), shade=1),
    # Gloves, one step off the sleeve: enough to read as a cuff, not so much
    # that the hands become the brightest thing on a figure whose face should be.
    'glove':   Material('hull', 4, lit=5, shade=2),
    'nanite':  Material('void', 3),
    # Flat and dark. Two void-bright pixels on a pale face at this size do not
    # read as Sekkar eyes, they read as a demon — and the accent is spent on
    # the nanites, which is where his identity actually is.
    'eye':     Material('hull', 1, lit=1, shade=1),
}

_KIT = Kit(
    head='skin', hair='hair', torso='outfit', arms='sleeve',
    hands='glove', legs='trouser', boots='boot',
    head_width=7, torso_width=11, arm_width=3, leg_width=5,
    hair_depth=3,
)

KITS = {
    'front': _KIT,
    # From behind there is no face at all. The hair has to cover the whole
    # skull, not most of it — two uncovered rows leave a pale sliver at the
    # jaw that reads as a chin on the back of his head.
    'back':  Kit(**{**vars(_KIT), 'hair_depth': HEAD_HEIGHT, 'face': False}),
}


# ── Overrides ─────────────────────────────────────────────────────────────

def decorate(canvas: Canvas, pose: Skeleton, state: str, frame: int, view: str) -> None:
    _chest_rig(canvas, pose, view)
    if view == 'front' and state != 'death':
        _face(canvas, pose)
    if view == 'back':
        _spine_ridge(canvas, pose)
    if state == 'attack':
        _nanite_blade(canvas, pose, frame)


def _chest_rig(canvas: Canvas, pose: Skeleton, view: str) -> None:
    """Collar, chest webbing and belt — what makes him read as kitted rather
    than as a man in a jumpsuit."""
    cx, top = round(pose.neck[0]), round(pose.neck[1])
    # Collar. Without a dark row here the pale neck runs straight into the
    # pale face and the head stops being a separate mass.
    canvas.rect(cx - 3, top + 1, cx + 3, top + 1, 'vest')
    canvas.rect(cx - 5, top + 4, cx + 5, top + 4, 'vest')
    if view == 'front':
        canvas.rect(cx - 5, top + 13, cx + 5, top + 14, 'vest')


def _face(canvas: Canvas, pose: Skeleton) -> None:
    """Two pixels. At a 10-row head there is no room for more, and a mouth at
    this size reads as dirt."""
    cx  = round(pose.head[0]) + pose.head_tilt
    row = round(pose.head[1]) - HEAD_HEIGHT // 2 + 5
    canvas.px(cx - 2, row, 'eye')
    canvas.px(cx + 2, row, 'eye')


def _spine_ridge(canvas: Canvas, pose: Skeleton) -> None:
    """Sekkar scale skin along the back.

    His doc says Sekkars carry scale skin along their backs and that how much
    Hugo inherits "is still being defined visually" — so this is one restrained
    line of it, not a full plate. It only ever appears in the back view, which
    is the view the design question is actually about.
    """
    cx = round(pose.neck[0])
    for row in range(round(pose.neck[1]) + 3, round(pose.hip[1]) - 2, 3):
        canvas.px(cx, row, 'vest')


def _nanite_blade(canvas: Canvas, pose: Skeleton, frame: int) -> None:
    """The ANBOT blade forming out of the forearm.

    There is no blade at all on the wind-up. His doc says the nanites extend
    when he acts and retract when the action is done, so the frame where the
    arm is still coiled is a man with an empty hand — and the strike frame is
    the moment the weapon exists. Losing that would cost the character the one
    thing a sprite sheet can say about him.

    The blade is drawn along the forearm's own direction, so it always leaves
    the hand rather than floating beside it.
    """
    reach = (0, 13, 9)[frame]
    ex, ey = pose.elbow_r
    hx, hy = pose.hand_r
    dx, dy = hx - ex, hy - ey
    length = max(1.0, (dx * dx + dy * dy) ** 0.5)
    ux, uy = dx / length, dy / length

    # Taper the blade by narrowing the brush over its last third — chunky at
    # the wrist, two pixels at the tip, never a single-pixel point.
    for i in range(1, reach + 1):
        width = 3 if i < reach * 0.66 else 2
        canvas._brush(round(hx + ux * i), round(hy + uy * i), width, 'nanite')


CHARACTER = Character(
    def_id='hugo_001',
    materials=MATERIALS,
    kits=KITS,
    decorate=decorate,
)
