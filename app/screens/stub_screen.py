"""StubScreen — generic 'Coming Soon' placeholder for unbuilt screens."""
from __future__ import annotations

from kivy.properties import StringProperty
from kivy.uix.screenmanager import Screen

import app.services.input_service as _input_service


class StubScreen(Screen):
    """Displays a title and 'Coming Soon' message.

    Used for Mastery Road, Shop, and any other screen not yet implemented.
    Instantiate with title_text='SCREEN NAME'.
    """

    title_text = StringProperty('')

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
        self.manager.current = 'main_menu'
