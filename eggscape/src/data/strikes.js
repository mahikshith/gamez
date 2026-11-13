// Chick Strike powers: the table. The rules live in sim/strike.js, the art in render/strike.js.
// Each chick rides on the hen's back while its meter fills; a tap on the HUD button when it is full sends it at a villain.
// Every power has a downside (the game's standing rule).
//   unlock: the level the player first reaches to get it (one-time unlock card)
//   t / boss: how long the effect holds a creature / a boss (s)
//   col: [body, dark, light, accent] for the chick, the button and the effects
export const STRIKES = [
  { id: 'freeze', name: 'Frost Chick', unlock: 6, t: 6, boss: 4, col: ['#8fd8ff', '#3c86c4', '#e6f8ff', '#ffffff'],
    up: 'Freezes a villain solid for 6 s.', down: 'The two nearest rings ice over: eggs slide.' },
  { id: 'thunder', name: 'Thunder Chick', unlock: 11, t: 3, boss: 3, chain: 2, chainCh: 2, col: ['#ffd23a', '#c98a12', '#fff4a8', '#3d6bff'],
    up: 'A bolt stuns a villain and arcs to two more.', down: 'Eggs near the bolt get a jolt.' },
  { id: 'bomb', name: 'Boom Chick', unlock: 16, t: 8, boss: 2.5, thornR: 1.2, shoveR: 2.4, col: ['#ff6a3c', '#b8361c', '#ffc18a', '#2a1a14'],
    up: 'Blasts a villain out of the vault and clears thorns.', down: 'The shockwave shoves your eggs.' },
  { id: 'decoy', name: 'Decoy Chick', unlock: 21, t: 7, rage: 4, fast: 1.3, col: ['#f2c58c', '#a8713a', '#fff0d8', '#e8402e'],
    up: 'Poses as an egg: hunters chase it for 7 s.', down: 'When they find out, they rush 30% faster for 4 s.' },
  { id: 'tornado', name: 'Twister Chick', unlock: 26, t: 2, boss: 3, spin: Math.PI / 4, col: ['#7fe0c4', '#2f9a86', '#dcfff4', '#ffffff'],
    up: 'A twister drops a villain in the outer channel.', down: 'The nearest ring spins an eighth of a turn.' },
  { id: 'glue', name: 'Sticky Chick', unlock: 31, t: 8, boss: 4, hold: 2, r: 0.5, col: ['#c78cff', '#7a3fc0', '#f0dcff', '#7dff6a'],
    up: 'Glues a villain in place for 8 s.', down: 'An egg that touches the glue is stuck for 2 s.' },
];
export const STRIKE = Object.fromEntries(STRIKES.map((s) => [s.id, s]));
export const STRIKE_IDS = STRIKES.map((s) => s.id);
// charge: the base fill time, and how much longer it gets after each use; boosts per egg saved and per orb
export const CHARGE = { base: 20, grow: 1.5, egg: 0.25, orb: 0.1, easy: 0.5 };
// the strike's flight (sim seconds): the hop off the hen's back, then the arc to the target
export const FLIGHT = { hop: 0.32, fly: 0.55 };
// no strike button before this level (the first five teach the basics)
export const STRIKE_FROM = 6;
