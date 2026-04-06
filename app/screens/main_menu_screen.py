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

import app.services.input_service as _input_service


class MainMenuScreen(Screen):
    """Central hub — routes the player to every major feature."""

    def on_enter(self) -> None:
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

    def _on_back(self) -> None:
        """On Android: send the app to the background. On desktop: no-op."""
        from kivy.utils import platform
        if platform == 'android':
            try:
                from jnius import autoclass
                activity = autoclass('org.kivy.android.PythonActivity').mActivity
                activity.moveTaskToBack(True)
            except Exception:
                pass

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

    def on_debug(self) -> None:
        self.manager.current = 'debug'
