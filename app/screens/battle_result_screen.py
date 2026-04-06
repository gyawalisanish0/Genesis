"""
BattleResultScreen — shown after every battle concludes.

Reads game_context.battle_result for outcome data and
game_context.selected_team for the character list.

Navigation
----------
PLAY AGAIN → 'pre_battle'
MAIN MENU  → 'main_menu'
"""
from __future__ import annotations

from kivy.app import App
from kivy.metrics import dp
from kivy.uix.boxlayout import BoxLayout
from kivy.uix.gridlayout import GridLayout
from kivy.uix.label import Label
from kivy.uix.screenmanager import Screen

import app.services.input_service as _input_service

_OUTCOME_STYLE: dict[str, dict] = {
    'victory': {
        'title':    '\u2605 VICTORY \u2605',
        'sub':      'Battle Complete',
        'color':    (0.961, 0.620, 0.043, 1),
        'bg':       (0.110, 0.090, 0.020, 1),
    },
    'defeat': {
        'title':    '\u2715 DEFEAT',
        'sub':      'Better luck next time',
        'color':    (0.937, 0.267, 0.267, 1),
        'bg':       (0.100, 0.040, 0.040, 1),
    },
}
_FALLBACK_STYLE = _OUTCOME_STYLE['victory']


class BattleResultScreen(Screen):
    """Post-battle summary — banner, rewards, team rows, stats."""

    def on_enter(self) -> None:
        ctx = App.get_running_app().game_context
        result = ctx.battle_result
        team   = ctx.selected_team

        self._populate_banner(result)
        self._populate_rewards(result)
        self._populate_unit_rows(team)
        self._populate_stats(result)
        svc = _input_service.get()
        if svc:
            svc.bind(on_game_key=self._on_game_key)

    def on_leave(self) -> None:
        self.ids.unit_rows.clear_widgets()
        self.ids.stats_grid.clear_widgets()
        svc = _input_service.get()
        if svc:
            svc.unbind(on_game_key=self._on_game_key)

    def _on_game_key(self, _svc, action, key, modifiers) -> None:
        if action == 'cancel':
            self._on_back()

    # ── Navigation ─────────────────────────────────────────────────────────────

    def _on_back(self) -> None:
        self.manager.current = 'main_menu'

    def _on_play_again(self) -> None:
        self.manager.current = 'pre_battle'

    def _on_main_menu(self) -> None:
        self.manager.current = 'main_menu'

    # ── Section populators ─────────────────────────────────────────────────────

    def _populate_banner(self, result: dict) -> None:
        outcome = result.get('outcome', 'victory')
        style   = _OUTCOME_STYLE.get(outcome, _FALLBACK_STYLE)

        self.ids.result_title.text  = style['title']
        self.ids.result_title.color = style['color']
        self.ids.result_sub.text    = style['sub']
        self._set_banner_bg(style['bg'])

    def _populate_rewards(self, result: dict) -> None:
        xp = result.get('xp_gained', 0)
        self.ids.xp_label.text = f'+{xp} XP'

    def _populate_unit_rows(self, team: list[dict]) -> None:
        container = self.ids.unit_rows
        container.clear_widgets()
        if not team:
            container.add_widget(self._muted_label('No team data'))
            return
        for char in team:
            container.add_widget(self._unit_row(char))

    def _populate_stats(self, result: dict) -> None:
        grid = self.ids.stats_grid
        grid.clear_widgets()
        stats = [
            ('Turns',    str(result.get('turns', '—'))),
            ('Outcome',  result.get('outcome', '—').capitalize()),
        ]
        for label, value in stats:
            grid.add_widget(self._stat_label(label))
            grid.add_widget(self._stat_value(value))

    # ── Canvas helpers ─────────────────────────────────────────────────────────

    def _set_banner_bg(self, color: tuple) -> None:
        banner = self.ids.banner_box
        banner.canvas.before.clear()
        from kivy.graphics import Color, Rectangle
        with banner.canvas.before:
            Color(rgba=color)
            Rectangle(pos=banner.pos, size=banner.size)
        banner.bind(
            pos=lambda w, _: self._redraw_banner_bg(w, color),
            size=lambda w, _: self._redraw_banner_bg(w, color),
        )

    def _redraw_banner_bg(self, widget, color: tuple) -> None:
        widget.canvas.before.clear()
        from kivy.graphics import Color, Rectangle
        with widget.canvas.before:
            Color(rgba=color)
            Rectangle(pos=widget.pos, size=widget.size)

    # ── Widget factories ───────────────────────────────────────────────────────

    @staticmethod
    def _unit_row(char: dict) -> BoxLayout:
        row = BoxLayout(
            size_hint_y=None,
            height=dp(44),
            spacing=dp(8),
            padding=(dp(12), dp(4)),
        )
        from kivy.graphics import Color, RoundedRectangle
        with row.canvas.before:
            Color(rgba=(0.110, 0.106, 0.149, 1))
            RoundedRectangle(pos=row.pos, size=row.size, radius=[dp(6)])
        row.bind(
            pos=lambda r, _: BattleResultScreen._redraw_row(r),
            size=lambda r, _: BattleResultScreen._redraw_row(r),
        )
        row.add_widget(Label(
            text=char.get('name', '???'),
            font_size=dp(14),
            bold=True,
            color=(0.945, 0.941, 1.0, 1),
            halign='left',
            valign='middle',
        ))
        row.add_widget(Label(
            text=char.get('class_name', ''),
            font_size=dp(12),
            color=(0.608, 0.557, 0.769, 1),
            size_hint_x=None,
            width=dp(80),
            halign='right',
            valign='middle',
        ))
        return row

    @staticmethod
    def _redraw_row(row: BoxLayout) -> None:
        row.canvas.before.clear()
        from kivy.graphics import Color, RoundedRectangle
        with row.canvas.before:
            Color(rgba=(0.110, 0.106, 0.149, 1))
            RoundedRectangle(pos=row.pos, size=row.size, radius=[dp(6)])

    @staticmethod
    def _stat_label(text: str) -> Label:
        return Label(
            text=text,
            font_size=dp(12),
            color=(0.608, 0.557, 0.769, 1),
            halign='left',
            valign='middle',
        )

    @staticmethod
    def _stat_value(text: str) -> Label:
        return Label(
            text=text,
            font_size=dp(14),
            bold=True,
            color=(0.945, 0.941, 1.0, 1),
            halign='right',
            valign='middle',
        )

    @staticmethod
    def _muted_label(text: str) -> Label:
        return Label(
            text=text,
            font_size=dp(13),
            color=(0.361, 0.329, 0.502, 1),
            size_hint_y=None,
            height=dp(32),
            halign='center',
        )
