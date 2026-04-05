"""
DebugScreen — in-app developer tools.

Accessible from the main menu when GENESIS_DEBUG=1.
Provides quick-nav to every screen (with auto-filled state where needed),
a data-service cache summary, and the current GameContext snapshot.

Never imported or referenced from non-debug code paths.
"""
from __future__ import annotations

from kivy.app import App
from kivy.clock import Clock
from kivy.metrics import dp
from kivy.uix.screenmanager import Screen

import app.services.data_service as _data_service
from app.screens.pre_battle_screen_3 import PreBattleScreen3


class DebugScreen(Screen):
    """Developer tools — quick nav, state inspector, test-data injectors."""

    def on_enter(self) -> None:
        self._refresh_ds_stats()
        self._refresh_ctx_snapshot()
        Clock.schedule_interval(self._tick_fps, 0.5)

    def on_leave(self) -> None:
        Clock.unschedule(self._tick_fps)

    # ── Navigation ─────────────────────────────────────────────────────────────

    def _on_back(self) -> None:
        self.manager.current = 'main_menu'

    # ── Quick-nav handlers ─────────────────────────────────────────────────────

    def go_splash(self)        -> None: self.manager.current = 'splash'
    def go_main_menu(self)     -> None: self.manager.current = 'main_menu'
    def go_roster(self)        -> None: self.manager.current = 'roster'
    def go_pre_battle(self)    -> None: self.manager.current = 'pre_battle'
    def go_settings(self)      -> None: self.manager.current = 'settings'
    def go_mastery_road(self)  -> None: self.manager.current = 'mastery_road'
    def go_shop(self)          -> None: self.manager.current = 'shop'

    def go_battle(self) -> None:
        """Jump straight into battle using the first available character."""
        ctx = App.get_running_app().game_context
        step3 = PreBattleScreen3()

        ds = _data_service.get()
        chars = ds.get_all('character') if ds else []
        modes = ds.get_all('mode')      if ds else []

        team = chars[:1]   # first character only
        ctx.selected_mode  = modes[0] if modes else {}
        ctx.selected_team  = team
        player_units       = step3.build_player_units(team)
        enemy_units        = step3.build_enemy_units(chars)
        ctx.enemies        = enemy_units

        if not player_units:
            self.ids.status_label.text = 'No characters in data — cannot start battle.'
            return

        battle = self.manager.get_screen('battle')
        battle.load_battle(player_units[0], enemy_units, player_units)
        self.manager.current = 'battle'

    def go_battle_result(self) -> None:
        """Jump to battle result with a sample victory payload."""
        ctx = App.get_running_app().game_context
        ds  = _data_service.get()
        ctx.selected_team  = ds.get_all('character')[:1] if ds else []
        ctx.battle_result  = {'outcome': 'victory', 'turns': 3, 'xp_gained': 90}
        self.manager.current = 'battle_result'

    def go_defeat(self) -> None:
        """Jump to battle result with a sample defeat payload."""
        ctx = App.get_running_app().game_context
        ds  = _data_service.get()
        ctx.selected_team  = ds.get_all('character')[:2] if ds else []
        ctx.battle_result  = {'outcome': 'defeat', 'turns': 7, 'xp_gained': 20}
        self.manager.current = 'battle_result'

    # ── Stats refresh ──────────────────────────────────────────────────────────

    def _refresh_ds_stats(self) -> None:
        ds = _data_service.get()
        if ds is None:
            self.ids.ds_stats.text = 'data_service not initialised'
            return
        lines = []
        for entity_type in ('character', 'mode', 'skill', 'genesis_item', 'campaign_item', 'quest'):
            count = len(ds.get_all(entity_type))
            if count:
                lines.append(f'{entity_type:<18} {count}')
        self.ids.ds_stats.text = '\n'.join(lines) if lines else 'No entities cached'

    def _refresh_ctx_snapshot(self) -> None:
        ctx   = App.get_running_app().game_context
        mode  = ctx.selected_mode.get('name', '—') if ctx.selected_mode else '—'
        team  = ', '.join(c.get('name', '?') for c in ctx.selected_team) or '—'
        result = ctx.battle_result.get('outcome', '—') if ctx.battle_result else '—'
        self.ids.ctx_snapshot.text = (
            f'mode    {mode}\n'
            f'team    {team}\n'
            f'result  {result}'
        )

    def _tick_fps(self, dt: float) -> None:
        from kivy.clock import Clock as _Clock
        fps = _Clock.get_fps()
        self.ids.fps_label.text = f'FPS  {fps:.0f}'
