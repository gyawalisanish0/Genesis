"""
PreBattleScreen — 3-step wizard that flows into the battle screen.

Step 1 — Select Mode   (PreBattleScreen1)
Step 2 — Select Team   (PreBattleScreen2)
Step 3 — Confirm       (PreBattleScreen3)

On finish, builds Unit objects and calls BattleScreen.load_battle().

Navigation
----------
← back  : previous step or 'main_menu'
CONTINUE: next step; START BATTLE on step 3
"""
from __future__ import annotations

from kivy.app import App
from kivy.uix.screenmanager import Screen

import app.services.data_service as _data_service
import app.services.input_service as _input_service
from app.screens.pre_battle_screen_1 import PreBattleScreen1
from app.screens.pre_battle_screen_2 import PreBattleScreen2
from app.screens.pre_battle_screen_3 import PreBattleScreen3

_STEP_LABELS = {1: 'SELECT MODE', 2: 'SELECT TEAM', 3: 'CONFIRM'}


class PreBattleScreen(Screen):
    """3-step pre-battle wizard — orchestrates the three helper classes."""

    def __init__(self, **kwargs) -> None:
        super().__init__(**kwargs)
        self._step   = 1
        self._step1  = PreBattleScreen1()
        self._step2  = PreBattleScreen2()
        self._step3  = PreBattleScreen3()
        self._chars: list[dict] = []
        self._modes: list[dict] = []

    # ── Lifecycle ──────────────────────────────────────────────────────────────

    def on_enter(self) -> None:
        self._load_data()
        self._step1.reset()
        self._step2.reset()
        self._step3.reset()
        self._set_step(1)
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
        if self._step > 1:
            self._set_step(self._step - 1)
        else:
            self.manager.current = 'main_menu'

    def _on_continue(self) -> None:
        if self._step == 1:
            if self._step1.validate():
                self._set_step(2)
        elif self._step == 2:
            if self._step2.validate():
                self._set_step(3)
        else:
            self._launch_battle()

    # ── Step management ────────────────────────────────────────────────────────

    def _set_step(self, n: int) -> None:
        self._step = n
        self._update_dots()
        self._update_step_label()
        self._update_continue_btn()
        self._swap_panel(n)

    def _swap_panel(self, n: int) -> None:
        container = self.ids.step_container
        container.clear_widgets()
        if n == 1:
            container.add_widget(self._step1.build_panel(self._modes))
        elif n == 2:
            container.add_widget(self._step2.build_panel(self._chars))
        else:
            container.add_widget(
                self._step3.build_panel(
                    self._step1.selected_mode,
                    self._step2.selected_team,
                )
            )

    # ── Battle launch ──────────────────────────────────────────────────────────

    def _launch_battle(self) -> None:
        import traceback
        from kivy.logger import Logger
        try:
            self._do_launch_battle()
        except Exception as exc:
            Logger.error(
                'PreBattleScreen: _launch_battle CRASHED: %s\n%s',
                exc, traceback.format_exc(),
            )
            try:
                with open('/sdcard/genesis_crash.log', 'w') as f:
                    f.write(traceback.format_exc())
            except OSError:
                pass

    def _do_launch_battle(self) -> None:
        from kivy.logger import Logger
        Logger.info('PreBattleScreen: _do_launch_battle start')

        ctx = App.get_running_app().game_context
        ctx.selected_mode = self._step1.selected_mode or {}
        ctx.selected_team = self._step2.selected_team
        Logger.info('PreBattleScreen: selected_team size=%d', len(ctx.selected_team))

        Logger.info('PreBattleScreen: building player units')
        player_units = self._step3.build_player_units(ctx.selected_team)
        Logger.info('PreBattleScreen: player_units=%d', len(player_units))

        Logger.info('PreBattleScreen: building enemy units')
        enemy_units = self._step3.build_enemy_units(self._chars)
        Logger.info('PreBattleScreen: enemy_units=%d', len(enemy_units))
        ctx.enemies = enemy_units

        if not player_units:
            Logger.warning('PreBattleScreen: no player units — aborting launch')
            return

        Logger.info('PreBattleScreen: calling battle.load_battle()')
        battle = self.manager.get_screen('battle')
        battle.load_battle(player_units[0], enemy_units, player_units)
        Logger.info('PreBattleScreen: load_battle() done — switching to battle')
        self.manager.current = 'battle'
        Logger.info('PreBattleScreen: switched to battle')

    # ── Data loading ───────────────────────────────────────────────────────────

    def _load_data(self) -> None:
        ds = _data_service.get()
        self._chars = ds.get_all('character') if ds else []
        self._modes = ds.get_all('mode')      if ds else []

    # ── Header UI helpers ──────────────────────────────────────────────────────

    def _update_dots(self) -> None:
        for i in range(1, 4):
            dot = self.ids.get(f'dot_{i}')
            if dot:
                dot.opacity = 1.0 if i == self._step else 0.3

    def _update_step_label(self) -> None:
        label = self.ids.get('step_label')
        if label:
            label.text = _STEP_LABELS.get(self._step, '')

    def _update_continue_btn(self) -> None:
        btn = self.ids.get('continue_btn')
        if btn:
            btn.text = ('START BATTLE  \u25b6'
                        if self._step == 3
                        else 'CONTINUE  \u2192')
