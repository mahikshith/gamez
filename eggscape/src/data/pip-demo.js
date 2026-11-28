// The practice vault for Pip the penguin (0.8.17; the campaign meets him on level 16). Not a campaign level.
// Start it from Practice (Creatures: Pip) or, in the --dev build, with ?demo=penguin (__egg.startDemo('penguin')).
// Spec: penguin { ch, a, delay } (sim/pip.js). His channel has a gap to line up, a thorn to keep him off, a sponge pad
// that stops him with a boing, and a stone orb (a stone egg is too heavy to carry) and a frost orb (he loves frost).
export const PIP_DEMO = {
  id: 985, kind: 'penguin', theme: 'frozen', name: 'Pip the Penguin', eggs: 3, target: 2, time: 120, spacing: 1.05, material: 'stone', nest: { w: 2.8 }, seed: 9855, world: 3,
  tip: 'Pip shoves eggs like curling stones. Turn a gap in front of him: wheee! Walls and sponge pads stop him.',
  penguin: { ch: 2, a: -135, delay: 2 },
  orbs: [{ type: 'stone', ch: 1, a: -60 }, { type: 'frost', ch: 2, a: -40 }],
  rings: [
    { gaps: [{ a: -40 }] },
    { mat: 'ice', gaps: [{ a: 150 }, { a: 25 }], pads: [{ a: -110, len: 1.1 }] },
    { mat: 'ice', gaps: [{ a: -20 }, { a: 160 }], thorns: [{ a: -160, n: 2 }], pads: [{ a: 70, len: 1.2 }] },
    { mat: 'ice', gaps: [{ a: 100 }] },
  ],
};
