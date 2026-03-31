from dataclasses import dataclass, field


@dataclass
class StatBlock:
    """Six core stats that define a unit's combat capabilities."""

    strength:   int = 0  # Physical damage output
    endurance:  int = 0  # Max HP and physical defence
    power:      int = 0  # Magical / ability damage output
    resistance: int = 0  # Magical / ability defence
    speed:      int = 0  # Starting tick position bias (0–100)
    precision:  int = 0  # Hit chance multiplier (scales final dice probability)
