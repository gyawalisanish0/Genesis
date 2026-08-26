"""The shared humanoid rig.

Every character in Genesis is built on these proportions. The framework is
uniform and the roster is not — CLAUDE.md § Game Design Principles 6 says that
about skills, and it holds for silhouettes too: identity comes from the kit and
the overrides, not from redrawing the skeleton per character.

Proportions target the constraints in docs/art/sprite-prompt.md § FRAMING —
figure fills 40-46 of the 48 rows, head 8-10 rows, feet on the bottom edge,
chunky blocks rather than tapered points.
"""

from dataclasses import dataclass, replace

from canvas import Canvas, Point

# ── Default proportions ───────────────────────────────────────────────────
# A 45-row figure: head 4..13, torso 15..29, legs 30..47. Feet land on row 47,
# the bottom edge, leaving rows 0..3 as the margin the framing spec asks for.

HEAD_TOP    = 4
HEAD_HEIGHT = 9
CENTRE_X    = 23

# Depth of the shoulder and hip masses, in rows.
SHOULDER_DEPTH = 5
HIP_DEPTH      = 5


@dataclass
class Skeleton:
    """Joint positions in logical pixels. A pose is a set of these."""

    head:      Point
    neck:      Point
    shoulder_l: Point
    shoulder_r: Point
    elbow_l:   Point
    elbow_r:   Point
    hand_l:    Point
    hand_r:    Point
    hip:       Point
    hip_l:     Point
    hip_r:     Point
    knee_l:    Point
    knee_r:    Point
    foot_l:    Point
    foot_r:    Point
    # Sideways offset of the head, in pixels. Positive leans right.
    head_tilt: int = 0

    def shifted(self, dx: int = 0, dy: int = 0) -> 'Skeleton':
        """The whole figure moved. Used by the breathing frame and by hurt."""
        moved = {
            field: (value[0] + dx, value[1] + dy)
            for field, value in vars(self).items()
            if isinstance(value, tuple)
        }
        return replace(self, **moved)


def rest_pose() -> Skeleton:
    """Neutral combat stance — the pose every other pose is derived from."""
    return Skeleton(
        head=(CENTRE_X, HEAD_TOP + HEAD_HEIGHT // 2),
        neck=(CENTRE_X, 14),
        shoulder_l=(CENTRE_X - 4, 17), shoulder_r=(CENTRE_X + 4, 17),
        elbow_l=(CENTRE_X - 8, 23),    elbow_r=(CENTRE_X + 8, 23),
        hand_l=(CENTRE_X - 7, 29),     hand_r=(CENTRE_X + 7, 29),
        hip=(CENTRE_X, 30),
        hip_l=(CENTRE_X - 3, 31),      hip_r=(CENTRE_X + 3, 31),
        knee_l=(CENTRE_X - 3, 39),     knee_r=(CENTRE_X + 3, 39),
        foot_l=(CENTRE_X - 3, 46),     foot_r=(CENTRE_X + 3, 46),
    )


@dataclass
class Kit:
    """What a character is made of.

    Material keys are resolved against the character's own material table, so
    two characters can both have `armour` and look nothing alike.
    """

    head:    str = 'skin'
    hair:    str = 'hair'
    torso:   str = 'armour'
    # Sleeves are their own material even when they share the torso's ramp:
    # the shading pass separates surfaces by material key, so an arm that
    # names the same material as the chest merges into it and the figure
    # loses its arms entirely.
    arms:    str = 'sleeve'
    hands:   str = 'skin'
    legs:    str = 'trouser'
    boots:   str = 'boot'

    # Odd, so the head has a true centre column to hang a face on.
    head_width:  int = 7
    torso_width: int = 11
    arm_width:   int = 3
    leg_width:   int = 4

    # Rows of hair drawn over the top of the skull. 0 = bald or helmeted.
    hair_depth:  int = 3
    # Draw a face. False for back views and full visors.
    face:        bool = True


def draw_figure(canvas: Canvas, pose: Skeleton, kit: Kit) -> None:
    """Lay the whole body down in draw order: back limbs, torso, front limbs.

    Order matters only where parts overlap — the far arm belongs behind the
    torso so a swing reads as coming from behind the body rather than pasted
    on top of it.
    """
    _draw_arm(canvas, pose.shoulder_l, pose.elbow_l, pose.hand_l, kit)
    _draw_legs(canvas, pose, kit)
    _draw_torso(canvas, pose, kit)
    _draw_arm(canvas, pose.shoulder_r, pose.elbow_r, pose.hand_r, kit)
    _draw_head(canvas, pose, kit)


def _draw_torso(canvas: Canvas, pose: Skeleton, kit: Kit) -> None:
    """Shoulders, trunk, hips — three masses rather than one slab.

    The trunk is a limb between neck and hip rather than a rectangle, so it
    rotates with the pose. A rectangle could only ever stand upright, and the
    death frames need the body to come down flat.
    """
    canvas.limb(pose.shoulder_l, pose.shoulder_r, SHOULDER_DEPTH, kit.torso)
    canvas.limb(pose.neck, pose.hip, kit.torso_width - 2, kit.torso)
    canvas.limb(pose.hip_l, pose.hip_r, HIP_DEPTH, kit.torso)


def _draw_arm(canvas: Canvas, shoulder: Point, elbow: Point, hand: Point, kit: Kit) -> None:
    canvas.limb(shoulder, elbow, kit.arm_width, kit.arms)
    canvas.limb(elbow, hand, kit.arm_width, kit.arms)
    canvas._brush(round(hand[0]), round(hand[1]), kit.arm_width, kit.hands)


def _draw_legs(canvas: Canvas, pose: Skeleton, kit: Kit) -> None:
    for hip, knee, foot in ((pose.hip_l, pose.knee_l, pose.foot_l),
                            (pose.hip_r, pose.knee_r, pose.foot_r)):
        canvas.limb(hip, knee, kit.leg_width, kit.legs)
        canvas.limb(knee, foot, kit.leg_width, kit.legs)
        # Boots are a block at the ankle, wider than the leg — the design spec
        # calls for chunky feet, and a foot that tapers vanishes at this size.
        x, y = round(foot[0]), round(foot[1])
        canvas.rect(x - kit.leg_width // 2, y - 1, x + kit.leg_width // 2 + 1, y + 1, kit.boots)


def _draw_head(canvas: Canvas, pose: Skeleton, kit: Kit) -> None:
    half = kit.head_width // 2
    cx   = round(pose.head[0]) + pose.head_tilt
    top  = round(pose.head[1]) - HEAD_HEIGHT // 2
    bottom = top + HEAD_HEIGHT - 1

    # Neck first, so the jaw sits over it. Two pixels wide and barely longer
    # than the gap it spans — a wide neck merges the head into the shoulders.
    canvas.limb((cx, bottom), pose.neck, 2, kit.head)

    canvas.rect(cx - half, top, cx + half, bottom, kit.head)
    _clip_corners(canvas, cx, half, top)
    # Jaw: the bottom two rows narrow by one each side. Without it the head is
    # a brick, which is the single thing that makes a small sprite read as a
    # toy rather than a person.
    canvas.erase(cx - half, bottom - 1, cx - half, bottom)
    canvas.erase(cx + half, bottom - 1, cx + half, bottom)

    if kit.hair_depth:
        # A cap, not a fringe: full width across the crown, then down both
        # temples past the cheekbone. What is left is a face opening a few
        # pixels across, which is what makes a 9-row head read as a head
        # instead of as a pale tile with a dark bar on top.
        canvas.rect(cx - half, top, cx + half, top + kit.hair_depth - 1, kit.hair)
        for side in (cx - half, cx + half):
            canvas.rect(side, top, side, top + kit.hair_depth + 1, kit.hair)
        _clip_corners(canvas, cx, half, top)


def _clip_corners(canvas: Canvas, cx: int, half: int, top: int) -> None:
    """Knock the square corners off the skull."""
    canvas.erase(cx - half, top, cx - half, top)
    canvas.erase(cx + half, top, cx + half, top)
