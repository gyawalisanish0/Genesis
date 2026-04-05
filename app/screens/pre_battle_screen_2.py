"""
PreBattleScreen2 — Step 2: team selection.

Shows N team slots at the top and a scrollable pick grid below.
Tapping a pick card fills the next empty slot.
Tapping a filled slot removes that character.

Widget classes CharacterSlot and RosterPickCard are defined here;
their visual rules live in pre_battle_screen.kv.
"""
from __future__ import annotations

from kivy.metrics import dp
from kivy.properties import BooleanProperty, ListProperty, StringProperty
from kivy.uix.behaviors import ButtonBehavior
from kivy.uix.boxlayout import BoxLayout
from kivy.uix.gridlayout import GridLayout
from kivy.uix.label import Label
from kivy.uix.scrollview import ScrollView

from app.core.constants import TEAM_SIZE_MAX

_RARITY_COLORS: dict[int, list] = {
    1: [0.420, 0.447, 0.502, 1],
    2: [0.063, 0.725, 0.506, 1],
    3: [0.231, 0.510, 0.965, 1],
    4: [0.545, 0.361, 0.965, 1],
    5: [0.961, 0.620, 0.043, 1],
}
_DEFAULT_COLOR = [0.608, 0.557, 0.769, 1]


# ── Slot and pick-card widgets ────────────────────────────────────────────────

class CharacterSlot(ButtonBehavior, BoxLayout):
    """A single team slot — empty (+) or filled with a character name."""

    is_filled    = BooleanProperty(False)
    slot_label   = StringProperty('+')
    rarity_color = ListProperty([0.361, 0.329, 0.502, 1])


class RosterPickCard(ButtonBehavior, BoxLayout):
    """Small character card in the pick grid — highlights when in the team."""

    char_name    = StringProperty('')
    char_class   = StringProperty('')
    rarity_color = ListProperty(_DEFAULT_COLOR)
    in_team      = BooleanProperty(False)


# ── Step 2 helper ─────────────────────────────────────────────────────────────

class PreBattleScreen2:
    """Builds and manages the team-selection panel for step 2."""

    def __init__(self) -> None:
        self.selected_team: list[dict] = []
        self._all_chars: list[dict] = []
        self._slots_row: BoxLayout | None = None
        self._pick_grid: GridLayout | None = None
        self._team_label: Label | None = None

    def reset(self) -> None:
        self.selected_team = []
        self._all_chars = []

    def validate(self) -> bool:
        return len(self.selected_team) > 0

    # ── Panel builder ──────────────────────────────────────────────────────────

    def build_panel(self, chars: list[dict]) -> BoxLayout:
        """Return the full team-select panel (slots + roster picker)."""
        self._all_chars = chars

        panel = BoxLayout(
            orientation='vertical',
            size_hint=(1, 1),
            padding=dp(8),
            spacing=dp(8),
        )

        self._team_label = Label(
            text=self._team_label_text(),
            font_size=dp(12),
            bold=True,
            color=(0.608, 0.557, 0.769, 1),
            size_hint_y=None,
            height=dp(24),
            halign='left',
            valign='middle',
        )
        self._team_label.bind(size=self._team_label.setter('text_size'))

        self._slots_row = BoxLayout(
            size_hint_y=None,
            height=dp(88),
            spacing=dp(8),
        )

        pick_label = Label(
            text='TAP TO ADD',
            font_size=dp(11),
            color=(0.361, 0.329, 0.502, 1),
            size_hint_y=None,
            height=dp(20),
            halign='center',
        )

        self._pick_grid = GridLayout(
            cols=2,
            size_hint_y=None,
            spacing=dp(8),
        )
        self._pick_grid.bind(minimum_height=self._pick_grid.setter('height'))

        scroll = ScrollView(size_hint=(1, 1), do_scroll_x=False)
        scroll.add_widget(self._pick_grid)

        panel.add_widget(self._team_label)
        panel.add_widget(self._slots_row)
        panel.add_widget(pick_label)
        panel.add_widget(scroll)

        self._refresh()
        return panel

    # ── Internal refresh ───────────────────────────────────────────────────────

    def _refresh(self) -> None:
        self._rebuild_slots()
        self._rebuild_pick_grid()
        if self._team_label:
            self._team_label.text = self._team_label_text()

    def _rebuild_slots(self) -> None:
        self._slots_row.clear_widgets()
        for i in range(TEAM_SIZE_MAX):
            if i < len(self.selected_team):
                char = self.selected_team[i]
                slot = self._filled_slot(char, i)
            else:
                slot = self._empty_slot()
            self._slots_row.add_widget(slot)

    def _rebuild_pick_grid(self) -> None:
        self._pick_grid.clear_widgets()
        team_ids = {c['id'] for c in self.selected_team}
        for char in self._all_chars:
            card = self._pick_card(char, char['id'] in team_ids)
            self._pick_grid.add_widget(card)

    # ── Widget factories ───────────────────────────────────────────────────────

    def _filled_slot(self, char: dict, idx: int) -> CharacterSlot:
        slot = CharacterSlot()
        slot.is_filled    = True
        slot.slot_label   = char.get('name', '?')
        slot.rarity_color = _RARITY_COLORS.get(char.get('rarity', 1), _DEFAULT_COLOR)
        slot.bind(on_release=lambda s, i=idx: self._on_remove(i))
        return slot

    def _empty_slot(self) -> CharacterSlot:
        slot = CharacterSlot()
        slot.is_filled  = False
        slot.slot_label = '+'
        return slot

    def _pick_card(self, char: dict, in_team: bool) -> RosterPickCard:
        card = RosterPickCard()
        card.char_name    = char.get('name', '???')
        card.char_class   = char.get('class_name', '')
        card.rarity_color = _RARITY_COLORS.get(char.get('rarity', 1), _DEFAULT_COLOR)
        card.in_team      = in_team
        card.bind(on_release=lambda c, ch=char: self._on_pick(ch))
        return card

    # ── Selection callbacks ────────────────────────────────────────────────────

    def _on_pick(self, char: dict) -> None:
        if len(self.selected_team) >= TEAM_SIZE_MAX:
            return
        if any(c['id'] == char['id'] for c in self.selected_team):
            return
        self.selected_team.append(char)
        self._refresh()

    def _on_remove(self, idx: int) -> None:
        if idx < len(self.selected_team):
            self.selected_team.pop(idx)
            self._refresh()

    def _team_label_text(self) -> str:
        return f'YOUR TEAM  ({len(self.selected_team)}/{TEAM_SIZE_MAX})'
