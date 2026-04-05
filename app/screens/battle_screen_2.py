"""
BattleScreen2 — action log and status slots manager.

Receives widget references from BattleScreen and provides methods to:
- Append entries to the scrollable action log
- Rebuild the status slots pill row
- Handle status chip tap events (opening StatusDetailPopup)
"""
from __future__ import annotations

from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from kivy.uix.widget import Widget
    from kivy.uix.scrollview import ScrollView
    from app.core.characters.unit import Unit

_MAX_VISIBLE_STATUSES: int = 3
_LOG_ENTRY_HEIGHT_DP: int = 24
_STATUS_CHIP_SIZE_DP: int = 32
_TEXT_MUTED: tuple = (0.612, 0.639, 0.686, 1)
_TEXT_PRIMARY: tuple = (0.973, 0.973, 1.0, 1)


class BattleScreen2:
    """Manages the action log box and status slots pill for BattleScreen."""

    def __init__(
        self,
        log_inner: Widget,
        log_scroll: ScrollView,
        status_row: Widget,
    ) -> None:
        self._log_inner = log_inner
        self._log_scroll = log_scroll
        self._status_row = status_row
        # List of (widget, status_or_list) pairs for tap detection
        self._status_chips: list[tuple[Widget, object]] = []

    # ── Action log ─────────────────────────────────────────────────────────────

    def append_log(self, entry: str) -> None:
        """Add a text entry to the bottom of the action log."""
        from kivy.uix.label import Label
        from kivy.metrics import dp
        from kivy.clock import Clock

        label = Label(
            text=entry,
            size_hint_y=None,
            height=dp(_LOG_ENTRY_HEIGHT_DP),
            font_size='11sp',
            color=_TEXT_MUTED,
            halign='left',
            valign='middle',
        )
        label.bind(width=lambda inst, w: setattr(inst, 'text_size', (w, None)))
        self._log_inner.add_widget(label)
        Clock.schedule_once(lambda dt: self._scroll_to_bottom(), 0.05)

    def show_outcome(self, outcome: str, value: int | float) -> None:
        """Append a highlighted outcome line to the log."""
        self.append_log(f'{outcome}: {value}')

    # ── Status slots ───────────────────────────────────────────────────────────

    def refresh_status_slots(self, unit: Unit) -> None:
        """Rebuild the status chip row from unit.status_slots."""
        self._status_row.clear_widgets()
        self._status_chips = []
        statuses: list = getattr(unit, 'status_slots', []) or []
        visible = statuses[:_MAX_VISIBLE_STATUSES]
        overflow = len(statuses) - len(visible)
        for status in visible:
            chip = self._build_chip(status)
            self._status_row.add_widget(chip)
            self._status_chips.append((chip, status))
        if overflow > 0:
            label = self._build_overflow_label(overflow, statuses)
            self._status_row.add_widget(label)
            self._status_chips.append((label, statuses))

    def handle_status_tap(self, x: float, y: float) -> bool:
        """Check tap coordinates against status chips. Returns True if handled."""
        from app.components.status_detail_popup import StatusDetailPopup

        for chip, status in self._status_chips:
            if chip.collide_point(x, y):
                popup = StatusDetailPopup()
                popup.load_status(status)
                popup.open()
                return True
        return False

    # ── Private helpers ────────────────────────────────────────────────────────

    def _scroll_to_bottom(self) -> None:
        self._log_scroll.scroll_y = 0

    def _build_chip(self, status: object) -> Widget:
        from kivy.uix.label import Label
        from kivy.metrics import dp

        name = getattr(status, 'name', '?')
        label = Label(
            text=name[:2].upper(),
            size_hint=(None, None),
            size=(dp(_STATUS_CHIP_SIZE_DP), dp(_STATUS_CHIP_SIZE_DP)),
            font_size='11sp',
            color=_TEXT_PRIMARY,
        )
        return label

    def _build_overflow_label(self, count: int, all_statuses: list) -> Widget:
        from kivy.uix.label import Label
        from kivy.metrics import dp

        return Label(
            text=f'+{count}',
            size_hint=(None, None),
            size=(dp(_STATUS_CHIP_SIZE_DP), dp(_STATUS_CHIP_SIZE_DP)),
            font_size='12sp',
            color=_TEXT_PRIMARY,
        )
