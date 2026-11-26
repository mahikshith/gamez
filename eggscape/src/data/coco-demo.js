// The practice vault for Coco the monkey (0.8.17; the campaign meets him on level 10). Not a campaign level.
// Start it from Practice (Creatures: Coco) or, in the --dev build, with ?demo=monkey (__egg.startDemo('monkey')).
// Spec: monkey { ch, a, delay } (sim/coco.js). He rides ring 1 over channel 2: flick that ring and he flies off. A red flame
// burns his banana peel; rock skin makes every egg too heavy to snatch or to slip.
export const COCO_DEMO = {
  id: 987, kind: 'monkey', theme: 'jungle', name: 'Coco the Monkey', eggs: 3, target: 2, time: 120, spacing: 1.0, material: 'wood', nest: { w: 2.8 }, seed: 9877, world: 2,
  tip: 'Coco grabs eggs with his tail. Flick his ring hard: he flies off and drops it.',
  monkey: { ch: 2, a: -100, delay: 2 },
  orbs: [{ type: 'fire_red', ch: 1, a: -60 }, { type: 'rockskin', ch: 2, a: -20 }],
  rings: [
    { gaps: [{ a: -60 }] },
    { gaps: [{ a: 150 }, { a: 20 }] },
    { gaps: [{ a: -20 }, { a: 160 }], thorns: [{ a: 120, n: 2, kind: 'blunt' }] },
    { gaps: [{ a: 100 }] },
  ],
};
