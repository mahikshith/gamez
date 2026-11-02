// Dev-only studio levels for the sea creatures (v3.3 M8, Coral Reef). Not campaign levels. Start one in the --dev
// build with ?demo=octopus (or __egg.startDemo('fish')). tools/sea-strips.cjs films them.
// Spec fields: octopus {ch, a, delay} and fish {ch, n, speed, a, dir, turn} (one, or an array), see sim/sea.js.
const base = { theme: 'reef', material: 'coral', spacing: 1.05, nest: { w: 2.6 }, eggs: 3, target: 2, time: 100 };

export const SEA_DEMOS = [
  {
    ...base, id: 911, kind: 'octopus', name: 'Octopus: Ink and Go', seed: 9111,
    octopus: { ch: 2, a: -60, delay: 2 },
    orbs: [{ type: 'water', ch: 1, a: 150 }, { type: 'thunder', ch: 1, a: 30 }],
    tip: 'The octopus grabs an egg and carries it off. Hit it with water or a zap and it lets go.',
    intro: { title: 'Octopus', line: 'It holds an egg safe from thorns and snakes, but it walks off with it. Water, a zap or a glow flash makes it let go.' },
    rings: [
      { gaps: [{ a: -90 }] },
      { gaps: [{ a: 100 }] },
      { gaps: [{ a: 170 }], thorns: [{ a: -110, n: 3 }] },
      { gaps: [{ a: -30 }] },
    ],
  },
  {
    ...base, id: 912, kind: 'fish', name: 'Fish: Ride the School', seed: 9122,
    fish: { ch: 2, n: 8, speed: 1.1, a: 0, turn: 14 },
    tip: 'The fish push eggs along as they swim past. Drop an egg onto them and they scatter.',
    intro: { title: 'Fish school', line: 'Eggs ride along with the school, past gaps and into thorns too. Drop an egg on them and they scatter for a moment.' },
    rings: [
      { gaps: [{ a: -90 }] },
      { gaps: [{ a: 120 }] },
      { gaps: [{ a: 30 }], thorns: [{ a: -150, n: 2 }] },
      { gaps: [{ a: -60 }] },
    ],
  },
  {
    ...base, id: 913, kind: 'reef', name: 'Reef: Everyone In', seed: 9133, time: 160,
    octopus: { ch: 2, a: 180, delay: 1 },
    fish: { ch: 3, n: 8, speed: 1.0, a: 0, turn: 11 },
    snake: { delay: 4, speed: 0.4, a: 30 },
    eagle: { delay: 5, every: 9 },
    orbs: [{ type: 'water', ch: 2, a: 60 }],
    tip: 'Octopus, fish, a snake and the eagle together.',
    rings: [
      { gaps: [{ a: -90 }] },
      { gaps: [{ a: 100 }] },
      { gaps: [{ a: -150 }], thorns: [{ a: -40, n: 2 }] },
      { gaps: [{ a: 20 }, { a: 200 }] },
    ],
  },
];
