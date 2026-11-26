// Level specs: the designer's intent per level (mechanics, materials, pressure).
// tools/gen.mjs places gaps/thorns/items from these and keeps only layouts the solver can clear
// with 2+ stars, then writes src/data/levels.js.
//
// ring fields: mat, motor (deg/s), motorFlip (s), retract {period,on,phase}, gaps (count), gapX (multipliers
// to hand out), thorns (cluster count), size ([min,max] thorns per cluster), out (outward thorn count),
// items ([types]), noGap (true = solid ring, must be blasted/burnt open), pads (sponge count; default by level)
//   v2 ring fields: shut {period, open} (every gap gets a sliding door, open for that fraction of the period),
//   gear (true = geared to the next ring out: turning one turns the other the opposite way), honey (honey pad
//   count), blunt (how many thorn clusters are blunt grey spikes that crack instead of break), pocket (true =
//   the floor thorn cluster hugs one edge of the gap). items still work and become floating orbs in the
//   channel inside that ring.
// v2 level fields: orbs [{type, ch, a?}] floating orbs (types: fire_red fire_black fire_green fire_gold stone
//   bubble water thunder thorn magnet twin; 'fire'/'steel' map to fire_red/stone), portals [{from:[ch,a],
//   to:[ch,a], emit?:[types], every?: s}] (placed on channel floors; with emit they spit an orb out every
//   `every` s), weather ('thunder' | 'quake' | 'embers' | 'rain' | 'current' have physics; any other
//   WEATHER_KINDS id is visual only), weatherOpts {strength} (current), snake {delay, speed, a, len},
//   nest {w, amp, period, x, drop, pattern: 'sine' | 'slide' | 'stopgo' | 'speedup'}, bonus objective
//   {kind:'turns', n} | {kind:'prize'} (save the speckled egg) | {kind:'orbs'} (collect every orb) |
//   {kind:'time', s}, world (for the level map), intro {title, line} (one-screen card when a world's
//   new mechanic first appears). Up to 7 rings.
// v3 ring fields: oneway (1 | -1: the ring only turns that way), curtain (the first n gaps get a thorn curtain only
//   fire burns), grate (n quail-only grated openings on free floor), barriers (n wooden walls on this channel floor:
//   they block eggs and snakes; fire burns them, venom melts them).
// 0.8.18 ring field: creep {len (m of rim), v (m/s), rest (s, the pause at each end on Medium: the safe window), side 'in' |
//   'out', delay, form, w}: the creeper family travels a stretch of this ring's rim from just past a gap's edge
//   (sim/creeper.js; laid out by tools/gen.mjs layCreep). form = its world's look and small rule: 'thorn' (default: farm,
//   woods), 'frost', 'shard', 'spark', 'saw', 'anemone', 'vine' (bayou), 'lava' (w = the flow's length; volcano, not placed
//   yet). First met in world 2 as a slow, gentle thorn creeper on L11, then on a level that measured easy for its place.
// v3 level fields: snake {delay, speed, a, len, size, kind, skin} or an array of them (kind: 'classic' | 'fast' (emerald,
//   speed x1.3, body x0.8) | 'constrictor' (amber, armoured: half the back-off from a protected egg, speed x0.8) |
//   'spitter' (crimson, venom melts a barrier in half the time); a trait is on only when the spec sets `kind`.
//   skin: 'violet' | 'emerald' | 'amber' | 'crimson', cosmetic; default the kind's, else by index so two snakes in a
//   level never share one), eagle {delay, every}, weasel {a, delay, ch}
//   (a hunting egg thief, sim/thieves.js), rats {a, n, delay, ch} (a pair that rolls eggs to their hole), lava {every, delay} (lava rocks; lava: true is only a lava floor), icicles
//   {every, delay}, eggKinds ['ostrich' | 'quail' | 'duck' | null, ...] (per starting egg), portal pull (m),
//   world 1..7 (environment), boss (bossId for the intro portrait: weasel snake blizzard golem salamander eagle ratking).
//   v3 orb types: hourglass feather rockskin curse (bosses and portals hand out curse orbs).
// v3.1 level fields: gusts {every, delay, strength, dur} (telegraphed wind that shoves eggs and snakes along the
//   channels), bossFight {kind, delay, gale, throws, phases: [{at: {saved, t}, attacks, every, heat, summon
//   }]} drives the boss actor, its telegraphed attacks and the phase bar (see src/sim/boss.js);
//   icicles {every, delay, big} now grow over an egg and drop (every `big`-th is a chunk that freezes a ring and
//   stands as a melting ice wall). v3.1 orb: frost (freezes the ring under the egg for 3 s).
// v3.2 level field: salamander {delay, every, a, ch, dir} or an array of them: the lava salamander walks channel ch
//   (1 .. rings-1) from angle a (deg; 90 = top), climbs through gaps toward the leading egg and every `every` s
//   (Medium) breathes fire at a ring wall just ahead of it: that section is red-hot for 4 s (eggs touching it crack,
//   thorns on it burn). The ring under it carries it; water cools it. In a salamander boss fight it is the boss
//   (1.3x, breathing on the phase rhythm; see src/sim/salamander.js).
// 60 levels = 10 environments x 6 (0.8.17; 35 = 7 x 5 when this was written): the first level of an environment
// teaches its trait, the next ones twist it, the last is the boss (with an intro card; world 1 ends with Midnight Raid
// after its weasel); the level after a boss is a breather. Nests only move where there is a reason
// (the lake current, the hen keeping her nest away from the thieves in their vault).
// Rule: the outermost ring is never a motor ring: it would drop eggs wherever its gap happens to be, so
// whether they hit the nest would be luck.
export const SPECS = [
  // ---------------- 1 The Farm (2026-11-20 first-five ladder: ONE new idea per level, the first win in 15-25 s)
  // L1 Hen House: turn a ring, the egg drops, the basket catches it (2 rings, wide gaps, nothing that hurts, no fuse:
  //   `noFuse`; one egg home wins, so a first-timer cannot really lose). From L2 every level hands over a new toy (owner,
  //   2026-11-20): L2 Haystacks: red thorns and the red flame that burns them. L3 Duck Pond: the twin orb, and a thorn
  //   curtain only the flame burns (the swirl remakes a missed flame). L4 Windmill: the portal and the first chick (glow).
  //   L5 Big Red Barn: the Weasel Raid boss and Papa Rooster, fought with everything learned.
  //   Gate doors, gears and grey spikes first appear later (L6+), each taught there.
  //   `fuseX` stretches the generated fuse (L2-L5: generous while the game is learned); `gapLen` (ring) = a wider gap.
  // 2026-11-23 (mykee: the first five are way too easy on Medium): L1 stays a sure win (a star per egg), L3 asks for 3 (the twin makes a 4th), the fuses are 50/60/60/80 s
  // (the clumsy bot's median win is 14/18/22/29 s), the hen reaches less, and thorns sit just past the gaps of L2-L4 (an overshoot costs an egg).
  // levels.js holds the tuned rings; these specs only mirror the targets and the fuse.
  { id: 1, world: 1, theme: 'coop', name: 'Hen House', eggs: 3, target: 1, spacing: 1.15, material: 'wood', minMoves: 2, noFuse: true,
    nest: { w: 3.6, reach: 1.2 },
    rings: [{ gaps: 1, gapLen: 1.0 }, { gaps: 2, gapLen: 1.1, pads: 2 }] },
  { id: 2, world: 1, theme: 'hayfield', name: 'Haystacks', eggs: 3, target: 2, spacing: 1.1, material: 'wood', minMoves: 3, fuseX: 0.9,
    nest: { w: 3.3, reach: 1.0 },
    orbs: [{ type: 'fire_red', ch: 1 }],
    intro: { title: 'Red flame', line: 'Red thorns break eggs. An egg that rolls through the red flame burns every thorn it touches.' },
    tip: 'Roll an egg into the red flame, then into the thorns.',
    rings: [{ gaps: 1, gapLen: 0.95 }, { gaps: 1, gapLen: 0.9, thorns: 1, size: [2, 3] }, { gaps: 2, gapLen: 0.9, thorns: 1, size: [2, 2] }] },
  { id: 3, world: 1, theme: 'pond', name: 'Duck Pond', eggs: 3, target: 3, spacing: 1.1, material: 'wood', minMoves: 3, fuseX: 0.95,
    nest: { w: 3.0, reach: 1.0 }, softCurtain: true, // the first curtain only cracks an egg and pushes it back
    orbs: [{ type: 'twin', ch: 1, a: -90 }, { type: 'fire_red', ch: 1 }] /* twin under the first drop, not in the egg chamber: there the pile took it by itself at 2 s and a twin got squashed */, portals: [{ from: [1, 90], to: [1, 90], emit: ['fire_red'], every: 6, pull: 0 }],
    intro: { title: 'Twin orb', line: 'The twin orb splits an egg in two: more eggs home! Then burn the thorn curtain with the red flame.' },
    tip: 'Burn the curtain: roll an egg into the red flame, then onto the thorns.',
    rings: [{ gaps: 1, gapLen: 0.95 }, { gaps: 1, curtain: 1, gapLen: 0.95 }, { gaps: 2, gapX: [2], thorns: 1, size: [1, 2] }] },
  { id: 4, world: 1, theme: 'windmill', name: 'Windmill', eggs: 3, target: 2, spacing: 1.05, material: 'wood', minMoves: 3, fuseX: 1.0, useTap: true,
    nest: { w: 3.0, reach: 0.8 }, bonus: { kind: 'time' },
    orbs: [{ type: 'hatch_glow', ch: 1 }], portals: [{ from: [1, -150], to: [3, -30] }],
    intro: { title: 'Glow chick', chick: 'glow', line: 'The yellow orb hatches a glow chick. Tap it once: a flash burns every thorn near it.' },
    tip: 'Tap your glow chick next to thorns. The swirl drops an egg two rings lower.',
    rings: [{ gaps: 1, gapLen: 0.9 }, { gaps: 1, thorns: 1, size: [2, 3] }, { gaps: 1, thorns: 2, size: [2, 3] }, { gaps: 2, gapX: [3], thorns: 1, size: [1, 2] }] },
  { id: 5, world: 1, theme: 'redbarn', name: 'Big Red Barn', boss: 'weasel', eggs: 3, target: 2, spacing: 1.05, material: 'wood', minMoves: 4, fuseX: 1.1,
    nest: { w: 3.0, reach: 0.8 }, bonus: { kind: 'prize' },
    orbs: [{ type: 'hatch_glow', ch: 1 }, { type: 'fire_red', ch: 2 }, { type: 'fire_green', ch: 3 }],
    bossFight: { kind: 'weasel', delay: 3, den: { a: 30, hp: 3 }, throws: ['thorn'], phases: [
      { attacks: ['pop'], every: 7 }, // measured: with no attacks here the pop only came after 40 s, so most runs never saw it
      { at: { saved: 1, t: 40 }, attacks: ['throw', 'pop'], every: 8 },
      { at: { saved: 2, t: 75 }, attacks: ['throw', 'pop'], every: 7 },
    ] },
    intro: { title: 'Boss: Weasel Raid', line: 'When the weasel crouches under a gap, turn that ring away: BONK! Then drop an egg on him.' },
    tip: 'Papa Rooster chases thieves off. The green flame mends cracks.',
    rings: [{ gaps: 1, gapLen: 0.9 }, { gaps: 1, gapX: [2], thorns: 1, size: [1, 2] }, { gaps: 2, thorns: 1, size: [1, 2] }, { gaps: 2, gapX: [3], thorns: 2, size: [1, 2] }] },

  // 0.8.17 (sixty levels): world 1's finale after the boss, at night. Not a boss at first; 0.8.17 bandit: the new boss of
  //   world 1, Bandit the raccoon (sim/bandit.js). 0.8.18: he climbs onto the outer ring, sits on it and slowly cranks it
  //   so eggs roll up to his paws; turn his ring briskly against him to shake him (three hurts bag him and his sack
  //   spills every egg back; after each hurt he hops a ring inward and cranks the other way). After the second hurt he
  //   whistles the weasel out for a short hunt. Gentle: the sixth level of the game. A still basket.
  { id: 6, world: 1, theme: 'farm', name: 'Midnight Raid', boss: 'raccoon', eggs: 5, target: 3, spacing: 1.05, material: 'wood', minMoves: 4, fuseX: 1.5,
    nest: { w: 2.9 }, bonus: { kind: 'turns' }, weather: 'fireflies', // (visual only: a summer night)
    raccoon: { delay: 3 }, weasel: { a: 30, delay: 9999 }, bossFight: { kind: 'raccoon', delay: 3, phases: [{ attacks: [] }] }, // 0.8.17 bandit: the weasel only comes when he whistles
    orbs: [{ type: 'hatch_glow', ch: 1 }, { type: 'fire_red', ch: 2 }, { type: 'fire_green', ch: 3 }],
    intro: { title: 'Boss: Bandit the Raccoon', line: 'Turn his ring against him!' },
    tip: 'Bandit turns a ring: turn it back, hard!',
    rings: [{ gaps: 1, gapLen: 0.9 }, { gaps: 1, gapX: [2], thorns: 1, size: [1, 2] }, { gaps: 2, thorns: 1, size: [1, 2] }, { gaps: 2, thorns: 1, size: [1, 2] }] },

  // ---------------- 2 Wild Woods: snakes (two from L9), wooden barriers, the chick; rock skin, sun flame
  { id: 7, gid: 6, world: 2, theme: 'bramble', name: 'Bramble Path', eggs: 3, target: 2, spacing: 1.05, material: 'vine', minMoves: 8,
    nest: { w: 2.6 }, bonus: { kind: 'turns' }, snake: { delay: 6, speed: 0.4 },
    orbs: [{ type: 'rockskin', ch: 1 }, { type: 'fire_red', ch: 2 }],
    intro: { title: 'Wild Woods', line: 'A snake slides in and hunts your eggs. It crosses a ring only through a gap: turn the gaps away. Rock skin turns every egg to stone.' },
    tip: 'Grab the rock skin, then run every egg down while they are stone.',
    // 0.8.17 boss817 (mykee: the level after a boss must not be a rest): the Farm's thorn curtain (L3) shuts the middle
    // ring's one gap while the snake hunts, so the flame in channel 2 is the way on; a fifth ring, one sponge a ring.
    // minMoves on the post-boss levels (and L28, L34) asks the planner's clear for as many moves as the world before.
    rings: [{ mat: 'wood', gaps: 1, thorns: 1 }, { gaps: 1, gapX: [2], thorns: 2, size: [2, 3], pads: 1 }, { mat: 'wood', gaps: 1, curtain: 1, thorns: 1, size: [2, 3], blunt: 1, pads: 1 }, { gaps: 2, gapX: [3], thorns: 2, size: [1, 2], pads: 1 }, { mat: 'wood', gaps: 2, thorns: 2, size: [1, 2], pads: 1 }] },
  { id: 8, gid: 7, world: 2, theme: 'jungle', name: 'Jungle Nursery', eggs: 3, target: 2, spacing: 1.0, material: 'vine', minMoves: 5,
    nest: { w: 2.8 }, bonus: { kind: 'prize' }, snake: { delay: 12, speed: 0.35 },
    orbs: [{ type: 'fire_gold', ch: 1 }, { type: 'rockskin', ch: 2 }],
    intro: { title: 'Sun flame chick', line: 'The sun flame hatches a chick. It flutters, pecks grey spikes away, and snakes chase it first.' },
    tip: 'The chick is bait: while the snake chases it, move the others.',
    rings: [{ mat: 'wood', gaps: 1, thorns: 1 }, { gaps: 1, gapX: [2], thorns: 2, size: [2, 3], blunt: 1 }, { mat: 'wood', gaps: 2, thorns: 2, size: [2, 3], blunt: 2 }, { gaps: 2, gapX: [3], thorns: 2, size: [2, 3], gear: true }, { mat: 'wood', gaps: 2, thorns: 2, size: [1, 2] }] },
  { id: 9, gid: 8, world: 2, theme: 'mushroom', name: 'Woodcutter Glade', eggs: 3, target: 2, spacing: 1.0, material: 'wood', minMoves: 5,
    nest: { w: 2.8 }, bonus: { kind: 'time' }, frog: { ch: 2, a: -120, delay: 6, every: 7, sn: 1 }, // 0.8.18: one snatch on its first level (room to learn it); 2026-11-20: the frog instead of a fourth snake level in a row
    orbs: [{ type: 'fire_red', ch: 1 }, { type: 'rockskin', ch: 3 }],
    intro: { title: 'The frog', line: 'Its tongue snatches eggs! Turn a wall into it: bonk. Wooden walls block eggs: fire burns them.' },
    tip: 'Turn a wall into its tongue: bonk! A flaming egg scares the frog off.',
    rings: [{ gaps: 1, thorns: 1 }, { gaps: 2, gapX: [2], thorns: 1, size: [2, 3], barriers: 1 }, { gaps: 2, thorns: 1, size: [2, 3], barriers: 1 }, { gaps: 2, gapX: [3], thorns: 2, size: [2, 3], blunt: 1, gear: true }, { gaps: 2, thorns: 2, size: [1, 2] }] },
  // 0.8.17 coco: Coco the monkey (src/sim/coco.js) rides ring 1 over channel 2, snatches eggs with his tail and tosses banana peels; a hard flick throws him off
  { id: 10, world: 2, theme: 'jungle', name: 'Monkey Business', eggs: 3, target: 2, spacing: 1.0, material: 'wood', minMoves: 5,
    monkey: { ch: 2, a: -100, delay: 5 }, nest: { w: 2.8 }, bonus: { kind: 'turns' },
    orbs: [{ type: 'fire_red', ch: 1 }, { type: 'rockskin', ch: 3 }],
    intro: { title: 'Coco the Monkey', line: 'Coco grabs eggs with his tail and throws banana peels. Flick his ring hard: whoa, off he flies!' },
    tip: 'Flick the ring Coco hangs from: he lets the egg go.',
    rings: [{ gaps: 1, thorns: 1 }, { gaps: 2, gapX: [2], thorns: 1, size: [1, 2] }, { gaps: 2, thorns: 1, size: [1, 2], blunt: 1 }, { gaps: 2, gapX: [3], thorns: 2, size: [1, 2] }, { gaps: 2, thorns: 1, size: [1, 2] }] },
  { id: 11, gid: 9, world: 2, theme: 'bramble', name: 'Twin Fangs', eggs: 3, target: 2, spacing: 1.0, material: 'vine', minMoves: 5,
    nest: { w: 2.8 }, bonus: { kind: 'turns' }, snake: [{ delay: 9, speed: 0.35, a: 0 }, { delay: 18, speed: 0.35, a: 125 }],
    orbs: [{ type: 'rockskin', ch: 1 }, { type: 'fire_gold', ch: 2 }, { type: 'fire_green', ch: 4 }, { type: 'hatch_glow', ch: 1 }],
    tip: 'Two snakes. Tap the glow chick as one closes in: the flash stuns it for 3 s.',
    useTap: true, // its glow-chick intro moved to L4 (the first-five ladder)
    rings: [{ mat: 'wood', gaps: 1, thorns: 1 }, { gaps: 1, gapX: [2], thorns: 2, size: [2, 3], blunt: 1 }, { mat: 'wood', gaps: 2, thorns: 2, size: [2, 3], creep: { len: 1.2, v: 0.35, rest: 1.4, delay: 4, baby: 1 } }, { gaps: 2, gapX: [3], thorns: 2, size: [2, 3] }, { mat: 'wood', gaps: 2, thorns: 2, size: [2, 3] }] },
  { id: 12, gid: 10, world: 2, theme: 'jungle', name: 'Serpent Hollow', boss: 'snake', eggs: 3, target: 2, spacing: 1.0, material: 'vine', minMoves: 5,
    nest: { w: 3.0 }, bonus: { kind: 'prize' },
    snake: [{ delay: 7, speed: 0.28, size: 1.5, len: 1.6, a: 0 }, { delay: 15, speed: 0.45, size: 0.8, a: 140 }],
    orbs: [{ type: 'rockskin', ch: 1 }, { type: 'fire_gold', ch: 2 }, { type: 'rockskin', ch: 3 }],
    bossFight: { kind: 'snake', phases: [{}, { at: { saved: 1, t: 35 } }, { at: { saved: 2, t: 70 } }] },
    intro: { title: 'Boss: Serpent Hollow', line: 'A big slow snake and a small fast one hunt together. Lure them with a chick, then run in rock skin.' },
    tip: 'Walls hold the snakes back while the venom works. Count to three, then go.',
    rings: [{ mat: 'wood', gaps: 1, thorns: 1, gear: true }, { gaps: 1, gapX: [2], thorns: 2, size: [2, 3], blunt: 1, gear: true }, { mat: 'wood', gaps: 2, thorns: 1, size: [2, 3], barriers: 1 }, { gaps: 2, gapX: [3], thorns: 2, size: [2, 3] }, { mat: 'wood', gaps: 2, thorns: 2, size: [1, 2] }] },

  // ---------------- 3 Frozen Lake: one-way rings, ice, icicles, the current (moving nest); hourglass, duck egg
  { id: 13, gid: 11, world: 3, theme: 'frozen', name: 'Frozen Lake', eggs: 3, target: 2, spacing: 1.05, material: 'wood', minMoves: 10,
    nest: { w: 2.6 }, bonus: { kind: 'turns' }, snake: { delay: 8, speed: 0.35 }, // boss817: the Wild Woods snake follows you onto the ice
    orbs: [{ type: 'hourglass', ch: 1 }, { type: 'stone', ch: 2 }],
    intro: { title: 'Frozen Lake', line: 'Arrow rings turn only one way, and ice is slippery. The hourglass slows the world and stops the fuse.' },
    tip: 'Arrow rings only turn one way: sometimes the long way round is the safe one.',
    rings: [{ gaps: 1 }, { mat: 'ice', gaps: 1, gapX: [2], thorns: 2, size: [2, 3], oneway: 1, pads: 1 }, { gaps: 2, thorns: 2, size: [2, 3], pads: 1, creep: { len: 0.9, v: 0.3, rest: 1.8, form: 'frost' } }, { mat: 'ice', gaps: 2, gapX: [3], thorns: 2, size: [2, 3], oneway: -1, pads: 1 }, { gaps: 2, thorns: 2, size: [1, 2], pads: 1 }] },
  { id: 14, gid: 12, world: 3, theme: 'blizzard', name: 'Icicle Hollow', eggs: 3, target: 2, spacing: 1.0, material: 'stone', minMoves: 5,
    nest: { w: 2.8 }, bonus: { kind: 'time' }, icicles: { every: 5, delay: 4, big: 3 }, snake: { delay: 10, speed: 0.35 }, // M4: a chaser in every world
    orbs: [{ type: 'stone', ch: 1 }, { type: 'fire_green', ch: 3 }, { type: 'frost', ch: 2 }],
    intro: { title: 'Falling ice', line: 'An icicle grows over an egg and shakes before it drops: turn the ring above to swing it away. Big chunks freeze a ring.' },
    tip: 'Ice leaves a slippery patch. The frost orb freezes the ring under your egg.',
    rings: [{ gaps: 1, thorns: 1 }, { mat: 'ice', gaps: 1, gapX: [2], thorns: 2, size: [2, 3], oneway: -1, gear: true }, { gaps: 2, thorns: 2, size: [2, 3], blunt: 1 }, { mat: 'ice', gaps: 2, gapX: [3], thorns: 2, size: [2, 3] }, { gaps: 2, thorns: 2, size: [1, 2], oneway: 1 }] },
  { id: 15, gid: 13, world: 3, theme: 'frozen', name: 'Duck Creek', eggs: 3, target: 2, spacing: 1.0, material: 'wood', minMoves: 5, eggKinds: ['duck'],
    weather: 'current', weatherOpts: { strength: 0.8 }, snake: { delay: 14, speed: 0.33 },
    octopus: { ch: 3, a: -60, delay: 10, den: true },
    nest: { w: 2.8 }, bonus: { kind: 'prize' },
    orbs: [{ type: 'water', ch: 2 }, { type: 'thunder', ch: 3 }, { type: 'hatch_glow', ch: 3 }],
    tip: 'The duck egg floats and rides the current. Let it drift to the gap.',
    rings: [{ gaps: 1, thorns: 1 }, { mat: 'ice', gaps: 1, gapX: [2], thorns: 2, size: [2, 3] }, { gaps: 2, thorns: 2, size: [2, 3], oneway: 1 }, { mat: 'ice', gaps: 2, gapX: [3], thorns: 2, size: [2, 3], blunt: 1 }, { gaps: 2, thorns: 2, size: [1, 2] }] },
  // 0.8.17 pip: Pip the penguin (src/sim/pip.js) slides the ice channels and shoves or carries eggs; a wall or a sponge stops him
  { id: 16, world: 3, theme: 'blizzard', name: "Pip's Rink", eggs: 3, target: 2, spacing: 1.0, material: 'stone', minMoves: 5,
    penguin: { ch: 2, a: -125, delay: 5 }, nest: { w: 2.8 }, bonus: { kind: 'time' },
    orbs: [{ type: 'frost', ch: 2 }, { type: 'stone', ch: 3 }],
    intro: { title: 'Pip the Penguin', line: 'Pip belly-slides on the ice and shoves eggs along. Turn a wall or a sponge into his path: bonk!' },
    tip: 'Line a gap up in front of Pip: he shoves the egg through it for you.',
    rings: [{ gaps: 1, thorns: 1 }, { mat: 'ice', gaps: 1, gapX: [2], thorns: 1, size: [2, 3] }, { mat: 'ice', gaps: 2, thorns: 1, size: [2, 3], pads: 1 }, { gaps: 2, gapX: [3], thorns: 2, size: [2, 3], barriers: 1 }, { gaps: 2, thorns: 2, size: [1, 2] }] },
  { id: 17, gid: 14, world: 3, theme: 'frozen', name: 'Drifting Nest', eggs: 3, target: 2, spacing: 1.0, material: 'wood', minMoves: 5,
    weather: 'current', weatherOpts: { strength: 0.7 }, icicles: { every: 6, delay: 6, big: 3 },
    nest: { w: 2.7, amp: 1.3, period: 8, pattern: 'slide' }, bonus: { kind: 'turns' },
    orbs: [{ type: 'hourglass', ch: 2 }, { type: 'thunder', ch: 4 }, { type: 'frost', ch: 3 }, { type: 'hatch_pick', ch: 1 }],
    tip: 'The ice ring has one gap. Drill a closer one with the purple chick, then drop fast: it freezes over in 6 s.',
    portals: [{ from: [1, 90], to: [1, 90], emit: ['hatch_pick'], every: 9, pull: 0 }],
    intro: { title: 'Drill Chick', chick: 'pick', line: 'Hard ice is too tough for eggs. The purple orb hatches the Drill Chick: tap it on the ice and it drills a hole that freezes over 6 s later.' }, useTap: true,
    rings: [{ gaps: 1, thorns: 1 }, { mat: 'ice', gaps: 1, ice: true }, { gaps: 2, thorns: 2, size: [2, 3] }, { mat: 'ice', gaps: 2, gapX: [3], thorns: 2, size: [2, 3], blunt: 1 }, { gaps: 2, thorns: 2, size: [2, 3] }, { gaps: 2, thorns: 2, size: [1, 2] }] },
  { id: 18, gid: 15, world: 3, theme: 'blizzard', name: 'The Blizzard', boss: 'blizzard', eggs: 3, target: 2, spacing: 1.0, material: 'stone', minMoves: 5,
    bossFight: { kind: 'blizzard', delay: 4, gale: 5, gecko: { delay: 3, dir: 1 }, phases: [
      { attacks: ['gale'], every: 5 },
      { at: { saved: 1, t: 30 }, attacks: ['gale', 'freeze'], every: 4.5 },
      { at: { saved: 2, t: 60 }, attacks: ['icicles', 'gale', 'freeze', 'icicles'], every: 3.8 },
    ] },
    nest: { w: 2.9 }, bonus: { kind: 'time' },
    orbs: [{ type: 'hourglass', ch: 1 }, { type: 'stone', ch: 3 }, { type: 'fire_green', ch: 4 }, { type: 'frost', ch: 2 }],
    intro: { title: 'Boss: Baron von Brr', line: 'A frost gecko crawls in after your eggs. His lick cracks an egg and freezes it solid.' },
    tip: 'His icy feet make eggs slide. A licked egg is stuck, but uncrackable.',
    rings: [{ gaps: 1, thorns: 1 }, { mat: 'ice', gaps: 1, gapX: [2], thorns: 2, size: [2, 3], oneway: 1 }, { gaps: 2, thorns: 2, size: [2, 3], blunt: 1 }, { mat: 'ice', gaps: 2, thorns: 2, size: [2, 3], oneway: -1 }, { gaps: 2, gapX: [3], thorns: 2, size: [2, 3] }, { gaps: 2, thorns: 2, size: [1, 2], oneway: 1 }] },

  // ---------------- 4 Crystal Caves: portals that suck and spit orbs, grates, quail and ostrich eggs, glass
  { id: 19, gid: 16, world: 4, theme: 'crystal', name: 'Crystal Caves', eggs: 3, target: 2, spacing: 1.0, material: 'stone', minMoves: 4, eggKinds: ['quail'],
    nest: { w: 2.8 }, bonus: { kind: 'orbs' }, icicles: { every: 7, delay: 8, big: 4 },
    orbs: [{ type: 'fire_red', ch: 2 }, { type: 'twin', ch: 3 }],
    portals: [{ from: [2, 90], to: [2, 90], emit: ['fire_red'], every: 7, pull: 0 }, { from: [3, -150], to: [4, -40], emit: ['fire_green', 'bubble'], every: 9 }],
    intro: { title: 'Crystal Caves', line: 'Grates let only the little quail egg through. Portals suck in eggs from every side.' },
    tip: 'Only the quail fits a grate. Send it for the flame: the curtain must burn for the others.',
    rings: [{ gaps: 1 }, { gaps: 1, gapX: [2], thorns: 2, size: [2, 3], grate: 1 }, { gaps: 1, curtain: 1, thorns: 1, size: [2, 3], grate: 1 }, { gaps: 2, gapX: [3], thorns: 2, size: [2, 3] }, { gaps: 2, thorns: 2, size: [1, 2] }] },
  { id: 20, gid: 17, world: 4, theme: 'crystal', name: 'Portal Hall', eggs: 3, target: 2, spacing: 1.0, material: 'stone', minMoves: 5, eggKinds: ['duck'],
    weather: 'current', weatherOpts: { strength: 0.6 },
    nest: { w: 2.8 }, bonus: { kind: 'turns' },
    orbs: [{ type: 'magnet', ch: 1 }],
    portals: [{ from: [1, -30], to: [3, -150], emit: ['bubble', 'thorn'], every: 9 }, { from: [2, -160], to: [4, 30], emit: ['fire_red', 'magnet'], every: 10 }, { from: [3, 20], to: [4, -120], emit: ['twin'], every: 12 }],
    tip: 'Three portals, three routes. Pick the one that skips the thorns.',
    rings: [{ gaps: 1, thorns: 1 }, { gaps: 1, gapX: [2], thorns: 2, size: [2, 3] }, { mat: 'glass', gaps: 2, thorns: 2, size: [2, 3], blunt: 1, gear: true }, { gaps: 2, gapX: [3], thorns: 2, size: [2, 3], gear: true }, { gaps: 2, thorns: 2, size: [2, 3] }] },
  { id: 21, gid: 18, world: 4, theme: 'crystal', name: 'Ostrich Run', eggs: 3, target: 2, spacing: 1.05, material: 'stone', minMoves: 5, eggKinds: ['ostrich'],
    nest: { w: 3.0 }, bonus: { kind: 'prize' }, snake: { delay: 10, speed: 0.36 },
    orbs: [{ type: 'fire_black', ch: 2 }, { type: 'bubble', ch: 4 }, { type: 'hatch_bulk', ch: 1 }],
    portals: [{ from: [2, 160], to: [4, -20], emit: ['fire_green'], every: 10 }],
    tip: 'The ostrich is too big for narrow gaps, but a two-ring fall lets it flatten thorns.',
    intro: { title: 'Bulk chick', chick: 'bulk', line: 'The green orb hatches a bulk chick. Tap it once: big and heavy for 5 s, it squashes thorns and smashes cracked glass. Too big for gaps!' }, useTap: true,
    rings: [{ gaps: 1, thorns: 1 }, { gaps: 2, gapX: [3], thorns: 2, size: [2, 3] }, { gaps: 2, thorns: 2, size: [2, 3] }, { mat: 'glass', gaps: 2, gapX: [3, 2], thorns: 2, size: [2, 3] }, { gaps: 2, thorns: 2, size: [2, 3], blunt: 1 }, { gaps: 2, thorns: 2, size: [1, 2] }] },
  // 0.8.17: a thief in the dark: the weasel among the portals
  { id: 22, world: 4, theme: 'crystal', name: 'Thief in the Dark', eggs: 3, target: 2, spacing: 1.0, material: 'stone', minMoves: 5, eggKinds: ['quail'],
    nest: { w: 2.9 }, bonus: { kind: 'prize' }, weasel: { a: -40, delay: 8 },
    orbs: [{ type: 'fire_red', ch: 2 }, { type: 'hatch_glow', ch: 1 }],
    portals: [{ from: [2, 150], to: [4, -30], emit: ['fire_green'], every: 10 }, { from: [1, -120], to: [3, 60] }],
    intro: { title: 'A thief in the dark', line: 'The weasel followed you into the caves. Send your eggs through the portals, out of his reach.' },
    tip: 'Trap the weasel behind a turned ring, then drop an egg on him: he gives one back.',
    rings: [{ gaps: 1, thorns: 1 }, { gaps: 1, gapX: [2], thorns: 2, size: [2, 3], grate: 1 }, { mat: 'glass', gaps: 2, thorns: 2, size: [2, 3], creep: { len: 1.2, v: 0.7, rest: 1.4, form: 'shard' } }, { gaps: 2, gapX: [3], thorns: 2, size: [2, 3], blunt: 1 }, { gaps: 2, thorns: 2, size: [1, 2] }] },
  { id: 23, gid: 19, world: 4, theme: 'crystal', name: 'Glass Floor', eggs: 3, target: 2, spacing: 1.0, material: 'glass', minMoves: 5, eggKinds: [null, 'quail'],
    nest: { w: 3.0 }, bonus: { kind: 'time' }, rats: { a: 100, n: 2, delay: 9 },
    orbs: [{ type: 'bubble', ch: 1 }, { type: 'magnet', ch: 3 }, { type: 'hatch_swoop', ch: 3 }],
    portals: [{ from: [2, -30], to: [5, -150], emit: ['fire_green', 'water', 'curse'], every: 9 }, { from: [4, 150], to: [5, -40], emit: ['bubble'], every: 11 }],
    tip: 'Rats roll eggs to their hole: turn a gap under a rolling egg. Water and light send them running.',
    intro: { title: 'Swoop chick', chick: 'swoop', line: 'The blue orb hatches a swoop chick. Tap it once: it flies up through the ring above and tears down a thorn curtain on the way.' },
    rings: [{ mat: 'stone', gaps: 1, thorns: 1 }, { gaps: 1, gapX: [2], thorns: 2, size: [2, 3] }, { mat: 'stone', gaps: 2, thorns: 2, size: [2, 3], grate: 1 }, { gaps: 2, gapX: [3], thorns: 2, size: [2, 3], curtain: 1 }, { mat: 'stone', gaps: 2, thorns: 2, size: [2, 3], blunt: 1 }, { gaps: 2, thorns: 2, size: [1, 2] }] },
  { id: 24, gid: 20, world: 4, theme: 'crystal', name: 'Quartz Maze', boss: 'golem', eggs: 3, target: 2, spacing: 1.0, material: 'stone', minMoves: 5, eggKinds: [null, null, 'ostrich'],
    nest: { w: 3.0, drop: 1.1 }, bonus: { kind: 'prize' },
    bossFight: { kind: 'golem', delay: 4, thorn: { delay: 3, dir: 1 }, spike: { delay: 18, dir: -1 }, phases: [
      { attacks: ['stomp', 'shards'], every: 6 },
      { at: { saved: 1, t: 30 }, attacks: ['cage', 'stomp', 'shards'], every: 5 },
      { at: { saved: 2, t: 60 }, attacks: ['stomp', 'cage', 'punch', 'shards'], every: 4.5 },
    ] },
    orbs: [{ type: 'feather', ch: 1 }, { type: 'stone', ch: 2 }, { type: 'hatch_bulk', ch: 2 }],
    portals: [{ from: [1, -20], to: [3, 160], emit: ['feather', 'thorn'], every: 10 }, { from: [2, -150], to: [4, -40], emit: ['fire_green'], every: 9 }, { from: [3, 30], to: [4, -140], emit: ['rockskin'], every: 12 }],
    intro: { title: 'Boss: Duke Quartz', line: 'A crystal thorn-back crawls in. He stomps, drops crystal spikes and rams eggs: every ram cracks the shell.' },
    tip: 'A Stone egg flips the Duke. Turn a ring to shear a cage off; keep a wall over eggs in shard rain.',
    rings: [{ gaps: 1, thorns: 1 }, { gaps: 1, gapX: [2], thorns: 2, size: [2, 3] }, { mat: 'glass', gaps: 2, thorns: 2, size: [2, 3] }, { gaps: 2, gapX: [3], thorns: 2, size: [2, 3], blunt: 1 }, { mat: 'glass', gaps: 2, thorns: 2, size: [1, 2] }, { gaps: 2, thorns: 2, size: [1, 2] }] },

  // ---------------- 5 Volcano: lava rocks melt holes and blast eggs; water shell, black flame, honey, spikes
  { id: 25, gid: 21, world: 5, theme: 'volcano', name: 'Volcano', eggs: 3, target: 2, spacing: 1.0, material: 'obsidian', minMoves: 4,
    nest: { w: 2.8 }, bonus: { kind: 'orbs' }, salamander: { delay: 3, every: 6, a: 160, ch: 2 },
    orbs: [{ type: 'water', ch: 1 }, { type: 'fire_red', ch: 3 }],
    intro: { title: 'The lava salamander', line: 'It eats an egg at its snout: watch for the red ring. Turn the ring it stands on to carry it away. Its fire heats walls.' },
    tip: 'The salamander rides the ring under it. Turn that ring to carry it away from your eggs; water cools it down.',
    rings: [{ gaps: 1, thorns: 1 }, { gaps: 1, gapX: [2], thorns: 2, size: [2, 3] }, { gaps: 2, thorns: 2, size: [2, 3], blunt: 1 }, { gaps: 2, gapX: [3], thorns: 2, size: [2, 3] }, { gaps: 2, thorns: 2, size: [1, 2] }] },
  { id: 26, gid: 22, world: 5, theme: 'volcano', name: 'Melt-Through', eggs: 3, target: 2, spacing: 1.0, material: 'obsidian', minMoves: 4,
    nest: { w: 2.8 }, bonus: { kind: 'time' }, lava: { every: 6, delay: 4 }, salamander: { delay: 6, every: 7, a: 30, ch: 3 },
    orbs: [{ type: 'fire_black', ch: 2 }, { type: 'water', ch: 3 }, { type: 'hourglass', ch: 4 }, { type: 'warp', ch: 1 }],
    intro: { title: 'Lava rocks', line: 'Lava rocks fall on the rings, glow, then melt a hole. The hole heals after 5 s. A water egg cools them.' },
    tip: 'This ring has no gap. Wait for a lava hole, or burn one with the black flame.',
    rings: [{ gaps: 1, thorns: 1 }, { gaps: 1, gapX: [2], thorns: 2, size: [2, 3] }, { noGap: true, thorns: 1, size: [1, 2], creep: { len: 0.9, v: 0.22, rest: 1.6, form: 'lava', w: 0.6, at: 'bottom' } }, { gaps: 2, gapX: [3], thorns: 2, size: [2, 3] }, { gaps: 2, thorns: 2, size: [1, 2] }] },
  { id: 27, gid: 23, world: 5, theme: 'volcano', name: 'Honey Vents', eggs: 3, target: 2, spacing: 1.0, material: 'obsidian', minMoves: 5,
    nest: { w: 3.0 }, bonus: { kind: 'turns' }, lava: { every: 6, delay: 4 }, salamander: { delay: 5, every: 7, a: -40, ch: 3 },
    snake: { delay: 9, a: 40, speed: 0.35 },
    orbs: [{ type: 'water', ch: 2 }, { type: 'stone', ch: 4 }, { type: 'hatch_dash', ch: 1 }],
    tip: 'Honey holds an egg while the rocks fall. Lure the snake to the salamander: they face off and leave your eggs alone.',
    intro: { title: 'Dash chick', chick: 'dash', line: 'The orange orb hatches a dash chick. Tap it once: it shoots along its channel, bonks snakes and the salamander dizzy, and grabs orbs.' }, useTap: true,
    rings: [{ gaps: 1, thorns: 1 }, { gaps: 1, gapX: [2], thorns: 2, size: [2, 3], honey: 1 }, { gaps: 2, thorns: 2, size: [2, 3] }, { gaps: 2, gapX: [3], thorns: 2, size: [2, 3], honey: 1 }, { gaps: 2, thorns: 2, size: [2, 3], blunt: 1 }, { gaps: 2, thorns: 2, size: [1, 2] }] },
  // 0.8.17: the face-off: fire and frost salamanders in two channels; the player steers them head to head
  { id: 28, world: 5, theme: 'volcano', name: 'The Face-off', eggs: 3, target: 2, spacing: 1.0, material: 'obsidian', minMoves: 10,
    nest: { w: 3.0 }, bonus: { kind: 'turns' }, lava: { every: 7, delay: 6 }, // boss817: L26's lava rocks keep falling (it sat below both neighbours)
    salamander: [{ delay: 3, every: 6.5, a: 140, ch: 2 }, { delay: 6, every: 7, a: -20, ch: 3, kind: 'frost' }],
    orbs: [{ type: 'water', ch: 1 }, { type: 'fire_red', ch: 3 }, { type: 'hourglass', ch: 4 }],
    intro: { title: 'Fire meets frost', line: 'A frost salamander walks in. Its bite freezes an egg. When it meets the fire one they fight, and both are knocked out.' },
    tip: 'Turn their rings to bring them head to head: the steam knocks both out. Then run your eggs past.',
    rings: [{ gaps: 1, thorns: 1 }, { gaps: 1, gapX: [2], thorns: 2, size: [2, 3], honey: 1 }, { gaps: 2, thorns: 2, size: [2, 3] }, { gaps: 2, gapX: [3], thorns: 2, size: [2, 3] }, { gaps: 2, thorns: 2, size: [2, 3], blunt: 1, creep: { a0: -100, a1: -72, v: 0.22, rest: 1.6, form: 'lava', w: 0.6 } }, { gaps: 2, thorns: 2, size: [1, 2] }] },
  { id: 29, gid: 24, world: 5, theme: 'volcano', name: 'Spike Forge', eggs: 3, target: 2, spacing: 1.0, material: 'obsidian', minMoves: 5,
    nest: { w: 3.0 }, bonus: { kind: 'time' }, lava: { every: 6, delay: 5 }, salamander: [{ delay: 4, every: 6.5, a: 120, ch: 2 }, { delay: 9, every: 7, a: -30, ch: 2, dir: -1, kind: 'frost' }], // 0.8.14: fire meets frost in one channel (0.8.17: its card moved to The Face-off, where they first meet)
    orbs: [{ type: 'hourglass', ch: 1 }, { type: 'water', ch: 3 }, { type: 'fire_green', ch: 5 }, { type: 'hatch_swoop', ch: 2 }],
    tip: 'Forge spikes pump in and out. Count the beat and pass while they are down.',
    rings: [{ gaps: 1, thorns: 1, gear: true }, { gaps: 1, gapX: [2], thorns: 3, size: [2, 3], retract: { period: 3, on: 0.5 } }, { gaps: 2, thorns: 2, size: [2, 3], curtain: 1, honey: 1 }, { gaps: 2, gapX: [3], thorns: 3, size: [2, 3], retract: { period: 2.6, on: 0.55 } }, { gaps: 2, thorns: 2, size: [2, 3], blunt: 1 }, { gaps: 2, thorns: 2, size: [1, 2] }] },
  { id: 30, gid: 25, world: 5, theme: 'volcano', name: 'The Eruption', boss: 'salamander', eggs: 3, target: 2, spacing: 1.0, material: 'obsidian', minMoves: 5,
    nest: { w: 3.0 }, bonus: { kind: 'prize' },
    bossFight: { kind: 'salamander', delay: 3, phases: [
      { attacks: ['rock'], every: 4.5 },
      { at: { saved: 1, t: 30 }, attacks: ['rock2', 'magma', 'rock'], every: 5.5 },
      { at: { saved: 2, t: 60 }, attacks: ['rock2', 'magma', 'rock', 'whip'], every: 4.5, heat: true },
    ] },
    salamander: { delay: 3, ch: 3, a: 90 }, // the boss itself: 1.3x, breathes fire between its lava throws
    orbs: [{ type: 'water', ch: 1 }, { type: 'feather', ch: 3 }, { type: 'water', ch: 4 }],
    intro: { title: 'Boss: The Lava Salamander', line: 'It walks the rings, spits lava rocks at your eggs and breathes fire on the walls. At the end the heat cracks any egg that waits.' },
    tip: 'Rocks melt holes everywhere. Use them, and take the feather for the last run.',
    rings: [{ gaps: 1, thorns: 1 }, { gaps: 1, gapX: [2], thorns: 2, size: [2, 3], honey: 1 }, { gaps: 2, thorns: 2, size: [2, 3] }, { noGap: true, thorns: 2, size: [1, 2] }, { gaps: 2, gapX: [3], thorns: 2, size: [2, 3], blunt: 1 }, { gaps: 2, thorns: 2, size: [1, 2] }] },

  // ---------------- 6 Storm Peaks: lightning, the eagle (it also takes snakes), gears; guardian feather, thunder
  { id: 31, gid: 26, world: 6, theme: 'storm', name: 'Storm Peaks', eggs: 3, target: 2, spacing: 1.0, material: 'metal', minMoves: 12, weather: 'thunder',
    nest: { w: 2.8 }, bonus: { kind: 'turns' },
    gusts: { delay: 7, every: 11, strength: 3, dur: 2 }, // v3.1: storm gusts shove eggs (and snakes) along the channels
    chameleon: { delay: 2, dir: 1 }, // Sly, the orb thief (sim/chameleon.js): crawls in through an outer gap and eats orbs
    orbs: [{ type: 'thunder', ch: 2 }, { type: 'bubble', ch: 3 }, { type: 'magnet', ch: 1 }, { type: 'fire_black', ch: 4 }],
    intro: { title: 'Storm Peaks', line: 'Lightning strikes and locks a ring. And Sly the chameleon creeps in to steal power orbs with his tongue: grab them first.' },
    tip: 'Let Sly eat the black flame: he gets sick and coughs up the last orb he stole.',
    // boss817 (the level after a boss is a step on): the Volcano's forge spikes pump on the third ring, and a sixth ring
    rings: [{ gaps: 1, thorns: 1 }, { mat: 'cloud', gaps: 1, gapX: [2], thorns: 2, size: [2, 3] }, { gaps: 2, thorns: 3, size: [2, 3], retract: { period: 3, on: 0.5 } }, { mat: 'cloud', gaps: 2, gapX: [3], thorns: 2, size: [2, 3], blunt: 1 }, { gaps: 2, thorns: 2, size: [2, 3] }, { gaps: 2, thorns: 2, size: [1, 2] }] },
  { id: 32, gid: 27, world: 6, theme: 'storm', name: 'Eagle Crag', eggs: 3, target: 2, spacing: 1.0, material: 'metal', minMoves: 5, weather: 'thunder',
    nest: { w: 3.0 }, bonus: { kind: 'prize' }, eagle: { delay: 8, every: 11 },
    gusts: { delay: 10, every: 14, strength: 1.8, dur: 1.6 }, // v3.1: storm gusts shove eggs (and snakes) along the channels
    orbs: [{ type: 'feather', ch: 3 }, { type: 'fire_green', ch: 4 }, { type: 'hatch_pick', ch: 1 }, { type: 'warp', ch: 3 }],
    intro: { title: 'The eagle', line: 'The eagle reaches in only through gaps in the outer ring. When it screeches, turn that gap away.' },
    tip: 'Wait deeper in the vault, then cross the outer channel right after a dive.',
    rings: [{ gaps: 1, thorns: 1 }, { mat: 'ice', gaps: 1, ice: true }, { gaps: 2, thorns: 2, size: [2, 3] }, { mat: 'cloud', gaps: 2, gapX: [3], thorns: 2, size: [2, 3], blunt: 1 }, { gaps: 2, thorns: 2, size: [2, 3] }, { gaps: 2, thorns: 2, size: [1, 2] }] },
  { id: 33, gid: 28, world: 6, theme: 'storm', name: 'Snake Snatcher', eggs: 3, target: 2, spacing: 1.0, material: 'metal', minMoves: 5,
    nest: { w: 3.0 }, bonus: { kind: 'time' }, eagle: { delay: 10, every: 10 }, snake: { delay: 6, speed: 0.4 },
    gusts: { delay: 9, every: 10, strength: 3, dur: 2 }, // v3.1: storm gusts shove eggs (and snakes) along the channels
    orbs: [{ type: 'fire_gold', ch: 1 }, { type: 'rockskin', ch: 3 }, { type: 'hatch_glow', ch: 1 }, { type: 'hatch_dash', ch: 3 }],
    tip: 'The eagle loves snakes. Keep the snake in the outer channel and let it feed.',
    rings: [{ gaps: 1, thorns: 1 }, { gaps: 1, gapX: [2], thorns: 2, size: [2, 3], blunt: 1 }, { mat: 'cloud', gaps: 2, thorns: 1, size: [2, 3], barriers: 1 }, { gaps: 2, gapX: [3], thorns: 2, size: [2, 3] }, { gaps: 2, thorns: 2, size: [2, 3] }, { gaps: 2, thorns: 2, size: [1, 2] }] },
  // 0.8.17: Sly and the gusts, no eagle
  { id: 34, world: 6, theme: 'storm', name: 'Sly in the Gale', eggs: 3, target: 2, spacing: 1.0, material: 'metal', minMoves: 10,
    nest: { w: 3.0 }, bonus: { kind: 'turns' }, gusts: { delay: 6, every: 9, strength: 3, dur: 2 }, chameleon: { delay: 3, dir: -1 },
    weather: 'thunder', // boss817: the storm's lightning (L31) locks rings here too (it sat below both neighbours)
    orbs: [{ type: 'feather', ch: 1 }, { type: 'fire_black', ch: 2 }, { type: 'thunder', ch: 3 }, { type: 'hatch_glow', ch: 4 }],
    tip: 'Gusts shove your eggs along the channels. Grab the feather before Sly does.',
    rings: [{ gaps: 1, thorns: 1 }, { mat: 'cloud', gaps: 1, gapX: [2], thorns: 2, size: [2, 3], gear: true, creep: { a0: -150, a1: -118, v: 0.9, rest: 1.6, form: 'spark' } }, { gaps: 2, thorns: 2, size: [2, 3] }, { mat: 'cloud', gaps: 2, gapX: [3], thorns: 2, size: [2, 3], blunt: 1 }, { gaps: 2, thorns: 2, size: [2, 3] }, { gaps: 2, thorns: 2, size: [1, 2] }] },
  { id: 35, gid: 29, world: 6, theme: 'storm', name: 'Thunder Gears', eggs: 3, target: 2, spacing: 1.0, material: 'metal', minMoves: 5, weather: 'thunder',
    nest: { w: 3.0 }, bonus: { kind: 'turns' }, eagle: { delay: 12, every: 11 },
    gusts: { delay: 9, every: 10, strength: 3, dur: 2 }, // v3.1: storm gusts shove eggs (and snakes) along the channels
    orbs: [{ type: 'fire_black', ch: 2 }, { type: 'feather', ch: 4 }, { type: 'hatch_bulk', ch: 2 }],
    tip: 'Gear teeth link two rings: turn one and its neighbour turns the other way.',
    rings: [{ gaps: 1, thorns: 1 }, { gaps: 1, gapX: [2], thorns: 2, size: [2, 3], gear: true }, { gaps: 2, thorns: 2, size: [2, 3], retract: { period: 3, on: 0.55 } }, { gaps: 2, gapX: [3], thorns: 2, size: [2, 3], gear: true }, { gaps: 2, thorns: 2, size: [2, 3], blunt: 1 }, { gaps: 2, thorns: 2, size: [1, 2] }] },
  { id: 36, gid: 30, world: 6, theme: 'storm', name: 'Eagle and Serpent', boss: 'eagle', eggs: 3, target: 2, spacing: 1.0, material: 'metal', minMoves: 5, weather: 'thunder',
    nest: { w: 3.0 }, bonus: { kind: 'prize' }, eagle: { delay: 12, every: 10 },
    snake: [{ delay: 6, speed: 0.38, a: 0 }, { delay: 999, speed: 0.42, a: 140 }],
    bossFight: { kind: 'eagle', delay: 6, phases: [
      { attacks: ['dive'], every: 8 },
      { at: { saved: 1, t: 35 }, attacks: ['bolt', 'wgust', 'dive'], every: 6 },
      { at: { saved: 2, t: 65 }, attacks: ['bolt', 'dive', 'bolt2', 'wgust'], every: 4.5, summon: true },
    ] },
    orbs: [{ type: 'feather', ch: 1 }, { type: 'thunder', ch: 2 }, { type: 'feather', ch: 4 }, { type: 'hatch_dash', ch: 2 }],
    intro: { title: 'Boss: The Storm Eagle', line: 'The eagle dives while a snake hunts inside; then the storm aims lightning at the ring under your egg and a second snake comes.' },
    tip: 'When the ring under an egg crackles, turn it away. A locked ring also stops a snake.',
    rings: [{ gaps: 1, thorns: 1 }, { gaps: 1, gapX: [2], thorns: 2, size: [2, 3] }, { mat: 'cloud', gaps: 2, thorns: 2, size: [2, 3] }, { gaps: 2, thorns: 2, size: [2, 3], blunt: 1 }, { gaps: 2, gapX: [3], thorns: 2, size: [2, 3] }, { gaps: 2, thorns: 2, size: [1, 2] }] },

  // ---------------- 7 The Thieves' Vault: a weasel and rats raid, the hen moves her nest; every trait remixed
  { id: 37, gid: 31, world: 7, theme: 'vault', name: "The Thieves' Gate", eggs: 3, target: 2, spacing: 1.0, material: 'metal', minMoves: 4, eggKinds: ['duck'],
    weather: 'current', weatherOpts: { strength: 0.6 },
    nest: { w: 2.7, amp: 1.0, period: 9, pattern: 'stopgo' }, bonus: { kind: 'turns' }, weasel: { a: 30, delay: 7 }, rats: { a: -40, n: 2, ch: 3, delay: 12 },
    orbs: [{ type: 'twin', ch: 1 }, { type: 'hourglass', ch: 3 }, { type: 'hatch_pick', ch: 2 }, { type: 'frost', ch: 4 }],
    intro: { title: "The Thieves' Vault", line: 'A weasel and a pack of rats raid this vault, and the hen moves her nest to stay out of their reach. New: gate doors slide shut on a beat.' },
    tip: 'The nest moves now: the hen keeps it away from the thieves. Drop when she stops.',
    portals: [{ from: [2, 90], to: [2, 90], emit: ['hatch_pick', 'curse'], every: 9, pull: 0 }],
    rings: [{ gaps: 1, thorns: 1 }, { gaps: 1, gapX: [2], thorns: 2, size: [2, 3], shut: { period: 4, open: 0.5 } }, { mat: 'ice', noGap: true, ice: true }, { gaps: 2, gapX: [3], thorns: 2, size: [2, 3], blunt: 1 }, { gaps: 2, thorns: 2, size: [1, 2] }] },
  { id: 38, gid: 32, world: 7, theme: 'clock', name: 'Clockwork Keep', eggs: 3, target: 2, spacing: 1.0, material: 'metal', minMoves: 5, eggKinds: ['quail', 'ostrich'],
    nest: { w: 2.7, amp: 1.0, period: 9, pattern: 'stopgo' }, bonus: { kind: 'prize' }, rats: { a: 160, n: 2, delay: 8 },
    orbs: [{ type: 'fire_red', ch: 2 }, { type: 'fire_green', ch: 4 }, { type: 'hatch_swoop', ch: 2 }], portals: [{ from: [2, 90], to: [2, 90], emit: ['fire_red', 'curse'], every: 7, pull: 0 }],
    tip: 'Quail through the grate for the flame; the ostrich waits for the curtain to burn.',
    rings: [{ gaps: 1, thorns: 1, gear: true }, { gaps: 1, gapX: [2], thorns: 2, size: [2, 3], grate: 1, gear: true }, { gaps: 1, curtain: 1, thorns: 1, size: [2, 3], grate: 1 }, { gaps: 2, thorns: 2, size: [2, 3], oneway: 1 }, { gaps: 2, gapX: [3], thorns: 2, size: [2, 3], blunt: 1, retract: { period: 3.2, on: 0.5 } }, { gaps: 2, thorns: 2, size: [1, 2] }] },
  { id: 39, gid: 33, world: 7, theme: 'vault', name: 'Snake Pit', eggs: 3, target: 2, spacing: 1.0, material: 'metal', minMoves: 5, eggKinds: ['ostrich'],
    nest: { w: 2.7, amp: 1.0, period: 9, pattern: 'stopgo' }, bonus: { kind: 'time' }, lava: { every: 9, delay: 7 },
    snake: [{ delay: 6, speed: 0.45, a: 0 }, { delay: 15, speed: 0.4, a: -125 }],
    orbs: [{ type: 'rockskin', ch: 1 }, { type: 'fire_black', ch: 3 }, { type: 'rockskin', ch: 4 }, { type: 'hatch_bulk', ch: 2 }, { type: 'hatch_dash', ch: 4 }],
    tip: 'Lava rocks melt walls and rings alike. Rock skin keeps both snakes off.',
    rings: [{ gaps: 1, thorns: 1 }, { gaps: 2, gapX: [2], thorns: 1, size: [2, 3], barriers: 1, honey: 1 }, { gaps: 2, thorns: 2, size: [2, 3], retract: { period: 3, on: 0.5 } }, { gaps: 2, gapX: [3], thorns: 1, size: [2, 3], barriers: 1, gear: true }, { gaps: 2, thorns: 2, size: [2, 3], blunt: 1, gear: true }, { gaps: 2, thorns: 2, size: [1, 2] }] },
  // 0.8.17: the weasel AND the rats in one vault, behind sliding doors
  { id: 40, world: 7, theme: 'vault', name: 'Den of Thieves', eggs: 3, target: 2, spacing: 1.0, material: 'metal', minMoves: 5,
    nest: { w: 2.7, amp: 1.0, period: 9, pattern: 'stopgo' }, bonus: { kind: 'turns' }, weasel: { a: 150, delay: 7 }, rats: { a: -60, n: 2, ch: 2, delay: 10 },
    orbs: [{ type: 'water', ch: 2 }, { type: 'hatch_glow', ch: 1 }, { type: 'fire_red', ch: 4 }],
    tip: 'Water and light send the rats home. Shut the weasel out behind a door.',
    rings: [{ gaps: 1, thorns: 1 }, { gaps: 1, gapX: [2], thorns: 2, size: [2, 3], shut: { period: 4, open: 0.5 } }, { gaps: 2, thorns: 2, size: [2, 3], creep: { len: 0.7, v: 0.4, rest: 2, form: 'saw' } }, { gaps: 2, gapX: [3], thorns: 2, size: [2, 3], blunt: 1, shut: { period: 4.5, open: 0.5 } }, { gaps: 2, thorns: 2, size: [1, 2] }] },
  { id: 41, gid: 34, world: 7, theme: 'clock', name: 'Sky Bridge', eggs: 3, target: 2, spacing: 1.0, material: 'metal', minMoves: 5, eggKinds: [null, 'quail'],
    nest: { w: 2.7, amp: 1.0, period: 9, pattern: 'stopgo' }, bonus: { kind: 'turns' }, eagle: { delay: 9, every: 11 },
    orbs: [{ type: 'magnet', ch: 1 }, { type: 'feather', ch: 4 }, { type: 'hatch_pick', ch: 4 }],
    portals: [{ from: [2, -30], to: [4, -150], emit: ['bubble', 'magnet'], every: 9 }, { from: [4, 90], to: [4, 90], emit: ['hatch_pick'], every: 9, pull: 0 }],
    tip: 'The portal drops eggs past the eagle’s reach, onto the ice. Drill it with the purple chick.',
    rings: [{ gaps: 1, thorns: 1 }, { gaps: 1, gapX: [2], thorns: 2, size: [2, 3], oneway: -1 }, { gaps: 2, thorns: 2, size: [2, 3], grate: 1 }, { gaps: 2, gapX: [3], thorns: 2, size: [2, 3], oneway: 1 }, { mat: 'ice', noGap: true, ice: true }, { gaps: 2, thorns: 2, size: [1, 2] }] },
  { id: 42, gid: 35, world: 7, theme: 'vault', name: 'The Rat King', boss: 'ratking', eggs: 3, target: 2, spacing: 1.0, material: 'metal', minMoves: 6,
    nest: { w: 2.7, amp: 1.0, period: 9, pattern: 'stopgo', drop: 1.1 }, bonus: { kind: 'prize' },
    rats: { n: 2, delay: 999 },
    bossFight: { kind: 'ratking', delay: 3, den: { a: -60, hp: 4 }, throws: ['curse', 'thorn'], phases: [
      { attacks: [], every: 6 },
      { at: { saved: 1, t: 35 }, attacks: ['throw', 'fog'], every: 6, summon: true },
      { at: { saved: 2, t: 70 }, attacks: ['throw2', 'fog'], every: 5 },
    ] },
    orbs: [{ type: 'hourglass', ch: 1 }, { type: 'fire_red', ch: 3 }, { type: 'feather', ch: 4 }, { type: 'hatch_swoop', ch: 3 }, { type: 'hatch_glow', ch: 1 }], portals: [{ from: [3, 90], to: [3, 90], emit: ['fire_red'], every: 7, pull: 0 }],
    intro: { title: 'Boss: The Rat King', line: 'The Rat King hunts his vault and pounces through gaps. Trap him behind a turned ring and hit him; later his rats roll eggs to his den.' },
    tip: 'The hourglass stops even a cursed fuse. Fog lifts in a few seconds: remember where the gaps were.',
    rings: [{ gaps: 1, thorns: 1 }, { gaps: 1, gapX: [2], thorns: 2, size: [2, 3] }, { gaps: 2, thorns: 2, size: [2, 3], oneway: 1 }, { gaps: 1, curtain: 1, thorns: 1, size: [2, 3] }, { gaps: 2, gapX: [3], thorns: 2, size: [2, 3] }, { gaps: 2, thorns: 2, size: [1, 2], blunt: 1 }] },
  // ---------------- 8 Coral Reef: underwater, eggs float UP to the hen's boat; hermit crab, pufferfish, jellyfish; the
  // three new powers (warp gate L37, shock ring L38, frost nova L39), reused at the King Crab (L40). water: true on these
  // five levels only (sim/sim.js: buoyancy, drag and a bob; the basket hangs under her boat at the surface).
  { id: 43, gid: 36, world: 8, theme: 'reef', name: 'Under the Waves', eggs: 3, target: 2, spacing: 1.05, material: 'coral', minMoves: 12, water: true,
    nest: { w: 2.8 }, bonus: { kind: 'time' }, hermit: { ch: 1, a: 70, delay: 1.5 }, fish: { ch: 2, n: 7, speed: 0.9, a: 20, turn: 14 },
    orbs: [{ type: 'bubble', ch: 2 }],
    intro: { title: 'Coral Reef', line: 'Underwater, eggs float UP! Line the gaps up toward the top to reach the hen\'s boat. A hermit crab tucks eggs in its shell: bump an egg into it, or turn a gap to it.' },
    tip: 'A tucked egg is safe from thorns. Turn a gap to the crab and the egg floats out through it.',
    // boss817 (the level after a boss is a step on): the Thieves' Vault gate doors (L37) on the second ring, a fifth ring
    rings: [{ gaps: 1 }, { gaps: 1, gapX: [2], thorns: 2, size: [1, 2], shut: { period: 4.5, open: 0.5 } }, { gaps: 2, gapX: [2], thorns: 2, size: [2, 3] }, { gaps: 2, gapX: [3], thorns: 2, size: [1, 2] }, { gaps: 2, thorns: 1, size: [1, 2] }] },
  { id: 44, gid: 37, world: 8, theme: 'reef', name: 'Puffer Lagoon', eggs: 3, target: 2, spacing: 1.05, material: 'coral', minMoves: 4, water: true, eggKinds: ['duck'],
    nest: { w: 2.7 }, bonus: { kind: 'turns' }, puffer: { ch: 3, a: 40, delay: 3 }, hermit: { ch: 4, a: 150, delay: 9 },
    orbs: [{ type: 'warp', ch: 2 }, { type: 'twin', ch: 1 }],
    intro: { title: 'Pufferfish', line: 'A pufferfish swells up over a gap and plugs it for a few seconds. A slow egg bounces off it, but its spines prick a fast one. A thorn or a zap pops it.' },
    tip: 'The warp gate swirl sends the next creature that grabs at an egg far away.',
    rings: [{ gaps: 1, thorns: 1 }, { gaps: 1, gapX: [2], thorns: 2, size: [1, 2], shut: { period: 4.5, open: 0.45 } }, { gaps: 2, thorns: 1, size: [2, 3], out: 1 }, { gaps: 2, gapX: [3], thorns: 2, size: [1, 2], oneway: 1 }, { gaps: 2, thorns: 1, size: [1, 2] }] },
  { id: 45, gid: 38, world: 8, theme: 'reef', name: 'Jelly Drift', eggs: 3, target: 2, spacing: 1.05, material: 'coral', minMoves: 4, water: true,
    weather: 'current', weatherOpts: { strength: 0.4 }, nest: { w: 2.8 }, bonus: { kind: 'prize' },
    jelly: { ch: 2, a: 30, delay: 2 }, fish: { ch: 3, n: 7, speed: 1.0, a: 160, turn: 12 },
    orbs: [{ type: 'shock', ch: 1 }, { type: 'water', ch: 3 }],
    intro: { title: 'Jellyfish', line: 'A jellyfish drifts through the reef. Its sting cracks an egg, but its glow lights up murky water. Water washes it away; a live ring stuns it.' },
    tip: 'The shock ring makes the ring under the egg live: jellyfish and crabs that touch it are stunned.',
    rings: [{ gaps: 1, thorns: 1, gear: true }, { gaps: 1, gapX: [2], thorns: 1, size: [1, 2], gear: true }, { gaps: 2, gapX: [2], thorns: 1, size: [1, 2], creep: { len: 1.2, v: 0.35, rest: 1.3, form: 'anemone' } }, { gaps: 2, gapX: [3], thorns: 1, size: [1, 2], out: 1 }, { gaps: 2, thorns: 1, size: [1, 2] }] },
  // 0.8.17 urchin: Spike the sea urchin (sim/urchin.js) lives on the floor of channel 2. He naps (eggs slip past), puffs and
  // rolls (a living thorn that fills the channel), and dashes at an egg he sees through a gap of ring 1. Shut that gap in
  // his face (or behind him on his way back) and he flips, helpless. One villain, no current: the tricks come one at a time.
  { id: 46, world: 8, theme: 'reef', name: 'Urchin Alley', eggs: 3, target: 2, spacing: 1.05, material: 'coral', minMoves: 5, water: true,
    nest: { w: 2.7 }, bonus: { kind: 'time' }, urchin: { ch: 2, a: 90, delay: 3 },
    orbs: [{ type: 'stone', ch: 1 }],
    intro: { title: 'Spike the sea urchin', line: 'A living thorn: he rolls and dashes at eggs. Turn a wall into his dash and he flips!' },
    tip: 'Shut the gap he aims through: SPLAT! He lies on his back and you can slip past.',
    rings: [{ gaps: 1 }, { gaps: 2, gapX: [2] }, { gaps: 2 }, { gaps: 2, gapX: [3], thorns: 1, size: [1, 2] }, { gaps: 1, thorns: 1, size: [1, 2] }] },
  { id: 47, gid: 39, world: 8, theme: 'reef', name: 'Kelp Castle', eggs: 3, target: 2, spacing: 1.05, material: 'coral', minMoves: 5, water: true, eggKinds: [null, 'quail'],
    nest: { w: 2.7 }, bonus: { kind: 'turns' }, hermit: { ch: 3, a: 160, delay: 4 }, puffer: { ch: 4, a: 30, delay: 7 }, jelly: { ch: 1, a: -30, delay: 3 },
    orbs: [{ type: 'frostnova', ch: 2 }, { type: 'warp', ch: 4 }],
    intro: { title: 'Frost nova', line: 'The frost orb freezes every creature for a few seconds. A frozen crab or jellyfish cannot grab or sting.' },
    tip: 'Freeze them all, then float your eggs past while they cannot move.',
    rings: [{ gaps: 1, thorns: 1 }, { gaps: 1, gapX: [2], thorns: 2, size: [1, 2], shut: { period: 4, open: 0.55 } }, { gaps: 2, thorns: 2, size: [2, 3], grate: 1 }, { gaps: 2, gapX: [3], thorns: 1, size: [2, 3], out: 1 }, { gaps: 2, thorns: 2, size: [1, 2] }] },
  { id: 48, gid: 40, world: 8, theme: 'reef', name: 'King Crab', boss: 'kingcrab', eggs: 4, target: 2, spacing: 1.05, material: 'coral', minMoves: 5, water: true,
    nest: { w: 2.8 }, bonus: { kind: 'prize' }, jelly: { ch: 2, a: 150, delay: 4 },
    bossFight: { kind: 'kingcrab', delay: 2, phases: [
      { attacks: ['snap', 'bubbles'], every: 4.5 },
      { at: { saved: 1, t: 35 }, attacks: ['snap', 'barnacles', 'snap', 'bubbles'], every: 4 },
      { at: { saved: 2, t: 70 }, attacks: ['snap2', 'whirl', 'snap', 'barnacles', 'snap', 'bubbles', 'silt'], every: 3.3 },
    ] },
    orbs: [{ type: 'warp', ch: 4 }, { type: 'shock', ch: 3 }, { type: 'frostnova', ch: 1 }],
    intro: { title: 'Boss: King Crab', line: 'The King Crab reaches its claws in through lined-up gaps to snatch eggs. Turn the ring while a claw is inside: it gets stuck. Then hit the stuck claw with an egg or a zap.' },
    tip: 'Each hit makes it give back one stolen egg. The warp gate sends a claw away.',
    rings: [{ gaps: 1, thorns: 1 }, { gaps: 1, gapX: [2], thorns: 1, size: [1, 2] }, { gaps: 2, thorns: 2, size: [1, 2] }, { gaps: 2, gapX: [2], thorns: 2, size: [1, 2] }, { gaps: 1, thorns: 2, size: [1, 2] }] },


  // ---------------- 9 Gator Bayou (v3.7): an alligator, a mosquito swarm and a snapping turtle; Grandpa Gator at L45.
  // Thorn vines are the clock. Powers taught here: Pepper Puff (L41), Decoy Egg (L42), Laser Cannon (L43).
  { id: 49, gid: 41, world: 9, theme: 'bayou', name: 'Gator Crossing', eggs: 3, target: 2, spacing: 1.15, material: 'wood', minMoves: 12,
    nest: { w: 2.8 }, bonus: { kind: 'turns' }, gator: { ch: 4, a: -60, delay: 6 }, frog: { ch: 2, a: -130, delay: 8, every: 8 }, // boss817: the frog's first hop 8 s in (was 16)
    orbs: [{ type: 'pepper', ch: 2 }, { type: 'fire_red', ch: 3 }],
    intro: { title: 'Gator Bayou', line: 'An alligator lies in the outer channel like a log. Asleep, his back is a bridge. Awake, he snaps at eggs that drop near his jaws.' },
    tip: 'Turn the gap away from his jaws and he bites nothing. Pepper makes him sneeze and swim off.',
    // boss817 (the level after a boss is a step on): the reef's gate doors (L44, L47) on the third ring
    rings: [{ gaps: 1, thorns: 1 }, { gaps: 1, thorns: 2, size: [2, 3], gear: true }, { gaps: 2, thorns: 2, size: [2, 3], shut: { period: 4.5, open: 0.5 } }, { gaps: 2, gapX: [2], thorns: 2, size: [2, 3], blunt: 1 }, { gaps: 2, thorns: 2, size: [1, 2] }] },
  { id: 50, gid: 42, world: 9, theme: 'bayou', name: 'Mosquito Marsh', eggs: 3, target: 2, spacing: 1.1, material: 'wood', minMoves: 5,
    nest: { w: 2.8 }, bonus: { kind: 'time' }, gator: { ch: 5, a: -120, delay: 9 }, mosquito: { ch: 2, a: -40, delay: 5 }, turtle: { ch: 3, a: -120, delay: 8 },
    orbs: [{ type: 'pepper', ch: 1 }, { type: 'fire_red', ch: 2 }, { type: 'decoy', ch: 3 }, { type: 'fire_red', ch: 4 }],
    intro: { title: 'Mosquitoes and decoys', line: 'A swarm grabs an egg and lifts it back up, even off thorns. Fire or pepper scatters it. The wooden decoy egg draws every bite first.' },
    tip: 'Mosquitoes lift eggs back up. Fire scatters them and burns the vines.',
    rings: [{ gaps: 1, thorns: 1 }, { gaps: 1, thorns: 2, size: [2, 3], gear: true }, { gaps: 2, vine: 1, thorns: 2, size: [2, 3] }, { gaps: 2, thorns: 2, size: [2, 3], retract: { period: 3, on: 0.55 } }, { gaps: 2, gapX: [2], vine: 1, thorns: 2, size: [2, 3] }, { gaps: 2, thorns: 2, size: [1, 2] }] },
  { id: 51, gid: 43, world: 9, theme: 'bayou', name: 'Snapper Slough', eggs: 3, target: 2, spacing: 1.15, material: 'wood', minMoves: 5,
    nest: { w: 2.8 }, bonus: { kind: 'prize' }, gator: { ch: 5, a: -50, delay: 9 }, turtle: { ch: 3, a: -110, delay: 4 }, mosquito: { ch: 1, a: 30, delay: 12 },
    orbs: [{ type: 'laser', ch: 1 }, { type: 'rockskin', ch: 2 }, { type: 'decoy', ch: 3 }, { type: 'pepper', ch: 4 }, { type: 'warp', ch: 3 }],
    intro: { title: 'Snapping turtle', line: 'The turtle clamps an egg: safe from everything, but stuck. Drop an egg or a stone egg on its shell and it flips over. The laser cannon cuts vines and thorns and stuns the turtle.' },
    tip: 'A clamped egg is safe but stuck. Drop another egg on the shell to free it.',
    rings: [{ gaps: 1, thorns: 1 }, { gaps: 1, gapX: [2], thorns: 2, size: [2, 3], oneway: 1 }, { gaps: 2, vine: 1, thorns: 2, size: [2, 3] }, { gaps: 2, thorns: 2, size: [2, 3], honey: 1 }, { gaps: 2, vine: 1, thorns: 2, size: [2, 3], blunt: 1 }, { gaps: 2, thorns: 2, size: [1, 2] }] },
  // 0.8.17: the frog, the turtle and the mosquitoes, without the gator
  { id: 52, world: 9, theme: 'bayou', name: 'Froggy Bottom', eggs: 3, target: 2, spacing: 1.1, material: 'wood', minMoves: 5,
    nest: { w: 2.8 }, bonus: { kind: 'turns' }, frog: { ch: 2, a: -100, delay: 10, every: 8 }, turtle: { ch: 3, a: -80, delay: 6 }, mosquito: { ch: 1, a: 40, delay: 9 },
    orbs: [{ type: 'pepper', ch: 1 }, { type: 'decoy', ch: 2 }, { type: 'fire_red', ch: 3 }],
    tip: 'Drop an egg on the frog: it spits out what it took. Drop one on the turtle to flip it.',
    rings: [{ gaps: 1, thorns: 1 }, { gaps: 1, gapX: [2], thorns: 2, size: [2, 3] }, { gaps: 2, vine: 1, thorns: 2, size: [2, 3] }, { gaps: 2, thorns: 2, size: [2, 3], gear: true }, { gaps: 2, gapX: [3], thorns: 2, size: [2, 3], blunt: 1 }, { gaps: 2, thorns: 2, size: [1, 2] }] },
  { id: 53, gid: 44, world: 9, theme: 'bayou', name: 'Decoy Delta', eggs: 3, target: 2, spacing: 1.15, material: 'wood', minMoves: 5, eggKinds: ['duck'],
    weather: 'current', weatherOpts: { strength: 0.5 },
    nest: { w: 2.8 }, bonus: { kind: 'turns' }, gator: { ch: 4, a: -70, delay: 7 }, turtle: { ch: 3, a: -60, delay: 6 }, mosquito: { ch: 2, a: 140, delay: 9 },
    orbs: [{ type: 'decoy', ch: 1 }, { type: 'fire_red', ch: 2 }, { type: 'laser', ch: 3 }, { type: 'pepper', ch: 4 }, { type: 'spin', ch: 4 }],
    intro: { title: 'Swamp current', line: 'The current pushes every egg along, and the duck egg floats on it. Throw the decoy to pull the gator, the turtle and the swarm off your real eggs.' },
    tip: 'The gator bites the decoy first. Send real eggs past while he chews wood.',
    rings: [{ gaps: 1, thorns: 1 }, { gaps: 1, thorns: 2, size: [2, 3] }, { gaps: 2, vine: 1, thorns: 2, size: [2, 3], gear: true, creep: { len: 1.6, v: 0.5, rest: 1.1, form: 'vine' } }, { gaps: 2, gapX: [2], thorns: 2, size: [2, 3] }, { gaps: 2, thorns: 2, size: [2, 3], blunt: 1 }, { gaps: 2, thorns: 1, size: [1, 2] }] },
  { id: 54, gid: 45, world: 9, theme: 'bayou', name: 'Grandpa Gator', boss: 'gator', eggs: 3, target: 2, spacing: 1.15, material: 'wood', minMoves: 6,
    nest: { w: 2.8 }, bonus: { kind: 'prize' },
    gator: [{ ch: 3, a: -60, call: 1 }, { ch: 4, a: -120, call: 1, face: -1 }], mosquito: { ch: 2, a: 60, delay: 14 }, turtle: { ch: 4, a: -40, delay: 10 },
    bossFight: { kind: 'gator', hp: 3, a: -70, delay: 5, phases: [
      { attacks: ['sweep'], every: 6 },
      { at: { saved: 1, t: 16 }, attacks: ['roll', 'sweep'], every: 5 },
      { at: { saved: 2, t: 32 }, attacks: ['roll', 'sweep', 'roll'], every: 4.5, summon: true },
    ] },
    orbs: [{ type: 'pepper', ch: 1 }, { type: 'laser', ch: 2 }, { type: 'decoy', ch: 3 }, { type: 'fire_red', ch: 4 }],
    intro: { title: 'Boss: Grandpa Gator', line: 'His tail sweep shakes every ring and his death roll spins one. After each attack he lies dizzy: drop an egg on him or pepper him to knock out a tooth.' },
    tip: 'When he lies dizzy, drop an egg on him. Later his grandkids swim in.',
    rings: [{ gaps: 1, thorns: 1 }, { gaps: 1, gapX: [2], thorns: 2, size: [2, 3] }, { gaps: 2, vine: 1, thorns: 2, size: [2, 3], gear: true }, { gaps: 2, thorns: 2, size: [2, 3], blunt: 1 }, { gaps: 2, gapX: [3], vine: 1, thorns: 2, size: [2, 3] }, { gaps: 2, thorns: 2, size: [1, 2] }] },

  // ---------------- 10 The Shape Lab: square, hex, spiral and rocking vaults; the clockwork spider, wind-up beetle and
  // spring jack (sim/clockwork.js); Iron Shell, Shrink Ray, Spin Storm and the Cannonballs combo; the Clockwork Owl (sim/owl.js)
  // v4 level fields: shape ('square' | 'hex': every ring; a ring's own shape wins, 'spiral' is a one-turn ramp ring whose
  //   seam is its way through), rock ({} or {amp, hold, swing}: the whole vault leans and back), spider {ring, delay, every},
  //   beetle {ch, a?, delay, dir}, jack [{ch, a?}] (gen.mjs puts a missing a on free floor of that ring; a jack just short of a gap),
//   useCombo (the planner's run must fire a power combo).
  { id: 55, gid: 46, world: 10, theme: 'lab', name: 'Square One', eggs: 3, target: 2, spacing: 1.05, material: 'metal', minMoves: 12, fuseX: 0.75, shape: 'square',
    nest: { w: 2.7 }, bonus: { kind: 'turns' }, spider: { ring: 2, delay: 4 },
    orbs: [{ type: 'iron', ch: 1 }, { type: 'fire_red', ch: 3 }],
    intro: { title: 'Shape Lab', cw: 'spider', line: 'Square vaults: eggs rest on flat sides and slide at corners. The clockwork spider crawls to a gap and webs it shut; slip an egg past while it spins.' },
    tip: 'A webbed egg rides its ring: turn it over another gap. The iron shell tears webs and smashes thorns.',
    // boss817 (the level after a boss is a step on): a fifth ring with a Gator Bayou thorn vine (L50) on one gap; fuseX
    // keeps the clock near what it was (100 s, was 60; the plain formula gives 130 for the longer climb)
    rings: [{ gaps: 1, thorns: 1 }, { gaps: 2, gapX: [2], thorns: 2, size: [1, 2] }, { gaps: 2, thorns: 2, size: [2, 3] }, { gaps: 2, vine: 1, thorns: 2, size: [1, 2] }, { gaps: 2, gapX: [3], thorns: 1, size: [1, 2] }] },
  { id: 56, gid: 47, world: 10, theme: 'lab', name: 'Hex Works', eggs: 3, target: 2, spacing: 1.05, material: 'metal', minMoves: 3, shape: 'hex',
    nest: { w: 2.7 }, bonus: { kind: 'time' }, beetle: { ch: 2, delay: 3 }, spider: { ring: 4, delay: 12 },
    orbs: [{ type: 'shrink', ch: 1 }, { type: 'iron', ch: 3 }, { type: 'shock', ch: 4 }],
    intro: { title: 'Wind-up beetle', cw: 'beetle', line: "Turn the beetle's ring to wind him: he marches the way you turned it, shoves eggs ahead and crushes thorns. Unwound, he is a wall." },
    tip: 'Shrink ray: small eggs slip through grates, but they crack easier.',
    rings: [{ gaps: 1, thorns: 1 }, { gaps: 1, gapX: [2], thorns: 2, size: [2, 3], grate: 1 }, { gaps: 2, thorns: 2, size: [2, 3], creep: { len: 1.3, v: 0.8, rest: 1.4, form: 'saw' } }, { gaps: 2, gapX: [3], thorns: 2, size: [1, 2] }, { gaps: 2, thorns: 1, size: [1, 2] }] },
  { id: 57, gid: 48, world: 10, theme: 'lab', name: 'Spiral Spring', eggs: 3, target: 2, spacing: 1.05, material: 'metal', minMoves: 4,
    nest: { w: 2.7 }, bonus: { kind: 'turns' }, jack: [{ ch: 1 }], beetle: { ch: 3, delay: 6 },
    orbs: [{ type: 'shrink', ch: 1 }, { type: 'iron', ch: 2 }, { type: 'spin', ch: 3 }],
    intro: { title: 'Spring jack', cw: 'jack', line: 'Roll an egg over the jack and it bounces back up: time it to jump a gap. An iron egg jams it. The spiral ring has no gap: roll down its step.' },
    tip: 'Spin storm flings the beetle on its back, but your eggs tumble too.',
    rings: [{ gaps: 1, thorns: 1 }, { gaps: 2, gapX: [2], thorns: 2, size: [1, 2] }, { shape: 'spiral', noGap: true, thorns: 1, size: [1, 2] }, { gaps: 2, gapX: [3], thorns: 2, size: [2, 3] }, { gaps: 2, thorns: 1, size: [1, 2] }] },
  // 0.8.17: a square vault with the spring jack and one spider
  { id: 58, world: 10, theme: 'lab', name: 'Jack in the Box', eggs: 3, target: 2, spacing: 1.05, material: 'metal', minMoves: 4, shape: 'square',
    nest: { w: 2.8 }, bonus: { kind: 'time' }, spider: { ring: 3, delay: 6 }, jack: [{ ch: 1 }, { ch: 3 }],
    orbs: [{ type: 'iron', ch: 2 }, { type: 'shrink', ch: 1 }],
    tip: 'Bounce an egg off the jack to jump a webbed gap.',
    rings: [{ gaps: 1, thorns: 1 }, { gaps: 2, gapX: [2], thorns: 2, size: [1, 2] }, { gaps: 2, thorns: 2, size: [2, 3] }, { gaps: 2, gapX: [3], thorns: 2, size: [1, 2] }, { gaps: 2, thorns: 1, size: [1, 2] }] },
  { id: 59, gid: 49, world: 10, theme: 'lab', name: 'Rocking Lab', eggs: 3, target: 2, spacing: 1.05, material: 'metal', minMoves: 4, useCombo: true, shape: 'square', rock: {},
    nest: { w: 3.1 }, bonus: { kind: 'time' }, spider: { ring: 2, delay: 8 }, beetle: { ch: 1, delay: 5 }, jack: [{ ch: 3 }],
    orbs: [{ type: 'shrink', ch: 0, a: -100 }, { type: 'iron', ch: 0, a: -80 }, { type: 'spin', ch: 3, a: 90 }], // the combo fires at the start: a demo
    intro: { title: 'Rocking vault', cw: 'rock', line: 'The whole vault leans and comes back. Parked eggs slide. Shrink ray plus iron shell make cannonballs: tiny iron eggs that smash thorns and slip through grates.' },
    tip: 'Your eggs start as cannonballs: smash thorns while it lasts. Wait out the lean before you park an egg.',
    rings: [{ gaps: 1, thorns: 1 }, { gaps: 2, gapX: [2], thorns: 2, size: [2, 3], grate: 1 }, { gaps: 2, thorns: 2, size: [2, 3] }, { gaps: 2, gapX: [3], thorns: 1, size: [1, 2] }] },
  { id: 60, gid: 50, world: 10, theme: 'lab', name: 'The Clockwork Owl', boss: 'owl', eggs: 4, target: 3, spacing: 1.05, material: 'metal', minMoves: 6, shape: 'hex',
    nest: { w: 2.8 }, bonus: { kind: 'prize' }, spider: { ring: 3, delay: 999 }, beetle: { ch: 1, delay: 999 }, jack: [{ ch: 2 }],
    bossFight: { kind: 'owl', delay: 3, phases: [
      { attacks: ['swoop', 'gears'], every: 5.5 },
      { at: { saved: 1, t: 30 }, attacks: ['wind', 'swoop', 'gears'], every: 5 },
      { at: { saved: 2, t: 55 }, attacks: ['swoop', 'gears2', 'wind'], every: 4.5, summon: true },
    ] },
    orbs: [{ type: 'shrink', ch: 1, a: 156 }, { type: 'iron', ch: 1, a: 144 }, { type: 'spin', ch: 2 }, { type: 'thunderclap', ch: 3 }, { type: 'iron', ch: 4 }],
    intro: { title: 'Boss: The Clockwork Owl', line: 'The owl swoops at eggs in the outer channel, winds the rings round and drops gear bombs. Turn the gap away when it marks an egg. An iron egg jams its gears.' },
    tip: 'Thunderclap stalls the owl. Carry a ticking gear bomb away from your eggs.',
    rings: [{ gaps: 1, thorns: 1 }, { gaps: 1, gapX: [2], thorns: 2, size: [2, 3] }, { gaps: 2, thorns: 2, size: [2, 3] }, { gaps: 2, gapX: [3], thorns: 2, size: [1, 2] }, { gaps: 2, thorns: 1, size: [1, 2] }] },
];
