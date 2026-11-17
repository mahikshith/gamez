// Dev-only studio levels for the egg thieves (v3.6). Not part of the campaign. Start them in the --dev build with
// ?demo=weasel / ?demo=rats / ?demo=weaselboss / ?demo=ratking or __egg.startDemo('rats').
// Level fields (sim/thieves.js): weasel {a, delay, ch}, rats {a, n, delay, ch}, bossFight {kind: 'weasel' | 'ratking',
// den: {a, hp}}. All at normal ring spacing.
const rings = [
  { gaps: [{ a: -60 }], thorns: [{ a: 120, n: 1 }] },
  { gaps: [{ a: 20 }], thorns: [{ a: 160, n: 2 }] },
  { gaps: [{ a: -80 }, { a: 140 }], thorns: [{ a: 40, n: 2 }] },
  { gaps: [{ a: -150 }, { a: 10 }], thorns: [{ a: 100, n: 2 }] },
];
const base = { theme: 'farm', eggs: 3, target: 2, time: 120, spacing: 1, material: 'wood', nest: { w: 2.8 }, seed: 4242, world: 1, rings };
export const THIEF_DEMOS = [
  { ...base, id: 911, kind: 'weasel', name: 'Weasel', tip: 'Turn the ring while it crouches and it bonks off. Turn the gap away while it is inside to trap it.', weasel: { a: 60, delay: 1.5 } },
  { ...base, id: 912, kind: 'rats', name: 'Rats', tip: 'Turn a gap under a rolling egg and it drops through. Water or a glow flash sends them home.', theme: 'vault', material: 'metal', world: 7, rats: { a: 50, n: 2, delay: 1.5 } },
  {
    ...base, id: 913, kind: 'weaselboss', name: 'Weasel Raid (studio)', boss: 'weasel',
    bossFight: { kind: 'weasel', delay: 2, den: { a: 40, hp: 3 }, throws: ['thorn', 'curse'], phases: [{ attacks: [], every: 6 }, { at: { saved: 1, t: 40 }, attacks: ['throw'], every: 7 }, { at: { saved: 2, t: 75 }, attacks: ['throw2'], every: 6 }] },
  },
  {
    ...base, id: 914, kind: 'ratking', name: 'The Rat King (studio)', theme: 'vault', material: 'metal', world: 7, boss: 'ratking', rats: { n: 2, delay: 4 },
    bossFight: { kind: 'ratking', delay: 2, den: { a: -50, hp: 4 }, throws: ['curse', 'thorn'], phases: [{ attacks: [], every: 6 }, { at: { saved: 1, t: 35 }, attacks: ['throw', 'fog'], every: 6 }] },
  },
];
