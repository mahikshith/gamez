// Dev-only studio vaults for the v3.4 powers (sim/powers2.js): one per power and one per combo, each with the creatures
// and the obstacles that show the power's upside and its downside. Not campaign levels (levels are placed later).
// Start one in the --dev build with ?demo=frostnova (or __egg.startDemo('combo_shatter')).
// Spec fields to place a power in a level: an orb { type: 'frostnova' | 'shock' | 'thunderclap' | 'laser' | 'spin' |
// 'pepper' | 'shrink' | 'iron' | 'decoy', ch, a } in level.orbs (or a portal's emit list, or the fox's throws).
const base = { eggs: 3, target: 2, time: 90, spacing: 1.05, material: 'wood', nest: { w: 2.6 } };
const orb = (type, ch = 1, a = -90) => ({ type, ch, a });

export const POWER_DEMOS = [
  {
    ...base, id: 951, kind: 'frostnova', theme: 'orchard', material: 'wood', name: 'Frost nova', seed: 9511,
    tip: 'Grab the frost nova: the snake freezes, the thorns turn brittle. Mind the icy rings after!',
    snake: { delay: 1, speed: 0.45, a: -30 }, orbs: [orb('frostnova')],
    rings: [{ gaps: [{ a: -100 }] }, { gaps: [{ a: 150 }], thorns: [{ a: -20, n: 3 }, { a: 110, n: 2 }] }, { gaps: [{ a: 20 }], thorns: [{ a: -120, n: 2 }] }, { gaps: [{ a: -70 }] }],
  },
  {
    ...base, id: 952, kind: 'shock', theme: 'volcano', material: 'obsidian', name: 'Shock ring', seed: 9522,
    tip: 'The shock ring zaps the snake and the salamander off it. Your eggs bounce off it too.',
    snake: { delay: 2, speed: 0.4, a: 40 }, salamander: { delay: 1, ch: 2, a: -40 }, orbs: [orb('shock')],
    rings: [{ gaps: [{ a: -100 }] }, { gaps: [{ a: 160 }] }, { gaps: [{ a: 30 }] }, { gaps: [{ a: -60 }] }],
  },
  {
    ...base, id: 953, kind: 'thunderclap', theme: 'storm', material: 'metal', name: 'Thunderclap', seed: 9533,
    tip: 'Thunderclap stuns every creature, but the door and the portal lose power while it lasts.',
    snake: { delay: 1, speed: 0.45, a: 60 }, eagle: { delay: 2, every: 7 }, orbs: [orb('thunderclap')],
    portals: [{ a: [-1.2, -1.45], b: [1.5, -2.6] }],
    rings: [{ gaps: [{ a: -100 }] }, { gaps: [{ a: 140, shut: { period: 6, open: 0.5 } }] }, { gaps: [{ a: -40, x: 2 }] }, { gaps: [{ a: 90 }] }],
  },
  {
    ...base, id: 954, kind: 'laser', theme: 'farm', name: 'Laser beak', seed: 9544,
    tip: 'Tap anywhere to fire the beak: it cuts thorns, walls and curtains in a line. It burns sponge too.',
    snake: { delay: 1, speed: 0.4, a: 60 }, orbs: [orb('laser')], barriers: [{ ring: 2, a: -30 }],
    rings: [{ gaps: [{ a: -100 }] }, { gaps: [{ a: -30, curtain: 1 }, { a: 150 }], thorns: [{ a: -60, n: 3 }], pads: [{ a: -110, len: 1.2 }] }, { gaps: [{ a: 20 }], thorns: [{ a: -80, n: 2 }], pads: [{ a: -140, len: 1.3 }] }, { gaps: [{ a: -70 }] }],
  },
  {
    ...base, id: 955, kind: 'spin', theme: 'storm', name: 'Spin storm', seed: 9555,
    tip: 'The spin storm flings creatures out to the rim. Your eggs tumble with it, so watch the thorns.',
    snake: [{ delay: 1, speed: 0.45, a: 0 }, { delay: 2, speed: 0.45, a: 180 }], orbs: [orb('spin')],
    rings: [{ gaps: [{ a: -100 }] }, { gaps: [{ a: 150 }], thorns: [{ a: -40, n: 2 }, { a: -150, n: 2 }] }, { gaps: [{ a: 20 }] }, { gaps: [{ a: -70 }] }],
  },
  {
    ...base, id: 956, kind: 'pepper', theme: 'bramble', material: 'vine', name: 'Pepper puff', seed: 9566,
    tip: 'Pepper! Snakes and the eagle sneeze and run off. The smoke hides the board for a moment.',
    snake: { delay: 1, speed: 0.45, a: -20 }, eagle: { delay: 3, every: 7 }, orbs: [orb('pepper')],
    rings: [{ gaps: [{ a: -100 }] }, { gaps: [{ a: 150 }] }, { gaps: [{ a: 20 }] }, { gaps: [{ a: -70 }] }],
  },
  {
    ...base, id: 957, kind: 'shrink', theme: 'crystal', material: 'glass', name: 'Shrink ray', seed: 9577,
    tip: 'Tiny eggs fit the grates and the snake loses track of them. They crack more easily.',
    snake: { delay: 1, speed: 0.45, a: 40 }, orbs: [orb('shrink')],
    rings: [{ gaps: [{ a: -100 }] }, { gaps: [{ a: -60, grate: 1 }, { a: 120, grate: 1 }] }, { gaps: [{ a: -120, grate: 1 }, { a: 60 }] }, { gaps: [{ a: -70 }] }],
  },
  {
    ...base, id: 958, kind: 'iron', theme: 'vault', material: 'stone', name: 'Iron shell', seed: 9588,
    tip: 'Iron eggs smash thorns and the snake can’t bite. Too heavy for narrow gaps; they sink through sponge.',
    snake: { delay: 2, speed: 0.4, a: 30 }, orbs: [orb('iron')],
    rings: [{ gaps: [{ a: -100 }] }, { gaps: [{ a: -40, len: 0.7 }, { a: 160 }], thorns: [{ a: -120, n: 3 }], pads: [{ a: -80, len: 1.0 }] }, { gaps: [{ a: 20 }], pads: [{ a: -90, len: 1.4 }] }, { gaps: [{ a: -70 }] }],
  },
  {
    ...base, id: 959, kind: 'decoy', theme: 'jungle', name: 'Decoy egg', seed: 9599,
    tip: 'The snake and the eagle go for the decoy. It is big: don’t let it plug your gap.',
    snake: { delay: 1, speed: 0.5, a: 20 }, eagle: { delay: 3, every: 6 }, orbs: [orb('decoy')],
    rings: [{ gaps: [{ a: -100 }] }, { gaps: [{ a: 150 }] }, { gaps: [{ a: 20 }] }, { gaps: [{ a: -70 }] }],
  },
  // combos: the two orbs sit side by side, so one egg takes both
  {
    ...base, id: 961, kind: 'combo_shatter', theme: 'blizzard', material: 'wood', name: 'Combo: Shatter', seed: 9611,
    tip: 'Frost nova, then the shock ring: frozen creatures are knocked out of the vault.',
    snake: [{ delay: 1, speed: 0.45, a: -30 }, { delay: 1.5, speed: 0.45, a: 150 }], orbs: [orb('frostnova', 1, -100), orb('shock', 1, -80)],
    rings: [{ gaps: [{ a: -100 }] }, { gaps: [{ a: 150 }] }, { gaps: [{ a: 20 }] }, { gaps: [{ a: -70 }] }],
  },
  {
    ...base, id: 962, kind: 'combo_sweep', theme: 'farm', name: 'Combo: Sweep beam', seed: 9622,
    tip: 'Laser beak and spin storm together: the beam sweeps a full circle.',
    orbs: [orb('laser', 1, -100), orb('spin', 1, -80)], barriers: [{ ring: 2, a: 60 }],
    rings: [{ gaps: [{ a: -100 }] }, { gaps: [{ a: 150 }], thorns: [{ a: -40, n: 2 }, { a: 60, n: 3 }], pads: [{ a: -140, len: 1.0 }] }, { gaps: [{ a: 20, curtain: 1 }], thorns: [{ a: -100, n: 2 }, { a: 170, n: 2 }] }, { gaps: [{ a: -70 }] }],
  },
  {
    ...base, id: 963, kind: 'combo_cannon', theme: 'crystal', material: 'glass', name: 'Combo: Cannonballs', seed: 9633,
    tip: 'Shrink ray plus iron shell: tiny cannonballs smash thorns, barriers and glass and slip through grates.',
    snake: { delay: 2, speed: 0.4, a: 60 }, orbs: [orb('shrink', 1, -100), orb('iron', 1, -80)], barriers: [{ ring: 2, a: -60 }],
    rings: [{ gaps: [{ a: -100 }] }, { gaps: [{ a: -40, grate: 1 }, { a: 140 }], thorns: [{ a: -120, n: 3 }] }, { gaps: [{ a: 20, grate: 1 }] }, { gaps: [{ a: -70 }] }],
  },
  {
    ...base, id: 964, kind: 'combo_twister', theme: 'bramble', material: 'vine', name: 'Combo: Pepper twister', seed: 9644,
    tip: 'Pepper and the spin storm: the smoke blows away and every creature is sneezed out to the rim.',
    snake: [{ delay: 1, speed: 0.45, a: 0 }, { delay: 1.5, speed: 0.45, a: 180 }], orbs: [orb('pepper', 1, -100), orb('spin', 1, -80)],
    rings: [{ gaps: [{ a: -100 }] }, { gaps: [{ a: 150 }] }, { gaps: [{ a: 20 }] }, { gaps: [{ a: -70 }] }],
  },
  {
    ...base, id: 965, kind: 'combo_magnet', theme: 'storm', material: 'metal', name: 'Combo: Electromagnet', seed: 9655,
    tip: 'Shock ring and iron shell: iron eggs stick to the live ring. Turn it to carry them round.',
    orbs: [orb('iron', 1, -100), orb('shock', 1, -80)],
    rings: [{ gaps: [{ a: -100 }] }, { gaps: [{ a: 90 }] }, { gaps: [{ a: -90 }] }, { gaps: [{ a: 90 }] }],
  },
  {
    ...base, id: 966, kind: 'combo_stink', theme: 'jungle', name: 'Combo: Pepper decoy', seed: 9666,
    tip: 'Decoy plus pepper: whatever bites the decoy, and all around it, flee for far longer.',
    snake: [{ delay: 1, speed: 0.5, a: 20 }, { delay: 2, speed: 0.5, a: 160 }], orbs: [orb('decoy', 1, -100), orb('pepper', 1, -80)],
    rings: [{ gaps: [{ a: -100 }] }, { gaps: [{ a: 150 }] }, { gaps: [{ a: 20 }] }, { gaps: [{ a: -70 }] }],
  },
];
