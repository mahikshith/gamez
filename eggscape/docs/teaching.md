# Teaching in play: slow motion and gesture, not text

The owner (2026-11-26): "While they are moving their eggs and saving themselves from villains they won't even read the
text ... Give a split second or 1 or 2 seconds for them to see what is going on, if the villain comes for the first or
second time. From the third time they will handle it."

Code: rules and the lesson table in `src/engine/teach.js` (pure, `node tools/test-teach.mjs`), the moment itself in
`src/lesson.js`, wired from `src/main.js` (`lessonAsk`, `lessonTick`, `drawLesson`), the fuse hold in `src/sim/sim.js`
(`sim.clockHold`).

## 1. When a moment may fire

A **subject** is a villain, hazard or boss move (its old tip key, for example `snake`, `gator`, `owlSwoop`) or `lv:<id>`
for a level's opening caption. `save.met[subject]` counts **meetings**: one per level try in which the subject showed up,
wherever that is. A skipped level cannot hide a lesson: the first meeting just happens somewhere else.

A moment fires only when all hold:
- it is the subject's **first or second meeting** (Adaptive help off: the first only);
- no other moment is on, and the last one ended **at least 6 s ago**;
- the fuse has **5 s or more** left;
- no finger is turning **another** ring (a finger on the lesson's own ring is fine);
- no card, fuse intro or modal is up (the request waits up to 8 s, then is dropped; the meeting still counts);
- the subject has not had a moment already in this try.

A replay of a won level teaches nothing for a subject already met twice (that follows from the rule above).

## 2. Length and the clock

- Time eases to **0.2x in 0.15 s**, holds **up to 1.5 s** (0.6 s with Adaptive help off, or on a second meeting the
  player already answered), eases back in 0.25 s. All curves are smoothstep; nothing is linear.
- **The level clock (fuse) stands still for the whole moment**, the same for every player, for at most 1.5 s of sim time
  per moment. Nothing else ever changes level time. One moment holds about 0.55 s of sim time; a subject can give back at
  most 2 x 1.5 s in a player's life. The sim's play is otherwise untouched (`test-teach`: same eggs at the same spots).
- **Input stays live.** Doing the gesture for real (turning the lesson ring the right way, or tapping the shown thing)
  snaps time back in 0.12 s with a gold ring burst, a sparkle and a soft chime, and marks the subject understood
  (`save.metOk`). Any other touch lets the moment go at once.

## 3. What a moment may show

- The scene dims round a **soft spotlight** on the subject (calm mode: a flat soft veil, no camera move, no ripple; Low
  graphics: the same flat veil). The camera **leans** a little toward it (45% of the moment camera, never in calm).
- A **ghost finger** (the coach's glove) does the answer on the real ring, with a faint arc and an arrow head: it presses,
  pulls back a hair (anticipation), drags, runs a touch past the end and settles (overshoot, settle), then lifts. Calm
  mode shows the end pose with the whole arc.
- **No words**, unless the subject cannot be shown by gesture: then **at most three words** under the spotlight.
- The HUD stays bright and usable; the moment draws under it.

## 4. The gesture vocabulary

| gesture | what the finger does | used for |
|---|---|---|
| `away` | drags the ring under the subject so the nearby gap moves away | snake, gator, weasel, eagle, owl swoop, Pip, shards, the frog's egg snatch (its ring is the wall between frog and egg) |
| `open` | brings the nearest gap of that ring to the subject | rats, hermit crab, urchin, dizzy gator, turtle, a level's caption |
| `spin` | turns the ring the subject sits on or rides | salamander, Coco, Bandit (against his crank), mama raccoon's kits (the floor they carry an egg on: either way, briskly), beetle, whirlpool, cage, whip |
| `tap`  | taps the thing to use | thorn vine (the fire orb) |
| `look` | spotlight only, at most three words | effects and threats no ring turn answers (laser, gust, frost) |
| `power` | no finger: the power's effect, an icon gag, its icon and name (pickups, section 5b) | every orb |
| `none` | no moment: the creature's own pop-up says it | reactions such as a frog's soft landing, a snake clash |

Ring choice: `floor` (the ring just outside the subject: its channel floor), `own` (the ring nearest its radius),
`outer`, `ev` (the event's own ring).

## 5. A level's opening caption

The text bar ("The duck egg floats and rides the current") is gone. On the first two visits to a level the finger shows
the first move on the real rings: it brings the gap to the egg the caption is about (the special egg kind of the level,
else the egg furthest along). Level 1 keeps its own coach instead. The words stay in the level's "i" panel.

## 5b. Power pickups and lost stars (no words in play)

- **A power pickup has no card.** The first two pickups of each power (`save.met['pw:<id>']`, the same two-meetings rule,
  6 s spacing and clock hold as a lesson, never while another moment is on) are a short moment on the egg that took it:
  the power's own effect art plays, an icon gag shows what is not self-evident (a snake fang pings off the stone shell, a
  flame licks a thorn away, a crack mends, seconds fly to the timer, arrows show the bubble's lift), and the orb's icon with
  its NAME only (one or two words) floats by the egg for about a second. From the third pickup: the icon pops at the egg.
  A first pickup that could not have its moment (spacing, another moment on) only pops the icon and keeps its meeting.
  The sentence stays on the level card's faces and in the "i" panel.
- **A lost star goal has no words.** The HUD star bulges, cracks and greys with a small shake; the goal's icon (the level
  card's and win page's own) flies out of it and fades. Calm: a soft fade.
- Any other message in play: an icon gesture where one exists (the teach hand on a button), else three words at most.

## 6. Adding a new villain's lesson

1. Pick the event where it first shows a threat (its telegraph), and call `lessonAsk('<key>', null, ev)` from main.js
   (or keep passing `once` from main.js to the render file: its key reaches `lessonAsk`). The event needs `x, y`; give
   `id` too and add a live tracker in `src/lesson.js where()` if the creature moves.
2. Add a row to `LESSONS` in `src/engine/teach.js`: `key: L('<gesture>', '<ring>', '<at most three words>')`.
3. If the answer is a ring turned a given way, expose that way (see `banditLesson`) so only the right turn counts.
4. Run `node tools/test-teach.mjs` and take a frame strip of the moment at 450x1000 (normal and calm).

## 7. Forbidden

- Walls of text, any sentence in play, a text bar for a villain.
- Blocking input or stopping the world dead: the world runs at 0.2x, the player plays on.
- Repeating after the second meeting, two moments within 6 s, a moment in the last 5 s.
- Touching level time in any other way, or giving any player a different clock.
- Flashing or shaking in calm mode.
