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
  // 2026-11-16 premium chicks (shop only: no level unlocks them; economy.js PREMIUM_CHICKS has the prices). They aim at
  // eggs or at time itself rather than at one villain, which is what makes them worth the coins.
  //   phoenix: carry (s) the flight home to the basket; slow: how much slower its meter fills; once a level
  //   tock: t (s) every villain and hazard stands still; cost (s) taken off the level clock
  //   bubble: t (s) of bubble; fall: the net fall left to a bubbled egg (x g); pop: the shove when it pops
  { id: 'phoenix', name: 'Phoenix Chick', premium: true, carry: 1.05, slow: 2, col: ['#ff7a2a', '#c2361a', '#ffd86a', '#fff3b0'],
    up: 'Swoops on the egg in the most danger and flies it home to the basket.', down: 'Once a level, and its meter fills half as fast.' },
  { id: 'tock', name: 'Tick-Tock Chick', premium: true, t: 5, cost: 10, col: ['#e2ae48', '#8a5a1c', '#fff0c0', '#2f7a8a'],
    up: 'Rings its bell: every villain and hazard stops in time for 5 s.', down: 'The level clock loses 10 s.' },
  { id: 'bubble', name: 'Bubble Chick', premium: true, t: 6, fall: 0.35, pop: 0.9, col: ['#7fdcff', '#2f8fd0', '#eefbff', '#ff8ad0'],
    up: 'Blows a bubble round every egg: nothing can hurt them for 6 s.', down: 'Bubbled eggs float light and steer badly, then pop with a shove.' },
];
export const STRIKE = Object.fromEntries(STRIKES.map((s) => [s.id, s]));
export const STRIKE_IDS = STRIKES.map((s) => s.id);
// the chicks whose flight goes to an egg (not a villain)
export const EGG_STRIKES = new Set(['phoenix', 'bubble']);
// charge: the base fill time, and how much longer it gets after each use; boosts per egg saved and per orb
// 2026-11-15 economy: the clock fills the meter only `timed` times per level (it used to refill every 20 s, so waiting made
// hard levels easy); after that only saved eggs and orbs fill it, or a Chick Charge bought with coins (economy.js 'chick')
export const CHARGE = { base: 35, grow: 1.5, timed: 1, egg: 0.3, orb: 0.1, easy: 0.5 };
// the strike's flight (sim seconds): the hop off the hen's back, then the arc to the target
export const FLIGHT = { hop: 0.32, fly: 0.55 };
// no strike button before this level (the first five teach the basics)
export const STRIKE_FROM = 6;
