#!/usr/bin/env python3
"""Generate placeholder battle SFX as GBA-style square-wave blips.

These are PLACEHOLDERS. They exist so the feedback loop is audible and its
timing can be felt while the real audio is commissioned. Replace any file in
public/audio/ with a real .webm/.mp3 of the same key name and SoundService
picks it up with no code change — the loader tries webm, then mp3, then wav.

Square (not sine) is deliberate: the GBA's PSG channels were square + noise,
so this is the right family of sound for the art direction rather than a
generic UI beep.

Run:  python3 scripts/gen-placeholder-audio.py
"""

import math
import struct
import wave
from pathlib import Path

RATE = 22050
OUT = Path(__file__).resolve().parent.parent / "public" / "audio"


def square(freq, t, duty=0.5):
    """One square-wave sample at time t."""
    if freq <= 0:
        return 0.0
    phase = (t * freq) % 1.0
    return 1.0 if phase < duty else -1.0


def noise(t, seed=12345):
    """Deterministic pseudo-noise — no RNG, so output is byte-stable."""
    n = int(t * RATE) * 1103515245 + seed
    n = (n ^ (n >> 16)) & 0x7FFFFFFF
    return (n / 0x3FFFFFFF) - 1.0


def render(segments, gain=0.28):
    """segments: list of (duration_s, freq_or_None, duty). None freq = noise."""
    samples = []
    for dur, freq, duty in segments:
        count = int(dur * RATE)
        for i in range(count):
            t = i / RATE
            # Fast attack, exponential decay — percussive, never clicky.
            env = min(1.0, (i / max(1, count * 0.02))) * math.exp(-3.2 * (i / count))
            v = noise(t) if freq is None else square(freq, t, duty)
            samples.append(v * env * gain)
    return samples


def write_wav(name, samples):
    OUT.mkdir(parents=True, exist_ok=True)
    path = OUT / f"{name}.wav"
    with wave.open(str(path), "w") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(RATE)
        w.writeframes(b"".join(
            struct.pack("<h", max(-32767, min(32767, int(s * 32767)))) for s in samples
        ))
    return path.stat().st_size


# Key → segments. Pitches sit in the GBA's bright register.
SFX = {
    # Needle ticking across the odds band — very short, repeats fast.
    "roll_tick":    [(0.020, 1760, 0.5)],
    # Best outcome: rising major arpeggio.
    "dice_boosted": [(0.055, 880, 0.5), (0.055, 1174, 0.5), (0.11, 1760, 0.25)],
    # Clean connect.
    "dice_hit":     [(0.070, 587, 0.5), (0.070, 880, 0.5)],
    # Evade: two-step drop, reads as "slipped away".
    "dice_evade":   [(0.060, 1174, 0.25), (0.090, 784, 0.25)],
    # Whiff: low, dull.
    "dice_fail":    [(0.130, 196, 0.5)],
    # Impact body — noise burst under the outcome tone.
    "impact":       [(0.090, None, 0.5)],
    "death":        [(0.10, 392, 0.5), (0.10, 294, 0.5), (0.20, 196, 0.5)],
    # UI
    "select":       [(0.030, 1047, 0.25)],
    "ap_short":     [(0.055, 147, 0.5), (0.055, 131, 0.5)],
    "tick_advance": [(0.022, 1319, 0.125)],
}

if __name__ == "__main__":
    total = 0
    for key, segs in sorted(SFX.items()):
        size = write_wav(key, render(segs))
        total += size
        print(f"  {key:14s} {size / 1024:6.1f} KB")
    print(f"\n{len(SFX)} placeholder SFX written to {OUT}  ({total / 1024:.0f} KB total)")
