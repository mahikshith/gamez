// Dev / test-build studio levels for Coral Reef (world 8): underwater vaults (water: true, eggs float up to the hen's
// boat) with the hermit crab, the pufferfish, the jellyfish and the King Crab. Not campaign levels. Start one in the
// --dev build with __egg.startDemo('hermit') or from the Lab page "Coral Reef". tools/reef-strips.cjs films the cast.
const base = { theme: 'reef', material: 'coral', spacing: 1.05, nest: { w: 2.6 }, eggs: 3, target: 2, time: 120, water: true, world: 8 };
const rings = (outer) => [{ gaps: [{ a: -90 }] }, { gaps: [{ a: 60 }] }, { gaps: [{ a: 130 }], thorns: [{ a: 20, n: 2 }] }, { gaps: outer || [{ a: 40 }] }];

export const REEF_DEMOS = [
  {
    ...base, id: 941, kind: 'hermit', name: 'Hermit Crab', seed: 9411, hermit: { ch: 3, a: 120, delay: 2 },
    tip: 'Bump an egg into the crab and it flips over, or turn a gap to it and the egg floats out.',
    intro: { title: 'Hermit crab', line: 'It tucks an egg in its shell: safe from thorns, but it walks off with it.' },
    rings: rings(),
  },
  {
    ...base, id: 942, kind: 'puffer', name: 'Pufferfish', seed: 9422, puffer: { ch: 3, a: 150, delay: 1 },
    tip: 'It plugs a gap for a few seconds. A thorn pointing at it, or a zap, pops it.',
    orbs: [{ type: 'thunder', ch: 1, a: 90 }],
    rings: [{ gaps: [{ a: -90 }] }, { gaps: [{ a: 60 }] }, { gaps: [{ a: 130 }], thorns: [{ a: 100, n: 1, side: 'out' }] }, { gaps: [{ a: 115 }] }],
  },
  {
    ...base, id: 943, kind: 'jelly', name: 'Jellyfish', seed: 9433, jelly: { ch: 2, a: 60, delay: 1 },
    tip: 'Its sting cracks eggs. Water washes it away; the live ring stuns it.',
    orbs: [{ type: 'water', ch: 1, a: 90 }, { type: 'shock', ch: 1, a: -90 }],
    rings: rings(),
  },
  {
    ...base, id: 944, kind: 'kingcrab', name: 'King Crab', seed: 9444, boss: 'kingcrab', time: 160, hermit: { ch: 3, a: 160, delay: 8 }, jelly: { ch: 2, a: 0, delay: 3 },
    bossFight: { kind: 'kingcrab', delay: 3, phases: [{ attacks: ['snap', 'bubbles'], every: 5 }, { at: { saved: 1, t: 35 }, attacks: ['snap', 'barnacles', 'whirl'], every: 5 }, { at: { saved: 2, t: 70 }, attacks: ['snap2', 'bubbles', 'silt', 'whirl'], every: 4.5 }] },
    orbs: [{ type: 'warp', ch: 3, a: -90 }, { type: 'frostnova', ch: 1, a: 90 }],
    tip: 'Turn the ring while a claw is inside: it gets stuck. Then bump an egg into the claw.',
    rings: rings([{ a: 75 }, { a: -110 }]),
  },
];
