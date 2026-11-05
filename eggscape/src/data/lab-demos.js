// Dev-only studio vaults for the Shape Lab (v4): the clockwork cast (sim/clockwork.js) and the Clockwork Owl (sim/owl.js).
// Not campaign levels. Start one in the --dev build with ?demo=spider (or __egg.startDemo('owl')).
// Spec fields: spider { ring, delay, every } | beetle { ch, a, delay, dir } | jack [{ ch, a }] | bossFight { kind: 'owl', ... }.
const base = { eggs: 3, target: 2, time: 120, spacing: 1.05, material: 'metal', theme: 'lab', nest: { w: 2.6 } };
export const LAB_DEMOS = [
  {
    ...base, id: 981, kind: 'spider', name: 'Clockwork spider', seed: 9811, shape: 'square',
    tip: 'The spider winds down and webs a gap shut. The web catches eggs softly; fire, iron or the laser tears it.',
    spider: { ring: 1, delay: 2 }, orbs: [{ type: 'iron', ch: 1, a: 120 }],
    rings: [{ gaps: [{ a: -100 }] }, { gaps: [{ a: -50 }, { a: 140 }], thorns: [{ a: 40, n: 2 }] }, { gaps: [{ a: 20 }] }, { gaps: [{ a: -70 }] }],
  },
  {
    ...base, id: 982, kind: 'beetle', name: 'Wind-up beetle', seed: 9822, shape: 'hex',
    tip: 'The beetle shoves eggs along until its key runs down. Stopped, it is a wall. Turn its ring to wind it up again.',
    beetle: { ch: 1, a: -150, delay: 1.5 },
    rings: [{ gaps: [{ a: -100 }] }, { gaps: [{ a: 30 }], thorns: [{ a: -40, n: 2 }] }, { gaps: [{ a: 150 }] }, { gaps: [{ a: -70 }] }],
  },
  {
    ...base, id: 983, kind: 'jack', name: 'Spring jack', seed: 9833, shape: 'square',
    tip: 'Roll an egg over the jack and it bounces back up. Time it to jump a gap. An iron egg jams it shut.',
    jack: [{ ch: 1, a: -120 }], orbs: [{ type: 'iron', ch: 1, a: 60 }],
    rings: [{ gaps: [{ a: -100 }] }, { gaps: [{ a: -40 }] }, { gaps: [{ a: 150 }] }, { gaps: [{ a: -70 }] }],
  },
  {
    ...base, id: 984, kind: 'owl', name: 'The Clockwork Owl', seed: 9844, shape: 'hex', boss: 'owl',
    tip: 'Turn the outer gap away when the owl marks an egg. An iron egg in its talons jams its gears.',
    bossFight: { kind: 'owl', delay: 2, phases: [{ attacks: ['swoop', 'gears', 'wind'], every: 3.5 }] },
    orbs: [{ type: 'iron', ch: 1, a: -90 }, { type: 'thunderclap', ch: 2, a: 90 }],
    rings: [{ gaps: [{ a: -100 }] }, { gaps: [{ a: 150 }] }, { gaps: [{ a: 20 }], thorns: [{ a: -120, n: 2 }] }, { gaps: [{ a: -70 }, { a: 110 }] }],
  },
];
