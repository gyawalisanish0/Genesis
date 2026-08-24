# Genesis — Design Philosophy

## The Core Statement

**The form is the content.**

The way Genesis looks is what Genesis is about.
The way the player learns is what the character experiences.
The stories humanity already carries are the lore the game needs.

Nothing is invented that did not need to be.
Nothing is explained that the player can discover.
Nothing is separated that belongs together.

---

## The Visual Style Is the Story

Most games have three separate things: a visual style, a narrative, and a
mechanic. Good games make these feel related. Great games make them feel
unified. Genesis makes them the same thing.

The pixel art is not a visual style that supports a story about perception
tiers. The pixel art **is** the perception tier. A 48-pixel sprite is not a
low-budget picture of a soldier — it is what a soldier looks like to something
that resolves reality coarsely, at a fixed grid, in a limited palette.
The Commander perceives the battlefield as a bounded set of discrete cells and
colours because that is the resolution their consciousness renders at.

The battle is real. The characters are full, complex, breathing beings. The
Commander sees them quantised because that is the Commander's tier.

**Implication for every design decision:** if the visual style and the
narrative and the mechanic are not saying the same thing, one of them is wrong.
Find the one that is wrong and change it.

---

## Why Pixel Art Specifically

The constraint has to be *legible as a constraint*. That is the whole trick.

A photoreal render says "this is everything there is." A soft, painterly
render says "this is an impression." Pixel art says something more precise:
**there is a grid, and reality has been sampled onto it.** The player can see
the sampling. They can count the pixels. The lossiness is visible and
countable, and that is exactly the claim the fiction is making.

The GBA era is the right register for this because its limits were real ones:
a fixed resolution, a fixed palette depth, a fixed tile grid. Those constraints
produced a visual language that is confident rather than apologetic. Genesis
adopts the language and the confidence together.

The rules in `docs/ui/00-design-system.md` — integer scaling, no antialiasing,
no gradients, ramped palettes, stepped motion — are not nostalgia. Each one
keeps the sampling grid visible. Break them and the claim quietly stops being
made.

---

## The Player Is Not Simulating an Experience. They Are Having One.

Traditional games create empathy — you understand what the character feels.
Genesis creates identity — you are doing what the character is doing, through
different means, at the same time.

The Commander reads a compressed rendering of the battlefield and infers the
full situation from it. So does the player. Neither is given the whole picture;
both reconstruct it. These are not analogous processes — they are parallel
instances of the same process, running simultaneously in the fiction and in
reality.

A player learning to read a 48-pixel silhouette as a specific person, with
specific threat, at a glance: diegetically correct. That is the skill the
Commander is exercising.

**The player's learning curve is the character arc.**

**Implication:** never apologise for the abstraction. Never add a tutorial that
explains the visual style.

---

## Abstraction Is Not a Compromise

Pixel art is not HD graphics minus the budget. It is a different relationship
between the viewer and the image — one that is superior for what Genesis is
doing.

A fully rendered character is a closed statement. Here is exactly what this
looks like. Nothing left for the mind. The player receives the image passively.

A sprite is an open signal. Here is the shape of something, at this resolution
— now complete it. The player's mind fills the gap with something more vivid,
more personal, and more emotionally resonant than any renderer could produce.
The player is an active participant in constructing what they see.

This convergence — in-universe (perception samples reality onto a grid) and
out-of-universe (abstraction activates imagination) — is not a coincidence. It
is the design being correct. When the lore reason and the craft reason point to
the same answer, you have found the right answer.

**Implication:** lean into the constraint. Do not add detail to reassure
players who want HD graphics. Adding a sub-pixel gradient to make a sprite
"nicer" costs the entire premise and buys almost nothing.

---

## The Game Never Explains Itself

The perception tiers are never in a tutorial. The lore is never in a codex.
The Commander never thinks "I am perceiving this at reduced resolution."

The player discovers. The game plants signal and trusts the player to read it.

This is both the ethical principle and the design principle — and they are the
same principle. A player who completes the connection themselves has built
something that a player who was told cannot have. The discovery **is** the
perception working. The player reads pattern from limited signal. They are
doing the thing the lore describes.

**The rule:** if a line, a cutscene, a tooltip, or a UI element is explaining
what the player should be experiencing — cut it. If the experience requires
explanation to land, the experience is not working. Fix the experience.

---

## Mythology as Signal, Not Invention

Genesis does not invent lore where human history has already provided it.
Figures operating above the common tier have existed throughout history. Many
became myths — not because they were supernatural, but because ordinary
consciousness encountered something it could not resolve and reached for the
only containers it had.

The stories are the highest-fidelity translation of what was witnessed. They
are not wrong. They are compressed — sampled onto the grid available at the
time.

Genesis does not claim to own this meaning. It provides a framework that makes
existing human stories legible as data. A player who brings their own tradition
finds it recognised — not explained, not reduced, not appropriated. Recognised.

**Implication:** never invent historical or mythological lore when existing
human stories can provide it. Never claim a tradition. Never explain what a
tradition means. Provide the framework. Let the player bring what they carry.

---

## Writing Rules That Follow From This Philosophy

These are not stylistic preferences. They follow directly from the principles
above.

**Never state the hierarchy.** Characters do not discuss perception tiers.
The framework is never named in dialogue.

**Double meaning in every line.** Anything said from above the common tier must
read one way on a first playthrough and another on a second. The form of the
speech is the content.

**The player's confusion is the Commander's confusion.** Do not resolve it
prematurely. The demo ends unresolved because the Commander ends the demo
unresolved. That is honest.

---

## For New Collaborators

Genesis is a game where the way it looks is what it is about. The pixel art is
not a style — it is the story. The player's experience of learning to read it
is the character's experience of becoming what they are.

Every decision — visual, narrative, mechanical — is evaluated against one
question: **is this the same statement, expressed in this register?**

If yes: it belongs.
If no: it does not, regardless of how good it is on its own terms.

---

> **Revision note.** Genesis previously rendered in ASCII/Unicode symbols, and
> this document argued that ASCII *was* the perception tier. The art direction
> is now GBA-era pixel art (`docs/ui/00-design-system.md`). The premise did not
> change — only the register it is expressed in. The claim has always been that
> perception samples reality lossily and the player completes the signal; a
> visible pixel grid makes that claim more legibly than a glyph grid did, and
> it survives contact with animation, colour, and readability at arm's length.
