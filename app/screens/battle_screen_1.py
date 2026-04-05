"""
BattleScreen1 — vertical tick timeline strip manager.

Receives the `timeline_strip` Widget reference from BattleScreen and rebuilds
unit markers whenever the tick order changes. Allies point right (→); enemies
point left (←). The active unit's marker is sized larger with an accent ring.

No Kivy imports at module level — all Kivy usage is deferred to method bodies
so this helper stays importable without a running Kivy app.
"""
from __future__ import annotations

from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from kivy.uix.widget import Widget
    from app.core.characters.unit import Unit

_MARKER_HEIGHT_DP: int = 24
_MARKER_HEIGHT_ACTIVE_DP: int = 28
_FAR_TICK_THRESHOLD: int = 20
_FAR_OPACITY: float = 0.4


class BattleScreen1:
    """Manages the vertical timeline strip for BattleScreen."""

    def __init__(self, strip_widget: Widget) -> None:
        self._strip = strip_widget
        self._active_unit: Unit | None = None

    # ── Public API ─────────────────────────────────────────────────────────────

    def refresh_timeline(
        self,
        allies: list[Unit],
        enemies: list[Unit],
        active_unit: Unit | None,
    ) -> None:
        """Rebuild all markers sorted by ascending tick_position (soonest = top)."""
        self._active_unit = active_unit
        self._strip.clear_widgets()
        tagged = [(u, True) for u in allies] + [(u, False) for u in enemies]
        for unit, is_ally in self._sort_by_tick(tagged):
            marker = self._build_marker(unit, is_ally)
            self._strip.add_widget(marker)

    # ── Internal helpers ───────────────────────────────────────────────────────

    def _sort_by_tick(
        self, tagged: list[tuple[Unit, bool]]
    ) -> list[tuple[Unit, bool]]:
        return sorted(tagged, key=lambda t: t[0].tick_position)

    def _build_marker(self, unit: Unit, is_ally: bool) -> Widget:
        from kivy.uix.boxlayout import BoxLayout
        from kivy.uix.label import Label
        from kivy.metrics import dp

        is_active = unit is self._active_unit
        height = _MARKER_HEIGHT_ACTIVE_DP if is_active else _MARKER_HEIGHT_DP
        is_far = unit.tick_position >= _FAR_TICK_THRESHOLD

        row = BoxLayout(
            orientation='horizontal',
            size_hint=(1, None),
            height=dp(height),
            opacity=_FAR_OPACITY if is_far else 1.0,
        )
        arrow = '→' if is_ally else '←'
        initial = unit.name[:1].upper() if unit.name else '?'
        label = Label(
            text=f'{initial}{arrow}',
            font_size='9sp',
            halign='center',
            valign='middle',
        )
        label.bind(size=label.setter('text_size'))
        row.add_widget(label)
        return row
