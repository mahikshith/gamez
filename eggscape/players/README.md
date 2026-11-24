# How players behave: the record

Open this file first. It holds what we assume about players, what the simulations and the real logs have shown, what
was changed because of it, and what is still open. Keep it current: every new finding gets a dated line here.

## What is in this folder

| File | What it is | Who writes it |
| --- | --- | --- |
| `README.md` | This record | By hand, after every run that shows something new |
| `latest.txt` | The last full simulation report | `node tools/sim-players.mjs --save` |
| `history.jsonl` | One line of key numbers per saved run, to compare builds | the same command |
| `real.json` | Counts from real speed logs: tries and wins per level, buttons shown against taken, time per screen | `node tools/read-log.mjs <log.txt>` |

Nothing personal is kept here: counts only, never a raw log.

## The three commands

```
node tools/sim-players.mjs --save --note "why this run"   # the town, the crowd, the clickers; about half a minute
node tools/read-log.mjs path/to/eggscape-log.txt          # file a shared speed log into real.json
node tools/test-players.mjs                               # the quick check that no rule breaks (part of the test list)
node tools/test-promise.mjs                               # what a rule promises, a page must offer (every booster can be picked, every way to spin has a button)
```

Options: `--n 300` players of each kind, `--days 30`, `--seed 1`, `--only quitter`, `--crowd 3000`, `--clickers 300`, `--quick` (the eight kinds only), `--json`.

## What the simulation is, and is not

Simulated players live 30 days under the game's real rules: the purse and the shop, the wheel, the Director's help,
the offer engine and its caps, the Brain's gate, and the whole engine room (Ledger, Pulse, the learning Oracle,
Conductor, Herald, Tally).

- **The eight kinds** (`PERSONAS` in `tools/sim-players.mjs`): child, commuter, quitter, grinder, video lover, video
  hater, payer, weekend player. By behaviour, never by who someone is.
- **The crowd**: thousands of players with every trait drawn at random, so mixes exist that no named kind covers. The
  report compares the lowest third against the highest third of each trait.
- **The clickers**: not people. They do any allowed thing in any order, leave and come back after minutes or days, and
  the save is written and read back in between. A line in their result is a way to break the game.

What is assumed, and can be argued with, sits at the top of the simulator: `WORLD` (how hard a level is, what a booster
is worth, what makes someone stop playing) and `PERSONAS`. Rows marked `*` in the report follow from those assumptions.
The other rows follow from the game's own rules. **The simulation proves what the rules do. It cannot say what real
people will do, or how many of each kind exist.** Real logs replace the guesses: a level with 8 real tries in
`real.json` is used instead of the guessed difficulty.

## Findings

Status: FIXED (changed in the build named), OPEN (needs a decision or real data), KEPT (looked at, left as it is).

### 2026-11-24, build 0.8.15, first runs (difficulty guessed, no real logs yet)

| # | What was seen | Rule or assumption | Status |
| --- | --- | --- | --- |
| 1 | The Oracle's rule for "will watch a video" was badly wrong (error 0.4 to 0.66; a coin scores 0.25). It counted a button passed by as nothing, so it overrated everyone. | Rule (engine bug) | FIXED 0.8.15: it now uses what the player did the last times a video was really on the card. Error 0.12 to 0.22. |
| 2 | The Oracle's trust bar (error under 0.2) can never be reached for an event that happens 65% of the time, so nothing would ever have steered. | Rule (engine bug) | FIXED 0.8.15: trusted when better than a coin and saying "yes" about as often as it happens. |
| 3 | A player who leaves got one reminder and then silence for good, because a reminder is only planned when the game is closed. | Rule | FIXED 0.8.15: three notes for a long absence (about a day, three days, a week), the later two about the welcome-back gift, then nothing. Still one a day at most. |
| 4 | A strong player is given about 60 boosters in a month, uses about 11, and sat on 31 unused. To him the wheel's booster prizes are worth nothing. | Rule | PARTLY FIXED 0.8.15: a free gift fills a stack to 3, not 5; past that it pays coins (pile now 22). OPEN: something a strong player wants from the wheel. |
| 5 | **The game is short.** Of the players who stay, 43 to 90% finish all 50 levels inside the month, most inside the first week. A middling player needs roughly 100 tries, about two to three hours. After that only the Daily Vault and replaying for stars are new. | Rule, but the size depends on the guessed difficulty | OPEN, the biggest one. Real logs will say how hard the levels really are. |
| 6 | A paid offer card comes in 20 to 55% of sessions (Starter Nest about 2.6 times, No videos 2.4, Unlock Everything 1.6 in a month). The cap of two cards a session holds everywhere. | Rule | OPEN: mykee to say whether that is too often. |
| 7 | The weakest player has no help at all on about 5% of his tries (a level that beat him three times, no booster, no free help). The Director gives him about 14 free helps in a month. | Rule | KEPT: a game that is never hard is never bought into. |
| 8 | The impatient player most often leaves at level 9, the first level marked hard. | Assumption meets rule | OPEN: watch level 9 in real logs (tries, wins, where sessions end). |
| 9 | The impatient player leaves with about 950 coins never spent. | Assumption (he rarely opens the shop) | OPEN: real logs now carry "shop opened, first at level". |
| 10 | Everyone is asked about reminders on the first day (level 6 is reached in the first session). | Rule | KEPT for now: a player who leaves after one session can only be reached if he was asked in it. |
| 11 | The heaviest video watcher sees about 90 videos in a month. At an assumed 10 dollars per thousand that is under one dollar. A payer who buys Unlock Everything is worth six times that. | Assumption (prices of ads) | KEPT as a sober number, not a forecast. |
| 12 | 120,000 random actions by the clickers and 5,400 simulated lives broke no rule: no purse under zero, no bag over its size, never two reminders in a day, none at night or without permission, no paid offer before level 3 is won, no subsystem down, every save writable. | Rule | KEPT as a test: `tools/test-players.mjs`. |

### 2026-11-24, build 0.8.15, the Lucky Spin can lose (mykee: "every spin doesn't win")

| # | What was seen | Rule or assumption | Status |
| --- | --- | --- | --- |
| 13 | Three villains take one pull in four, never twice in a row, so one pull in five in the long run (20.3 of 102 pulls for the heaviest spinner). A pull paid with coins gets its coins back, a pull paid with a video tries again free, a free pull can try again by a chosen video, and a Try again always wins. Nobody in 5,400 lives or 80,000 random actions paid for nothing or met the villains twice in a row. | Rule | KEPT as tests: `tools/test-spin.mjs`, and the simulator reports "villain rows / tried again". |
| 14 | About half of the villain rows are tried again by a video (9 of 20 for the child, 1 of 10 for the video hater). That is one extra chosen video every three or four play days for a middling player. | Assumption (who watches videos) | OPEN: real logs carry `spin:retry` shown against taken. |
| 15 | The villains cut the free boosters from spins by a fifth; the three coin prizes were raised by a quarter (20, 40, 100) so the coins from spins stay where they were and the economy lanes in `tools/test-loop.mjs` still hold. The strong player's unused pile did not move (22): the villains do not fix finding 4. | Rule | KEPT. Finding 4 stays OPEN. |

## What real logs have said

Nothing yet: no speed log from build 0.8.15 or later has been filed. From 0.8.15 on the log carries, as counts only:
a row per level (tries, wins, seconds, one egg short, Rewinds, boosters), every tracked button and offer shown against
taken, seconds per screen, where the last sessions ended, how often the shop was opened and at which level first.

## Open questions

- How hard are the levels for real players? (finding 5, 8)
- How many players of each kind exist? The simulation cannot know. Play Console and AdMob give the totals for free.
- Is one paid card every second or third session acceptable? (finding 6)
- What should a strong player want from the wheel? (finding 4)
