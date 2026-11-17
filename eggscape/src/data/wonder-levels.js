// Wonder Vaults: the bonus world. Five vaults, each on one new mechanic (sim/wonder.js). Not part of the campaign:
// own ids (901..905), own save keys (save.wonder), no coins.
// Angles in degrees. Ring specs are the core sim's (gaps, thorns, pads, gear); level.wonder carries the mechanic.
// `solve` is the scripted clear that tools/wonder-check.mjs replays: [vault, ring, degrees] turns, ['wait', s],
// ['hen', angle] (mama), ['set', ring, degrees] + ['hatch'] (plan).

export const WONDER_LEVELS = [
  {
    id: 901, key: 'planet', name: 'Planet Nest', theme: 'crystal', material: 'stone', eggs: 3, target: 2, time: 80, r0: 1.8, spacing: 0.95, seed: 11,
    pitch: 'Gravity turned inside out', tip: 'Every egg falls toward mama. Bring a gap under an egg to let it down.',
    wonder: { kind: 'planet', eggs: [90, 210, 330] },
    rings: [
      { gaps: [{ a: 200, len: 0.86 }], thorns: [{ a: 20, n: 1, side: 'out' }] },
      { gaps: [{ a: 0, len: 0.86 }], thorns: [{ a: 180, n: 2, side: 'out' }] },
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
    id: 902, key: 'plan', name: 'Plan and Hatch', theme: 'clock', material: 'metal', eggs: 3, target: 2, time: 0, r0: 1.3, spacing: 1.2, seed: 21, nest: { w: 2.4 },
    pitch: 'Think first, then watch', tip: 'Time is frozen. Set every ring, then press HATCH. The middle rings are geared: only the portal gets past the thorns.',
    wonder: { kind: 'plan', par: [3, 7], eggs: [{ ch: 0, a: 185 }, { ch: 0, a: 225 }, { ch: 1, a: 200 }] },
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
    id: 903, key: 'mama', name: "Mama's Call", theme: 'mushroom', material: 'wood', eggs: 2, target: 1, time: 70, r0: 1.05, spacing: 1.0, seed: 5,
    pitch: 'Gravity follows the hen', tip: 'The rings are stuck. Drag mama round the rail: the eggs roll to wherever she calls from.',
    wonder: { kind: 'mama', start: -90 },
    rings: [
      { gaps: [{ a: 90 }], thorns: [{ a: 0, n: 2 }] },
      { gaps: [{ a: -30 }], thorns: [{ a: 25, n: 2 }] },
      { gaps: [{ a: 150, len: 0.9 }], thorns: [{ a: -90, n: 3 }] },
    ],
    solve: [['hen', 90, -1], ['hen', -30, 1], ['hen', 150, 1], ['wait', 5]],
  },
  {
    id: 904, key: 'twin', name: 'Twin Vaults', theme: 'orchard', material: 'wood', time: 90, seed: 3,
    pitch: 'One hand, two worlds', tip: 'The vaults are linked: turn a ring here and its twin turns the other way. Save an egg from each.',
    wonder: {
      kind: 'twin',
      // B's rings 0 and 1 mirror A's (one move drops both); ring 2 does not: free A first, then swing back for B.
      // Freeing B first swings A's thorn through A's eggs.
      vaults: [
        { eggs: 2, target: 1, r0: 1.05, spacing: 1.0, material: 'wood', seed: 3, nest: { w: 2.4 }, rings: [
          { gaps: [{ a: 0 }], thorns: [{ a: 150, n: 2 }] },
          { gaps: [{ a: -150 }], thorns: [{ a: -45, n: 2 }] },
          { gaps: [{ a: 0, len: 0.9 }], thorns: [{ a: -135, n: 2 }] },
        ] },
        { eggs: 2, target: 1, r0: 1.05, spacing: 1.0, material: 'wood', seed: 4, nest: { w: 2.4 }, rings: [
          { gaps: [{ a: 180 }], thorns: [{ a: 30, n: 2 }] },
          { gaps: [{ a: -30 }], thorns: [{ a: -135, n: 2 }] },
          { gaps: [{ a: 0, len: 0.9 }], thorns: [{ a: 120, n: 2 }] },
        ] },
      ],
    },
    rings: [],
    solve: [[0, 0, -90], [0, 1, 60, 1.5], [0, 2, -90, 2.5], [0, 2, 180, 3], [0, 2, 20, 3]],
    fails: [[['wait', 20]], [[0, 0, -90], [0, 1, 60, 1.5], [0, 2, 90, 2.5], [0, 2, -180, 3], [0, 2, -20, 3]]], // idle; B's vault freed first
  },
  {
    id: 905, key: 'hatch', name: 'Hatchlings', theme: 'barn', material: 'wood', eggs: 4, target: 3, time: 75, r0: 1.05, spacing: 1.0, seed: 9, nest: { w: 2.6 },
    pitch: 'The eggs stop being eggs', tip: 'The lamp hatches an egg into a chick. Chicks walk by themselves: you can only move the gaps.',
    wonder: { kind: 'hatch', lamp: { ch: 1, a: -90 }, eggs: [null, null, { ch: 2, a: -96 }, { ch: 2, a: -84 }] },
    rings: [
      { gaps: [{ a: 30 }] },
      { fixed: 1, mat: 'stone', gaps: [{ a: -35, len: 0.9 }] },
      { gaps: [{ a: 10 }], thorns: [{ a: -130, n: 2 }] },
      { gaps: [{ a: 20, len: 0.9 }], thorns: [{ a: -40, n: 2 }], pads: [{ a: -90, len: 1.2 }] },
    ],
    solve: [[0, 3, -110], [0, 2, -100], ['wait', 2], [0, 0, -120], ['wait', 30]],
  },
];
export const wonderByKey = (k) => WONDER_LEVELS.find((L) => L.key === k || String(L.id) === String(k)) || null;
