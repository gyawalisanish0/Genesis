"""
MainMenuScreen — hub screen the player returns to between sessions.

Navigation
----------
PLAY          → 'pre_battle'
ROSTER        → 'roster'
MASTERY ROAD  → 'mastery_road'  (StubScreen)
SETTINGS      → 'settings'
SHOP          → 'shop'          (StubScreen)
"""
from __future__ import annotations

from kivy.uix.screenmanager import Screen


class MainMenuScreen(Screen):
    """Central hub — routes the player to every major feature."""

    def on_play(self) -> None:
        self.manager.current = 'pre_battle'

    def on_roster(self) -> None:
        self.manager.current = 'roster'

    def on_mastery_road(self) -> None:
        self.manager.current = 'mastery_road'

    def on_settings(self) -> None:
        self.manager.current = 'settings'

    def on_shop(self) -> None:
        self.manager.current = 'shop'
