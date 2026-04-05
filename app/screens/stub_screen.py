"""StubScreen — generic 'Coming Soon' placeholder for unbuilt screens."""
from __future__ import annotations

from kivy.properties import StringProperty
from kivy.uix.screenmanager import Screen


class StubScreen(Screen):
    """Displays a title and 'Coming Soon' message.

    Used for Mastery Road, Shop, and any other screen not yet implemented.
    Instantiate with title_text='SCREEN NAME'.
    """

    title_text = StringProperty('')

    def _on_back(self) -> None:
        self.manager.current = 'main_menu'
