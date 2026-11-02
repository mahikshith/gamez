// Dev-only studio level for the frog (v3.3 M8). Not part of the campaign. Start it in the --dev build with
// __egg.startFrog(). Two frogs: one plugs a gap of ring 2 (turn that ring and it rides along: a soft floor for
// the eggs, until it hops away), one roams channel 3 next to a red flame orb and a water orb it will lick.
// Spec: frog {ch, a, delay, every, face} (or an array). ch = channel it sits in, a = start angle (deg).
export const FROG_DEMO = {
  id: 904, kind: 'frog', theme: 'bramble', name: 'Frog: Soft Floor', eggs: 3, target: 2, time: 120, spacing: 1.05, material: 'vine', nest: { w: 2.6 }, seed: 9044,
  tip: 'The frog plugs a gap and hops through the rings. Eggs bounce softly on it, but it steals orbs and chicks.',
  orbs: [{ type: 'fire_red', ch: 3, a: -70 }, { type: 'water', ch: 1, a: -110 }],
  chickEggs: [{ kind: 'bulk', hatched: true }],
  frog: [{ ch: 2, a: -120, delay: 4, every: 6 }, { ch: 3, a: -80, delay: 2, every: 5, face: -1 }],
  rings: [
    { gaps: [{ a: -90 }] },
    { gaps: [{ a: -60 }, { a: 100 }] },
    { gaps: [{ a: -120 }, { a: 60 }] },
    { gaps: [{ a: -80 }, { a: 150 }] },
    { gaps: [{ a: -100 }] },
  ],
};
