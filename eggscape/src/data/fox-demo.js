// Dev-only studio levels for the den fox (v3.5): copies of L5 "Fox Raid" and L35 "The Fox King" with the boss inside
// the vault. Not part of the campaign. Start them in the --dev build with ?demo=foxden / ?demo=foxkingden or
// __egg.startDemo('foxden').
// What changes against the campaign level (the proposed spec change):
//   bossFight.den {a, hp}   the fox lives in the outermost channel (its den run); den.a = its den on the outer ring
//                           (deg, ring-local), hp = hits to drive it off
//   rings[n-1].gapTo 1.55   the den run is wider so the fox stands in it
//   rings[n-2].gapTo 1.25   the channel it pounces into is wider too
//   rings[n-2] gaps         one plain gap it fits through (len 0.95) beside the thorn curtain, which it can't pass
//   phases                  phase 1 is the fox alone (prowl, pounce); the throws come back in phases 2 and 3
export const FOX_DEMOS = [
  {
    id: 905, kind: 'foxden', theme: 'farm', name: 'Fox Raid (den)', eggs: 3, target: 2, time: 110, spacing: 1, material: 'wood', boss: 'fox', seed: 39599, world: 1,
    bossFight: { kind: 'fox', delay: 3, den: { a: 30, hp: 3 }, throws: ['thorn', 'foxcurse'], phases: [
      { attacks: [], every: 6 }, { at: { saved: 1, t: 40 }, attacks: ['throw'], every: 7 }, { at: { saved: 2, t: 75 }, attacks: ['throw2'], every: 6 }] },
    nest: { w: 2.8 }, bonus: { kind: 'prize' },
    tip: 'Turn the ring under the fox when it pounces in: trapped, it drops the egg. Then hit it.',
    intro: { title: 'Boss: Fox Raid', line: 'The fox prowls the outer ring and pounces through gaps to steal eggs. Turn the gap away to trap him, then hit him.' },
    portals: [{ a: [0, 3.65], b: [0, 3.65], emit: ['fire_red'], every: 7, pull: 0 }],
    orbs: [{ type: 'fire_green', ch: 2, a: -30 }, { type: 'fire_red', ch: 3, a: 89 }],
    rings: [
      { gaps: [{ a: 8 }], thorns: [{ a: 118, n: 1 }], pads: [{ a: 62, len: 1.01 }] },
      { gaps: [{ a: 64, x: 2, shut: { period: 4, open: 0.5, phase: 1.76 } }], thorns: [{ a: 177, n: 3 }, { a: 105, n: 2, side: 'out', h: 0.26 }], pads: [{ a: -95, len: 1.77 }, { a: 1, len: 1.17 }] },
      { gear: 3, gaps: [{ a: 13 }, { a: 94 }], thorns: [{ a: 54, n: 3 }, { a: 163, n: 3, kind: 'blunt' }], pads: [{ a: -89, len: 1.61 }, { a: -142, len: 1.87 }] },
      { gapTo: 1.25, gaps: [{ a: -40, curtain: 1 }, { a: 150, len: 0.95 }], thorns: [{ a: 100, n: 3 }], pads: [{ a: -95, len: 1.1 }, { a: -134, len: 1.1 }] },
      { gapTo: 1.55, gaps: [{ a: 135, x: 3, len: 0.7 }, { a: -145 }], thorns: [{ a: -34, n: 3 }, { a: 172, n: 3 }], pads: [{ a: -94, len: 1.89 }, { a: 55, len: 1.09 }] },
    ],
  },
  {
    id: 906, kind: 'foxkingden', theme: 'vault', name: 'The Fox King (den)', eggs: 3, target: 2, time: 160, spacing: 1, material: 'metal', boss: 'foxking', seed: 277166, world: 7,
    bossFight: { kind: 'foxking', delay: 3, den: { a: -60, hp: 4 }, throws: ['foxcurse', 'thorn'], phases: [
      { attacks: [], every: 6 }, { at: { saved: 1, t: 35 }, attacks: ['throw', 'fog'], every: 6 }, { at: { saved: 2, t: 70 }, attacks: ['throw2', 'fog'], every: 5, summon: true }] },
    nest: { w: 2.7, amp: 1, period: 9, pattern: 'stopgo' }, snake: { delay: 999, speed: 0.38 }, bonus: { kind: 'prize' },
    tip: 'A burning egg is safe from the Fox King, and burns him when he is trapped.',
    intro: { title: 'Boss: The Fox King', line: 'The Fox King hunts inside his vault. Trap him behind a turned ring and hit him; at the end he calls his snake.' },
    portals: [{ a: [0, 3.65], b: [0, 3.65], emit: ['fire_red'], every: 7, pull: 0 }],
    orbs: [{ type: 'hourglass', ch: 1, a: 39 }, { type: 'fire_red', ch: 3, a: -168 }, { type: 'feather', ch: 4, a: -101 }, { type: 'hatch_glow', ch: 1, a: 99 }],
    rings: [
      { gaps: [{ a: -17 }], thorns: [{ a: 153, n: 2 }] },
      { gaps: [{ a: 133, x: 2 }], thorns: [{ a: 84, n: 3 }, { a: 77, n: 2, side: 'out', h: 0.26 }], pads: [{ a: -160, len: 1.6 }] },
      { oneway: 1, gaps: [{ a: 18 }, { a: -168 }], thorns: [{ a: -30, n: 2, side: 'out', h: 0.26 }, { a: 109, n: 2, side: 'out', h: 0.26 }], pads: [{ a: -31, len: 1.34 }] },
      { gaps: [{ a: 104, curtain: 1 }], thorns: [{ a: 3, n: 2 }], pads: [{ a: -109, len: 1.32 }] },
      { gapTo: 1.25, gaps: [{ a: 152, x: 3, len: 0.7 }, { a: -6, len: 0.95 }], thorns: [{ a: 110, n: 3 }, { a: -144, n: 3 }], pads: [{ a: 62, len: 1.6 }] },
      { gapTo: 1.55, gaps: [{ a: -141 }, { a: 111 }], thorns: [{ a: 46, n: 2 }, { a: 180, n: 1, kind: 'blunt' }], pads: [{ a: 158, len: 1.5 }] },
    ],
  },
];
