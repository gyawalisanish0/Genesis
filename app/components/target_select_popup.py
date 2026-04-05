"""
TargetSelectPopup — enemy target selection modal.

Opens when a skill or basic attack is used and more than one enemy is alive.
Dispatches `on_target_selected(unit)` when a target row is tapped, then
dismisses itself. The caller binds this event before calling `open()`.

Usage
-----
    popup = TargetSelectPopup()
    popup.load_targets(alive_enemies)
    popup.bind(on_target_selected=lambda inst, unit: resolve(unit))
    popup.open()
"""
from __future__ import annotations

from kivy.uix.modalview import ModalView
from kivy.metrics import dp

_ROW_HEIGHT_DP: int = 60
_HEADER_HEIGHT_DP: int = 40
_CANCEL_HEIGHT_DP: int = 44
_BG_CARD: tuple = (0.110, 0.110, 0.157, 1)
_TEXT_PRIMARY: tuple = (0.973, 0.973, 1.0, 1)
_TEXT_SECONDARY: tuple = (0.612, 0.639, 0.686, 1)
_ACCENT_DANGER: tuple = (0.937, 0.267, 0.267, 1)


class TargetSelectPopup(ModalView):
    """Modal for selecting an enemy target before resolving an action."""

    __events__ = ('on_target_selected',)

    def __init__(self, **kwargs) -> None:
        kwargs.setdefault('size_hint', (0.85, None))
        kwargs.setdefault('background_color', (0, 0, 0, 0))
        super().__init__(**kwargs)
        self._build_shell()

    # ── Public API ─────────────────────────────────────────────────────────────

    def load_targets(self, enemies: list) -> None:
        """Populate the popup with one row per enemy."""
        self._enemy_list.clear_widgets()
        for unit in enemies:
            row = self._build_enemy_row(unit)
            self._enemy_list.add_widget(row)
        total_h = (
            dp(_HEADER_HEIGHT_DP)
            + dp(_ROW_HEIGHT_DP) * len(enemies)
            + dp(_CANCEL_HEIGHT_DP)
        )
        self.height = total_h

    # ── Default event handler (required by Kivy EventDispatcher) ──────────────

    def on_target_selected(self, unit) -> None:
        pass

    # ── Private helpers ────────────────────────────────────────────────────────

    def _build_shell(self) -> None:
        from kivy.uix.boxlayout import BoxLayout
        from kivy.uix.label import Label
        from kivy.uix.button import Button
        from kivy.graphics import Color, RoundedRectangle

        root = BoxLayout(orientation='vertical')

        with root.canvas.before:
            Color(*_BG_CARD)
            self._bg_rect = RoundedRectangle(radius=[dp(12)])

        root.bind(
            pos=lambda inst, v: setattr(self._bg_rect, 'pos', v),
            size=lambda inst, v: setattr(self._bg_rect, 'size', v),
        )

        header = Label(
            text='Select Target',
            font_size='14sp',
            color=_TEXT_PRIMARY,
            size_hint_y=None,
            height=dp(_HEADER_HEIGHT_DP),
        )
        root.add_widget(header)

        from kivy.uix.scrollview import ScrollView
        scroll = ScrollView(do_scroll_x=False)
        self._enemy_list = BoxLayout(
            orientation='vertical',
            size_hint_y=None,
        )
        self._enemy_list.bind(minimum_height=self._enemy_list.setter('height'))
        scroll.add_widget(self._enemy_list)
        root.add_widget(scroll)

        cancel_btn = Button(
            text='Cancel',
            font_size='13sp',
            color=_TEXT_SECONDARY,
            size_hint_y=None,
            height=dp(_CANCEL_HEIGHT_DP),
            background_color=(0, 0, 0, 0),
        )
        cancel_btn.bind(on_release=lambda *_: self.dismiss())
        root.add_widget(cancel_btn)

        self.add_widget(root)

    def _build_enemy_row(self, unit) -> object:
        from kivy.uix.boxlayout import BoxLayout
        from kivy.uix.label import Label
        from kivy.uix.button import Button

        row = Button(
            size_hint_y=None,
            height=dp(_ROW_HEIGHT_DP),
            background_color=(0, 0, 0, 0),
        )

        inner = BoxLayout(
            orientation='horizontal',
            spacing=dp(8),
            padding=(dp(12), dp(8)),
        )

        name_label = Label(
            text=unit.name,
            font_size='13sp',
            color=_TEXT_PRIMARY,
            halign='left',
            text_size=(None, None),
        )
        inner.add_widget(name_label)

        hp_pct = int(unit.hp / max(unit.max_hp, 1) * 100)
        hp_label = Label(
            text=f'{unit.hp}/{unit.max_hp}',
            font_size='11sp',
            color=_ACCENT_DANGER,
            size_hint_x=None,
            width=dp(60),
        )
        inner.add_widget(hp_label)

        row.add_widget(inner)
        row.bind(on_release=lambda inst, u=unit: self._on_row_tap(u))
        return row

    def _on_row_tap(self, unit) -> None:
        self.dismiss()
        self.dispatch('on_target_selected', unit)
