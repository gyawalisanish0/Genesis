"""
BattleScreen — main combat screen orchestrator.

Composes BattleScreen1 (timeline) and BattleScreen2 (log + status slots).
Routes all input through InputService named events; never binds raw touch.

Usage
-----
    screen = BattleScreen(name='battle')
    screen.load_battle(player_unit, enemies, allies=[player_unit])
    screen_manager.switch_to(screen)
"""
from __future__ import annotations

import traceback

from kivy.animation import Animation
from kivy.app import App
from kivy.clock import Clock
from kivy.logger import Logger
from kivy.metrics import dp
from kivy.uix.screenmanager import Screen

from app.screens.battle_screen_1 import BattleScreen1
from app.screens.battle_screen_2 import BattleScreen2
from app.services import input_service

_SKILL_IDS = ('skill_1', 'skill_2', 'skill_3', 'skill_4')
_SKILL_GRID_HEIGHT_DP = 192
_OPPONENT_CARD_HEIGHT_DP = 130


class BattleScreen(Screen):
    """Combat screen — orchestrates timeline, log, and player input."""

    def __init__(self, **kwargs) -> None:
        super().__init__(**kwargs)
        self._timeline: BattleScreen1 | None = None
        self._log: BattleScreen2 | None = None
        self._player_unit = None
        self._enemies: list = []
        self._allies: list = []
        self._skills_expanded: bool = True
        self._skill_grid_full_h: float = dp(_SKILL_GRID_HEIGHT_DP)
        self._turn: int = 1
        self._is_player_turn: bool = True
        self._finish_event = None

    def on_kv_post(self, base_widget) -> None:
        self._timeline = BattleScreen1(self.ids.timeline_strip)
        self._log = BattleScreen2(
            self.ids.action_log_inner,
            self.ids.action_log_scroll,
            self.ids.status_slots_row,
        )

    def on_enter(self) -> None:
        svc = input_service.get()
        if svc:
            svc.bind(on_game_tap=self._on_tap)
            svc.bind(on_game_long_press=self._on_long_press)
            svc.bind(on_game_key=self._on_game_key)

    def on_leave(self) -> None:
        svc = input_service.get()
        if svc:
            svc.unbind(on_game_tap=self._on_tap)
            svc.unbind(on_game_long_press=self._on_long_press)
            svc.unbind(on_game_key=self._on_game_key)
        if self._finish_event:
            self._finish_event.cancel()
            self._finish_event = None

    def _on_game_key(self, _svc, action, key, modifiers) -> None:
        if action == 'cancel':
            self._on_back()

    def _on_back(self) -> None:
        """Abandon the current battle and return to main menu."""
        if self._finish_event:
            self._finish_event.cancel()
            self._finish_event = None
        self.manager.current = 'main_menu'

    # ── Battle setup ───────────────────────────────────────────────────────────

    def load_battle(self, player_unit, enemies: list, allies: list | None = None) -> None:
        """Populate the screen with battle data before entering."""
        try:
            self._do_load_battle(player_unit, enemies, allies)
        except Exception as exc:
            Logger.error(
                'BattleScreen: load_battle CRASHED: %s\n%s',
                exc, traceback.format_exc(),
            )
            try:
                with open('/sdcard/genesis_crash.log', 'w') as f:
                    f.write(traceback.format_exc())
            except OSError:
                pass

    def _do_load_battle(self, player_unit, enemies: list, allies: list | None = None) -> None:
        Logger.info('BattleScreen: _do_load_battle start, player=%s', getattr(player_unit, 'name', '?'))
        self._player_unit = player_unit
        self._enemies = enemies
        self._allies = allies or [player_unit]
        self._is_player_turn = True
        self._turn = 1

        Logger.info('BattleScreen: _refresh_player_panel')
        self._refresh_player_panel()

        Logger.info('BattleScreen: _refresh_skill_buttons')
        self._refresh_skill_buttons()

        if self._timeline is not None:
            Logger.info('BattleScreen: refresh_timeline')
            self._timeline.refresh_timeline(self._allies, self._enemies, player_unit)
        else:
            Logger.warning('BattleScreen: _timeline is None — skipping refresh_timeline')

        if self._log is not None:
            Logger.info('BattleScreen: refresh_status_slots')
            self._log.refresh_status_slots(player_unit)
            self._log.append_log('Battle started.')
        else:
            Logger.warning('BattleScreen: _log is None — skipping log init')

        Logger.info('BattleScreen: _hide_opponent_card')
        self._hide_opponent_card()
        Logger.info('BattleScreen: _do_load_battle complete')

    # ── Input routing ──────────────────────────────────────────────────────────

    def _on_tap(self, dispatcher, x: float, y: float) -> None:
        ids = self.ids
        if ids.collapse_btn.collide_point(x, y):
            self._on_collapse_toggle()
            return
        if ids.basic_btn.collide_point(x, y):
            self._on_basic_tap()
            return
        if ids.end_skip_btn.collide_point(x, y):
            self._on_end_skip_tap()
            return
        for i, sid in enumerate(_SKILL_IDS):
            if ids[sid].collide_point(x, y):
                self._on_skill_tap(i)
                return
        if self._log is not None:
            self._log.handle_status_tap(x, y)

    def _on_long_press(self, dispatcher, x: float, y: float) -> None:
        for i, sid in enumerate(_SKILL_IDS):
            if self.ids[sid].collide_point(x, y):
                self._on_skill_long_press(i)
                return

    # ── Skill actions ──────────────────────────────────────────────────────────

    def _on_skill_tap(self, slot_index: int) -> None:
        if not self._is_player_turn:
            return
        unit = self._player_unit
        if unit is None or slot_index >= len(unit.skills):
            return
        skill = unit.skills[slot_index]
        if not unit.spend_ap(getattr(skill, 'ap_cost', 0)):
            self._flash_insufficient_ap(slot_index)
            return
        self._dispatch_to_target(skill)

    def _on_skill_long_press(self, slot_index: int) -> None:
        unit = self._player_unit
        if unit is None or slot_index >= len(unit.skills):
            return
        from app.components.skill_detail_popup import SkillDetailPopup
        popup = SkillDetailPopup()
        popup.load_skill(unit.skills[slot_index])
        popup.open()

    def _on_basic_tap(self) -> None:
        if not self._is_player_turn:
            return
        self._dispatch_to_target(None)

    def _on_end_skip_tap(self) -> None:
        if not self._is_player_turn:
            return
        name = self._player_unit.name if self._player_unit else 'Player'
        self._log.append_log(f'{name} ends their turn.')
        self._end_player_turn()

    # ── Target selection ───────────────────────────────────────────────────────

    def _dispatch_to_target(self, skill) -> None:
        """Route skill/basic to single target or open target popup."""
        alive = [e for e in self._enemies if e.is_alive]
        if not alive:
            return
        if len(alive) == 1:
            self._resolve_action(skill, alive[0])
        else:
            self._open_target_popup(skill, alive)

    def _open_target_popup(self, skill, enemies: list) -> None:
        from app.components.target_select_popup import TargetSelectPopup
        popup = TargetSelectPopup()
        popup.load_targets(enemies)
        popup.bind(
            on_target_selected=lambda inst, unit: self._resolve_action(skill, unit)
        )
        popup.open()

    # ── Combat resolution ──────────────────────────────────────────────────────

    def _resolve_action(self, skill, target) -> None:
        actor = self._player_unit.name if self._player_unit else 'Player'
        action = getattr(skill, 'name', 'Basic Attack') if skill else 'Basic Attack'
        self._log.append_log(f'{actor} → {action} → {target.name}')
        self._end_player_turn()

    def _end_player_turn(self) -> None:
        self._is_player_turn = False
        self._set_enemy_turn_state()

    # ── UI state management ────────────────────────────────────────────────────

    def _refresh_player_panel(self) -> None:
        unit = self._player_unit
        if unit is None:
            return
        ids = self.ids
        Logger.info(
            'BattleScreen: panel — hp=%s/%s ap=%s/%s tick=%s',
            unit.hp, unit.max_hp, unit.ap, unit.max_ap, unit.tick_position,
        )
        ids.turn_counter_label.text = f'Turn {self._turn}'
        ids.tick_label.text = f'Tick: {unit.tick_position}'
        ids.hp_label.text = f'{unit.hp}/{unit.max_hp}'
        ids.hp_bar.value = unit.hp
        ids.hp_bar.max = unit.max_hp
        ids.ap_label.text = f'{int(unit.ap)}/{int(unit.max_ap)}'
        ids.ap_bar.value = unit.ap
        ids.ap_bar.max = unit.max_ap

    def _refresh_skill_buttons(self) -> None:
        unit = self._player_unit
        for i, sid in enumerate(_SKILL_IDS):
            slot = self.ids.get(sid)
            if slot is None:
                Logger.warning('BattleScreen: ids[%s] is None — skipping', sid)
                continue
            slot_ids = slot.ids
            if not slot_ids:
                Logger.warning('BattleScreen: slot.ids empty for %s — skipping', sid)
                continue
            has_skill = unit is not None and i < len(unit.skills)
            if has_skill:
                skill = unit.skills[i]
                if 'skill_name' in slot_ids:
                    slot_ids.skill_name.text = getattr(skill, 'name', '—')
                if 'skill_tuc' in slot_ids:
                    slot_ids.skill_tuc.text = f'TU:{getattr(skill, "tu_cost", "—")}'
                if 'skill_chrg' in slot_ids:
                    slot_ids.skill_chrg.text = f'×{getattr(skill, "charge", 0)}'
                if 'skill_lvl' in slot_ids:
                    slot_ids.skill_lvl.text = f'LVL {getattr(skill, "level", 1)}'
                slot.opacity = 1.0
            else:
                if 'skill_name' in slot_ids:
                    slot_ids.skill_name.text = '—'
                if 'skill_tuc' in slot_ids:
                    slot_ids.skill_tuc.text = ''
                if 'skill_chrg' in slot_ids:
                    slot_ids.skill_chrg.text = ''
                if 'skill_lvl' in slot_ids:
                    slot_ids.skill_lvl.text = ''
                slot.opacity = 0.3

    def _flash_insufficient_ap(self, slot_index: int) -> None:
        slot = self.ids[_SKILL_IDS[slot_index]]
        (Animation(opacity=0.2, duration=0.1) + Animation(opacity=0.5, duration=0.1)).start(slot)

    def _set_enemy_turn_state(self) -> None:
        ids = self.ids
        for sid in _SKILL_IDS:
            ids[sid].disabled = True
            ids[sid].opacity = 0.2
        ids.basic_btn.disabled = True
        ids.end_skip_btn.disabled = True
        # Prototype: no enemy AI — auto-resolve after a brief pause.
        self._finish_event = Clock.schedule_once(self._finish_battle, 1.5)

    def _finish_battle(self, dt: float) -> None:
        """Populate battle_result in GameContext and navigate to result screen."""
        self._finish_event = None
        ctx = App.get_running_app().game_context
        ctx.battle_result = {
            'outcome': 'victory',
            'turns':   self._turn,
            'xp_gained': max(50, self._turn * 30),
        }
        self.manager.current = 'battle_result'

    def _set_player_turn_state(self) -> None:
        self._is_player_turn = True
        ids = self.ids
        for sid in _SKILL_IDS:
            ids[sid].disabled = False
        ids.basic_btn.disabled = False
        ids.end_skip_btn.disabled = False
        self._refresh_skill_buttons()

    def _show_opponent_card(self, unit) -> None:
        ids = self.ids
        ids.opp_name.text = unit.name
        ids.opp_class.text = unit.class_name
        ids.opp_hp_bar.value = unit.hp
        ids.opp_hp_bar.max = unit.max_hp
        ids.opp_tu.text = f'TU: {unit.tick_position}'
        Animation(height=dp(_OPPONENT_CARD_HEIGHT_DP), opacity=1, duration=0.15).start(ids.opponent_card)

    def _hide_opponent_card(self) -> None:
        Animation(height=0, opacity=0, duration=0.15).start(self.ids.opponent_card)

    # ── Collapse toggle ────────────────────────────────────────────────────────

    def _on_collapse_toggle(self) -> None:
        self._skills_expanded = not self._skills_expanded
        self._animate_skill_grid(self._skills_expanded)
        self.ids.collapse_btn.text = '▼' if self._skills_expanded else '▲'

    def _animate_skill_grid(self, show: bool) -> None:
        target_h = self._skill_grid_full_h if show else 0
        Animation(height=target_h, duration=0.2).start(self.ids.skill_grid)
