"""Pose derivations.

The pose table in docs/art/sprite-prompt.md § POSE describes most frames as
*changes to another frame* — "identical to the previous idle pose, raised by
exactly one logical pixel", "frame n of a four-step fall". Written out as
derivations rather than as drawings, those come out exactly consistent, which
is the property hand-drawn or generated frame sets lose first.

Every function here returns a Skeleton. None of them know what a character
looks like.
"""

from rig import Skeleton, rest_pose

# The attacking side. Sprites are authored facing right; the arena mirrors the
# ally slot, so a swing always reads as going toward the opponent.
SWING = 1


def idle(frame: int) -> Skeleton:
    """Two frames: settled, then a one-pixel breath."""
    pose = rest_pose()
    if frame == 0:
        return pose
    # Only the upper body lifts. Feet that rise with the chest read as a hop.
    return _lift_upper(pose, -1)


def attack(frame: int) -> Skeleton:
    """Wind-up, strike, follow-through."""
    pose = rest_pose()
    if frame == 0:
        return _wind_up(pose)
    if frame == 1:
        return _strike(pose)
    return _follow_through(pose)


def hurt(frame: int) -> Skeleton:
    """Recoiling from a blow — head snapped back, arms loose, weight thrown
    onto the back foot.

    Deliberately overstated. The engine plays this for a handful of frames
    while a damage number is also flying, so a subtle flinch reads as nothing
    happening at all.
    """
    pose = rest_pose()
    knock = -4 - 2 * frame
    knocked = _lift_upper(pose, 1, dx=knock)
    return Skeleton(
        **{**vars(knocked),
           'head_tilt': knock // 2,
           'elbow_l': (pose.elbow_l[0] + knock - 1, pose.elbow_l[1] - 1),
           'hand_l':  (pose.hand_l[0] + knock - 3, pose.hand_l[1] - 3),
           'elbow_r': (pose.elbow_r[0] + knock + 1, pose.elbow_r[1] - 2),
           'hand_r':  (pose.hand_r[0] + knock + 2, pose.hand_r[1] - 5),
           # Back foot slides out to catch the weight.
           'foot_l':  (pose.foot_l[0] + knock, pose.foot_l[1]),
           'knee_l':  (pose.knee_l[0] + knock // 2, pose.knee_l[1])}
    )


def death(frame: int) -> Skeleton:
    """A four-step fall from standing to lying flat.

    The figure rotates about the feet rather than sinking: each frame drops the
    upper body further and pushes it back, so the last frame is a body on the
    ground rather than a standing figure that shrank.
    """
    pose = rest_pose()
    t = frame / 3                      # 0 at standing, 1 at flat
    # The neck travels down and back while the hip stays put, so the trunk —
    # drawn as a limb between them — rotates toward horizontal on its own.
    return Skeleton(
        **{**vars(pose),
           'head':  (pose.head[0] - round(13 * t), pose.head[1] + round(30 * t)),
           'neck':  (pose.neck[0] - round(9 * t),  pose.neck[1] + round(29 * t)),
           'shoulder_l': (pose.shoulder_l[0] - round(8 * t), pose.shoulder_l[1] + round(27 * t)),
           'shoulder_r': (pose.shoulder_r[0] - round(8 * t), pose.shoulder_r[1] + round(27 * t)),
           'hip':   (pose.hip[0] + round(2 * t), pose.hip[1] + round(14 * t)),
           'hip_l': (pose.hip_l[0] + round(2 * t), pose.hip_l[1] + round(14 * t)),
           'hip_r': (pose.hip_r[0] + round(2 * t), pose.hip_r[1] + round(14 * t)),
           'head_tilt': -round(2 * t),
           # Legs fold: knees come up and in, feet stay roughly where they fell.
           'knee_l': (pose.knee_l[0] + round(5 * t), pose.knee_l[1] + round(6 * t)),
           'knee_r': (pose.knee_r[0] + round(7 * t), pose.knee_r[1] + round(6 * t)),
           'foot_l': (pose.foot_l[0] + round(9 * t), pose.foot_l[1] - round(1 * t)),
           'foot_r': (pose.foot_r[0] + round(11 * t), pose.foot_r[1] - round(1 * t)),
           'elbow_l': (pose.elbow_l[0] - round(9 * t), pose.elbow_l[1] + round(25 * t)),
           'elbow_r': (pose.elbow_r[0] - round(7 * t), pose.elbow_r[1] + round(23 * t)),
           'hand_l': (pose.hand_l[0] - round(13 * t), pose.hand_l[1] + round(17 * t)),
           'hand_r': (pose.hand_r[0] - round(13 * t), pose.hand_r[1] + round(15 * t))}
    )


# ── shared derivations ────────────────────────────────────────────────────

UPPER_JOINTS = ('head', 'neck', 'shoulder_l', 'shoulder_r',
                'elbow_l', 'elbow_r', 'hand_l', 'hand_r', 'hip', 'hip_l', 'hip_r')


def _lift_upper(pose: Skeleton, dy: int, dx: int = 0) -> Skeleton:
    """Move everything above the knees, leaving the stance planted."""
    moved = {j: (getattr(pose, j)[0] + dx, getattr(pose, j)[1] + dy) for j in UPPER_JOINTS}
    return Skeleton(**{**vars(pose), **moved})


def _wind_up(pose: Skeleton) -> Skeleton:
    """Weight shifted back, striking arm cocked above and behind the head.

    The hand goes *up* and back, not down and back. A weapon drawn back at hip
    height points into the character's own legs on the next frame; drawn over
    the shoulder it has somewhere to travel from.
    """
    return Skeleton(
        **{**vars(_lift_upper(pose, 0, dx=-2 * SWING)),
           'head_tilt': -SWING,
           'elbow_r': (pose.elbow_r[0] + 1 * SWING, pose.elbow_r[1] - 5),
           'hand_r':  (pose.hand_r[0] - 5 * SWING, pose.hand_r[1] - 10),
           'elbow_l': (pose.elbow_l[0] - 2 * SWING, pose.elbow_l[1] - 1),
           'hand_l':  (pose.hand_l[0] - 3 * SWING, pose.hand_l[1] - 3)}
    )


def _strike(pose: Skeleton) -> Skeleton:
    """Full extension toward the target: the frame the hit lands on."""
    return Skeleton(
        **{**vars(_lift_upper(pose, 0, dx=2 * SWING)),
           'head_tilt': SWING,
           'elbow_r': (pose.elbow_r[0] + 3 * SWING, pose.elbow_r[1] - 6),
           'hand_r':  (pose.hand_r[0] + 8 * SWING, pose.hand_r[1] - 3),
           'elbow_l': (pose.elbow_l[0] - 1 * SWING, pose.elbow_l[1] + 1),
           'hand_l':  (pose.hand_l[0] - 3 * SWING, pose.hand_l[1] + 1),
           # Lunging stance — front foot forward, back foot trailing.
           'foot_r':  (pose.foot_r[0] + 4 * SWING, pose.foot_r[1]),
           'knee_r':  (pose.knee_r[0] + 3 * SWING, pose.knee_r[1]),
           'foot_l':  (pose.foot_l[0] - 3 * SWING, pose.foot_l[1]),
           'knee_l':  (pose.knee_l[0] - 1 * SWING, pose.knee_l[1])}
    )


def _follow_through(pose: Skeleton) -> Skeleton:
    """Weapon past the target, body rotated through, off-balance forward."""
    return Skeleton(
        **{**vars(_lift_upper(pose, 1, dx=3 * SWING)),
           'head_tilt': SWING,
           'elbow_r': (pose.elbow_r[0] + 5 * SWING, pose.elbow_r[1] + 2),
           'hand_r':  (pose.hand_r[0] + 8 * SWING, pose.hand_r[1] + 6),
           'elbow_l': (pose.elbow_l[0] + 1 * SWING, pose.elbow_l[1] + 2),
           'hand_l':  (pose.hand_l[0] + 1 * SWING, pose.hand_l[1] + 4),
           'foot_r':  (pose.foot_r[0] + 5 * SWING, pose.foot_r[1]),
           'knee_r':  (pose.knee_r[0] + 4 * SWING, pose.knee_r[1]),
           'foot_l':  (pose.foot_l[0] - 2 * SWING, pose.foot_l[1])}
    )


# Which states exist and how many frames each has. The manifest is generated
# from this, so the JSON can never disagree with the files on disk.
STATES: dict[str, tuple[int, callable]] = {
    'idle':   (2, idle),
    'attack': (3, attack),
    'hurt':   (2, hurt),
    'death':  (4, death),
}
