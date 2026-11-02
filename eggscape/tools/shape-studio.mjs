// Studio levels for the vault shapes prototype (v3.3 M10). Not campaign levels: review and planner checks only.
const base = { id: 990, name: 'Studio', eggs: 1, target: 1, time: 90, material: 'wood', nest: { w: 2.6 }, seed: 31, tip: '', theme: 'farm' };
export const SHAPE_STUDIO = {
  // square: ledges to park on, corners to slide down. Gaps sit at corners and mid-sides; a thorn pair guards a ledge
  square: { ...base, shape: 'square', rings: [
    { gaps: [{ a: 45 }] },
    { gaps: [{ a: 135 }], thorns: [{ a: -90, n: 2, spread: 9 }], pads: [{ a: 0, len: 1.4 }] },
    { gaps: [{ a: 90 }] },
  ] },
  // hex: six short ledges, steeper slopes between them, so an egg runs further per turn
  hex: { ...base, shape: 'hex', theme: 'crystal', material: 'stone', rings: [
    { gaps: [{ a: 90 }] },
    { gaps: [{ a: -30 }], thorns: [{ a: 150, n: 2, spread: 8 }] },
    { gaps: [{ a: 30 }], pads: [{ a: 90, len: 1.2 }] },
    { gaps: [{ a: 150 }] },
  ] },
  // rocking square vault: every few seconds the vault leans 25 deg and back; parked eggs slide to a corner
  rock: { ...base, shape: 'square', rock: {}, theme: 'dunes', material: 'stone', rings: [
    { gaps: [{ a: 90 }] },
    { gaps: [{ a: -45 }, { a: 135 }], thorns: [{ a: 45, n: 2, spread: 9 }] },
    { gaps: [{ a: 90 }] },
  ] },
  // spiral: ring 1 is a one-turn ramp; its seam is the way through (an egg rolls round it and down the step)
  spiral: { ...base, theme: 'orchard', rings: [
    { gaps: [{ a: 90 }] },
    { shape: 'spiral', thorns: [{ a: 200, n: 2, spread: 8 }] },
    { gaps: [{ a: 60 }], pads: [{ a: -90, len: 1.2 }] },
  ] },
};
