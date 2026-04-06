"""
RosterScreen — scrollable character collection grid.

Displays all unlocked characters from data_service with class and rarity
filters. Tapping a card selects it and updates the visual highlight.

Navigation
----------
← back → 'main_menu'
"""
from __future__ import annotations

from kivy.uix.screenmanager import Screen

import app.services.data_service as _data_service
import app.services.input_service as _input_service
from app.screens.roster_screen_1 import RosterScreen1


class RosterScreen(Screen):
    """Roster hub — orchestrates filter state and card grid rebuilds."""

    def __init__(self, **kwargs) -> None:
        super().__init__(**kwargs)
        self._helper = RosterScreen1()
        self._all_chars: list[dict] = []
        self._class_filter: str = 'All'
        self._rarity_filter: int = 0   # 0 = show all rarities

    # ── Lifecycle ──────────────────────────────────────────────────────────────

    def on_enter(self) -> None:
        self._load_chars()
        self._build_filters()
        self._rebuild_grid()
        svc = _input_service.get()
        if svc:
            svc.bind(on_game_key=self._on_game_key)

    def on_leave(self) -> None:
        svc = _input_service.get()
        if svc:
            svc.unbind(on_game_key=self._on_game_key)

    def _on_game_key(self, _svc, action, key, modifiers) -> None:
        if action == 'cancel':
            self._on_back()

    # ── Navigation ─────────────────────────────────────────────────────────────

    def _on_back(self) -> None:
        self.manager.current = 'main_menu'

    # ── Data loading ───────────────────────────────────────────────────────────

    def _load_chars(self) -> None:
        ds = _data_service.get()
        self._all_chars = ds.get_all('character') if ds else []

    # ── Filter construction ────────────────────────────────────────────────────

    def _build_filters(self) -> None:
        self._helper.build_class_tabs(
            self._all_chars,
            self.ids.class_filter_row,
            self._on_class_filter,
        )
        self._helper.build_rarity_chips(
            self._all_chars,
            self.ids.rarity_filter_row,
            self._on_rarity_filter,
        )
        self._update_count_label()

    # ── Filter callbacks ───────────────────────────────────────────────────────

    def _on_class_filter(self, class_name: str) -> None:
        self._class_filter = class_name
        self._rebuild_grid()

    def _on_rarity_filter(self, rarity: int) -> None:
        self._rarity_filter = rarity
        self._rebuild_grid()

    # ── Grid rebuild ───────────────────────────────────────────────────────────

    def _rebuild_grid(self) -> None:
        visible = self._helper.filter_chars(
            self._all_chars, self._class_filter, self._rarity_filter
        )
        self._helper.populate_grid(visible, self.ids.char_grid)
        self._update_count_label()

    def _update_count_label(self) -> None:
        total = len(self._all_chars)
        self.ids.count_label.text = f'{total} characters'
