// Wonder Vaults: the bonus world. Five vaults, each on one new mechanic (sim/wonder.js), and (0.8.17) a second of
// five of them. Not part of the campaign: own ids (901..910), own save keys (save.wonder); since 0.8.17 they are the
// map's side quests (src/side.js), which pay a little (the Mint's sideQuest row).
// Angles in degrees. Ring specs are the core sim's (gaps, thorns, pads, gear); level.wonder carries the mechanic.
// `solve` is the scripted clear that tools/wonder-check.mjs replays: [vault, ring, degrees] turns, ['wait', s],
// ['hen', angle] (mama), ['set', ring, degrees] + ['hatch'] (plan).

export const WONDER_LEVELS = [
  {
    // 0.8.18: all three eggs (was two of three), 72 s (was 80), and the middle ring's thorns come and go on a beat (3 s,
    // up half of it), one more of them low on its left
    id: 901, key: 'planet', name: 'Planet Nest', theme: 'crystal', material: 'stone', eggs: 3, target: 3, time: 72, r0: 1.8, spacing: 0.95, seed: 11,
    pitch: 'Inside-out gravity', tip: 'Thorns come, go',
    wonder: { kind: 'planet', eggs: [90, 210, 330] },
    rings: [
      { gaps: [{ a: 200, len: 0.86 }], thorns: [{ a: 20, n: 1, side: 'out' }] },
      { gaps: [{ a: 0, len: 0.86 }], thorns: [{ a: 180, n: 2, side: 'out' }, { a: -140, n: 1, side: 'out' }], retract: { period: 3, on: 0.5 } },
      { gaps: [{ a: 60, len: 0.86 }], thorns: [{ a: 150, n: 1, side: 'out' }] },
    ],
    solve: [['drop', 0, 2, 1, 1], ['drop', 0, 1, 1, 1], ['drop', 0, 0, 1, -1], ['drop', 0, 2, 3, -1], ['drop', 0, 1, 3, -1], ['drop', 0, 0, 3, -1], ['drop', 0, 2, 2, -1], ['drop', 0, 1, 2, -1], ['drop', 0, 0, 2, -1]],
  },
  {
    // Plan and Hatch, retuned for g=15: a staggered chain, ~11 s of watching (6-12 s across the winning window). The honey pad on ring 0 holds the first egg
    // while the others go; each egg drops left through rings 0 and 1, the portal by the bottom of channel 2 throws it to
    // the top left of the outer channel, it slides down and out of ring 3 into the nest. Three settings must be right:
    // ring 0 (gap low-left), ring 1 (gap low-left; geared to ring 2, so it also parks ring 2's thorns) and ring 3 (gap at
    // the bottom). The lazy setup (every gap straight down) gears ring 2's thorns under the drop and breaks all three.
    // 0.8.18: all three eggs must come home (was two of three) and the stars ask for a plan right first time (par 1 / 3,
    // was 3 / 7)
    id: 902, key: 'plan', name: 'Plan and Hatch', theme: 'clock', material: 'metal', eggs: 3, target: 3, time: 0, r0: 1.3, spacing: 1.2, seed: 21, nest: { w: 2.4 },
    pitch: 'Think, then watch', tip: 'Set, then HATCH',
    wonder: { kind: 'plan', par: [1, 3], eggs: [{ ch: 0, a: 185 }, { ch: 0, a: 225 }, { ch: 1, a: 200 }] },
    portals: [{ a: [-0.59, -3.32], b: [-2.15, 3.72] }],
    rings: [
      { gaps: [{ a: 0, len: 0.95 }], honey: [{ a: -45, len: 0.45 }] },
      { gear: 2, gaps: [{ a: 30, len: 1.1 }] },
      { gaps: [{ a: 0, len: 1.0 }], thorns: [{ a: 150, n: 2 }] },
      { gaps: [{ a: 90, len: 1.9 }] },
    ],
    solve: [['set', 0, -130], ['set', 1, -135], ['set', 3, -180], ['hatch']],
    // must NOT win (tools/wonder-check.mjs): doing nothing; the lazy all-gaps-down setup; ring 2's gap down instead
    // (the gear swings ring 1 shut); ring 3 left alone (no way out)
    fails: [[['hatch']], [['set', 0, -90], ['set', 1, -120], ['set', 3, -180], ['hatch']], [['set', 0, -90], ['set', 2, -90], ['set', 3, -180], ['hatch']], [['set', 0, -130], ['set', 1, -135], ['hatch']]],
  },
  {
    // 0.8.18: both eggs (was one of two), 34 s (was 50), and the middle ring is no longer stuck: it turns by itself, its
    // gap and its thorns going round. Calling at once drops the eggs on its thorns; she waits for them to pass, then
    // follows its gap round until both are through.
    id: 903, key: 'mama', name: "Mama's Call", theme: 'mushroom', material: 'wood', eggs: 2, target: 2, time: 34, r0: 1.05, spacing: 1.0, seed: 5,
    pitch: 'Follow the gap', tip: 'Mind the turning',
    wonder: { kind: 'mama', start: -90 },
    rings: [
      { gaps: [{ a: 90 }], thorns: [{ a: 0, n: 2 }] },
      { motor: 12, gaps: [{ a: -30 }], thorns: [{ a: 25, n: 2 }] },
      { gaps: [{ a: 150, len: 0.9 }], thorns: [{ a: -90, n: 3 }] },
    ],
    solve: [['wait', 6], ['hen', 90, -1], ['henGap', 1, 1, 0.5, 0.5, 20], ['hen', 150, -1], ['wait', 5]],
    fails: [[['hen', 90, -1], ['hen', -30, 1], ['hen', 150, 1], ['wait', 5]], [['hen', 90, -1], ['henGap', 1, 1, 0.5, 0.5, 20], ['hen', 150, -1], ['wait', 5]]], // the 0.8.17 clear; the same walk without waiting for the thorns
  },
  {
    // 0.8.18: every egg (was one from each), 30 s (was 55), and the second vault's outer ring has thorns that come and go
    // on a beat (3 s, up 55% of it), one of them where its eggs wait: the last swing waits half way for it to sink
    id: 904, key: 'twin', name: 'Twin Vaults', theme: 'volcano', material: 'wood', time: 30, seed: 3,
    pitch: 'One hand, two', tip: 'Wait for thorns',
    wonder: {
      kind: 'twin',
      // B's rings 0 and 1 mirror A's (one move drops both); ring 2 does not: free A first, then swing back for B.
      // Freeing B first swings A's thorn through A's eggs.
      vaults: [
        { eggs: 2, target: 2, r0: 1.05, spacing: 1.0, material: 'wood', seed: 3, nest: { w: 2.4 }, rings: [
          { gaps: [{ a: 0 }], thorns: [{ a: 150, n: 2 }] },
          { gaps: [{ a: -150 }], thorns: [{ a: -45, n: 2 }] },
          { gaps: [{ a: 0, len: 0.9 }], thorns: [{ a: -135, n: 2 }] },
        ] },
        { eggs: 2, target: 2, r0: 1.05, spacing: 1.0, material: 'wood', seed: 4, nest: { w: 2.4 }, rings: [
          { gaps: [{ a: 180 }], thorns: [{ a: 30, n: 2 }] },
          { gaps: [{ a: -30 }], thorns: [{ a: -135, n: 2 }] },
          { gaps: [{ a: 0, len: 0.9 }], thorns: [{ a: 120, n: 2 }, { a: -45, n: 2 }], retract: { period: 3, on: 0.55 } },
        ] },
      ],
    },
    rings: [],
    solve: [[0, 0, -90], [0, 1, 60, 1.5], [0, 2, -90, 2.1], ['beat', 1, 3, 0.1], [0, 2, 90, 1.7], [0, 2, 90, 1], [0, 2, 20, 3]], // the swing back for B waits for B's thorn beat
    fails: [[['wait', 20]], [[0, 0, -90], [0, 1, 60, 1.5], [0, 2, 90, 2.5], [0, 2, -180, 3], [0, 2, -20, 3]], [[0, 0, -90], [0, 1, 60, 1.5], [0, 2, -90, 2.5], [0, 2, 180, 3], [0, 2, 20, 3]]], // idle; B's vault freed first; the 0.8.17 clear (one swing through the thorn)
  },
  {
    // 0.8.18 (mykee on this one, the first side quest: "It is too easy, too damn easy"): every gap straight down won it.
    // Now all four must come home (was three), in 50 s (was 75), and the two outer rings are GEARED: they turn together,
    // opposite ways, so their gaps are never both down. The outer eggs go first (ring 2's gap, then ring 3's), then the
    // chicks, and the gear goes back for them: ring 2 low while they walk it, ring 3 low once both are past.
    id: 905, key: 'hatch', name: 'Hatchlings', theme: 'barn', material: 'wood', eggs: 4, target: 4, time: 50, r0: 1.05, spacing: 1.0, seed: 9, nest: { w: 2.6 },
    pitch: 'Chicks, gears, order', tip: 'Geared rings',
    wonder: { kind: 'hatch', lamp: { ch: 1, a: -90 }, eggs: [null, null, { ch: 2, a: -96 }, { ch: 2, a: -84 }] },
    rings: [
      { gaps: [{ a: 30 }] },
      { fixed: 1, mat: 'stone', gaps: [{ a: -35, len: 0.9 }] },
      { gear: 3, gaps: [{ a: 10 }], thorns: [{ a: -130, n: 2 }] },
      { gaps: [{ a: 20, len: 0.9 }], thorns: [{ a: -40, n: 2 }], pads: [{ a: -90, len: 1.2 }] },
    ],
    solve: [[0, 2, -100, 2], [0, 3, 150, 2], [0, 0, -120, 1], [0, 2, -210, 1], ['wait', 8], [0, 3, -210, 1], ['wait', 20]],
    // must NOT win: the 0.8.17 clear (every gap down, outer first); the gear swung back the other way (its thorns sweep the eggs)
    fails: [[[0, 3, -110], [0, 2, -100], ['wait', 2], [0, 0, -120], ['wait', 30]], [[0, 2, -100, 2], [0, 3, -210, 2], [0, 0, -120, 1], [0, 2, 210, 1], ['wait', 8], [0, 3, -210, 1], ['wait', 20]]],
  },
  // ---- the second vaults (0.8.17): side quests further down the road (src/side.js). Each is an earlier vault drawn in
  // the mirror (the same rules, a new board) and stepped up: every egg must come home, a tighter clock, more thorns.
  {
    // Twin Vaults in the mirror: the old order no longer works (it swings a thorn through vault A, see fails); of the
    // 1,872 ways to work ring 2 after the first two moves, three win
    // 0.8.18: 28 s (was 40), and the second vault's outer ring has thorns that come and go (as in Twin Vaults), one where
    // its eggs wait: the last swing stops half way for it (the 0.8.17 clear swings straight through)
    id: 906, key: 'twin2', name: 'Twin Vaults II', theme: 'frozen', material: 'wood', time: 28, seed: 3,
    pitch: 'Twins, mirrored', tip: 'Wait for thorns',
    wonder: {
      kind: 'twin',
      vaults: [
        { eggs: 2, target: 2, r0: 1.05, spacing: 1.0, material: 'wood', seed: 3, nest: { w: 2.4 }, rings: [
          { gaps: [{ a: 180 }], thorns: [{ a: 30, n: 2 }] },
          { gaps: [{ a: -30 }], thorns: [{ a: -135, n: 2 }] },
          { gaps: [{ a: 180, len: 0.9 }], thorns: [{ a: -45, n: 2 }] },
        ] },
        { eggs: 2, target: 2, r0: 1.05, spacing: 1.0, material: 'wood', seed: 4, nest: { w: 2.4 }, rings: [
          { gaps: [{ a: 0 }], thorns: [{ a: 150, n: 2 }] },
          { gaps: [{ a: -150 }], thorns: [{ a: -45, n: 2 }] },
          { gaps: [{ a: 180, len: 0.9 }], thorns: [{ a: 60, n: 2 }, { a: -135, n: 2 }], retract: { period: 3, on: 0.55 } },
        ] },
      ],
    },
    rings: [],
    solve: [[0, 0, 90], [0, 1, -60, 1.5], [0, 2, 30, 2.5], [0, 2, 60, 2.1], ['beat', 1, 3, 2.85], [0, 2, -90, 1.7], [0, 2, -90, 3]], // the swing back for B waits for B's thorn beat
    fails: [[['wait', 20]], [[0, 0, 90], [0, 1, -60, 1.5], [0, 2, 90, 2.5], [0, 2, -180, 3], [0, 2, -20, 3]], [[0, 0, 90], [0, 1, -60, 1.5], [0, 2, 30, 2.5], [0, 2, 60, 3], [0, 2, -180, 3]]], // idle; the first vault's order, mirrored; the 0.8.17 clear
  },
  {
    // Planet Nest in the mirror: all three eggs (was two of three), a thorn more on each of the two outer rings, 75 s
    // 0.8.18: 68 s (was 75)
    id: 907, key: 'planet2', name: 'Planet Nest II', theme: 'reef', material: 'stone', eggs: 3, target: 3, time: 68, r0: 1.8, spacing: 0.95, seed: 11,
    pitch: 'Hungrier little world', tip: 'Gap by gap',
    wonder: { kind: 'planet', eggs: [90, -30, -150] },
    rings: [
      { gaps: [{ a: -20, len: 0.86 }], thorns: [{ a: 160, n: 1, side: 'out' }] },
      { gaps: [{ a: 180, len: 0.86 }], thorns: [{ a: 0, n: 2, side: 'out' }, { a: 75, n: 1, side: 'out' }] },
      { gaps: [{ a: 120, len: 0.86 }], thorns: [{ a: 30, n: 1, side: 'out' }, { a: 45, n: 1, side: 'out' }] },
    ],
    solve: [['drop', 0, 2, 1, -1], ['drop', 0, 1, 1, -1], ['drop', 0, 0, 1, 1], ['drop', 0, 2, 3, 1], ['drop', 0, 1, 3, 1], ['drop', 0, 0, 3, 1], ['drop', 0, 2, 2, 1], ['drop', 0, 1, 2, 1], ['drop', 0, 0, 2, 1]],
  },
  {
    // Mama's Call in the mirror: both eggs (was one of two), a thorn more on rings 0 and 2, 34 s
    // 0.8.18: the outer ring turns by itself (its gap must be met where it is going, not where it was), 26 s (was 34)
    id: 908, key: 'mama2', name: "Mama's Call II", theme: 'storm', material: 'wood', eggs: 2, target: 2, time: 26, r0: 1.05, spacing: 1.0, seed: 5,
    pitch: 'The storm turns', tip: 'Meet the gap',
    wonder: { kind: 'mama', start: -90 },
    rings: [
      { gaps: [{ a: 90 }], thorns: [{ a: 180, n: 2 }, { a: -120, n: 1 }] },
      { gaps: [{ a: -150 }], thorns: [{ a: 155, n: 2 }] },
      { motor: 10, gaps: [{ a: 30, len: 0.9 }], thorns: [{ a: -90, n: 3 }, { a: 15, n: 1 }] },
    ],
    solve: [['henGap', 0, 1, 0.5, 0.5], ['henGap', 1, -1, 0.5, 0.5], ['henGap', 2, -1, 0.5, 0.5], ['wait', 5]],
    fails: [[['hen', 90, 1], ['hen', -150, -1], ['hen', 30, -1], ['wait', 5]]], // the 0.8.17 clear (the outer gap has moved on)
  },
  {
    // Plan and Hatch in the mirror: all three eggs (was two of three), a thorn on the geared ring 1 and on the outer ring
    // 0.8.18: three stars only for a plan right first time (par 1 / 3, was 3 / 7)
    id: 909, key: 'plan2', name: 'Plan and Hatch II', theme: 'bayou', material: 'metal', eggs: 3, target: 3, time: 0, r0: 1.3, spacing: 1.2, seed: 21, nest: { w: 2.4 },
    pitch: 'Think twice, watch', tip: 'Set, then HATCH',
    wonder: { kind: 'plan', par: [1, 3], eggs: [{ ch: 0, a: -5 }, { ch: 0, a: -45 }, { ch: 1, a: -20 }] },
    portals: [{ a: [0.59, -3.32], b: [2.15, 3.72] }],
    rings: [
      { gaps: [{ a: 180, len: 0.95 }], honey: [{ a: -135, len: 0.45 }] },
      { gear: 2, gaps: [{ a: 150, len: 1.1 }], thorns: [{ a: -45, n: 1 }] },
      { gaps: [{ a: 180, len: 1.0 }], thorns: [{ a: 30, n: 2 }] },
      { gaps: [{ a: 90, len: 1.9 }], thorns: [{ a: -150, n: 1 }] },
    ],
    solve: [['set', 0, 130], ['set', 1, 135], ['set', 3, 180], ['hatch']],
    // must NOT win: doing nothing; the lazy all-gaps-down setup; ring 2's gap down instead; ring 3 left alone (all mirrored)
    fails: [[['hatch']], [['set', 0, 90], ['set', 1, 120], ['set', 3, 180], ['hatch']], [['set', 0, 90], ['set', 2, 90], ['set', 3, 180], ['hatch']], [['set', 0, 130], ['set', 1, 135], ['hatch']]],
  },
  {
    // Hatchlings in the mirror: all four chicks (was three of four), a thorn more on the outer ring, 45 s (was 75)
    // 0.8.18: the way out has a DOOR that opens and shuts on a beat (4 s, open 40%), 42 s (was 45): the chicks must be
    // at the door when it opens, so the lamp's egg drop is timed to it (the 0.8.17 clear arrives a beat late)
    id: 910, key: 'hatch2', name: 'Hatchlings II', theme: 'lab', material: 'wood', eggs: 4, target: 4, time: 42, r0: 1.05, spacing: 1.0, seed: 9, nest: { w: 2.6 },
    pitch: 'Chicks on time', tip: 'Watch the door',
    wonder: { kind: 'hatch', lamp: { ch: 1, a: -90 }, eggs: [null, null, { ch: 2, a: -84 }, { ch: 2, a: -96 }] },
    rings: [
      { gaps: [{ a: 150 }] },
      { fixed: 1, mat: 'stone', gaps: [{ a: -145, len: 0.9 }] },
      { gaps: [{ a: 170 }], thorns: [{ a: -50, n: 2 }] },
      { gaps: [{ a: 160, len: 0.9, shut: { period: 4, open: 0.4, phase: 0 } }], thorns: [{ a: -140, n: 2 }, { a: 120, n: 1 }], pads: [{ a: -90, len: 1.2 }] },
    ],
    solve: [['beat', 0, 4, 0], [0, 3, 120, 5], [0, 2, 120, 0.3], ['wait', 2], [0, 0, -240, 1], ['wait', 30]], // starts on the door's beat
    fails: [[['wait', 20]], [[0, 3, -110], [0, 2, -100], ['wait', 2], [0, 0, -120], ['wait', 30]], [[0, 3, 120], [0, 2, 120], ['wait', 2], [0, 0, 120], ['wait', 30]]], // idle; the first vault's turns; the 0.8.17 clear
  },
];
export const wonderByKey = (k) => WONDER_LEVELS.find((L) => L.key === k || String(L.id) === String(k)) || null;
