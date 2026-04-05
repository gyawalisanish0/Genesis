"""
SkillDetailPopup — read-only skill information modal.

Opens on long-press of a skill slot during battle. Displays full skill details
without exposing upgrade functionality (upgrade happens outside battle).

Usage
-----
    popup = SkillDetailPopup()
    popup.load_skill(skill)
    popup.open()
"""
from __future__ import annotations

from kivy.uix.modalview import ModalView
from kivy.metrics import dp

_BG_CARD: tuple = (0.110, 0.110, 0.157, 1)
_TEXT_PRIMARY: tuple = (0.973, 0.973, 1.0, 1)
_TEXT_SECONDARY: tuple = (0.612, 0.639, 0.686, 1)
_TEXT_MUTED: tuple = (0.294, 0.333, 0.388, 1)
_ACCENT_GOLD: tuple = (0.961, 0.620, 0.043, 1)


class SkillDetailPopup(ModalView):
    """Read-only skill detail modal opened on long-press of a skill slot."""

    def __init__(self, **kwargs) -> None:
        kwargs.setdefault('size_hint', (0.85, None))
        kwargs.setdefault('height', dp(320))
        kwargs.setdefault('background_color', (0, 0, 0, 0))
        super().__init__(**kwargs)
        self._build_shell()

    # ── Public API ─────────────────────────────────────────────────────────────

    def load_skill(self, skill) -> None:
        """Populate fields from the skill object."""
        self._name_label.text = getattr(skill, 'name', '—')
        lvl = getattr(skill, 'level', 1)
        self._lvl_label.text = f'LVL {lvl}'
        ap = getattr(skill, 'ap_cost', '—')
        self._ap_label.text = f'AP Cost: {ap}'
        tu = getattr(skill, 'tu_cost', '—')
        self._tu_label.text = f'TU Cost: {tu}'
        chrg = getattr(skill, 'charge', 0)
        self._chrg_label.text = f'Charges: {chrg}' if chrg else 'No charges'
        desc = getattr(skill, 'description', 'No description available.')
        self._desc_label.text = desc

    # ── Shell construction ────────────────────────────────────────────────────

    def _build_shell(self) -> None:
        from kivy.uix.boxlayout import BoxLayout
        from kivy.uix.label import Label
        from kivy.uix.button import Button
        from kivy.graphics import Color, RoundedRectangle

        root = BoxLayout(orientation='vertical', padding=dp(16), spacing=dp(8))

        with root.canvas.before:
            Color(*_BG_CARD)
            self._bg_rect = RoundedRectangle(radius=[dp(12)])

        root.bind(
            pos=lambda inst, v: setattr(self._bg_rect, 'pos', v),
            size=lambda inst, v: setattr(self._bg_rect, 'size', v),
        )

        # Name + LVL row
        header_row = BoxLayout(
            orientation='horizontal',
            size_hint_y=None,
            height=dp(28),
        )
        self._name_label = Label(
            text='—',
            font_size='16sp',
            color=_TEXT_PRIMARY,
            halign='left',
            text_size=(None, None),
        )
        self._lvl_label = Label(
            text='LVL 1',
            font_size='11sp',
            color=_ACCENT_GOLD,
            size_hint_x=None,
            width=dp(48),
        )
        header_row.add_widget(self._name_label)
        header_row.add_widget(self._lvl_label)
        root.add_widget(header_row)

        # Stat labels
        for attr in ('_ap_label', '_tu_label', '_chrg_label'):
            lbl = Label(
                text='',
                font_size='12sp',
                color=_TEXT_SECONDARY,
                size_hint_y=None,
                height=dp(22),
                halign='left',
            )
            lbl.bind(size=lbl.setter('text_size'))
            setattr(self, attr, lbl)
            root.add_widget(lbl)

        # Description
        self._desc_label = Label(
            text='',
            font_size='12sp',
            color=_TEXT_MUTED,
            halign='left',
            valign='top',
            text_size=(None, None),
        )
        self._desc_label.bind(
            width=lambda inst, w: setattr(inst, 'text_size', (w, None))
        )
        root.add_widget(self._desc_label)

        root.add_widget(self._build_close_button())
        self.add_widget(root)

    def _build_close_button(self) -> object:
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
