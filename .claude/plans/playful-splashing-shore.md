# Plan: Fill CONCEPT.md for Genesis

## Context
The user has provided enough concept details to populate CONCEPT.md. Genesis is a turn-based combat game built on a unique **timeline mechanism** for turn assignment, set in a **multiversal/mixed** setting. The player's controlled unit is situational or game-mode-driven. Core theme is power and progression. Visual style is minimalist/flat. CONCEPT.md already exists with headers but empty content fields.

---

## Changes

**File**: `/home/user/Genesis/CONCEPT.md`

Fill each section as follows:

### Logline
Genesis is a turn-based combat game set across a fractured multiverse — where mastering the Timeline, a dynamic turn-order system, is the key to outthinking opponents and ascending to absolute power.

### Core Fantasy
- Feeling like the smartest person in the room — reading the timeline and acting at the perfect moment
- Watching power compound: small early advantages snowball into overwhelming dominance
- The thrill of a roster that shifts by mode — mastery is never static, always contextual

### Theme & Tone
- **Theme**: Power, origins, convergence — warriors, forces, and worlds from across the multiverse drawn into a single conflict
- **Tone**: Epic but sharp; the minimalist aesthetic keeps focus on strategy, not spectacle

### Genre
Turn-based strategy / RPG hybrid. Combat is the core; progression and power systems are the meta layer.

### Core Loop
- **Micro loop** (each turn): Read the Timeline, choose your action, manipulate turn order to gain advantage
- **Macro loop** (session): Win combat encounters, earn resources, unlock upgrades
- **Meta loop** (long-term): Persistent power progression, expand roster, unlock new game modes and multiversal arcs

### Progression System
- Power is earned through combat mastery and expressed through expanded Timeline control
- Multiple axes: character stats, abilities, Timeline slots, roster depth
- No wasted progress — losses feed the meta loop forward

### Visual Style
- Minimalist / flat — clean geometry, bold colours, strong contrast
- The Timeline is a first-class visual element: prominent, always readable, central to the UI
- Animations are snappy and purposeful, reinforcing the feel of decisive action
- Palette TBD; lean dark with high-contrast accent colours per faction/universe

### Platform & Session Design
- Primary: Android / iOS — designed for 5–15 minute combat sessions
- State always saved on exit — no penalty for interruption
- Portrait-first; Timeline UI optimised for one-thumb reach

### Open Questions (updated)
- [x] What is the micro-loop? → Timeline-based turn-order combat
- [ ] What does "power" look like visually? (number, character, Timeline slots?)
- [ ] Is there a narrative layer, or is progression purely systemic?
- [ ] Multiplayer / social, or single-player only?
- [ ] Monetisation model (if any)?
- [ ] How does the Timeline mechanic work exactly? (manipulation rules, limits, counters)
- [ ] What determines which units/characters are available per game mode?

---

## Verification
- Read the file after writing to confirm no formatting issues
- Commit with clear message and push to `claude/create-claude-docs-WugoI`
