"""
SplashScreen — first screen shown on app launch.

Runs data_service.init(), animates a progress bar, then transitions
to 'main_menu'. If data loading fails it still transitions so the app
remains usable in a stub state during development.
"""
from __future__ import annotations

import os

from kivy.app import App
from kivy.clock import Clock
from kivy.metrics import dp
from kivy.animation import Animation
from kivy.uix.screenmanager import Screen

import app.services.data_service as _data_service

_DATA_DIR = os.path.normpath(
    os.path.join(os.path.dirname(__file__), '..', '..', 'assets', 'data')
)
_PROGRESS_BAR_DP = 220


class SplashScreen(Screen):
    """Loads JSON definitions and transitions to the main menu."""

    def on_enter(self) -> None:
        self._set_progress(0.0)
        Clock.schedule_once(self._begin_load, 0.15)

    # ── Loading sequence ───────────────────────────────────────────────────────

    def _begin_load(self, dt: float) -> None:
        self._animate_progress(0.25)
        Clock.schedule_once(self._do_load, 0.3)

    def _do_load(self, dt: float) -> None:
        try:
            _data_service.init(_DATA_DIR)
        except Exception:
            pass  # non-fatal in prototype; screens guard against missing data
        self._animate_progress(1.0)
        Clock.schedule_once(self._finish, 0.5)

    def _finish(self, dt: float) -> None:
        self.manager.current = 'main_menu'

    # ── Progress helpers ───────────────────────────────────────────────────────

    def _set_progress(self, value: float) -> None:
        fill = self.ids.get('progress_fill')
        if fill is not None:
            fill.width = dp(_PROGRESS_BAR_DP) * value

    def _animate_progress(self, value: float) -> None:
        fill = self.ids.get('progress_fill')
        if fill is None:
            return
        Animation(
            width=dp(_PROGRESS_BAR_DP) * value,
            duration=0.4,
            t='out_cubic',
        ).start(fill)
