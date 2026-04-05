"""
PreBattleScreen1 — Step 1: mode selection.

Builds a scrollable list of ModeCard widgets from the supplied mode dicts.
Tracks which mode is currently selected and exposes validate().
"""
from __future__ import annotations

from kivy.metrics import dp
from kivy.properties import BooleanProperty, StringProperty
from kivy.uix.behaviors import ButtonBehavior
from kivy.uix.boxlayout import BoxLayout
from kivy.uix.scrollview import ScrollView


class ModeCard(ButtonBehavior, BoxLayout):
    """Selectable mode card — layout defined in pre_battle_screen.kv."""

    mode_name    = StringProperty('')
    mode_desc    = StringProperty('')
    is_selected  = BooleanProperty(False)


class PreBattleScreen1:
    """Builds and manages the mode-selection panel for step 1."""

    def __init__(self) -> None:
        self.selected_mode: dict | None = None
        self._cards: list[ModeCard] = []

    def reset(self) -> None:
        self.selected_mode = None
        self._cards = []

    def validate(self) -> bool:
        return self.selected_mode is not None

    # ── Panel builder ──────────────────────────────────────────────────────────

    def build_panel(self, modes: list[dict]) -> ScrollView:
        """Return a ScrollView containing one ModeCard per mode."""
        self._cards = []

        inner = BoxLayout(
            orientation='vertical',
            size_hint_y=None,
            spacing=dp(8),
            padding=(dp(8), dp(8)),
        )
        inner.bind(minimum_height=inner.setter('height'))

        if not modes:
            from kivy.uix.label import Label
            inner.add_widget(Label(
                text='No modes available',
                font_size=dp(14),
                color=(0.608, 0.557, 0.769, 1),
            ))
        else:
            for mode in modes:
                card = self._build_card(mode)
                self._cards.append(card)
                inner.add_widget(card)

        scroll = ScrollView(size_hint=(1, 1), do_scroll_x=False)
        scroll.add_widget(inner)
        return scroll

    # ── Helpers ────────────────────────────────────────────────────────────────

    def _build_card(self, mode: dict) -> ModeCard:
        card = ModeCard()
        card.mode_name   = mode.get('name', mode.get('id', '???'))
        card.mode_desc   = mode.get('description', '')
        card.is_selected = False
        card.bind(on_release=lambda c, m=mode: self._on_select(m, c))
        return card

    def _on_select(self, mode: dict, tapped: ModeCard) -> None:
        self.selected_mode = mode
        for card in self._cards:
            card.is_selected = (card is tapped)
