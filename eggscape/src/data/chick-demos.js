// Dev-only demo levels for the chick kinds (v3.2 K5/K6): one per kind, each built so that kind's tap power
// is the way through. Not part of the 35 campaign levels. Start one in the --dev build with ?demo=glow (or
// __egg.startDemo('glow')); tools/planner.mjs --demo checks each is solvable with taps and fails without.
// Level fields as in levels.js, plus chickEggs (per start index: 'dash' pre-tints that egg, {kind, hatched: true}
// starts it as a hatched chick) and ring ice (hard ice that only the pick chick breaks: true for the whole ring,
// or [{a, len}] sections).

export const CHICK_DEMOS = [
  {
    id: 901, kind: 'glow', theme: 'farm', name: 'Glow: Thorn Gate', eggs: 3, target: 2, time: 90, spacing: 1.05, material: 'wood', nest: { w: 2.6 }, seed: 9011,
    tip: 'Tap the glow chick next to the thorns: FLASH! They burn away.',
    intro: { title: 'Glow chick', line: 'The yellow orb hatches a glow chick. Tap it once: a flash burns every thorn near it and stuns snakes.' },
    orbs: [{ type: 'hatch_glow', ch: 1, a: -90 }],
    rings: [
      { gaps: [{ a: -90 }] },
      { gaps: [{ a: 150 }], thorns: [{ a: 133, n: 2 }, { a: 167, n: 2 }] },
      { gaps: [{ a: -60 }] },
    ],
  },
  {
    id: 902, kind: 'dash', theme: 'bramble', name: 'Dash: Snake Run', eggs: 3, target: 2, time: 90, spacing: 1.05, material: 'vine', nest: { w: 2.6 }, seed: 9022,
    snake: { delay: 1, speed: 0.4, a: -20 },
    tip: 'Tap the dash chick when the snake comes: it zooms along the channel and knocks the snake dizzy.',
    intro: { title: 'Dash chick', line: 'The orange chick is fast. Tap it once: it shoots along its channel, bonks snakes dizzy and grabs orbs on the way.' },
    orbs: [{ type: 'hatch_dash', ch: 1, a: -90 }],
    rings: [
      { gaps: [{ a: -90 }] },
      { gaps: [{ a: 120 }] },
      { gaps: [{ a: -80 }] },
    ],
  },
  {
    id: 903, kind: 'swoop', theme: 'orchard', name: 'Swoop: Curtain Rescue', eggs: 3, target: 2, time: 90, spacing: 1.05, material: 'wood', nest: { w: 2.6 }, seed: 9033,
    chickEggs: [{ kind: 'swoop', hatched: true }], eggKinds: ['quail'],
    tip: 'Only the little quail chick fits the grates. Turn the thorn curtain over it and tap it before the door opens: it flies up through.',
    intro: { title: 'Swoop chick', line: 'The blue chick flies. Tap it once: it flies up through the ring above, tearing down a thorn curtain on the way.' },
    rings: [
      { gaps: [{ a: -110, grate: 1 }, { a: 90, shut: { period: 40, open: 0.75, phase: 30 } }] }, // the door opens at 10 s
      { gaps: [{ a: -104, grate: 1 }, { a: -10, curtain: 1 }] },
      { gaps: [{ a: 60 }] },
    ],
  },
  {
    id: 904, kind: 'bulk', theme: 'jungle', name: 'Bulk: Thorn Gate', eggs: 3, target: 2, time: 90, spacing: 1.05, material: 'vine', nest: { w: 2.6 }, seed: 9044,
    chickEggs: [{ kind: 'bulk', hatched: true }], eggKinds: ['quail'],
    tip: 'The little green chick slips through the grate. Tap it: it puffs up big, then turn the thorns into it and they squash.',
    intro: { title: 'Bulk chick', line: 'The green chick puffs up. Tap it once: big and heavy for 5 s, it squashes thorns and snakes bounce off. Too big for gaps!' },
    rings: [
      { gaps: [{ a: -110, grate: 1 }, { a: 90 }] },
      { gaps: [{ a: 160 }], thorns: [{ a: 145, n: 2 }, { a: 175, n: 2 }] },
      { gaps: [{ a: -50 }] },
    ],
  },
  {
    id: 905, kind: 'pick', theme: 'blizzard', name: 'Pick: Ice Floor', eggs: 3, target: 2, time: 90, spacing: 1.05, material: 'wood', nest: { w: 2.6 }, seed: 9055,
    tip: 'Tap the purple chick on the ice: it drills a hole. Turn the hole under the others before it freezes over.',
    intro: { title: 'Pick chick', line: 'The purple chick has a drill beak. Tap it once on an ice ring: the ice shatters into a hole for 6 s.' },
    orbs: [{ type: 'hatch_pick', ch: 1, a: -90 }],
    rings: [
      { gaps: [{ a: -90 }] },
      { gaps: [], ice: true },
      { gaps: [{ a: -70 }] },
    ],
  },
];
