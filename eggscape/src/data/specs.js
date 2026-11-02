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
// v3 level fields: snake {delay, speed, a, len, size, kind, skin} or an array of them (kind: 'classic' | 'fast' (emerald,
//   speed x1.3, body x0.8) | 'constrictor' (amber, armoured: half the back-off from a protected egg, speed x0.8) |
//   'spitter' (crimson, venom melts a barrier in half the time); a trait is on only when the spec sets `kind`.
//   skin: 'violet' | 'emerald' | 'amber' | 'crimson', cosmetic; default the kind's, else by index so two snakes in a
//   level never share one), eagle {delay, every}, fox {every,
//   throws: [orb types], delay}, lava {every, delay} (lava rocks; lava: true is only a lava floor), icicles
//   {every, delay}, eggKinds ['ostrich' | 'quail' | 'duck' | null, ...] (per starting egg), portal pull (m),
//   world 1..7 (environment), boss (bossId for the intro portrait: fox snake blizzard golem salamander eagle foxking).
//   v3 orb types: hourglass feather rockskin foxcurse.
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
// 35 levels = 7 environments x 5: L1 of an environment teaches its trait, L2-L4 twist it, L5 is the boss
// (with an intro card); the level after a boss is a breather. Nests only move where there is a reason
// (the lake current, the fox chasing the hen in his fortress).
// Rule: the outermost ring is never a motor ring: it would drop eggs wherever its gap happens to be, so
// whether they hit the nest would be luck.
export const SPECS = [
  // ---------------- 1 The Farm: thorns, red flame, gate doors, curtains, portals; the fox drops bad orbs
  { id: 1, world: 1, theme: 'farm', name: 'Sunny Farm', eggs: 3, target: 2, spacing: 1.05, material: 'wood', minMoves: 3,
    nest: { w: 2.6 }, bonus: { kind: 'orbs' },
    orbs: [{ type: 'fire_red', ch: 1 }],
    intro: { title: 'The Farm', line: 'Drag a ring to turn it and drop the eggs into the nest. Red thorns break eggs, but the red flame burns them.' },
    tip: 'Roll an egg into the red flame first: it burns every thorn it touches.',
    rings: [{ gaps: 1 }, { gaps: 1, gapX: [2], thorns: 2, size: [2, 3] }, { gaps: 2, gapX: [3], thorns: 2, size: [2, 3] }] },
  { id: 2, world: 1, theme: 'barn', name: 'Hay Barn', eggs: 3, target: 2, spacing: 1.05, material: 'wood', minMoves: 3,
    nest: { w: 2.6 }, bonus: { kind: 'time' },
    orbs: [{ type: 'twin', ch: 1 }, { type: 'fire_red', ch: 2 }],
    intro: { title: 'Gate doors', line: 'Some gaps have sliding doors that open and shut on a beat. Park an egg over the door and drop when it opens.' },
    tip: 'Brass teeth link two rings: turn one and the other turns back the other way. Doors open on a beat.',
    rings: [{ gaps: 1, thorns: 1 }, { gaps: 1, gapX: [2], thorns: 2, size: [2, 3], shut: { period: 4, open: 0.5 }, gear: true }, { gaps: 2, gapX: [3], thorns: 2, size: [1, 2], blunt: 1 }] },
  { id: 3, world: 1, theme: 'orchard', name: 'Apple Orchard', eggs: 3, target: 2, spacing: 1.05, material: 'wood', minMoves: 4,
    nest: { w: 2.6 }, bonus: { kind: 'turns' },
    orbs: [{ type: 'fire_red', ch: 2 }], portals: [{ from: [2, 90], to: [2, 90], emit: ['fire_red'], every: 7, pull: 0 }],
    intro: { title: 'Thorn curtain', line: 'A curtain of thorns seals the only way down. Send one egg to fetch the red flame, burn the curtain, and the rest follow.' },
    tip: 'Fetch the flame and turn the curtain under that egg. Missed? The swirl up top makes a new flame.',
    rings: [{ gaps: 1, thorns: 1, gear: true }, { gaps: 1, gapX: [2], thorns: 2, size: [2, 3] }, { gaps: 1, curtain: 1, thorns: 1, size: [2, 2] }, { gaps: 2, gapX: [3], thorns: 2, size: [1, 2], shut: { period: 4.5, open: 0.55 } }] },
  { id: 4, world: 1, theme: 'pumpkin', name: 'Pumpkin Patch', eggs: 3, target: 2, spacing: 1.05, material: 'wood', minMoves: 4,
    nest: { w: 2.6 }, bonus: { kind: 'orbs' },
    portals: [{ from: [1, -150], to: [3, -30], emit: ['fire_green', 'fire_red'], every: 8 }],
    fox: { every: 13, throws: ['thorn'], delay: 9 },
    intro: { title: 'Portals', line: 'Swirling portals suck in eggs from every side and spit them out lower down. Now and then they spit out an orb.' },
    tip: 'The portal skips two thorny rings. The fox drops thorn balls: dodge them.',
    rings: [{ gaps: 1, thorns: 1 }, { gaps: 1, gapX: [2], thorns: 2, size: [2, 3], gear: true }, { gaps: 2, curtain: 1, thorns: 2, size: [2, 3] }, { gaps: 2, gapX: [3], thorns: 2, size: [1, 2], shut: { period: 4, open: 0.5 } }] },
  { id: 5, world: 1, theme: 'farm', name: 'Fox Raid', boss: 'fox', eggs: 3, target: 2, spacing: 1.0, material: 'wood', minMoves: 5,
    nest: { w: 2.8 }, bonus: { kind: 'prize' },
    orbs: [{ type: 'fire_green', ch: 2 }, { type: 'fire_red', ch: 3 }], portals: [{ from: [3, 90], to: [3, 90], emit: ['fire_red'], every: 7, pull: 0 }],
    bossFight: { kind: 'fox', delay: 4, throws: ['thorn', 'foxcurse'], phases: [
      { attacks: ['throw'], every: 5.5 },
      { at: { saved: 1, t: 30 }, attacks: ['throw2'], every: 6 },
      { at: { saved: 2, t: 60 }, attacks: ['throw2'], every: 4.5 },
    ] },
    intro: { title: 'Boss: Fox Raid', line: 'The fox aims thorn balls and curse orbs at your eggs (a red mark shows where), then throws two at once.' },
    tip: 'Curse orbs make the fuse run double. The green flame mends cracks.',
    rings: [{ gaps: 1, thorns: 1 }, { gaps: 1, gapX: [2], thorns: 2, size: [2, 3], shut: { period: 4, open: 0.5 } }, { gaps: 2, thorns: 2, size: [2, 3], blunt: 1, gear: true }, { gaps: 1, curtain: 1, thorns: 1, size: [2, 3] }, { gaps: 2, gapX: [3], thorns: 2, size: [2, 3] }] },

  // ---------------- 2 Wild Woods: snakes (two from L9), wooden barriers, the chick; rock skin, sun flame
  { id: 6, world: 2, theme: 'bramble', name: 'Bramble Path', eggs: 3, target: 2, spacing: 1.05, material: 'vine', minMoves: 4,
    nest: { w: 2.6 }, bonus: { kind: 'turns' }, snake: { delay: 6, speed: 0.4 },
    orbs: [{ type: 'rockskin', ch: 1 }, { type: 'fire_red', ch: 2 }],
    intro: { title: 'Wild Woods', line: 'A snake slides in and hunts your eggs. It crosses a ring only through a gap: turn the gaps away. Rock skin turns every egg to stone.' },
    tip: 'Grab the rock skin, then run every egg down while they are stone.',
    rings: [{ mat: 'wood', gaps: 1, thorns: 1 }, { gaps: 1, gapX: [2], thorns: 2, size: [2, 3] }, { mat: 'wood', gaps: 2, thorns: 2, size: [2, 3], blunt: 1 }, { gaps: 2, gapX: [3], thorns: 2, size: [1, 2] }] },
  { id: 7, world: 2, theme: 'jungle', name: 'Jungle Nursery', eggs: 3, target: 2, spacing: 1.0, material: 'vine', minMoves: 5,
    nest: { w: 2.8 }, bonus: { kind: 'prize' }, snake: { delay: 12, speed: 0.35 },
    orbs: [{ type: 'fire_gold', ch: 1 }, { type: 'rockskin', ch: 2 }],
    intro: { title: 'Sun flame chick', line: 'The sun flame hatches a chick. It flutters, pecks grey spikes away, and snakes chase it first.' },
    tip: 'The chick is bait: while the snake chases it, move the others.',
    rings: [{ mat: 'wood', gaps: 1, thorns: 1 }, { gaps: 1, gapX: [2], thorns: 2, size: [2, 3], blunt: 1 }, { mat: 'wood', gaps: 2, thorns: 2, size: [2, 3], blunt: 2 }, { gaps: 2, gapX: [3], thorns: 2, size: [2, 3], gear: true }, { mat: 'wood', gaps: 2, thorns: 2, size: [1, 2] }] },
  { id: 8, world: 2, theme: 'mushroom', name: 'Woodcutter Glade', eggs: 3, target: 2, spacing: 1.0, material: 'wood', minMoves: 5,
    nest: { w: 2.8 }, bonus: { kind: 'time' }, snake: { delay: 7, speed: 0.45 },
    orbs: [{ type: 'fire_red', ch: 1 }, { type: 'rockskin', ch: 3 }],
    intro: { title: 'Wooden walls', line: 'Walls stand on the ring floors. They stop eggs and snakes alike. Fire burns them; snake venom melts them.' },
    tip: 'The snake stops to melt a wall: that is your moment to drop.',
    rings: [{ gaps: 1, thorns: 1 }, { gaps: 2, gapX: [2], thorns: 1, size: [2, 3], barriers: 1 }, { gaps: 2, thorns: 1, size: [2, 3], barriers: 1 }, { gaps: 2, gapX: [3], thorns: 2, size: [2, 3], blunt: 1, gear: true }, { gaps: 2, thorns: 2, size: [1, 2] }] },
  { id: 9, world: 2, theme: 'bramble', name: 'Twin Fangs', eggs: 3, target: 2, spacing: 1.0, material: 'vine', minMoves: 5,
    nest: { w: 2.8 }, bonus: { kind: 'turns' }, snake: [{ delay: 9, speed: 0.35, a: 0 }, { delay: 18, speed: 0.35, a: 125 }],
    orbs: [{ type: 'rockskin', ch: 1 }, { type: 'fire_gold', ch: 2 }, { type: 'fire_green', ch: 4 }, { type: 'hatch_glow', ch: 1 }],
    tip: 'Two snakes. Tap the glow chick as one closes in: the flash stuns it for 3 s.',
    intro: { title: 'Glow chick', chick: 'glow', line: 'The yellow orb hatches a glow chick. Tap it once: a flash burns every thorn near it and stuns snakes.' }, useTap: true,
    rings: [{ mat: 'wood', gaps: 1, thorns: 1 }, { gaps: 1, gapX: [2], thorns: 2, size: [2, 3], blunt: 1 }, { mat: 'wood', gaps: 2, thorns: 2, size: [2, 3] }, { gaps: 2, gapX: [3], thorns: 2, size: [2, 3] }, { mat: 'wood', gaps: 2, thorns: 2, size: [2, 3] }] },
  { id: 10, world: 2, theme: 'jungle', name: 'Serpent Hollow', boss: 'snake', eggs: 3, target: 2, spacing: 1.0, material: 'vine', minMoves: 5,
    nest: { w: 3.0 }, bonus: { kind: 'prize' },
    snake: [{ delay: 7, speed: 0.28, size: 1.5, len: 1.6, a: 0 }, { delay: 15, speed: 0.45, size: 0.8, a: 140 }],
    orbs: [{ type: 'rockskin', ch: 1 }, { type: 'fire_gold', ch: 2 }, { type: 'rockskin', ch: 3 }],
    bossFight: { kind: 'snake', phases: [{}, { at: { saved: 1, t: 35 } }, { at: { saved: 2, t: 70 } }] },
    intro: { title: 'Boss: Serpent Hollow', line: 'A big slow snake and a small fast one hunt together. Lure them with a chick, then run in rock skin.' },
    tip: 'Walls hold the snakes back while the venom works. Count to three, then go.',
    rings: [{ mat: 'wood', gaps: 1, thorns: 1, gear: true }, { gaps: 1, gapX: [2], thorns: 2, size: [2, 3], blunt: 1, gear: true }, { mat: 'wood', gaps: 2, thorns: 1, size: [2, 3], barriers: 1 }, { gaps: 2, gapX: [3], thorns: 2, size: [2, 3] }, { mat: 'wood', gaps: 2, thorns: 2, size: [1, 2] }] },

  // ---------------- 3 Frozen Lake: one-way rings, ice, icicles, the current (moving nest); hourglass, duck egg
  { id: 11, world: 3, theme: 'frozen', name: 'Frozen Lake', eggs: 3, target: 2, spacing: 1.05, material: 'wood', minMoves: 4,
    nest: { w: 2.6 }, bonus: { kind: 'turns' },
    orbs: [{ type: 'hourglass', ch: 1 }, { type: 'stone', ch: 2 }],
    intro: { title: 'Frozen Lake', line: 'Arrow rings turn only one way, and ice is slippery. The hourglass slows the world and stops the fuse.' },
    tip: 'Arrow rings only turn one way: sometimes the long way round is the safe one.',
    rings: [{ gaps: 1 }, { mat: 'ice', gaps: 1, gapX: [2], thorns: 2, size: [2, 3], oneway: 1 }, { gaps: 2, thorns: 2, size: [2, 3] }, { mat: 'ice', gaps: 2, gapX: [3], thorns: 2, size: [1, 2], oneway: -1 }] },
  { id: 12, world: 3, theme: 'blizzard', name: 'Icicle Hollow', eggs: 3, target: 2, spacing: 1.0, material: 'stone', minMoves: 5,
    nest: { w: 2.8 }, bonus: { kind: 'time' }, icicles: { every: 5, delay: 4, big: 3 },
    orbs: [{ type: 'stone', ch: 1 }, { type: 'fire_green', ch: 3 }, { type: 'frost', ch: 2 }],
    intro: { title: 'Falling ice', line: 'An icicle grows over an egg and shakes before it drops: turn the ring above to swing it away. Big chunks freeze a ring.' },
    tip: 'Ice leaves a slippery patch. The frost orb freezes the ring under your egg.',
    rings: [{ gaps: 1, thorns: 1 }, { mat: 'ice', gaps: 1, gapX: [2], thorns: 2, size: [2, 3], oneway: -1, gear: true }, { gaps: 2, thorns: 2, size: [2, 3], blunt: 1 }, { mat: 'ice', gaps: 2, gapX: [3], thorns: 2, size: [2, 3] }, { gaps: 2, thorns: 2, size: [1, 2], oneway: 1 }] },
  { id: 13, world: 3, theme: 'frozen', name: 'Duck Pond', eggs: 3, target: 2, spacing: 1.0, material: 'wood', minMoves: 5, eggKinds: ['duck'],
    weather: 'current', weatherOpts: { strength: 0.8 },
    nest: { w: 2.8 }, bonus: { kind: 'prize' },
    orbs: [{ type: 'water', ch: 2 }, { type: 'thunder', ch: 3 }, { type: 'hatch_glow', ch: 3 }],
    tip: 'The duck egg floats and rides the current. Let it drift to the gap.',
    rings: [{ gaps: 1, thorns: 1 }, { mat: 'ice', gaps: 1, gapX: [2], thorns: 2, size: [2, 3] }, { gaps: 2, thorns: 2, size: [2, 3], oneway: 1 }, { mat: 'ice', gaps: 2, gapX: [3], thorns: 2, size: [2, 3], blunt: 1 }, { gaps: 2, thorns: 2, size: [1, 2] }] },
  { id: 14, world: 3, theme: 'frozen', name: 'Drifting Nest', eggs: 3, target: 2, spacing: 1.0, material: 'wood', minMoves: 5,
    weather: 'current', weatherOpts: { strength: 0.7 }, icicles: { every: 6, delay: 6, big: 3 },
    nest: { w: 2.7, amp: 1.3, period: 8, pattern: 'slide' }, bonus: { kind: 'turns' },
    orbs: [{ type: 'hourglass', ch: 2 }, { type: 'thunder', ch: 4 }, { type: 'frost', ch: 3 }, { type: 'hatch_pick', ch: 1 }],
    tip: 'The ice ring has one gap. Drill a closer one with the purple chick, then drop fast: it freezes over in 6 s.',
    portals: [{ from: [1, 90], to: [1, 90], emit: ['hatch_pick'], every: 9, pull: 0 }],
    intro: { title: 'Pick chick', chick: 'pick', line: 'Hard ice is too tough for eggs. The purple orb hatches a pick chick: tap it on the ice and it drills a hole that freezes over 6 s later.' }, useTap: true,
    rings: [{ gaps: 1, thorns: 1 }, { mat: 'ice', gaps: 1, ice: true }, { gaps: 2, thorns: 2, size: [2, 3] }, { mat: 'ice', gaps: 2, gapX: [3], thorns: 2, size: [2, 3], blunt: 1 }, { gaps: 2, thorns: 2, size: [2, 3] }, { gaps: 2, thorns: 2, size: [1, 2] }] },
  { id: 15, world: 3, theme: 'blizzard', name: 'The Blizzard', boss: 'blizzard', eggs: 3, target: 2, spacing: 1.0, material: 'stone', minMoves: 5,
    bossFight: { kind: 'blizzard', delay: 4, gale: 5, phases: [
      { attacks: ['gale'], every: 5 },
      { at: { saved: 1, t: 30 }, attacks: ['gale', 'freeze'], every: 4.5 },
      { at: { saved: 2, t: 60 }, attacks: ['icicles', 'gale', 'freeze', 'icicles'], every: 3.8 },
    ] },
    nest: { w: 2.9 }, bonus: { kind: 'time' },
    orbs: [{ type: 'hourglass', ch: 1 }, { type: 'stone', ch: 3 }, { type: 'fire_green', ch: 4 }],
    intro: { title: 'Boss: The Blizzard', line: 'The Blizzard blows gales that shove eggs along the rings, freezes a ring solid, then drops icicles on your eggs.' },
    tip: 'Turn a wall into the wind before the gale hits. Stone is too heavy to blow away.',
    rings: [{ gaps: 1, thorns: 1 }, { mat: 'ice', gaps: 1, gapX: [2], thorns: 2, size: [2, 3], oneway: 1 }, { gaps: 2, thorns: 2, size: [2, 3], blunt: 1 }, { mat: 'ice', gaps: 2, thorns: 2, size: [2, 3], oneway: -1 }, { gaps: 2, gapX: [3], thorns: 2, size: [2, 3] }, { gaps: 2, thorns: 2, size: [1, 2], oneway: 1 }] },

  // ---------------- 4 Crystal Caves: portals that suck and spit orbs, grates, quail and ostrich eggs, glass
  { id: 16, world: 4, theme: 'crystal', name: 'Crystal Caves', eggs: 3, target: 2, spacing: 1.0, material: 'stone', minMoves: 4, eggKinds: ['quail'],
    nest: { w: 2.8 }, bonus: { kind: 'orbs' },
    orbs: [{ type: 'fire_red', ch: 2 }, { type: 'twin', ch: 3 }],
    portals: [{ from: [2, 90], to: [2, 90], emit: ['fire_red'], every: 7, pull: 0 }, { from: [3, -150], to: [4, -40], emit: ['fire_green', 'bubble'], every: 9 }],
    intro: { title: 'Crystal Caves', line: 'Grates let only the little quail egg through. Portals suck in eggs from every side.' },
    tip: 'Only the quail fits a grate. Send it for the flame: the curtain must burn for the others.',
    rings: [{ gaps: 1 }, { gaps: 1, gapX: [2], thorns: 2, size: [2, 3], grate: 1 }, { gaps: 1, curtain: 1, thorns: 1, size: [2, 3], grate: 1 }, { gaps: 2, gapX: [3], thorns: 2, size: [2, 3] }, { gaps: 2, thorns: 2, size: [1, 2] }] },
  { id: 17, world: 4, theme: 'crystal', name: 'Portal Hall', eggs: 3, target: 2, spacing: 1.0, material: 'stone', minMoves: 5,
    nest: { w: 2.8 }, bonus: { kind: 'turns' },
    orbs: [{ type: 'magnet', ch: 1 }],
    portals: [{ from: [1, -30], to: [3, -150], emit: ['bubble', 'thorn'], every: 9 }, { from: [2, -160], to: [4, 30], emit: ['fire_red', 'magnet'], every: 10 }, { from: [3, 20], to: [4, -120], emit: ['twin'], every: 12 }],
    tip: 'Three portals, three routes. Pick the one that skips the thorns.',
    rings: [{ gaps: 1, thorns: 1 }, { gaps: 1, gapX: [2], thorns: 2, size: [2, 3] }, { mat: 'glass', gaps: 2, thorns: 2, size: [2, 3], blunt: 1, gear: true }, { gaps: 2, gapX: [3], thorns: 2, size: [2, 3], gear: true }, { gaps: 2, thorns: 2, size: [2, 3] }] },
  { id: 18, world: 4, theme: 'crystal', name: 'Ostrich Run', eggs: 3, target: 2, spacing: 1.05, material: 'stone', minMoves: 5, eggKinds: ['ostrich'],
    nest: { w: 3.0 }, bonus: { kind: 'prize' },
    orbs: [{ type: 'fire_black', ch: 2 }, { type: 'bubble', ch: 4 }, { type: 'hatch_bulk', ch: 1 }],
    portals: [{ from: [2, 160], to: [4, -20], emit: ['fire_green'], every: 10 }],
    tip: 'The ostrich is too big for narrow gaps, but a two-ring fall lets it flatten thorns.',
    intro: { title: 'Bulk chick', chick: 'bulk', line: 'The green orb hatches a bulk chick. Tap it once: big and heavy for 5 s, it squashes thorns and smashes cracked glass. Too big for gaps!' }, useTap: true,
    rings: [{ gaps: 1, thorns: 1 }, { gaps: 2, gapX: [3], thorns: 2, size: [2, 3] }, { gaps: 2, thorns: 2, size: [2, 3] }, { mat: 'glass', gaps: 2, gapX: [3, 2], thorns: 2, size: [2, 3] }, { gaps: 2, thorns: 2, size: [2, 3], blunt: 1 }, { gaps: 2, thorns: 2, size: [1, 2] }] },
  { id: 19, world: 4, theme: 'crystal', name: 'Glass Floor', eggs: 3, target: 2, spacing: 1.0, material: 'glass', minMoves: 5, eggKinds: [null, 'quail'],
    nest: { w: 3.0 }, bonus: { kind: 'time' },
    orbs: [{ type: 'bubble', ch: 1 }, { type: 'magnet', ch: 3 }, { type: 'hatch_swoop', ch: 3 }],
    portals: [{ from: [2, -30], to: [5, -150], emit: ['fire_green', 'water'], every: 9 }, { from: [4, 150], to: [5, -40], emit: ['bubble'], every: 11 }],
    tip: 'Glass floors crack under landings, then break. A bubble lands soft.',
    intro: { title: 'Swoop chick', chick: 'swoop', line: 'The blue orb hatches a swoop chick. Tap it once: it flies up through the ring above and tears down a thorn curtain on the way.' },
    rings: [{ mat: 'stone', gaps: 1, thorns: 1 }, { gaps: 1, gapX: [2], thorns: 2, size: [2, 3] }, { mat: 'stone', gaps: 2, thorns: 2, size: [2, 3], grate: 1 }, { gaps: 2, gapX: [3], thorns: 2, size: [2, 3], curtain: 1 }, { mat: 'stone', gaps: 2, thorns: 2, size: [2, 3], blunt: 1 }, { gaps: 2, thorns: 2, size: [1, 2] }] },
  { id: 20, world: 4, theme: 'crystal', name: 'Golem Maze', boss: 'golem', eggs: 3, target: 2, spacing: 1.0, material: 'stone', minMoves: 5,
    nest: { w: 3.0 }, bonus: { kind: 'prize' },
    bossFight: { kind: 'golem', delay: 4, phases: [
      { attacks: ['stomp'], every: 6 },
      { at: { saved: 1, t: 30 }, attacks: ['stomp'], every: 5 },
      { at: { saved: 2, t: 60 }, attacks: ['stomp', 'punch'], every: 4.5 },
    ] },
    orbs: [{ type: 'feather', ch: 1 }, { type: 'stone', ch: 2 }, { type: 'hatch_bulk', ch: 2 }],
    portals: [{ from: [1, -20], to: [3, 160], emit: ['feather', 'thorn'], every: 10 }, { from: [2, -150], to: [4, -40], emit: ['fire_green'], every: 9 }, { from: [3, 30], to: [4, -140], emit: ['rockskin'], every: 12 }],
    intro: { title: 'Boss: The Crystal Golem', line: 'The golem stomps: the vault quakes, crystal walls block your way and glass cracks; later he punches a ring round.' },
    tip: 'Walls shatter after a while, or under a stone egg. Watch which ring the golem points at.',
    rings: [{ gaps: 1, thorns: 1 }, { gaps: 1, gapX: [2], thorns: 2, size: [2, 3] }, { mat: 'glass', gaps: 2, thorns: 2, size: [2, 3] }, { gaps: 2, gapX: [3], thorns: 2, size: [2, 3], blunt: 1 }, { mat: 'glass', gaps: 2, thorns: 2, size: [1, 2] }, { gaps: 2, thorns: 2, size: [1, 2] }] },

  // ---------------- 5 Volcano: lava rocks melt holes and blast eggs; water shell, black flame, honey, spikes
  { id: 21, world: 5, theme: 'volcano', name: 'Volcano', eggs: 3, target: 2, spacing: 1.0, material: 'obsidian', minMoves: 4,
    nest: { w: 2.8 }, bonus: { kind: 'orbs' }, salamander: { delay: 3, every: 6, a: 160, ch: 2 },
    orbs: [{ type: 'water', ch: 1 }, { type: 'fire_red', ch: 3 }],
    intro: { title: 'The lava salamander', line: 'Its fire makes the wall in front of it red-hot. Turn the ring it stands on to aim the fire at thorns, not eggs.' },
    tip: 'The salamander rides the ring under it. Steer its fire onto thorns; water cools it down.',
    rings: [{ gaps: 1, thorns: 1 }, { gaps: 1, gapX: [2], thorns: 2, size: [2, 3] }, { gaps: 2, thorns: 2, size: [2, 3], blunt: 1 }, { gaps: 2, gapX: [3], thorns: 2, size: [2, 3] }, { gaps: 2, thorns: 2, size: [1, 2] }] },
  { id: 22, world: 5, theme: 'volcano', name: 'Melt-Through', eggs: 3, target: 2, spacing: 1.0, material: 'obsidian', minMoves: 4,
    nest: { w: 2.8 }, bonus: { kind: 'time' }, lava: { every: 6, delay: 4 }, salamander: { delay: 6, every: 7, a: 30, ch: 3 },
    orbs: [{ type: 'fire_black', ch: 2 }, { type: 'water', ch: 3 }, { type: 'hourglass', ch: 4 }],
    intro: { title: 'Lava rocks', line: 'Lava rocks crash onto the rings, glow, then melt a hole that heals 5 s later. The water shell cools them. Lava only feeds the salamander.' },
    tip: 'This ring has no gap. Wait for a lava hole, or burn one with the black flame.',
    rings: [{ gaps: 1, thorns: 1 }, { gaps: 1, gapX: [2], thorns: 2, size: [2, 3] }, { noGap: true, thorns: 1, size: [1, 2] }, { gaps: 2, gapX: [3], thorns: 2, size: [2, 3] }, { gaps: 2, thorns: 2, size: [1, 2] }] },
  { id: 23, world: 5, theme: 'volcano', name: 'Honey Vents', eggs: 3, target: 2, spacing: 1.0, material: 'obsidian', minMoves: 5,
    nest: { w: 3.0 }, bonus: { kind: 'turns' }, lava: { every: 6, delay: 4 }, salamander: { delay: 5, every: 7, a: -40, ch: 3 },
    snake: { delay: 9, a: 40, speed: 0.35 },
    orbs: [{ type: 'water', ch: 2 }, { type: 'stone', ch: 4 }, { type: 'hatch_dash', ch: 1 }],
    tip: 'Honey holds an egg while the rocks fall. Lure the snake to the salamander: they face off and leave your eggs alone.',
    intro: { title: 'Dash chick', chick: 'dash', line: 'The orange orb hatches a dash chick. Tap it once: it shoots along its channel, bonks snakes and the salamander dizzy, and grabs orbs.' }, useTap: true,
    rings: [{ gaps: 1, thorns: 1 }, { gaps: 1, gapX: [2], thorns: 2, size: [2, 3], honey: 1 }, { gaps: 2, thorns: 2, size: [2, 3] }, { gaps: 2, gapX: [3], thorns: 2, size: [2, 3], honey: 1 }, { gaps: 2, thorns: 2, size: [2, 3], blunt: 1 }, { gaps: 2, thorns: 2, size: [1, 2] }] },
  { id: 24, world: 5, theme: 'volcano', name: 'Spike Forge', eggs: 3, target: 2, spacing: 1.0, material: 'obsidian', minMoves: 5,
    nest: { w: 3.0 }, bonus: { kind: 'time' }, lava: { every: 6, delay: 5 }, salamander: { delay: 4, every: 6.5, a: 120, ch: 2 },
    orbs: [{ type: 'hourglass', ch: 1 }, { type: 'water', ch: 3 }, { type: 'fire_green', ch: 5 }, { type: 'hatch_swoop', ch: 2 }],
    tip: 'Forge spikes pump in and out. Count the beat and pass while they are down.',
    rings: [{ gaps: 1, thorns: 1, gear: true }, { gaps: 1, gapX: [2], thorns: 3, size: [2, 3], retract: { period: 3, on: 0.5 } }, { gaps: 2, thorns: 2, size: [2, 3], curtain: 1 }, { gaps: 2, gapX: [3], thorns: 3, size: [2, 3], retract: { period: 2.6, on: 0.55 } }, { gaps: 2, thorns: 2, size: [2, 3], blunt: 1 }, { gaps: 2, thorns: 2, size: [1, 2] }] },
  { id: 25, world: 5, theme: 'volcano', name: 'The Eruption', boss: 'salamander', eggs: 3, target: 2, spacing: 1.0, material: 'obsidian', minMoves: 5,
    nest: { w: 3.0 }, bonus: { kind: 'prize' },
    bossFight: { kind: 'salamander', delay: 3, phases: [
      { attacks: ['rock'], every: 4.5 },
      { at: { saved: 1, t: 30 }, attacks: ['rock2'], every: 4.5 },
      { at: { saved: 2, t: 60 }, attacks: ['rock2'], every: 4, heat: true },
    ] },
    salamander: { delay: 3, ch: 3, a: 90 }, // the boss itself: 1.3x, breathes fire between its lava throws
    orbs: [{ type: 'water', ch: 1 }, { type: 'feather', ch: 3 }, { type: 'water', ch: 4 }],
    intro: { title: 'Boss: The Lava Salamander', line: 'It walks the rings, spits lava rocks at your eggs and breathes fire on the walls. At the end the heat cracks any egg that waits.' },
    tip: 'Rocks melt holes everywhere. Use them, and take the feather for the last run.',
    rings: [{ gaps: 1, thorns: 1 }, { gaps: 1, gapX: [2], thorns: 2, size: [2, 3], honey: 1 }, { gaps: 2, thorns: 2, size: [2, 3] }, { noGap: true, thorns: 2, size: [1, 2] }, { gaps: 2, gapX: [3], thorns: 2, size: [2, 3], blunt: 1 }, { gaps: 2, thorns: 2, size: [1, 2] }] },

  // ---------------- 6 Storm Peaks: lightning, the eagle (it also takes snakes), gears; guardian feather, thunder
  { id: 26, world: 6, theme: 'storm', name: 'Storm Peaks', eggs: 3, target: 2, spacing: 1.0, material: 'metal', minMoves: 4, weather: 'thunder',
    nest: { w: 2.8 }, bonus: { kind: 'turns' },
    gusts: { delay: 7, every: 11, strength: 3, dur: 2 }, // v3.1: storm gusts shove eggs (and snakes) along the channels
    orbs: [{ type: 'thunder', ch: 2 }, { type: 'bubble', ch: 3 }],
    intro: { title: 'Storm Peaks', line: 'Lightning flickers on a ring, then strikes and locks it. A locked ring holds still: use it.' },
    tip: 'A flicker means a strike is coming. Keep eggs away from that spot.',
    rings: [{ gaps: 1, thorns: 1 }, { mat: 'cloud', gaps: 1, gapX: [2], thorns: 2, size: [2, 3] }, { gaps: 2, thorns: 2, size: [2, 3], blunt: 1 }, { mat: 'cloud', gaps: 2, gapX: [3], thorns: 2, size: [2, 3] }, { gaps: 2, thorns: 2, size: [1, 2] }] },
  { id: 27, world: 6, theme: 'storm', name: 'Eagle Crag', eggs: 3, target: 2, spacing: 1.0, material: 'metal', minMoves: 5,
    nest: { w: 3.0 }, bonus: { kind: 'prize' }, eagle: { delay: 8, every: 11 },
    gusts: { delay: 10, every: 14, strength: 1.8, dur: 1.6 }, // v3.1: storm gusts shove eggs (and snakes) along the channels
    orbs: [{ type: 'feather', ch: 3 }, { type: 'fire_green', ch: 4 }],
    intro: { title: 'The eagle', line: 'The eagle reaches in only through gaps in the outer ring. When it screeches, turn that gap away.' },
    tip: 'Wait deeper in the vault, then cross the outer channel right after a dive.',
    rings: [{ gaps: 1, thorns: 1 }, { mat: 'cloud', gaps: 1, gapX: [2], thorns: 2, size: [2, 3] }, { gaps: 2, thorns: 2, size: [2, 3] }, { mat: 'cloud', gaps: 2, gapX: [3], thorns: 2, size: [2, 3], blunt: 1 }, { gaps: 2, thorns: 2, size: [2, 3] }, { gaps: 2, thorns: 2, size: [1, 2] }] },
  { id: 28, world: 6, theme: 'storm', name: 'Snake Snatcher', eggs: 3, target: 2, spacing: 1.0, material: 'metal', minMoves: 5,
    nest: { w: 3.0 }, bonus: { kind: 'time' }, eagle: { delay: 10, every: 10 }, snake: { delay: 6, speed: 0.4 },
    gusts: { delay: 9, every: 10, strength: 3, dur: 2 }, // v3.1: storm gusts shove eggs (and snakes) along the channels
    orbs: [{ type: 'fire_gold', ch: 1 }, { type: 'rockskin', ch: 3 }, { type: 'hatch_glow', ch: 1 }, { type: 'hatch_dash', ch: 3 }],
    tip: 'The eagle loves snakes. Keep the snake in the outer channel and let it feed.',
    rings: [{ gaps: 1, thorns: 1 }, { gaps: 1, gapX: [2], thorns: 2, size: [2, 3], blunt: 1 }, { mat: 'cloud', gaps: 2, thorns: 1, size: [2, 3], barriers: 1 }, { gaps: 2, gapX: [3], thorns: 2, size: [2, 3] }, { gaps: 2, thorns: 2, size: [2, 3] }, { gaps: 2, thorns: 2, size: [1, 2] }] },
  { id: 29, world: 6, theme: 'storm', name: 'Thunder Gears', eggs: 3, target: 2, spacing: 1.0, material: 'metal', minMoves: 5, weather: 'thunder',
    nest: { w: 3.0 }, bonus: { kind: 'turns' }, eagle: { delay: 12, every: 11 },
    gusts: { delay: 9, every: 10, strength: 3, dur: 2 }, // v3.1: storm gusts shove eggs (and snakes) along the channels
    orbs: [{ type: 'fire_black', ch: 2 }, { type: 'feather', ch: 4 }, { type: 'hatch_bulk', ch: 2 }],
    tip: 'Gear teeth link two rings: turn one and its neighbour turns the other way.',
    rings: [{ gaps: 1, thorns: 1 }, { gaps: 1, gapX: [2], thorns: 2, size: [2, 3], gear: true }, { gaps: 2, thorns: 2, size: [2, 3] }, { gaps: 2, gapX: [3], thorns: 2, size: [2, 3], gear: true }, { gaps: 2, thorns: 2, size: [2, 3], blunt: 1 }, { gaps: 2, thorns: 2, size: [1, 2] }] },
  { id: 30, world: 6, theme: 'storm', name: 'Eagle and Serpent', boss: 'eagle', eggs: 3, target: 2, spacing: 1.0, material: 'metal', minMoves: 5, weather: 'thunder',
    nest: { w: 3.0 }, bonus: { kind: 'prize' }, eagle: { delay: 12, every: 10 },
    snake: [{ delay: 6, speed: 0.38, a: 0 }, { delay: 999, speed: 0.42, a: 140 }],
    bossFight: { kind: 'eagle', delay: 6, phases: [
      { attacks: [] },
      { at: { saved: 1, t: 35 }, attacks: ['bolt'], every: 6 },
      { at: { saved: 2, t: 65 }, attacks: ['bolt', 'bolt2'], every: 4.5, summon: true },
    ] },
    orbs: [{ type: 'feather', ch: 1 }, { type: 'thunder', ch: 2 }, { type: 'feather', ch: 4 }, { type: 'hatch_dash', ch: 2 }],
    intro: { title: 'Boss: The Storm Eagle', line: 'The eagle dives while a snake hunts inside; then the storm aims lightning at the ring under your egg and a second snake comes.' },
    tip: 'When the ring under an egg crackles, turn it away. A locked ring also stops a snake.',
    rings: [{ gaps: 1, thorns: 1 }, { gaps: 1, gapX: [2], thorns: 2, size: [2, 3] }, { mat: 'cloud', gaps: 2, thorns: 2, size: [2, 3] }, { gaps: 2, thorns: 2, size: [2, 3], blunt: 1 }, { gaps: 2, gapX: [3], thorns: 2, size: [2, 3] }, { gaps: 2, thorns: 2, size: [1, 2] }] },

  // ---------------- 7 The Fox's Fortress: the fox throws curses and drags the nest; every trait remixed
  { id: 31, world: 7, theme: 'vault', name: "The Fox's Gate", eggs: 3, target: 2, spacing: 1.0, material: 'metal', minMoves: 4,
    nest: { w: 2.7, amp: 1.0, period: 9, pattern: 'stopgo' }, bonus: { kind: 'turns' }, fox: { every: 9, throws: ['foxcurse', 'thorn'], delay: 6 },
    orbs: [{ type: 'twin', ch: 1 }, { type: 'hourglass', ch: 3 }, { type: 'hatch_pick', ch: 2 }],
    intro: { title: "The Fox's Fortress", line: 'The fox walks his walls, throws curse orbs, and chases the hen and her nest. Everything you learned, all at once.' },
    tip: 'The nest moves now: the fox is chasing the hen. Drop when she stops.',
    portals: [{ from: [2, 90], to: [2, 90], emit: ['hatch_pick'], every: 9, pull: 0 }],
    rings: [{ gaps: 1, thorns: 1 }, { gaps: 1, gapX: [2], thorns: 2, size: [2, 3], shut: { period: 4, open: 0.5 } }, { mat: 'ice', noGap: true, ice: true }, { gaps: 2, gapX: [3], thorns: 2, size: [2, 3], blunt: 1 }, { gaps: 2, thorns: 2, size: [1, 2] }] },
  { id: 32, world: 7, theme: 'clock', name: 'Clockwork Keep', eggs: 3, target: 2, spacing: 1.0, material: 'metal', minMoves: 5, eggKinds: ['quail', 'ostrich'],
    nest: { w: 2.7, amp: 1.0, period: 9, pattern: 'stopgo' }, bonus: { kind: 'prize' }, fox: { every: 10, throws: ['foxcurse'], delay: 8 },
    orbs: [{ type: 'fire_red', ch: 2 }, { type: 'fire_green', ch: 4 }, { type: 'hatch_swoop', ch: 2 }], portals: [{ from: [2, 90], to: [2, 90], emit: ['fire_red'], every: 7, pull: 0 }],
    tip: 'Quail through the grate for the flame; the ostrich waits for the curtain to burn.',
    rings: [{ gaps: 1, thorns: 1, gear: true }, { gaps: 1, gapX: [2], thorns: 2, size: [2, 3], grate: 1, gear: true }, { gaps: 1, curtain: 1, thorns: 1, size: [2, 3], grate: 1 }, { gaps: 2, thorns: 2, size: [2, 3], oneway: 1 }, { gaps: 2, gapX: [3], thorns: 2, size: [2, 3], blunt: 1 }, { gaps: 2, thorns: 2, size: [1, 2] }] },
  { id: 33, world: 7, theme: 'vault', name: 'Snake Pit', eggs: 3, target: 2, spacing: 1.0, material: 'metal', minMoves: 5,
    nest: { w: 2.7, amp: 1.0, period: 9, pattern: 'stopgo' }, bonus: { kind: 'time' }, lava: { every: 9, delay: 7 },
    snake: [{ delay: 6, speed: 0.45, a: 0 }, { delay: 15, speed: 0.4, a: -125 }],
    orbs: [{ type: 'rockskin', ch: 1 }, { type: 'water', ch: 3 }, { type: 'rockskin', ch: 4 }, { type: 'hatch_bulk', ch: 2 }, { type: 'hatch_dash', ch: 4 }],
    tip: 'Lava rocks melt walls and rings alike. Rock skin keeps both snakes off.',
    rings: [{ gaps: 1, thorns: 1 }, { gaps: 2, gapX: [2], thorns: 1, size: [2, 3], barriers: 1 }, { gaps: 2, thorns: 2, size: [2, 3] }, { gaps: 2, gapX: [3], thorns: 1, size: [2, 3], barriers: 1, gear: true }, { gaps: 2, thorns: 2, size: [2, 3], blunt: 1, gear: true }, { gaps: 2, thorns: 2, size: [1, 2] }] },
  { id: 34, world: 7, theme: 'clock', name: 'Sky Bridge', eggs: 3, target: 2, spacing: 1.0, material: 'metal', minMoves: 5,
    nest: { w: 2.7, amp: 1.0, period: 9, pattern: 'stopgo' }, bonus: { kind: 'turns' }, eagle: { delay: 9, every: 11 },
    orbs: [{ type: 'magnet', ch: 1 }, { type: 'feather', ch: 4 }, { type: 'hatch_pick', ch: 4 }],
    portals: [{ from: [2, -30], to: [4, -150], emit: ['bubble', 'magnet'], every: 9 }, { from: [4, 90], to: [4, 90], emit: ['hatch_pick'], every: 9, pull: 0 }],
    tip: 'The portal drops eggs past the eagle’s reach, onto the ice. Drill it with the purple chick.',
    rings: [{ gaps: 1, thorns: 1 }, { gaps: 1, gapX: [2], thorns: 2, size: [2, 3], oneway: -1 }, { gaps: 2, thorns: 2, size: [2, 3] }, { gaps: 2, gapX: [3], thorns: 2, size: [2, 3], oneway: 1 }, { mat: 'ice', noGap: true, ice: true }, { gaps: 2, thorns: 2, size: [1, 2] }] },
  { id: 35, world: 7, theme: 'vault', name: 'The Fox King', boss: 'foxking', eggs: 3, target: 2, spacing: 1.0, material: 'metal', minMoves: 6,
    nest: { w: 2.7, amp: 1.0, period: 9, pattern: 'stopgo' }, bonus: { kind: 'prize' },
    snake: { delay: 999, speed: 0.38 },
    bossFight: { kind: 'foxking', delay: 4, throws: ['foxcurse', 'thorn'], phases: [
      { attacks: ['throw'], every: 5.5 },
      { at: { saved: 1, t: 30 }, attacks: ['throw2', 'fog'], every: 5 },
      { at: { saved: 2, t: 60 }, attacks: ['throw2', 'fog'], every: 4.5, summon: true },
    ] },
    orbs: [{ type: 'hourglass', ch: 1 }, { type: 'fire_red', ch: 3 }, { type: 'feather', ch: 4 }, { type: 'hatch_swoop', ch: 3 }, { type: 'hatch_glow', ch: 1 }], portals: [{ from: [3, 90], to: [3, 90], emit: ['fire_red'], every: 7, pull: 0 }],
    intro: { title: 'Boss: The Fox King', line: 'The Fox King throws curses and thorn balls at your eggs, hides a ring in fog, and at the end calls in his snake.' },
    tip: 'The hourglass stops even a cursed fuse. Fog lifts in a few seconds: remember where the gaps were.',
    rings: [{ gaps: 1, thorns: 1 }, { gaps: 1, gapX: [2], thorns: 2, size: [2, 3] }, { gaps: 2, thorns: 2, size: [2, 3], oneway: 1 }, { gaps: 1, curtain: 1, thorns: 1, size: [2, 3] }, { gaps: 2, gapX: [3], thorns: 2, size: [2, 3] }, { gaps: 2, thorns: 2, size: [1, 2], blunt: 1 }] },
];
