from __future__ import annotations

from app.core.characters.stat_block import StatBlock
from app.core.constants import MAX_SKILL_SLOTS


class Unit:
    """Base unit model — holds all runtime state for a combatant."""

    def __init__(
        self,
        name: str,
        class_name: str,
        rarity: int,
        stats: StatBlock,
        max_hp: int,
        max_ap: float,
        ap_regen_rate: float,
    ) -> None:
        self.name          = name
        self.class_name    = class_name
        self.rarity        = rarity
        self.stats         = stats

        self.max_hp        = max_hp
        self.hp            = max_hp

        self.max_ap        = max_ap
        self.ap            = 0.0          # AP starts empty each battle
        self.ap_regen_rate = ap_regen_rate

        self.tick_position: int  = 0
        self.skills: list        = []     # Active skill slots — max MAX_SKILL_SLOTS
        self.passive             = None   # Unique passive, defined per character
        self.secondary_resource  = None   # Optional (e.g. rage, mana) — None if unused
        self.status_slots: list  = []     # Active status effects

    # ------------------------------------------------------------------
    # Derived properties
    # ------------------------------------------------------------------

    @property
    def is_alive(self) -> bool:
        return self.hp > 0

    # ------------------------------------------------------------------
    # HP management
    # ------------------------------------------------------------------

    def take_damage(self, amount: int) -> int:
        """Apply damage and return actual HP lost."""
        actual = min(amount, self.hp)
        self.hp -= actual
        return actual

    def heal(self, amount: int) -> int:
        """Restore HP up to max and return actual HP gained."""
        actual = min(amount, self.max_hp - self.hp)
        self.hp += actual
        return actual

    # ------------------------------------------------------------------
    # AP management
    # ------------------------------------------------------------------

    def gain_ap(self, amount: float) -> float:
        """Add AP up to max and return actual amount gained."""
        actual = min(amount, self.max_ap - self.ap)
        self.ap += actual
        return actual

    def spend_ap(self, amount: float) -> bool:
        """Deduct AP if sufficient funds; return True on success."""
        if self.ap < amount:
            return False
        self.ap -= amount
        return True

    # ------------------------------------------------------------------
    # Skill slot management
    # ------------------------------------------------------------------

    def equip_skill(self, skill) -> bool:
        """Add a skill to the active loadout if a slot is free."""
        if len(self.skills) >= MAX_SKILL_SLOTS:
            return False
        self.skills.append(skill)
        return True
