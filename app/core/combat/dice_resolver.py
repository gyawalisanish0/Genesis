from __future__ import annotations

import random
from enum import Enum

from app.core.constants import (
    BOOSTED_MULTIPLIER,
    EVASION_COUNTER_BASE,
    EVASION_COUNTER_MIN,
    EVASION_COUNTER_STEP,
    GUARD_UP_MITIGATION,
    TUMBLING_DELAY_MAX,
    TUMBLING_DELAY_MIN,
    TUMBLING_MULTIPLIER,
)


class DiceOutcome(Enum):
    BOOSTED  = "Boosted"
    SUCCESS  = "Success"
    TUMBLING = "Tumbling"
    GUARD_UP = "GuardUp"
    EVASION  = "Evasion"


class DiceResolver:
    """Resolves a single dice roll against a shifted probability table."""

    def roll(self, shifted_probabilities: dict) -> DiceOutcome:
        """
        Pick an outcome by weighted random selection.
        shifted_probabilities must sum to 1.0.
        """
        outcomes = list(shifted_probabilities.keys())
        weights  = [shifted_probabilities[k] for k in outcomes]
        chosen   = random.choices(outcomes, weights=weights, k=1)[0]
        return DiceOutcome(chosen)

    def apply_outcome(self, outcome: DiceOutcome, raw_output: int) -> dict:
        """
        Apply an outcome to raw_output and return a result dict:
          output         — final damage / healing value
          tumble_delay   — ticks added to attacker's timeline (Tumbling only)
          guard_mitigation — HP added to target's mitigation pool (GuardUp only)
          evaded         — True when the attack was fully evaded
        """
        result = {
            "output":           0,
            "tumble_delay":     0,
            "guard_mitigation": 0,
            "evaded":           False,
        }

        if outcome == DiceOutcome.BOOSTED:
            result["output"] = round(raw_output * BOOSTED_MULTIPLIER)

        elif outcome == DiceOutcome.SUCCESS:
            result["output"] = raw_output

        elif outcome == DiceOutcome.TUMBLING:
            result["output"]      = round(raw_output * TUMBLING_MULTIPLIER)
            result["tumble_delay"] = self.calculate_tumbling_delay()

        elif outcome == DiceOutcome.GUARD_UP:
            result["output"]           = raw_output
            result["guard_mitigation"] = round(raw_output * GUARD_UP_MITIGATION)

        elif outcome == DiceOutcome.EVASION:
            result["evaded"] = True

        return result

    def calculate_tumbling_delay(self) -> int:
        """Return a random tick delay within the Tumbling range."""
        return random.randint(TUMBLING_DELAY_MIN, TUMBLING_DELAY_MAX)

    def resolve_evasion_counter(self, recursion_depth: int) -> bool:
        """
        Attempt an evasion counter at the given recursion depth.
        Counter chance diminishes by EVASION_COUNTER_STEP per depth,
        floored at EVASION_COUNTER_MIN.
        Returns True if the counter triggers (attacker retaliates).
        """
        counter_chance = max(
            EVASION_COUNTER_MIN,
            EVASION_COUNTER_BASE - recursion_depth * EVASION_COUNTER_STEP,
        )
        return random.random() < counter_chance
