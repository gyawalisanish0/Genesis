"""
GameContext — transient session state shared between screens.

Lives in core/ so it has zero Kivy imports.
Accessed via App.get_running_app().game_context from any screen or component.
"""
from __future__ import annotations

from dataclasses import dataclass, field


@dataclass
class GameContext:
    """Holds all transient state for the current game session."""

    # Pre-battle selections
    selected_mode: dict = field(default_factory=dict)
    selected_team: list = field(default_factory=list)   # list of Unit
    selected_items: dict = field(default_factory=dict)  # unit_id → item dict

    # Active battle
    enemies: list = field(default_factory=list)         # list of Unit

    # Post-battle result
    battle_result: dict = field(default_factory=dict)   # populated by BattleScreen

    def reset_battle(self) -> None:
        """Clear battle-specific state between sessions."""
        self.selected_mode = {}
        self.selected_team = []
        self.selected_items = {}
        self.enemies = []
        self.battle_result = {}
