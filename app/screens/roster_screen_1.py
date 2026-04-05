"""
RosterScreen1 — card building, filter logic, and tab/chip construction.

Consumed exclusively by RosterScreen; has no direct Kivy screen dependency
so it can be tested in isolation.
"""
from __future__ import annotations

from kivy.metrics import dp
from kivy.properties import ListProperty, NumericProperty, StringProperty
from kivy.uix.boxlayout import BoxLayout
from kivy.uix.togglebutton import ToggleButton

# ── Rarity colour palette ─────────────────────────────────────────────────────
# Maps rarity int → RGBA tuple used for the card border and chip label.
_RARITY_COLORS: dict[int, tuple] = {
    1: (0.420, 0.447, 0.502, 1),   # grey   — Common
    2: (0.063, 0.725, 0.506, 1),   # green  — Uncommon
    3: (0.231, 0.510, 0.965, 1),   # blue   — Rare
    4: (0.545, 0.361, 0.965, 1),   # purple — Epic
    5: (0.961, 0.620, 0.043, 1),   # gold   — Legendary
    6: (0.976, 0.451, 0.086, 1),   # orange — Mythic
    7: (0.945, 0.941, 1.0,   1),   # white  — Omega
}
_RARITY_LABELS = {1: '★', 2: '★★', 3: '★★★', 4: '★★★★', 5: '★★★★★'}
_DEFAULT_COLOR = (0.608, 0.557, 0.769, 1)

_CLASS_FILTER_GROUP  = 'roster_class'
_RARITY_FILTER_GROUP = 'roster_rarity'


# ── CharacterCard widget ──────────────────────────────────────────────────────

class CharacterCard(BoxLayout):
    """Single roster card — data set from Python, layout defined in KV."""

    char_name    = StringProperty('')
    char_class   = StringProperty('')
    char_rarity  = NumericProperty(1)
    char_hp      = NumericProperty(0)
    rarity_color = ListProperty([0.608, 0.557, 0.769, 1])
    rarity_label = StringProperty('★')


# ── RosterScreen1 — helper ────────────────────────────────────────────────────

class RosterScreen1:
    """
    Builds the class-filter tabs, rarity chips, and character-card grid.
    All methods are stateless helpers that operate on the widgets passed in.
    """

    # ── Filter helpers ─────────────────────────────────────────────────────────

    @staticmethod
    def filter_chars(
        chars: list[dict],
        class_filter: str,
        rarity_filter: int,
    ) -> list[dict]:
        """Return chars that match the active class and rarity filters."""
        result = chars
        if class_filter != 'All':
            result = [c for c in result if c.get('class_name') == class_filter]
        if rarity_filter != 0:
            result = [c for c in result if c.get('rarity') == rarity_filter]
        return result

    @staticmethod
    def unique_classes(chars: list[dict]) -> list[str]:
        seen: list[str] = []
        for c in chars:
            cls = c.get('class_name', '')
            if cls and cls not in seen:
                seen.append(cls)
        return seen

    @staticmethod
    def unique_rarities(chars: list[dict]) -> list[int]:
        seen: list[int] = []
        for c in chars:
            r = c.get('rarity', 0)
            if r and r not in seen:
                seen.append(r)
        return sorted(seen)

    # ── Tab / chip builders ────────────────────────────────────────────────────

    def build_class_tabs(
        self,
        chars: list[dict],
        row: BoxLayout,
        on_select,
    ) -> None:
        """Populate the class-filter tab row with ToggleButtons."""
        row.clear_widgets()
        classes = ['All'] + self.unique_classes(chars)
        for i, cls in enumerate(classes):
            btn = ToggleButton(
                text=cls,
                group=_CLASS_FILTER_GROUP,
                state='down' if i == 0 else 'normal',
                size_hint=(None, 1),
                width=dp(72),
                font_size=dp(12),
                background_normal='',
                background_down='',
                background_color=(0, 0, 0, 0),
            )
            btn.bind(on_release=lambda b, c=cls: on_select(c))
            row.add_widget(btn)
        row.width = dp(72) * len(classes)

    def build_rarity_chips(
        self,
        chars: list[dict],
        row: BoxLayout,
        on_select,
    ) -> None:
        """Populate the rarity chip row with ToggleButtons."""
        row.clear_widgets()
        rarities = [0] + self.unique_rarities(chars)  # 0 = All
        for i, r in enumerate(rarities):
            label = 'All' if r == 0 else (_RARITY_LABELS.get(r, '★' * r))
            color = _DEFAULT_COLOR if r == 0 else list(_RARITY_COLORS.get(r, _DEFAULT_COLOR))
            btn = ToggleButton(
                text=label,
                group=_RARITY_FILTER_GROUP,
                state='down' if i == 0 else 'normal',
                size_hint=(None, 1),
                width=dp(56),
                font_size=dp(12),
                color=color,
                background_normal='',
                background_down='',
                background_color=(0, 0, 0, 0),
            )
            btn.bind(on_release=lambda b, rv=r: on_select(rv))
            row.add_widget(btn)
        row.width = dp(56) * len(rarities)

    # ── Card builder ───────────────────────────────────────────────────────────

    def build_card(self, char_dict: dict) -> CharacterCard:
        """Construct a CharacterCard widget populated from a character dict."""
        rarity = char_dict.get('rarity', 1)
        card = CharacterCard()
        card.char_name    = char_dict.get('name', '???')
        card.char_class   = char_dict.get('class_name', '')
        card.char_rarity  = rarity
        card.char_hp      = char_dict.get('max_hp', 0)
        card.rarity_color = list(_RARITY_COLORS.get(rarity, _DEFAULT_COLOR))
        card.rarity_label = _RARITY_LABELS.get(rarity, '★' * min(rarity, 5))
        return card

    def populate_grid(self, chars: list[dict], grid) -> None:
        """Clear the grid and rebuild it from the given character list."""
        grid.clear_widgets()
        for char in chars:
            grid.add_widget(self.build_card(char))
        # If odd number of chars, add an invisible spacer so the grid stays aligned
        if len(chars) % 2 == 1:
            from kivy.uix.widget import Widget
            grid.add_widget(Widget())
