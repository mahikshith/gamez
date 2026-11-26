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

### 2026-11-25, build 0.8.16, a lost pull is lost (mykee after playing 0.8.15: "for every turn users were able to get a reward ... it shouldn't be like that")

| # | What was seen | Rule or assumption | Status |
| --- | --- | --- | --- |
| 16 | In 0.8.15 every pull ended in a prize: a coin pull the villains took was refunded and a video pull got a free Try again (finding 13). Nothing was ever spent at the machine, so it was a second purse, not a place to spend. | Rule (my design fault) | FIXED 0.8.16: the villains take 45 pulls in 100, never three times in a row (about 4 in 10 in the long run); the coins or the video of a lost pull are spent; no Try again. First pull ever and the cheer-up spin still always win. Odds on the page, the same for everyone. |
| 17 | With the new rules a pull is worth about 50 coins against a first price of 80 (62%), so a coin spin is a real sink. Players who like the wheel now spend 63% of what they earn against 42% for those who do not (it was level before). Coin prizes went up to 30, 60 and 150 so a win feels like one and the lanes in `tools/test-loop.mjs` hold (boss treasures 59% of coins). | Rule | OPEN: watch in real logs how many coin and video spins follow a villain row (the row is `spin` in the buttons-shown-vs-taken tally). |
| 18 | Risk named to mykee: a slot machine where paid pulls can lose nothing back is closer to what store rating forms call simulated gambling than 0.8.15 was. | Outside rule (store ratings) | OPEN: his call; the odds page and the daily caps (3 video, 3 coin pulls) stay. |

### 2026-11-25, build 0.8.17, the coin engine (mykee: "from the rewarded videos, the slot machine and the daily unlockables the user could unlock everything ... without spending a single dollar"; "users cannot unlock a far distant world without unlocking the previous one")

**Measured before any change** (`src/engine/mint.js` did not exist; app build; numbers from the game's own functions):

| Faucet (before) | Amount | Ceiling |
| --- | --- | --- |
| First clear, two stars | 21 to 36 a level, 1,311 for all 50 (three stars perfect: 1,856) | once per level |
| Replay of a level already at three stars | full pay (34 for three stars) | **none: a farm** |
| Star chests | 30 + 10 a chest = 750, plus 10 boosters and 5 egg skins | 10 chests |
| Boss treasures | 120 + 40 a world = 3,000 | 10 |
| Daily chest | 25 to 60, mean 38.6 | one a day |
| Free-coins videos | 40/30/25/20/20/15 = 150 | six a day |
| Double coins video | the win's coins again | **every win, no daily limit** |
| Bonus chest video | 40 coins + a booster | every third win or so, no daily limit |
| Lucky Spin pull | worth 49.7 (14.3 in coins) at the first wheel, 71.2 (35.9) at the last | 3 video, 3 coin, 2 for time, 2 cheer-up a day + 1 per 3 fresh wins |
| Daily Vault | its win + 40 | one a day |

| Sink (before) | Total |
| --- | --- |
| Things to own for coins: 14 egg skins 2,900, 16 hen outfits 3,910, 3 premium chicks 4,500 | **11,310** (the six level chicks, 2,900, come free with their level) |
| World gates, flat 80 + 40 a world, any world from world 1 | 2,520 |
| Boosters 40-90, kits, charges 45-350, tickets 80-150, coin spins 80/110/150 x the wheel | endless |

| Purse after level (wins every level first try, 2 stars, 6 a day, spends nothing) | 5 | 10 | 12 | 20 | 30 | 50 |
| --- | --- | --- | --- | --- | --- | --- |
| Before, no videos | 314 | 706 | 775 | 1,625 | 2,744 | 5,563 |
| Before, every video and spin | 581 | 1,358 | **1,497** | 3,209 | 5,019 | 10,106 |
| 0.8.17, no videos (online) | 186 | 391 | 441 | 824 | 1,315 | 2,438 |
| 0.8.17, every free thing | 297 | 646 | **698** | 1,364 | 2,005 | 3,750 |

| Owning the whole catalogue (never leaving, never paying, buying all he can after every session) | child | commuter | quitter | grinder | video lover | video hater | payer | weekender |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Before: all owned on day (earliest) | >120 (39) | **41 (23)** | 51 (34) | 72 (31) | 42 (23) | >120 | >120 (109) | >120 (21) |
| Before: owned on day 30 | 67% | **81%** | 63% | 75% | 79% | 55% | 59% | 68% |
| 0.8.17: all owned on day | >90 | >90 | >90 | >90 | >90 | >90 | >90 | >90 |
| 0.8.17: owned on day 30 | 23% | **39.7%** | 29% | 40% | 38% | 22% | 25% | 30% |

| # | What was seen | Rule or assumption | Status |
| --- | --- | --- | --- |
| 19 | Any world gate could be bought from world 1 on (flat 80 + 40 a world). Buying ahead let the player play nothing new (a level still needs the one before it won), but it spent coins and removed the star target later. | Rule | FIXED 0.8.17: a world opens (stars or coins) only when the world before is open and its boss is won or skipped (`MINT.worldReady`); `gate:<k>` refuses otherwise and takes nothing. The price is the stars missing: 75 a star, at least 150, nothing at the target (`MINT.gatePrice`). Stars per world scale with `PER_ENV` (1.4 a level). |
| 20 | A level already at three stars paid in full on every replay. | Rule | FIXED 0.8.17: a win with no new star pays 40%; a new star pays in full. |
| 21 | Double coins had no daily limit (a 30-level day was worth about 800 coins of videos); the Bonus chest neither. | Rule | FIXED 0.8.17: both share one pot of 50 coins a day; once it is spent the win page offers neither until tomorrow. |
| 22 | Through level 12 with every free thing taken: 1,497 coins (three chicks, or every gate to world 6). The commuter owned 81% of the catalogue on day 30. | Rule | FIXED 0.8.17: free-coins videos 4 a day, 50 coins; daily chest 10 to 25; boss treasures 40 + 8 a world; star chests 10 + 5; spin coin prizes 10/20/50, wheel sizes x1.1/1.2/1.3 (were x1.5/2/2.5); a second ticket 20 coins; a gift into a full stack pays a quarter (was half), a charge into a full sack too (was its whole price); Daily Vault bonus 5 (was 40); a win offline 7 + 2 an egg + 4 a star + 4 perfect, and **online +20%** on its own line ("Online bonus +N"), so an online win pays about what it did. One table: `src/engine/mint.js`; `tools/test-mint.mjs` holds the targets. |
| 23 | The commuter target (40% on day 30) is met only just (39.7%). Wins are now half his coins; cutting them further would make the first levels feel poor. | Rule | OPEN: if a later change adds a faucet, `tools/test-mint.mjs` fails first. |
| 24 | Simulated players never buy a world gate: they average more than 2 stars a level, the gates ask 1.4. The gate price matters only to a one-star player. | Assumption (stars per win) | OPEN: real logs will say. |
| 25 | With 15% of sessions offline (no videos there) and the win-video pot, videos a play day fell (child 8.3 to 6.4, video lover 7.8 to 5.4) and so did the assumed ad income (child $0.98 to $0.74 a month). | Assumption (online share, eCPM) | OPEN: mykee to weigh ad income against the economy. |
| 26 | Money only: the Golden Hen and no videos (Premium), every level open (Unlock Everything), the whole collection at once (The Whole Coop). Coin-buyable: the golden egg (300) and the three premium chicks (1,200 to 1,800), as before. | Rule | KEPT. |

### 2026-11-25, build 0.8.17, the Pacer (mykee: "never ever reduce the time or increase the time for them ... push the struggling players"; "they could beat the level in easy mode, but the goals need to be high-target goals in order to earn 3 stars")

`node tools/sim-players.mjs --compare`: the same people and seeds without the Pacer and with it (300 of each, 30 days,
seed 1; seeds 2 and 3 agree on every direction below). The Pacer never touches the fuse, the rings, villains, odds or
prices; it fits help, the skip pop-up, a free booster, hints, dares and Easy's star goals.

| Before > after | child | commuter | quitter | grinder | video lover | video hater | payer | weekender |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Tries stuck with no help % | **4.9 > 1.5** | 0.1 > 0.0 | 0.0 > 0.0 | 0.0 > 0.0 | 1.7 > 0.4 | 0.6 > 0.2 | 0.9 > 0.2 | 1.3 > 0.3 |
| Worst losing run (median) | 7 > 6 | 3 > 3 | 2 > 2 | 3 > 3 | 4 > 4 | 3 > 3 | 4 > 4 | 4 > 4 |
| Stars won on Easy | 31.8 > 23.5 | 8.0 > 4.8 | 3.1 > 2.4 | 7.9 > 4.3 | 13.7 > 7.8 | 8.7 > 4.8 | 11.7 > 6.0 | 12.8 > 7.1 |
| Finished all 50 % (day) | 72 (4) > 76 (3) | 53 (11) > 57 (10) | 5 (21) > 8 (22) | 91 (2) > 94 (2) | 80 (5) > 79 (5) | 70 (5) > 70 (4) | 84 (4) > 85 (4) | 86 (5) > 85 (5) |
| Dares offered / taken / met | - | 2/0/0 | 1/0/0 | **7/6/3** | 2/0/0 | 3/1/0 | 2/1/0 | 2/1/0 |
| Coins in | 5159 > 5184 | 3349 > 3386 | 1023 > 1071 | 4589 > 4704 | 5210 > 5221 | 3795 > 3880 | 5804 > 5887 | 4568 > 4568 |

| # | What was seen | Rule or assumption | Status |
| --- | --- | --- | --- |
| 27 | Most of the child's stuck tries were replays of levels he had already won (no skip there) and tries that came back to a level by the map, where the "Keep trying" booster had been used up or was dropped. | Rule | FIXED 0.8.17: the Pacer's free booster also comes where no skip is possible, waits for the next try on that level however he gets there, and comes again in a later losing run; the free hint comes again every 3 more losses. Stuck tries with no help fell by 70% for the child; no persona's worst losing run grew. |
| 28 | Easy's second star asks for every egg (flawless where Medium asks for no cracks), the third also for the bonus goal; an Easy win pays 70% (the Mint's FAUCETS.easy) and no hard-level extra. Stars won on Easy fell by 26% (child) to 46% (grinder). The planner (tools/planner-easy.mjs, 16 levels) still gets three stars on Easy on 6 of 16 (Medium 11 of 16). | Rule (the planner), assumption (how often a player who needed Easy loses an egg) | KEPT; the child's fall is the smallest because he plays Easy most and the sim's share of his flawless wins is assumed. |
| 29 | The grinder takes 6 of 7 dares and meets 3, for 45 coins in a month; his day to finish all 50 stays day 2. Nobody else is offered more than 3. | Assumption (dare taken, dare met) | KEPT: coins from dares do not move the Mint's targets (commuter 39.7% of the catalogue on day 30, as before the Pacer). |
| 30 | "Left after a losing run" rose for the video lover (26 > 34) and the weekender (17 > 23) on seed 1 and fell on others: more of them are still playing at the end of the month, so more endings are left to count. | Assumption (leaving) | OPEN. |

## What real logs have said

Nothing yet: no speed log from build 0.8.15 or later has been filed. From 0.8.15 on the log carries, as counts only:
a row per level (tries, wins, seconds, one egg short, Rewinds, boosters), every tracked button and offer shown against
taken, seconds per screen, where the last sessions ended, how often the shop was opened and at which level first.

## Open questions

- How hard are the levels for real players? (finding 5, 8)
- How many players of each kind exist? The simulation cannot know. Play Console and AdMob give the totals for free.
- Is one paid card every second or third session acceptable? (finding 6)
- What should a strong player want from the wheel? (finding 4)
