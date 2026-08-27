"""What a character definition has to provide.

The rig draws a body. Everything that makes the body a specific person — gear,
a face, a weapon that only exists mid-swing — is an override the character
supplies here.

`decorate` is deliberately unconstrained: it is handed the canvas after the rig
has drawn, and may put anything anywhere. That is the escape hatch. A character
whose identity the rig cannot express (Hugo's nanites forming a blade out of
nothing) draws it directly rather than having the rig grow a `weapon` concept
that only one character uses.
"""

from dataclasses import dataclass, field
from typing import Callable

from canvas import Canvas
from palette import Material
from rig import Kit, Skeleton

# Called after the rig has drawn the body, to add whatever the rig cannot.
Decorator = Callable[[Canvas, Skeleton, str, int, str], None]

# The two views every character needs: the enemy slot faces the player, the
# ally slot shows the party from behind. See docs/art/sprite-prompt.md § FACING.
VIEWS = ('front', 'back')


@dataclass
class Character:
    """One roster entry, in the form the generator consumes."""

    def_id:    str
    materials: dict[str, Material]
    # Keyed by view — a back view is a different kit, not a mirrored front one.
    kits:      dict[str, Kit]
    decorate:  Decorator = field(default=lambda *_: None)
    # Which head row the portrait crops around; tuned per character because
    # head height and hair depth move the face.
    portrait_focus: int = 9
