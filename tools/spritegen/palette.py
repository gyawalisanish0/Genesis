"""The Genesis colour ramps.

Transcribed verbatim from docs/ui/00-design-system.md § 3. That document is the
authority; if a value here disagrees with it, this file is wrong.

Sprites shade by stepping along a ramp, never by mixing a new value. A ramp is
indexed 1..5 to match the table in the design doc, so `hull(4)` here is the same
thing the doc calls `hull-4` and tokens.css resolves `--bg-elevated` to.
"""

RAMPS: dict[str, list[str]] = {
    # chrome, backgrounds
    'hull':  ['#02080e', '#061422', '#0a1d30', '#0f2840', '#1e4060'],
    # text, light neutrals
    'bone':  ['#3a6a92', '#5a9dc0', '#8fc4dd', '#d8f0ff', '#ffffff'],
    # brand, selection, energy
    'cyan':  ['#004a5c', '#0089a8', '#00c2e6', '#00e5ff', '#9df4ff'],
    # AP, information
    'azure': ['#002d4d', '#0067b3', '#0099ff', '#7ac6ff'],
    # HP, damage, defeat
    'blood': ['#4d0a1c', '#a3123a', '#ff2257', '#ff7a99'],
    # healing, buffs
    'moss':  ['#00432c', '#009962', '#00ff9f', '#8fffd0'],
    # boosted, legendary
    'amber': ['#4d3d00', '#b39a00', '#ffe100', '#fff08a'],
    # warnings, alerts
    'flare': ['#4d2a00', '#b36200', '#ff8c00', '#ffbe73'],
    # evade, omega
    'void':  ['#390049', '#8000ad', '#bf00ff', '#dd8aff'],
    # Mars terrain
    'rust':  ['#1c0d06', '#3d1f10', '#5c2f18', '#8a4526', '#cc7040'],
}


def step(ramp: str, index: int) -> str:
    """A ramp step by its design-doc number (1 = darkest).

    Clamps rather than raising: shading walks off the end of a ramp constantly
    (the darkest step has no darker neighbour), and clamping is the correct
    behaviour there — it is what "step to a neighbour, never invent a colour"
    means at the ends.
    """
    steps = RAMPS[ramp]
    return steps[max(0, min(len(steps) - 1, index - 1))]


Tone = int | tuple[str, int]


class Material:
    """One surface of a character: three ramp steps — lit, base, shadowed.

    Shading normally walks one step along the material's own ramp. It may also
    cross ramps: a `lit` of `('bone', 1)` puts a pale rim on a dark garment,
    which is what stops a character in a black outfit from disappearing into
    the near-black arena behind them. Both steps are still named ramp values,
    so nothing here can invent a colour.
    """

    def __init__(self, ramp: str, base: int, *, lit: Tone | None = None, shade: Tone | None = None):
        self.tones = {
            'base':  (ramp, base),
            'lit':   _tone(ramp, base + 1 if lit   is None else lit),
            'shade': _tone(ramp, base - 1 if shade is None else shade),
        }

    def colour(self, tone: str) -> str:
        return step(*self.tones[tone])


def _tone(default_ramp: str, value: Tone) -> tuple[str, int]:
    return value if isinstance(value, tuple) else (default_ramp, value)
