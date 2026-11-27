# Villain dynamism (0.8.19)

Two files decide how every villain behaves:

- `src/data/dynamism.js`: **the table**. One row per villain: its temper.
- `src/sim/menace.js`: **the menace engine**. One director every villain obeys: when it may attack, how hot the level is, how it answers the player.

The pressure is the villain, never the clock: nothing here changes a level's time. Everything is deterministic (no randomness), lives in the sim's saved state, and the planner proves every level with it.

## The table: fields

Numbers are multipliers on the villain's own 0.8.18 Medium numbers unless a unit is given.

| field | what it means |
|---|---|
| `tempo` | travel speed while it has a target (and how fast its moves go: a crossing, a hop, a crank) |
| `rest` | idle time between two actions while a target exists (lower = meaner) |
| `tell` | the visible warning before a move that can cost an egg. Never under `TELL_MIN` = 0.45 s (a tell that was already shorter, a lunge's flight, keeps its length) |
| `snatch` | from "egg in reach" to "egg taken" (the player's window) |
| `chase` | 0..1, how hard it re-targets and follows when the player moves the egg away (1 = at once, across rings; 0 = stays put) |
| `threat` | 1..10, how much pressure it puts on a level (set by hand; a constructor adds these up) |
| `moves` | what it can do (below) |

`DYN_MODE` scales tempo, rest, tell, snatch and chase per mode (Easy x0.85 tempo, x1.35 rest and tell; Hard x1.12, x0.85) and sets the engine's **tokens** (Easy 1, Medium 1, Hard 2) and **breather** (Easy 5 s, Medium 3.5 s, Hard 2.5 s). A level may carry `dyn: { raccoon: { tempo: 1.2 }, tokens: 2 }`: a kind's fields replace the row's before the mode is applied.

`dyn(kind, mode, over)` returns the row; sims read it through `dynOf(sim, kind)` (cached per sim).

## The rows (den and yard villains)

- **raccoon** (threat 6, L6 boss): sneak in, climb onto a ring, **crank** it so the floor drags eggs to him, **reach** and **grab** into his sack. His second way: the **pounce** (eye-lock, then a hop down to a low perch right by the eggs) when a crank bout brought nothing or the player fights his ring. **Pursuit**: with no egg on his floor he eyes the ring the eggs are on and **hops** there. **Answer** to the player: his ring turned against him, he notes it (`bandBrace`) and changes plan at his next sit; an egg snatched from his reach, he re-plans at once. **Stand-off** with the weasel: only on one ring, close; rings apart he hops over while it runs his way.
- **weasel** (5): **prowl** and **stalk** in darts (bursts and checks), **lunge** (snap) at an egg on its run or **pounce** through a gap at one a channel in (two ways, picked by where the egg is), **carry** it home and stash it. **Answer**: its floor turned under it while it hunts: it shuns that egg (`thiefSwitch`) and goes for the next, round the other way if that is where it lies.
- **rat** (3): scurry in darts, **brace** behind an egg (the tell), **roll** it to the hole, squabble with the other rat. **Answer**: the same egg switch as the weasel.
- **kits** (4): pop out of mama's sack, scamper (dart, check), climb in, **cross** up and down through gaps or hop holes (route picked by where the egg is), **lift** and **carry** it home: two carry, the third is the lookout. **Answer**: their floor turned under them, they switch egg (`kitSwitch`); turned hard, they tumble.
- **monkey** (4): swing, **aim** and **snatch** with his tail, ride his ring, toss a peel. A snatch needs a token: refused, he rides instead.
- **penguin** (3): waddle, wind up, slide, tuck and shove eggs.
- **urchin** (3): puff, roll, **dash** at an egg, nap.
- **crab** (6, L48 boss): reach, snap, pull, bubbles, whirlpool, bar.
- **owl** (6, L60 boss): wind rings, grab, gear bombs (its attacks are the boss director's; only its tell is scaled).

The crawlers (salamander, chameleon, thornback, frog) have their own rows, added in the same file by the crawler work.

## The menace engine

**Heat** (`menaceHeat()`): a factor on travel speed (multiplied) and rests (divided), never on telegraphs. It glides (about 1.5 s), never jumps, and stays between 0.8 and 1.25.

- *Progress*: **opening** (no egg has gone 15 % of its way out yet) 0.8: villains stalk, look, position. **Middle** 1. **Finale** (the last egg needed for the target is on its way, or the last third of the level's time).
- *Margin*: how the run stands. **spare** = free eggs minus eggs still needed; **recent** = a loss in the last 20 s; **pace** = time left against the way still to go; **hands** = frantic back-and-forth turning (direction flips, leaky over 4 s).
  - **Cruising** (spare >= 1, no recent loss, on pace, calm hands): the finale climbs to 1.25: the rush.
  - **On the edge** (any of those not so): the heat does not rise (0.95 in the middle, 0.9 at the finish), telegraphs get 15 % longer (`menaceTell()`), and takes become **near misses** (`menaceNear()`): as a grab closes, its reach shrinks to 0.7 of itself, so an egg the player keeps moving slips out. A real rule, not a fake: a resting egg deep in reach is still taken.
  - After a loss the heat drops a step (0.2) for 8 s.

**Finale style** (`mn.style`, picked once when the finale starts; `menaceStyleFor(level, edge)` is the same pick as a pure function):

- `rush`: a cruising run. Every villain presses; tokens still hold.
- `ambush`: a cruising run on every third level (id % 3 == 0). 4 s of quiet (no costly move starts), then ONE strike with a 30 % longer telegraph, then the plain middle.
- `shadow`: a run on the edge. One villain at a time (bosses too), near misses, longer telegraphs.

**Attack tokens** (`menaceMay(id, move, boss)` / `menaceDone(id, move, tookEgg)`): a costly move (a reach, a lunge or pounce, a brace to roll, a lift, a snatch) may only START with a token; at most `tokens` at once. A refused villain keeps stalking: it paces by its egg (weasel, rat, kits) or keeps its eyes on it (raccoon), or does another trick (monkey). A boss holds its own token. A token goes back when the move is over; a forgotten one lapses after 15 s.

**The breather**: an egg taken, eaten or broken: no new costly move for `breather` s, bosses included. One loss never snowballs into three.

**Ring reactions** (`menaceTurned(ri, within)`): the player's last turn of each ring (its way and how long ago). Each villain answers it (above).

## Budget: building a level from villains

`menaceBudget(level, mode)` returns `{ load, budget, ratio, list }`:

- `load` = sum of `threat x count` of the level's villains, times the mode's pressure (`tempo / rest` of `DYN_MODE`: Easy 0.63, Medium 1, Hard 1.32).
- `budget` = `level.budget`, or by default `4 + 0.1 x (id - 1)` (4 at level 1, about 10 at level 60).
- `ratio` = load / budget. Around 1 is on budget; well over is a crowded level, well under a quiet one.

**Worked example: a new level 70 with a raccoon and the kits.**

1. Load on Medium: raccoon 6 + kits 4 = **10**. Default budget at 70: 4 + 6.9 = **10.9**. Ratio 0.92: on budget.
2. The same on Easy: load 10 x 0.63 = 6.3 against 10.9: a gentle level. On Hard: 13.2: over budget, which is what Hard is for.
3. In play nothing more is needed: the engine gives one token on Medium, so the raccoon's reach and the kits' lift never start together; after a loss the breather holds both; the heat paces the opening, and the finale style follows the run.
4. Too hot when proved? Lower the load: delay a villain, cut a count (two rats to one), or give the level `dyn: { kits: { rest: 1.2 } }`. Never the clock.

`tools/test-menace.mjs` checks all of the above.

---

## The crawlers, the frog and the volcano (absolute rows)

These rows carry `abs: true` in src/data/dynamism.js: seconds, not multipliers; their own mode scale is DYN_MODE_ABS; a level's `dyn` multiplies them.

The owner: villains must feel aggressive by what they DO (pursue across channels, react to the player's last move, pick
a move by situation, rest only briefly), never by raw speed alone. The temper of each villain is one row of data in
`src/data/dynamism.js`; its sim reads the row through `dyn(kind, mode, levelOverride)`. The menace director
(`src/sim/menace.js`, aggroA) decides WHEN a costly move may start; the crawlers only call it through optional hooks, so
they run the same without it.

## Fields (one row per villain kind)

| field | meaning |
|---|---|
| `tempo` | travel speed while it has a target, x today's hunting speed |
| `rest` | s it may idle between two actions while a target exists (lower = meaner) |
| `tell` | s of visible warning before a move that can cost an egg; never under `TELL_MIN` (0.45 s) after scaling |
| `snatch` | s from "egg in reach" to "egg taken": the player's window |
| `chase` | 0..1 how hard it re-targets and follows an egg the player moves away (1 = at once, across rings) |
| `threat` | 1..10 pressure it puts on a level (set by hand, checked by the hardness tables) |
| `moves` | what it can do (below) |

`DYN_MODE` scales tempo, rest, tell and snatch per mode (Easy: tempo 0.85, rest 1.3, tell 1.25, snatch 1.25; Hard: 1.1,
0.85, 0.9, 0.9) and carries the director's `tokens` (Easy 1, Medium 1, Hard 2 costly moves at once) and `breather`
(5 / 3.5 / 2.5 s of no new costly move after an egg is lost). A level may carry `dyn: { salamander: { tempo: 1.2 } }`:
multipliers on its row (softens or sharpens one level without touching the creature). In use: L24
`dyn: { thornback: { tell: 1.3, snatch: 1.3, rest: 3.4 } }` (longer curl, slower roll, longer rests: the planner wins Medium
and Hard again with the livelier thorn-backs).

## Crawler rows (aggroB)

| kind | tempo | rest | tell | snatch | chase | threat |
|---|---|---|---|---|---|---|
| salamander | 1.15 | 0.6 | 0.7 | 1.3 | 1 | 6 |
| salFrost | 1.1 | 1.3 | 0.85 | 1.0 | 0.7 | 4 |
| gecko | 1.1 | 1.0 | 1.4 | 2.15 | 0.8 | 5 |
| thornback | 1.15 | 1.2 | 0.9 | 1.4 | 0.6 | 5 |
| chameleon | 2.2 | 2.2 | 0.6 | 0.6 | 1 | 3 |
| frog | 1.2 | 3.2 | 0.7 | 0.95 | 0.7 | 4 |
| volcano | 0.67 | 9 | 1.8 | 0 | 0 | 2 |

## Moves, one line each

- **walk / climb** (salamanders, thorn-backs, gecko): follow the target egg round the channel and through the gap that
  leads to its channel; a ring turned under it makes it re-plan at once (`salTurned`).
- **stalk**: a costly move refused by the director: it creeps closer, eyes on the egg, and asks again.
- **breath** (salamander): heats the wall under an egg; idle breaths only when an egg is near.
- **lash** (salamander, replaces the Ember Spit): close (0.75 to 2.2 m) and in a straight line through the gaps: eyes lock
  on and the throat glows (tell), the tongue flies (0.2 s), sticks and reels the egg through the gap to the bite. Out of
  line in the tell = a clean miss; the gap turned away mid-reel = it lets go; pulled past reach + 0.5 m = it snaps and he
  tumbles back dazed 1.5 s (tug of war: the tongue thins and trembles as it stretches); stone = it snaps, ouch; water =
  doused; fire = burnt tongue.
- **dive** (salamander): the egg two channels off with no gap near: he sinks into the floor, bubbles show where he will
  come up (tell), he rises by the egg; a water egg on the pool douses him.
- **bite** (salamanders): coil at the snout, snap.
- **fireup** (salamander): a red flame orb or lava makes him white-hot (0.8.18).
- **lick / nip** (gecko): the lick freezes an egg to its ring; after the tell a nip cracks it. A frozen egg is freed by
  shaking its ring: the ice cracks on the first swing (10 deg), bursts on the second the other way; fire thaws it.
- **drop / hip / roll** (thorn-backs): thorns behind; a hip-check at the snout; an egg 1 to 4 m down his channel: he
  curls (tell), rolls as a spiked ball, cracks and shoves the egg or bonks on stone / a wall.
- **ghost / pop / tongue** (chameleon): far from any orb he fades to a faint ripple and crosses unseen, pops up by the
  orb in a flourish, then the tongue (orbs only, never eggs).
- **hop / lick / snatch / spit** (frog): hop between channels, lick orbs, snatch an egg into its cheeks, spit it.
- **volcano** (lava-rock levels with a salamander, and the L30 boss's Lava volley): a rumble (0.6 s), then bombs arc
  from the backdrop crater onto the same seeded spots and heat the floor where they land (no blast). The boss roars
  first (1.0 s) and adds a bomb ahead of the leading egg in phase 2+.

## How a constructor adds threat

A level's pressure is the sum of its villains' `threat`, scaled by its mode. To make a level harder or softer, a
constructor (or the level-making tool) does, in order: pick the villains (their rows), then the level's `dyn` multipliers
(for example `{ salamander: { tell: 1.2 } }` on a first-meeting level), then the egg spots. The creature's row is never
loosened to save a level: soften the level (its multipliers, its egg spots), not the creature, and never loosen its time. The planner
proof must still pass on every mode.

## The menace director (sim/menace.js, aggroA)

The crawlers call it only through optional hooks: `menaceHeat()` (1 = neutral; tempo x heat, rest / heat),
`menaceMay(id, move)` before every costly move (lash, bite, breath, nip, hip, roll, frog snatch, boss volley; refused =
stalk), `menaceDone(id, move, tookEgg)` when the move ends (the token goes back; an egg taken starts the breather), and
`menaceTurned(ri)` (which way the player last turned a ring). Without the file every call falls back to "yes" and heat 1.

Worked example (Medium, one token, breather 3.5 s): L25 has two salamanders. Salamander A has an egg in line at 1.5 m and
asks `menaceMay('c0', 'lash')`: granted, the token is A's. B, with an egg at its snout, asks for a bite: refused (no token
free), so B stalks: it creeps after the egg and keeps it in sight. A's lash snaps (the player turned the gap away):
`menaceDone('c0', 'lash', false)` returns the token, and B's next ask is granted. Had A taken the egg, the breather would
hold every costly move for 3.5 s: the player gets a moment to recover, and losses do not come in a burst ("eggs lost
within 10 s of another loss" in the before/after tables).
