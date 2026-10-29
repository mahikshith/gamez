# Eggscape — game design (production v1)

Working title. Successor of "Ring Escape". Web only (Poki first, then CrazyGames, GameDistribution, own site).

## Pitch
A sly fox locked the hen's eggs inside his spinning vault. Grab the rings, turn them,
roll the eggs out gap by gap and drop them into the nest. Eggs are fragile: a hard fall,
a thorn, or a heavy egg crashing into them cracks the shell. Three cracks and it's gone.

## Why this is harder and stickier than v4
- Rings never shatter. Every ring stays until the level ends; you work each egg out by hand.
- **Real rigid-body physics (Box2D via planck.js)**: eggs are egg-shaped bodies that roll, wobble,
  stack, and collide with each other. Ring walls carry eggs by friction.
- **Fragility is the skill**: impact speed is measured on every contact. Touching, rolling and
  resting on a ring never hurts. A drop of one ring is safe; a bigger fall onto bare ring (about
  1.6 m, e.g. tumbling from a gap high on the wall, or the deep rings of later levels) cracks the
  shell. **Sponge pads** (foam cushions on parts of rings, thorns grow between them) halve the
  landing impact: turn a pad under a falling egg to land it soft. Two gaps in one fall = Comet:
  the landing is free and the egg scores double.
- **Up to 4 eggs at once**, in different channels: turning one ring can sweep its thorns into an
  egg resting on the next ring, or drop an egg onto another egg. Choosing which ring to touch is
  the decision that makes it a game.
- **The last drop must hit the nest.** Miss and the egg splats on the ground (or lava). The nest moves
  in later levels.
- Stars demand mastery: 1 star = save the target, 2 = save every egg, 3 = every egg with zero cracks.

## Controls
- Touch/mouse: press on a ring (or the band around it) to grab it; drag around the center like a dial.
  The ring follows with a max turn speed (heavy rings turn slower). Selected ring is highlighted.
- Keyboard: Left/Right (A/D) turn the selected ring, Up/Down (W/S) select outer/inner ring, P/Esc pause.

## Egg rules
- Body: 12-vertex egg hull, h 0.56 m, w 0.42 m. Gravity 10 m/s^2.
- Closing speed along the contact normal at first contact: >= CRACK (5.6 m/s) adds one crack;
  >= SHATTER (8.5 m/s) breaks it at once. Sponge pads count half the speed, the nest less than half.
  Egg-on-egg impacts damage both. Thorn contact breaks it. Ground/lava contact breaks it.
- Cracks are drawn as growing crack lines; a 2-crack egg wobbles and leaks a tiny drip.
- Break = shell shards are physics bodies that bounce off rings, yolk splat particles, sound.
- Saved = egg settles in the nest bowl; flies to the HUD counter.

## Power-ups (all physical pickups between rings; every one has a cost)
| Pickup | Effect | Downside | First level |
|---|---|---|---|
| Twin | hatches +1 egg beside it (cap 4) | new egg starts with 1 crack | 3 |
| Fire | egg burns for 6 s, thorns it touches burn to ash | it also burns any wooden ring it rests on, opening holes you didn't plan | 5 |
| Portal | (level feature) swirling hole pair: enter one, exit the other with speed kept | some exits put you higher = harder fall, or send you back inward | 7 |
| Steel | iron shell for 8 s: no cracks, snaps thorns | 4x heavy: cracks eggs it hits, slower ring turns | 9 |
| Bubble | egg floats in a bubble 7 s, bubble pops instead of the egg on a thorn | it floats UP and drifts back toward the center | 13 |
| Bomb | physical bomb; an egg bumping it lights a 2.5 s fuse; blasts ring segments into debris | the blast throws and can crack nearby eggs | 14 |
| Magnet | ties two eggs with a short rope for 8 s; one can hang the other across a gap | drags the partner into whatever it hits | 17 |

## Hazards / ring materials (one new rule per level, then mixed)
wood (burnable), thorns, retracting spike traps, moving nest, mushroom (bouncy), glass (breaks after hits),
ice (frictionless), loose rocks (physics debris that can crack eggs), sandstone motor ring (spins on its own,
cannot be grabbed), sticky honey vine (eggs ride up the wall), underwater (low gravity, drag),
wind gusts, lava floor, clockwork counter-rotating motors.

## Levels: 20, each with its own theme
1 Sunny Farm, 2 Hay Barn, 3 Apple Orchard, 4 Pumpkin Patch, 5 Bramble Woods, 6 Mushroom Glade,
7 Crystal Cave, 8 Frozen Lake, 9 Pine Blizzard, 10 Desert Dunes, 11 Pyramid Tomb, 12 Jungle Ruins,
13 Coral Reef, 14 Pirate Cove, 15 Thunder Sky, 16 Clocktower, 17 Haunted Graveyard, 18 Volcano,
19 Dragon's Lair, 20 The Fox's Vault (finale).
Each theme = own background art, ambient particles, ring material, palette, music key and tempo.

## Score
- Egg saved 100; uncracked x2.
- Catch combo: eggs landing within 3 s of each other: x2, x3, x4.
- Time bonus under par.
- Star streak: consecutive 3-star levels raise a score multiplier (x1.2, x1.5, x2). Total score = leaderboard value.

## Ads (core rule: an ad is always a reward)
- Fail: "Rewind 5 s" (ad) restores the exact physics state from 5 s ago, streak kept. Or plain Retry.
- Level start (optional): "Golden shell" (ad) = one egg starts unbreakable for the first fall.
- Level end: "Double score" (ad).
- Interstitials only on level transitions, portal-controlled frequency. Never mid-level.

## Camera
Frames the channels that hold eggs (zoomed in early, eases out as eggs progress, includes nest for the final drop).
Small punch on saves and breaks. No motion blur, no trails, no glow on eggs, no path dots.

## UI rules
All text goes through one layout layer that measures every string, fits it to its box, and records its rect.
Debug/test mode asserts no two UI rects overlap. Toasts use a single slot queue. Score popups avoid each other.

## Tech
Plain ES modules + esbuild into one JS bundle; Canvas 2D; planck.js physics (fixed 1/120 s step);
WebAudio synthesized SFX and music (no audio files). Portal SDK adapter (Poki, CrazyGames, GameDistribution,
local). Save = localStorage (+ portal data API). Target build < 1 MB.
