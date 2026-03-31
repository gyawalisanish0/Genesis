import random

from app.core.constants import CLASS_TICK_RANGES


class TickCalculator:
    """Handles all tick-based timeline calculations."""

    def calculate_starting_tick(self, speed: int, class_name: str) -> int:
        """
        Determine where a unit starts on the infinite tick timeline.

        speed (0–100): higher speed compresses the random ceiling toward class_min,
        so faster units always act sooner.

        Formula:
            speed_factor = 1 - (speed / 100)
            max_offset   = (class_max - class_min) × speed_factor
            result       = class_min + randint(0, round(max_offset))

        At speed 100 → always returns class_min (deterministic).
        At speed 0   → uniform random across full class range.
        """
        class_min, class_max = CLASS_TICK_RANGES[class_name]
        speed_factor = 1.0 - (speed / 100.0)
        max_offset   = (class_max - class_min) * speed_factor
        return class_min + random.randint(0, round(max_offset))

    def advance_tick(self, current_tick: int, tu_cost: int) -> int:
        """
        Push a unit forward on the timeline after they act.
        tu_cost is the time-unit cost of the skill or action used.
        Returns the unit's new tick position.
        """
        return current_tick + tu_cost

    def calculate_ap_gained(self, ticks_elapsed: int, ap_regen_rate: float) -> float:
        """
        Compute AP regenerated over a span of ticks.
        ap_regen_rate is the unit's AP gained per tick (character-defined).
        """
        return ticks_elapsed * ap_regen_rate
