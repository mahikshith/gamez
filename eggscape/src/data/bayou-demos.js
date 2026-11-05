// Dev / test-build studio vaults for the Gator Bayou cast (sim/bayou.js). Not campaign levels. ?demo=gator (or the Lab page).
// Spec fields: gator {ch, a, delay, face, size, call}, turtle {ch, a, delay, face}, mosquito {ch, a, delay} (each also an array),
// bossFight {kind: 'gator', hp, a, delay, phases: [{attacks: ['sweep' | 'roll'], every, summon}]} with boss: 'gator'.
const base = { eggs: 3, target: 2, time: 120, spacing: 1.0, material: 'wood', theme: 'bayou', nest: { w: 2.6 } };
export const BAYOU_DEMOS = [
  {
    ...base, id: 981, kind: 'gator', name: 'Gator: Log Bridge', seed: 9811,
    tip: 'The sleeping gator is a bridge over a gap. When its jaws open under a gap, turn that gap away.',
    gator: { ch: 3, a: -80, delay: 2 }, orbs: [{ type: 'pepper', ch: 2, a: -130 }],
    rings: [{ gaps: [{ a: -90 }] }, { gaps: [{ a: -60 }, { a: 120 }] }, { gaps: [{ a: -110 }, { a: 40 }] }, { gaps: [{ a: -80 }, { a: 150 }] }, { gaps: [{ a: -40 }] }],
  },
  {
    ...base, id: 982, kind: 'turtle', name: 'Turtle: Snap Shell', seed: 9822,
    tip: 'The snapping turtle holds an egg: safe, but stuck. Drop another egg on its shell to flip it.',
    turtle: { ch: 2, a: -60, delay: 2 }, orbs: [{ type: 'rockskin', ch: 1, a: -120 }],
    rings: [{ gaps: [{ a: -90 }] }, { gaps: [{ a: -70 }, { a: 100 }] }, { gaps: [{ a: -120 }, { a: 50 }] }, { gaps: [{ a: -60 }] }, { gaps: [{ a: -100 }] }],
  },
  {
    ...base, id: 983, kind: 'mosquito', name: 'Mosquitoes: Lift Off', seed: 9833,
    tip: 'Mosquitoes latch onto an egg and lift it up. A flame or pepper scatters them.',
    mosquito: { ch: 2, a: -110, delay: 1 }, orbs: [{ type: 'fire_red', ch: 1, a: -60 }, { type: 'pepper', ch: 3, a: -120 }],
    rings: [{ gaps: [{ a: -90 }] }, { gaps: [{ a: -50 }], thorns: [{ a: -100, n: 2 }] }, { gaps: [{ a: -130 }, { a: 60 }] }, { gaps: [{ a: -70 }] }, { gaps: [{ a: -110 }] }],
  },
  {
    ...base, id: 984, kind: 'grandpa', name: 'Grandpa Gator', seed: 9844, boss: 'gator',
    tip: 'After each attack he lies dizzy: drop an egg on him, or hit him with pepper or the laser.',
    bossFight: { kind: 'gator', delay: 3, hp: 3, a: -60, phases: [{ attacks: ['sweep'], every: 5 }, { at: { saved: 1, t: 30 }, attacks: ['roll', 'sweep'], every: 5 }, { at: { saved: 2, t: 60 }, attacks: ['roll', 'sweep'], every: 4.5, summon: true }] },
    gator: [{ ch: 3, a: -120, call: 1 }], orbs: [{ type: 'pepper', ch: 2, a: -60 }, { type: 'laser', ch: 3, a: -130 }],
    rings: [{ gaps: [{ a: -90 }] }, { gaps: [{ a: -60 }, { a: 120 }] }, { gaps: [{ a: -110 }, { a: 40 }] }, { gaps: [{ a: -80 }, { a: 150 }] }, { gaps: [{ a: -50 }, { a: -130 }] }, { gaps: [{ a: -100 }] }],
  },
];
