# Fleet Layer — design proposal

> **Status: proposal, not authority.** Per `CLAUDE.md` § Design Authority, this
> file sits at precedence 5 and does not override `CONCEPT.md` or
> `docs/characters/`. It graduates to canon only when approved — at which point
> the parts that survive should move into `CONCEPT.md` and a
> `docs/mechanics/fleet.md`.
>
> **Provenance is marked throughout.** Lines tagged **[established]** are things
> the designer has stated. Everything else is **[proposed]** — my reading of the
> consequences, offered to be corrected or cut.

---

## 1. What the game is

**[established]** Genesis is a **fleet management game**. The player is the
**Commander** of a peace enforcement organisation — a future military
equivalent. The Commander is never controlled on the battlefield; they are the
strategist. The unit the player controls changes by **mission, mode, event, and
sometimes by skill mechanism**.

This is a different altitude from the one `CONCEPT.md` currently states:

> **Genre.** Combat framework first… The Tick system is the invention;
> everything else serves it.

**[proposed]** That sentence describes the *battle layer*, and the word "fleet"
appears nowhere in `CONCEPT.md`. The tick system is still the invention — but it
is the invention *inside* a fleet game, not the game itself. Since `CLAUDE.md`
makes `CONCEPT.md` authority #1, anyone reading it optimises the layer it names.
That is a real and observed failure mode, not a hypothetical: an entire work
session went into dice tables and tick manipulation without once asking about
recruitment or deployment, because nothing pointed there.

**Recommended amendment to `CONCEPT.md` § Genre:**

> Fleet management first, resolved through a continuous-timeline combat
> framework. The player commands an organisation and decides who deploys; the
> Tick system is how those decisions are settled on the ground.

---

## 2. The organisation

**[established]** A peace enforcement organisation. Future military equivalent.
Created independently of the Sekkarian Defense Force. Named by the player during
character creation; no canonical name.

**[proposed]** This is the least-documented load-bearing object in the project.
The *rival* organisation is better specified than the player's own:

| | Mandate | Scale | Interrogated |
|---|---|---|---|
| Sekkarian Defense Force | "maintaining balance", solar-system peacekeeping | 20+ fleets; Fleet 13 covers Earth | yes — *"whether this is peace-keeping or control is an open question"* |
| The Commander's fleet | — | — | — |

That matters more here than in most games, because **no faction in Genesis is
simply evil** — Netrolume aggression is induced, Kiragen are implicated in human
origins, the Creator is dangerous through curiosity. When every other party is
morally ambiguous by design, *"what does your organisation actually enforce, on
whose authority, and who checks it"* is the question that gives each mission its
texture. Without an answer, "peace enforcement" is a job title rather than a
stance.

**[proposed] It also has mechanical reach.** A peace enforcement body fields
whoever fits the contingency — which is the in-fiction reason the controlled
character rotates at all. The fiction and the structure are the same fact.

**Open — for the designer, not for me:**
- Who charters it? Does anyone have authority over the Commander?
- What is its relationship to the Defense Force — parallel, rival, successor,
  or something the Force does not formally recognise?
- Does it enforce a written mandate, or the Commander's judgement?

---

## 3. The fleet

**[proposed]** The fleet is the object that persists between sessions. Battles
are transient; the fleet is the save file.

| Layer | Persists? | Contains |
|---|---|---|
| Fleet | permanent | roster of recruited units, organisation identity |
| Deployment | per mission | the units sent to one operation |
| Battle | per encounter | tick positions, AP, statuses, temporary skill levels |

This aligns with what `CONCEPT.md` already specifies and gives it a home:
in-battle skill levels reset (temporary progression), Mastery Road is permanent
and cosmetic, currency persists. The missing middle is **the roster itself** —
who you have, and how that changes.

---

## 4. Acquisition

**[established]** The demo ends with **Hugo and Husty joining the Commander's
fleet**. **Tara is locked** — deployed for all three stages, not recruited.

**[established]** Hugo was previously under Celan's command in the Sekkarian
Defense Force. So the arc across the demo is a *transfer*, not a contradiction:
he begins as Celan's operative sent for intel and ends as the Commander's.

**[proposed]** This is the single most important beat in the demo, and it is
currently listed in `docs/demo/demo-flow.md` as an open question ("How does the
demo end — victory state, cliffhanger, or loop back to Creator? | TBD"). It is
none of those. It is the moment the player learns what the game is.

**[proposed] Tara being locked is good design and should be recorded as intent.**
She is rarity 6 with the strongest kit in the demo, played for three stages, and
then withheld. Playing with something and losing access to it generates want far
more effectively than never having it. Left undocumented it reads as a scoping
accident; written down it is a hook.

**[proposed] Acquisition routes** — to confirm or replace:

| Route | Example |
|---|---|
| Mission outcome | Hugo and Husty after Mars |
| Secondment | a unit on loan from another organisation, temporarily deployable |
| Currency | direct unlock, per `CONCEPT.md` § Character unlocks |
| Event / mode | availability granted for a limited context |

---

## 5. Deployment

**[proposed]** Existing engine pieces already model this and need no new work:

- `ModeDef.maxTeamSize` caps a deployment (`CLAUDE.md` § Principle 2 — modes are
  the only layer allowed to impose a cap)
- `ModeDef.settings.playerControl` decides who receives the HUD
  (`'single'` → party leader; `'all'` → each controlled unit takes its own turn)
- `stage.playerUnits.units` order sets the leader

**[proposed]** What is missing is the layer above: *which units are available to
put in `stage.playerUnits` in the first place*. In the demo that is fixed. In the
game it is the fleet.

---

## 6. The demo as tutorial

**[established]** The demo is the tutorial for the fleet loop. **[established]**
Scope runs from the dream to the unlock and "coming soon" screens; everything
else is locked or does not matter.

**[proposed]** Each beat should teach exactly one thing, and the last two are the
payoff the rest exists to set up:

| # | Beat | Teaches | Exists? |
|---|---|---|---|
| 1 | The dream | You are someone specific. Something found you. | script exists |
| 2 | Character creation | This organisation is yours — you name it. | in `demo-flow` |
| 3 | Wake / KALI | You have an interface, a fleet, a status. | in `demo-flow` |
| 4 | Celan's arrival | Other organisations exist and they come to *you*. | in `demo-flow` |
| 5 | Mars ×3 | The tick system. Units differ. You direct, you do not fight. | built |
| 6 | **Unlock** | **Units join your fleet. This is what you are playing for.** | **not built** |
| 7 | **Coming soon** | There is more fleet than you have seen. | **not built** |

Beats 6 and 7 are the only new screens the demo requires.

---

## 7. Immersion plan

**[proposed]** One rule underneath all of it:

> **Nothing is disabled. Things are locked by the fiction.**

A greyed-out `MASTERY ROAD` button reads as an unfinished game. `MASTERY ROAD —
AWAITING CLEARANCE` reads as a world with more of it out of view. The demo's
scope is mostly *absence*, so how absence is presented is most of the felt
quality.

Concrete applications, cheapest first:

**a. Locked surfaces speak in-fiction.**
Main menu `MASTERY ROAD` / `SHOP`, campaign stages 2–3 before unlock, roster
entries for un-recruited units. Replace "LOCKED" and "Complete earlier stages to
unlock" with organisational language — clearance, authorisation pending, no
personnel file on record.

**b. KALI narrates the system surfaces.**
She is already established as *"the Commander's primary interface throughout the
demo — briefings, status updates, alarms, deployment orders"*. Anywhere the game
currently speaks in its own voice ("Loading…", "Victory", "No items"), it can
speak in hers. This is text, not art, and it is the highest ratio of felt
immersion to work in the whole list.

**c. Loading is a status report.**
`Loading battle…` → relay sync / fleet readiness lines. Same wait, different
world.

**d. Boot goes to the dream.**
On a first run there should be nothing before it — no wordmark, no menu. The
dream is the first thing that happens. Returning sessions boot normally.

**e. The unlock screen is the emotional beat of the demo.**
It deserves the most care of anything in scope. Suggested shape: the two
recruits arriving on the roster one at a time rather than as a list, each with
their file opening; Tara present but not joining, and *acknowledged* — a unit you
fought beside who is not yours. Silence around her is worse than a line about
her.

**f. "Coming soon" is a deployment board, not a marketing card.**
Operations beyond Mars, listed and unavailable, in the same language as the rest
of the fleet UI.

**[proposed] Non-goals for this demo:** no fleet-management UI beyond the unlock
screen, no roster editing, no deployment selection. The demo teaches that the
fleet *exists* and that units join it. It does not need to let you run one.

---

## 8. Scope

**[established]** In scope: dream → character creation → wake → Mars ×3 →
unlock → coming soon.

Everything else locked or irrelevant: Mastery Road, Shop, pre-battle wizard,
roster filters, settings depth, campaign stages beyond the demo.

---

## 9. Questions I need answered before any of this becomes canon

1. The organisation — charter, authority, and whether anyone can overrule the
   Commander. Everything in § 2 hangs on this.
2. Does Tara's lock get explained in the demo, or only felt?
3. Is Hugo's transfer *earned* by the mission's outcome, or arranged by Celan
   regardless? That changes what the unlock screen means.
4. Should `CONCEPT.md` § Genre be amended as in § 1, or is the combat-first
   framing deliberate?
