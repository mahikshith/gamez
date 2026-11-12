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
    id: 902, key: 'plan', name: 'Plan and Hatch', theme: 'clock', material: 'metal', eggs: 3, target: 2, time: 0, r0: 1.3, spacing: 1.0, seed: 21, nest: { w: 2.6 },
    pitch: 'Think first, then watch', tip: 'Time is frozen. Set every ring, then press HATCH and watch it play out.',
    wonder: { kind: 'plan', par: [3, 7], eggs: [{ ch: 0, a: 196 }, { ch: 0, a: 224 }, { ch: 0, a: 252 }] },
    portals: [{ a: [-2.35, -1.75], b: [2.9, -2.3] }],
    rings: [
      { gaps: [{ a: -40, len: 0.9 }] },
      { gear: 2, gaps: [{ a: 160, len: 1.05 }], thorns: [{ a: -60, n: 2 }] },
      { gaps: [{ a: 30, len: 1.05 }], thorns: [{ a: -110, n: 2 }] },
      { gaps: [{ a: 100, len: 0.95 }], thorns: [{ a: 125, n: 2 }] },
    ],
    solve: [['set', 0, 320], ['set', 1, 115], ['set', 3, 170], ['hatch']],
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
          { gaps: [{ a: 90 }], thorns: [{ a: -45, n: 2 }] },
          { gaps: [{ a: 0, len: 0.9 }], thorns: [{ a: -135, n: 2 }] },
        ] },
        { eggs: 2, target: 1, r0: 1.05, spacing: 1.0, material: 'wood', seed: 4, nest: { w: 2.4 }, rings: [
          { gaps: [{ a: 180 }], thorns: [{ a: 30, n: 2 }] },
          { gaps: [{ a: 90 }], thorns: [{ a: -135, n: 2 }] },
          { gaps: [{ a: 0, len: 0.9 }], thorns: [{ a: 120, n: 2 }] },
        ] },
      ],
    },
    rings: [],
    solve: [[0, 0, -90], [0, 1, 195], [0, 2, -90, 2.5], [0, 2, 180, 3]],
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
