"""
PreBattleScreen3 — Step 3: summary + Unit assembly.

Displays a read-only summary of the chosen mode and team.
Exposes build_player_units() and build_enemy_units() which the orchestrator
calls just before launching the battle screen.
"""
from __future__ import annotations

from kivy.metrics import dp
from kivy.uix.boxlayout import BoxLayout
from kivy.uix.label import Label
from kivy.uix.scrollview import ScrollView

from app.core.characters.stat_block import StatBlock
from app.core.characters.unit import Unit


class PreBattleScreen3:
    """Builds the confirmation panel and assembles Unit objects for battle."""

    def reset(self) -> None:
        pass  # no state to clear

    def validate(self) -> bool:
        return True  # step 3 is always passable

    # ── Panel builder ──────────────────────────────────────────────────────────

    def build_panel(self, mode: dict, team: list[dict]) -> ScrollView:
        """Return a summary ScrollView for the chosen mode and team."""
        inner = BoxLayout(
            orientation='vertical',
            size_hint_y=None,
            padding=dp(16),
            spacing=dp(12),
        )
        inner.bind(minimum_height=inner.setter('height'))

        inner.add_widget(self._section_label('SELECTED MODE'))
        inner.add_widget(self._value_label(mode.get('name', '—') if mode else '—'))

        desc = mode.get('description', '') if mode else ''
        if desc:
            inner.add_widget(self._body_label(desc))

        inner.add_widget(self._divider())
        inner.add_widget(self._section_label('YOUR TEAM'))

        if team:
            for char in team:
                inner.add_widget(self._char_row(char))
        else:
            inner.add_widget(self._body_label('No characters selected.'))

        inner.add_widget(self._divider())
        inner.add_widget(self._section_label('GENESIS ITEMS'))
        inner.add_widget(self._body_label('Not equipped  —  coming soon'))

        scroll = ScrollView(size_hint=(1, 1), do_scroll_x=False)
        scroll.add_widget(inner)
        return scroll

    # ── Unit assembly ──────────────────────────────────────────────────────────

    def build_player_units(self, team: list[dict]) -> list[Unit]:
        """Convert selected character dicts into runtime Unit objects."""
        return [self._char_to_unit(c) for c in team]

    def build_enemy_units(self, all_chars: list[dict]) -> list[Unit]:
        """Create one dummy enemy from the first available character dict."""
        if not all_chars:
            return [self._dummy_enemy()]
        template = dict(all_chars[0])
        template['name'] = 'Enemy ' + template.get('name', 'Unit')
        return [self._char_to_unit(template)]

    # ── Helpers — Unit construction ────────────────────────────────────────────

    def _char_to_unit(self, char: dict) -> Unit:
        stats = StatBlock(**char['stats'])
        return Unit(
            name=char['name'],
            class_name=char['class_name'],
            rarity=char.get('rarity', 1),
            stats=stats,
            max_hp=char['max_hp'],
            max_ap=char['max_ap'],
            ap_regen_rate=char['ap_regen_rate'],
        )

    def _dummy_enemy(self) -> Unit:
        return Unit(
            name='Training Dummy',
            class_name='Warrior',
            rarity=1,
            stats=StatBlock(strength=40, endurance=40, power=10,
                            resistance=20, speed=30, precision=40),
            max_hp=600,
            max_ap=100.0,
            ap_regen_rate=8.0,
        )

    # ── Helpers — widget factories ─────────────────────────────────────────────

    @staticmethod
    def _section_label(text: str) -> Label:
        return Label(
            text=text,
            font_size=dp(11),
            bold=True,
            color=(0.545, 0.361, 0.965, 1),
            size_hint_y=None,
            height=dp(28),
            halign='left',
            valign='bottom',
            text_size=(None, dp(28)),
        )

    @staticmethod
    def _value_label(text: str) -> Label:
        return Label(
            text=text,
            font_size=dp(16),
            bold=True,
            color=(0.945, 0.941, 1.0, 1),
            size_hint_y=None,
            height=dp(32),
            halign='left',
            valign='middle',
            text_size=(None, dp(32)),
        )

    @staticmethod
    def _body_label(text: str) -> Label:
        return Label(
            text=text,
            font_size=dp(13),
            color=(0.608, 0.557, 0.769, 1),
            size_hint_y=None,
            height=dp(24),
            halign='left',
            valign='middle',
            text_size=(None, dp(24)),
        )

    @staticmethod
    def _char_row(char: dict) -> BoxLayout:
        row = BoxLayout(size_hint_y=None, height=dp(32), spacing=dp(8))
        row.add_widget(Label(
            text=char.get('name', '???'),
            font_size=dp(14),
            color=(0.945, 0.941, 1.0, 1),
            halign='left',
            valign='middle',
        ))
        row.add_widget(Label(
            text=char.get('class_name', ''),
            font_size=dp(12),
            color=(0.608, 0.557, 0.769, 1),
            halign='right',
            valign='middle',
            size_hint_x=None,
            width=dp(80),
        ))
        return row

    @staticmethod
    def _divider() -> BoxLayout:
        box = BoxLayout(size_hint_y=None, height=dp(1))
        from kivy.graphics import Color, Rectangle
        with box.canvas.before:
            Color(rgba=(0.141, 0.137, 0.188, 1))
            Rectangle(pos=box.pos, size=box.size)
        box.bind(
            pos=lambda b, _: setattr(b.canvas.before.children[1], 'pos', b.pos),
            size=lambda b, _: setattr(b.canvas.before.children[1], 'size', b.size),
        )
        return box
