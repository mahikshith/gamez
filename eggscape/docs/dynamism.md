# Villain dynamism (0.8.19)

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
multipliers on its row (softens or sharpens one level without touching the creature).

## Crawler rows (aggroB)

| kind | tempo | rest | tell | snatch | chase | threat |
|---|---|---|---|---|---|---|
| salamander | 1.15 | 0.9 | 0.7 | 1.3 | 1 | 6 |
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
(for example `{ salamander: { tell: 1.2 } }` on a first-meeting level), then the time. The creature's row is never
loosened to save a level: soften the level (its multipliers, its egg spots, its time), not the creature. The planner
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
