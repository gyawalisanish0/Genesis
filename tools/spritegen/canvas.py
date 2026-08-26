"""A 48 x 48 logical pixel grid.

Every drawing call writes a *material*, not a colour. Colours are resolved in a
single pass at the end, once the whole silhouette is known — which is what lets
shading depend on where a pixel sits in the figure rather than on the order the
parts happened to be drawn in.

This is the whole reason the generator exists. Nothing here can produce an
anti-aliased edge, a gradient, an off-grid pixel, or a colour outside the ramps,
so none of those need checking for afterwards.
"""

from PIL import Image

from palette import Material

SPRITE_SIZE = 48

# Light comes from the upper left. A pixel with empty space above or to the left
# is on the lit rim; one with empty space below or to the right is in shadow.
# At 48 px a figure is mostly rim, which is what gives it volume at this size.
LIT_NEIGHBOURS   = ((0, -1), (-1, 0))
SHADE_NEIGHBOURS = ((0, 1), (1, 0))

Point = tuple[float, float]


class Canvas:
    """A grid of material keys, resolvable to an RGBA image."""

    def __init__(self, size: int = SPRITE_SIZE, *, light_from_right: bool = False):
        self.size = size
        self.cells: dict[tuple[int, int], str] = {}
        # The arena mirrors the ally with scaleX(-1). Art lit from the upper
        # left arrives on screen lit from the upper right, so the two fighters
        # end up lit from opposite sides. Lighting the back view from the right
        # at generation cancels that mirror out.
        self.light_from_right = light_from_right

    # ── drawing ───────────────────────────────────────────────────────────

    def px(self, x: int, y: int, material: str) -> None:
        """Set one pixel. Off-grid writes are dropped, not an error — a swing
        that reaches past the frame is a pose decision, not a bug."""
        if 0 <= x < self.size and 0 <= y < self.size:
            self.cells[(x, y)] = material

    def rect(self, x0: int, y0: int, x1: int, y1: int, material: str) -> None:
        """A filled rectangle, inclusive of both corners."""
        for y in range(min(y0, y1), max(y0, y1) + 1):
            for x in range(min(x0, x1), max(x0, x1) + 1):
                self.px(x, y, material)

    def limb(self, a: Point, b: Point, width: int, material: str) -> None:
        """A thick line between two joints.

        Limbs are drawn as a square brush swept along the line rather than as a
        polygon, because a 2-3 px limb at this scale IS its brush — anything
        cleverer produces tapered points, which the design system bans as
        sub-pixel geometry.
        """
        (x0, y0), (x1, y1) = (round(a[0]), round(a[1])), (round(b[0]), round(b[1]))
        steps = max(abs(x1 - x0), abs(y1 - y0))
        for i in range(steps + 1):
            t = i / steps if steps else 0
            self._brush(round(x0 + (x1 - x0) * t), round(y0 + (y1 - y0) * t), width, material)

    def _brush(self, cx: int, cy: int, width: int, material: str) -> None:
        half = width // 2
        for dy in range(-half, width - half):
            for dx in range(-half, width - half):
                self.px(cx + dx, cy + dy, material)

    def erase(self, x0: int, y0: int, x1: int, y1: int) -> None:
        """Cut a rectangle back out of the silhouette — the gap between legs,
        a notch in a helmet."""
        for y in range(min(y0, y1), max(y0, y1) + 1):
            for x in range(min(x0, x1), max(x0, x1) + 1):
                self.cells.pop((x, y), None)

    # ── resolution ────────────────────────────────────────────────────────

    def to_image(self, materials: dict[str, Material]) -> Image.Image:
        """Resolve materials to colours and return the RGBA frame."""
        image = Image.new('RGBA', (self.size, self.size), (0, 0, 0, 0))
        pixels = image.load()
        for (x, y), key in self.cells.items():
            pixels[x, y] = _rgba(materials[key].colour(self._tone(x, y, key)))
        return image

    def _tone(self, x: int, y: int, key: str) -> str:
        """Where this pixel sits: on the figure's rim, on a seam, or inside.

        The two cases are deliberately different. Empty space above or to the
        left is the *silhouette* catching the light, and gets the pale rim that
        lifts the figure off a near-black stage. A different material there is a
        *seam* — sleeve against chest, hand against hip — and darkens instead.

        Lighting both the same way was the first thing tried and it turns the
        character into a wireframe: every internal boundary glows, and the
        result reads as an outline drawing rather than a lit body.
        """
        lit_side, shade_side = self._rims()
        if any((x + dx, y + dy) not in self.cells for dx, dy in lit_side):
            return 'lit'
        # Occluded by the surface next to it, on the side the light comes from.
        if any(self.cells.get((x + dx, y + dy), key) != key for dx, dy in lit_side):
            return 'shade'
        # The figure's own shadow side. Deliberately checks for *empty* space
        # rather than for a different material: darkening both sides of every
        # seam costs nothing on a body with four surfaces, but a face is almost
        # entirely seams — brow, eye, nose, cheek, mouth — and the rule ate it,
        # leaving 90% of the skin in shadow and no lit surface to model.
        if any((x + dx, y + dy) not in self.cells for dx, dy in shade_side):
            return 'shade'
        return 'base'

    def colours(self, materials: dict[str, Material]) -> set[str]:
        """Every distinct colour the frame resolves to. Used by the checks."""
        return {materials[k].colour(self._tone(x, y, k)) for (x, y), k in self.cells.items()}

    def _rims(self) -> tuple[tuple[tuple[int, int], ...], tuple[tuple[int, int], ...]]:
        if not self.light_from_right:
            return LIT_NEIGHBOURS, SHADE_NEIGHBOURS
        return tuple((-dx, dy) for dx, dy in LIT_NEIGHBOURS), \
               tuple((-dx, dy) for dx, dy in SHADE_NEIGHBOURS)

    def mirrored(self) -> 'Canvas':
        """A left-right flip of the geometry.

        Applied before colours are resolved, so the light keeps coming from the
        upper left. Flipping the finished PNG instead would flip the lighting
        with it, and the portrait — which is never mirrored — would end up lit
        from the other side than the sprite standing next to it.
        """
        flipped = Canvas(self.size, light_from_right=self.light_from_right)
        flipped.cells = {(self.size - 1 - x, y): key for (x, y), key in self.cells.items()}
        return flipped

    def bounds(self) -> tuple[int, int, int, int] | None:
        """Tight box around the drawn figure, or None if nothing was drawn."""
        if not self.cells:
            return None
        xs = [x for x, _ in self.cells]
        ys = [y for _, y in self.cells]
        return min(xs), min(ys), max(xs), max(ys)


def _rgba(hex_colour: str) -> tuple[int, int, int, int]:
    value = hex_colour.lstrip('#')
    return (int(value[0:2], 16), int(value[2:4], 16), int(value[4:6], 16), 255)
