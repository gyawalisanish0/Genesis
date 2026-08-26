"""The roster the generator knows how to draw.

One module per character. Adding one means writing that module and listing it
here — the generator itself never learns a character's name.
"""

from character import Character
from characters import hugo

ROSTER: dict[str, Character] = {
    hugo.CHARACTER.def_id: hugo.CHARACTER,
}
