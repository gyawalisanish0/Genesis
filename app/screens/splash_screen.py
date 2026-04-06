"""
SplashScreen — first screen shown on app launch.

Runs data_service.init(), animates a progress bar, then transitions
to 'main_menu'. If data loading fails it still transitions so the app
remains usable in a stub state during development.
"""
from __future__ import annotations

import os
import traceback

from kivy.animation import Animation
from kivy.clock import Clock
from kivy.logger import Logger
from kivy.metrics import dp
from kivy.uix.screenmanager import Screen

import app.services.data_service as _data_service

# Resolve data dir relative to main.py (two levels up from this file).
# Using normpath so the path works correctly on all platforms.
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
        Logger.info('SplashScreen: data dir = %s', _DATA_DIR)
        try:
            _data_service.init(_DATA_DIR)
            Logger.info('SplashScreen: data_service.init() OK')
        except Exception as exc:
            Logger.warning('SplashScreen: data load error (non-fatal): %s', exc)
        self._animate_progress(1.0)
        Clock.schedule_once(self._finish, 0.5)

    def _finish(self, dt: float) -> None:
        try:
            self.manager.current = 'main_menu'
        except Exception as exc:
            tb = traceback.format_exc()
            Logger.error('SplashScreen: crash on main_menu transition:\n%s', tb)
            self._show_error(tb)

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

    # ── Error display ──────────────────────────────────────────────────────────

    def _show_error(self, message: str) -> None:
        """Replace loading label with error text so the crash is visible on device."""
        label = self.ids.get('loading_label')
        if label is None:
            return
        label.text     = 'CRASH — see logcat\n\n' + message[:300]
        label.color    = (1.0, 0.35, 0.35, 1)
        label.font_size = dp(9)
        label.halign   = 'left'
        label.text_size = label.size
