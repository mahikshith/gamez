# Eggscape v2: playtest feedback and plan

Source: mykee's playtest of the v1 test build, 2026-10-29 20:17 UTC. Every idea from that message is listed
here with what v2 does about it. Status: `v2` = built on branch `eggscape-v2`, `later` = parked on purpose.

## What worked (keep)
- Physics, controls (drag a ring, two controls), smoothness, gust and ice effects, animations, the feel.
  "Simple, cool, relaxing, mindful, peaceful", kids will love it.

## Feedback items

| # | Feedback | v2 answer | Status |
|---|----------|-----------|--------|
| F1 | Fox has no proper face/eyes; not animated | Rebuilt fox: open eyes with pupils that track eggs, blinks, brows, ears; moods: smug, evil grin (you failed), shocked/angry (you won), laughing | v2 |
| F2 | Early levels way too easy | Only L1–L2 stay gentle. From L3: shorter fuses, more rings, moving nest, gap shutters, geared rings | v2 |
| F3 | Power-ups sit at the top of rings; eggs only fall, so they can never reach them | Power-ups become **floating orbs** that drift through the channels (and float down), and portals spit them out. Never pinned out of reach | v2 |
| F4 | Fire / stone / bubble power art not good enough | New orb and egg-overlay art per power: layered real flames per flame colour, granite stone shell, iridescent bubble, water, lightning | v2 |
| F5 | Fire sometimes burns the ring and sinks, sometimes only thorns: confusing | Split into flame colours with one rule each: **red** burns thorns only; **black** burns through the ring floor (rare, hard to get); **green** mends a crack; **gold (sun)** hatches the egg into a chick | v2 |
| F6 | More environmental effects: fire, earth, thunder... not only gust and ice | Weather/hazard per theme: thunderstorm (lightning strikes a ring, flash), earthquake (tremors nudge eggs), volcano (falling embers, heat), rain (slippery rings), blizzard, sandstorm, fog, ghost lights, underwater current | v2 |
| F7 | Store: coins from play and ads, buy power-ups for the start of a level | Coins per level (stars, eggs, perfect) + rewarded "double coins". Store sells starting boosters: stone shell, golden shell, +15 s fuse, rewind token, sponge pad | v2 |
| F8 | Google Play later | Code stays plain web; wrap later with a TWA/Capacitor shell. Store/coins designed so they can map to IAP | later |
| F9 | More concentric rings (from L5–L6) | Up to 6–7 rings in late levels | v2 |
| F10 | Moving basket in more levels (was in one) | Moving nest is common from L4, with several patterns (slide, stop-go, speed-up) | v2 |
| F11 | Egg cracking only seen in a couple of levels | Clearer cracks (bigger lines, chips, sound) on every crack; hazards that crack (blunt spikes, rocks, meteor falls) appear in most levels | v2 |
| F12 | Portals placed at the top where eggs never go | Portals sit where eggs travel (channel floors) and act as orb spawners | v2 |
| F13 | Proper stone power animation | Stone shell: granite texture, cracks on thorns instead of the egg, heavy thud | v2 |
| F14 | Powers happen too fast to understand: show a 1–2 s popup naming the power | On pickup: slow-motion for ~1.2 s and a card with the power's icon, name and one line ("Stone shell: hard to crack, heavy"). Shorter after the first time | v2 |
| F15 | Align all gaps once and every egg drops straight in: every level beaten the same way | (a) **Meteor rule**: falling through 3+ rings in one drop cracks the egg, even in the nest (2 rings = Comet, still a bonus). (b) Moving nest. (c) Gap shutters that open and close. (d) Geared rings: turning one turns its neighbour the other way. (e) Single-gap rings with thorn pockets | v2 |
| F16 | Hen (mama) animation: worried when an egg cracks; on the fail screen "you couldn't save 2 of 3" | Hen sits by the nest: cheers on a save, gasps on a crack, cries on a break. Fail card shows the sad hen next to the grinning fox | v2 |
| F17 | Fox with an evil smile when you lose | Fail card: fox evil grin + laugh | v2 |
| F18 | More power-ups; bomb should blast eggs away, some crack | Bomb blast throws nearby eggs outward; close eggs crack | v2 |
| F19 | Power-up balls come out of portals; some good, some bad; player must learn, not be told in advance | Mystery orbs: colour hints only. First touch reveals it (popup) and it is remembered in the save. Bad orbs: **thorn ball** (cracks), **thunder ball** (zaps: stuns rings / cracks nearby egg) | v2 |
| F20 | Study Candy Crush's dynamic difficulty; for web, a different way to tune difficulty | Research note in /mnt/project-files/research/eggscape-v2-research.md. Superseded by F32: the player picks the difficulty; no hidden auto-tuning | v2 |
| F21 | Explain what the golden shell / start boosters do | Booster buttons on the intro card show a one-line explanation | v2 |
| F22 | Different kinds of thorns | Sharp red hooks (break), blunt grey spikes (crack only), retracting spikes; | v2 |
| F23 | Vine level: eggs moved upwards, physics looked wrong | Vine "carry up" stickiness removed | v2 |
| F24 | Sticky sponges: hold the egg, blink, then release | **Honey pads**: amber sticky pads hold an egg ~2 s, blink, then let go; good for parking an egg while you turn rings | v2 |
| F25 | Eggs hatch mid-way into a chick that can't fly but must land properly | Gold (sun) flame hatches the egg into a chick: flutters (slow fall), never cracks, but thorns still get it; counts as saved in the nest | v2 |
| F26 | Snake predator: slithers in from the top through the channels toward the eggs; rings can be turned to hold it back | **Snake levels**: the snake enters through gaps in the outer ring and moves along channels toward the nearest egg; it can only pass a ring through a gap, so turning rings blocks it. Eats eggs it reaches | v2 |
| F27 | Other egg predators from nature | Snake first; later: crow (swoops at the nest), rat, weasel | later |
| F28 | More levels | 30 levels in v2 | v2 |
| F29 | Do proper research again; come up with own ideas too | docs/research/v2-research.md; own ideas marked "(Claude)" below | v2 |
| F30 | Reduce time where it helps difficulty | Fuses tightened from L3 (planner time x2.2 + 15 s instead of x3 + 25 s) | v2 |
| F32 | (20:20) Easy / Medium / Hard modes instead of silently raising difficulty; kids under 5 play Easy/Medium; default Medium; changeable in the menu | Mode setting on the title and pause screens, saved. Same levels, tuned per mode: **Easy** longer fuse (x1.6), slower and wider nest, thorns crack instead of break, no meteor rule. **Medium** as designed. **Hard** shorter fuse (x0.8), faster nest, harder landings crack. Stars and coins are tracked per mode | v2 |
| F31 | Use sub-agents, cheaper models where fine; new branch; push for tracking | Branch `eggscape-v2` in mahikshith/gamez; art, weather, store and research done by helpers | v2 |

## Claude's own additions
- Meteor rule (F15a) is the physics answer to the align-everything exploit: it is honest physics, not an arbitrary block.
- Gap shutters and geared rings give real puzzles instead of just reflex.
- Mystery-orb discovery is saved so a returning player sees known icons (learning curve, no tutorial walls).
- Difficulty is the player's choice (F32), never a hidden tweak: fair for kids and honest for adults.
