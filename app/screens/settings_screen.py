"""
SettingsScreen — adjustable game preferences.

Reads from and writes to App.get_running_app().settings (a plain dict).
All state is applied immediately on widget interaction; there is no
explicit Save button — values persist for the session.

Sections
--------
AUDIO        music_volume, sfx_volume, mute_all
DISPLAY      reduce_animations, show_damage_numbers, timeline_zoom
GAMEPLAY     battle_reminders, new_content_alerts
"""
from __future__ import annotations

from kivy.app import App
from kivy.uix.screenmanager import Screen

import app.services.input_service as _input_service


class SettingsScreen(Screen):
    """Settings hub — syncs widgets with App.settings on enter."""

    # ── Lifecycle ──────────────────────────────────────────────────────────────

    def on_enter(self) -> None:
        self._sync_from_settings()
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

    # ── Sync ───────────────────────────────────────────────────────────────────

    def _sync_from_settings(self) -> None:
        s = App.get_running_app().settings
        ids = self.ids
        ids.music_slider.value    = s['music_volume']
        ids.sfx_slider.value      = s['sfx_volume']
        ids.mute_switch.active    = s['mute_all']
        ids.anim_switch.active    = s['reduce_animations']
        ids.dmg_switch.active     = s['show_damage_numbers']
        ids.zoom_slider.value     = s['timeline_zoom']
        ids.remind_switch.active  = s['battle_reminders']
        ids.alerts_switch.active  = s['new_content_alerts']
        self._update_music_label(s['music_volume'])
        self._update_sfx_label(s['sfx_volume'])
        self._update_zoom_label(s['timeline_zoom'])

    def _write(self, key: str, value) -> None:
        App.get_running_app().settings[key] = value

    # ── Handlers — AUDIO ───────────────────────────────────────────────────────

    def _on_music_volume(self, value: float) -> None:
        self._write('music_volume', value)
        self._update_music_label(value)

    def _on_sfx_volume(self, value: float) -> None:
        self._write('sfx_volume', value)
        self._update_sfx_label(value)

    def _on_mute_all(self, active: bool) -> None:
        self._write('mute_all', active)

    # ── Handlers — DISPLAY ─────────────────────────────────────────────────────

    def _on_reduce_animations(self, active: bool) -> None:
        self._write('reduce_animations', active)

    def _on_show_damage_numbers(self, active: bool) -> None:
        self._write('show_damage_numbers', active)

    def _on_timeline_zoom(self, value: float) -> None:
        self._write('timeline_zoom', int(value))
        self._update_zoom_label(value)

    # ── Handlers — GAMEPLAY ────────────────────────────────────────────────────

    def _on_battle_reminders(self, active: bool) -> None:
        self._write('battle_reminders', active)

    def _on_new_content_alerts(self, active: bool) -> None:
        self._write('new_content_alerts', active)

    # ── Label updaters ─────────────────────────────────────────────────────────

    def _update_music_label(self, value: float) -> None:
        self.ids.music_val.text = f'{int(value * 100)}%'

    def _update_sfx_label(self, value: float) -> None:
        self.ids.sfx_val.text = f'{int(value * 100)}%'

    def _update_zoom_label(self, value: float) -> None:
        self.ids.zoom_val.text = str(int(value))
