// Studio levels for the farm allies (v3.4). Dev only: window.__egg.startAllyDemo('rooster' | 'goose'), then
// __egg.callAlly('rooster') (or 'goose', optionally {target: 'snake' | 'eagle' | 'fox'}). Not part of the campaign.
const base = { id: 991, theme: 'farm', eggs: 3, target: 2, time: 0, spacing: 1.05, material: 'wood', nest: { w: 2.6 }, seed: 91, tip: 'Dev: __egg.callAlly("rooster") or ("goose")' };
const rings = [{ gaps: [{ a: 90 }] }, { gaps: [{ a: 90 }] }, { gaps: [{ a: 60 }] }, { gaps: [{ a: 0 }] }];
const boss = { kind: 'fox', delay: 4, throws: ['thorn'], phases: [{ attacks: ['throw'], every: 5 }, { at: { saved: 1, t: 30 }, attacks: ['throw2'], every: 4.5 }] };

export const ALLY_DEMOS = [
  // the rooster stuns the snake and the boss, and skips the boss's next throw
  { ...base, kind: 'rooster', name: 'Rooster', allies: ['rooster'], snake: { delay: 0.5, speed: 0.5, a: 20 }, bossFight: boss, rings },
  // the goose knocks the snake (or the eagle, or the fox thrower) out of the vault; it bumps eggs in the outer channel
  { ...base, id: 992, kind: 'goose', name: 'Goose', allies: ['goose'], snake: { delay: 0.5, speed: 0.5, a: 20 }, fox: { every: 8, delay: 2 }, eagle: { delay: 8, every: 10 }, rings },
];
