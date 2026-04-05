"""
StatusDetailPopup — status effect detail modal.

Opens when a status chip is tapped. When `status` is a list (overflow tap),
renders a scrollable list of all statuses. When `status` is a single object,
renders that status's details directly.

Usage
-----
    # Single status
    popup = StatusDetailPopup()
    popup.load_status(status_object)
    popup.open()

    # All statuses (overflow)
    popup = StatusDetailPopup()
    popup.load_status(list_of_statuses)
    popup.open()
"""
from __future__ import annotations

from kivy.uix.modalview import ModalView
from kivy.metrics import dp

_BG_CARD: tuple = (0.110, 0.110, 0.157, 1)
_TEXT_PRIMARY: tuple = (0.973, 0.973, 1.0, 1)
_TEXT_SECONDARY: tuple = (0.612, 0.639, 0.686, 1)
_TEXT_MUTED: tuple = (0.294, 0.333, 0.388, 1)
_STATUS_ROW_HEIGHT_DP: int = 80


class StatusDetailPopup(ModalView):
    """Modal showing detail for one or all active status effects."""

    def __init__(self, **kwargs) -> None:
        kwargs.setdefault('size_hint', (0.85, None))
        kwargs.setdefault('height', dp(200))
        kwargs.setdefault('background_color', (0, 0, 0, 0))
        super().__init__(**kwargs)

    # ── Public API ─────────────────────────────────────────────────────────────

    def load_status(self, status) -> None:
        """Accept a single status object or a list of status objects."""
        self.clear_widgets()
        if isinstance(status, list):
            self._build_list_view(status)
        else:
            self._build_single_view(status)

    # ── Single status view ────────────────────────────────────────────────────

    def _build_single_view(self, status) -> None:
        from kivy.uix.boxlayout import BoxLayout
        from kivy.uix.label import Label
        from kivy.uix.button import Button
        from kivy.graphics import Color, RoundedRectangle

        root = BoxLayout(orientation='vertical', padding=dp(16), spacing=dp(10))
        self._apply_bg(root)

        name = getattr(status, 'name', 'Unknown')
        desc = getattr(status, 'description', 'No description.')
        duration = getattr(status, 'duration', None)
        source = getattr(status, 'source', None)

        root.add_widget(Label(
            text=name,
            font_size='15sp',
            color=_TEXT_PRIMARY,
            size_hint_y=None,
            height=dp(24),
            halign='left',
        ))

        desc_lbl = Label(
            text=desc,
            font_size='12sp',
            color=_TEXT_SECONDARY,
            halign='left',
            valign='top',
        )
        desc_lbl.bind(width=lambda inst, w: setattr(inst, 'text_size', (w, None)))
        root.add_widget(desc_lbl)

        if duration is not None:
            root.add_widget(self._small_label(f'Duration: {duration}'))
        if source is not None:
            src_name = getattr(source, 'name', str(source))
            root.add_widget(self._small_label(f'Applied by: {src_name}'))

        root.add_widget(self._close_button())
        self.add_widget(root)

    # ── List view (overflow) ──────────────────────────────────────────────────

    def _build_list_view(self, statuses: list) -> None:
        from kivy.uix.boxlayout import BoxLayout
        from kivy.uix.label import Label
        from kivy.uix.scrollview import ScrollView

        root = BoxLayout(orientation='vertical', padding=dp(12), spacing=dp(8))
        self._apply_bg(root)

        root.add_widget(Label(
            text='Active Statuses',
            font_size='14sp',
            color=_TEXT_PRIMARY,
            size_hint_y=None,
            height=dp(28),
        ))

        scroll = ScrollView(do_scroll_x=False)
        inner = BoxLayout(orientation='vertical', size_hint_y=None, spacing=dp(6))
        inner.bind(minimum_height=inner.setter('height'))

        for status in statuses:
            inner.add_widget(self._build_status_row(status))

        scroll.add_widget(inner)
        root.add_widget(scroll)
        root.add_widget(self._close_button())
        self.height = min(dp(400), dp(80 + _STATUS_ROW_HEIGHT_DP * len(statuses) + 60))
        self.add_widget(root)

    def _build_status_row(self, status) -> object:
        from kivy.uix.boxlayout import BoxLayout
        from kivy.uix.label import Label

        row = BoxLayout(
            orientation='vertical',
            size_hint_y=None,
            height=dp(_STATUS_ROW_HEIGHT_DP),
            padding=dp(4),
            spacing=dp(2),
        )
        row.add_widget(Label(
            text=getattr(status, 'name', '?'),
            font_size='13sp',
            color=_TEXT_PRIMARY,
            size_hint_y=None,
            height=dp(20),
            halign='left',
        ))
        row.add_widget(Label(
            text=getattr(status, 'description', ''),
            font_size='11sp',
            color=_TEXT_SECONDARY,
            halign='left',
        ))
        return row

    # ── Shared helpers ─────────────────────────────────────────────────────────

    def _apply_bg(self, widget) -> None:
        from kivy.graphics import Color, RoundedRectangle

        with widget.canvas.before:
            Color(*_BG_CARD)
            rect = RoundedRectangle(radius=[dp(12)])

        widget.bind(
            pos=lambda inst, v: setattr(rect, 'pos', v),
            size=lambda inst, v: setattr(rect, 'size', v),
        )

    def _small_label(self, text: str) -> object:
        from kivy.uix.label import Label

        lbl = Label(
            text=text,
            font_size='11sp',
            color=_TEXT_MUTED,
            size_hint_y=None,
            height=dp(18),
            halign='left',
        )
        lbl.bind(size=lbl.setter('text_size'))
        return lbl

    def _close_button(self) -> object:
        from kivy.uix.button import Button

        btn = Button(
            text='Close',
            font_size='13sp',
            color=_TEXT_SECONDARY,
            size_hint_y=None,
            height=dp(44),
            background_color=(0, 0, 0, 0),
        )
        btn.bind(on_release=lambda *_: self.dismiss())
        return btn
