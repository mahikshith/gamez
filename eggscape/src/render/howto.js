// "Show, don't tell" (2026-11-20, mykee's friend: "nobody reads the instructions"). A short looping cartoon on the level
// page for each villain: the villain goes for an egg, a hand shows the one move that beats it (turn the ring, tap a
// chick, call Papa Rooster, roll a stone egg, step aside from a falling hazard), the villain is bonked, frozen or
// scared off, and the egg drops into the basket. The same stage shows a chick's power on the Chicks tab.
//
//   drawHowTo(ctx, plan, x, y, w, h, t, o)   plan = howToPlan(kind) or chickPlan(id); t = seconds (loops every LOOP s)
//     o.rooster(ctx, x, y, s)  Papa Rooster's head for the call button (main.js allyIcon)
//     o.calm                   reduced motion: the key frame of the move, standing still
//     o.world                  the game's own art (main.js howWorld): { ringR (m), back, ring, egg, nest } draws the
//                              level's real backdrop, ring slab, egg and nest instead of the flat stand-ins below
//
// The stage: the bottom of a big ring seen from inside (its centre above the panel), a gap in it, the basket below.
// Everything on the ring turns with it; the egg stays at the lowest point and drops when the gap comes under it.

import { drawVillainPortrait } from './villain-art.js';
import { drawHand } from './wonder.js';
import { drawStrikeChick, drawStrikeButton } from './strike.js'; // 0.8.10: the chick scenes show the real HUD badge
import { drawKindChick } from './chicks.js'; // the bulk chick's own art (L18's card)
import { kitsHarmEgg } from './kitsplay.js'; // 0.8.18 kits
import { actorFor, harmActor, BREATH_AT, CHAM_ORB, BUMP_A, BITE_AT, FACE_T, bandHarmEgg } from './howact.js'; // 2026-11-20: the villain's own game rig acts the scene (snake, weasel, rats, crawlers) // 0.8.17 bandit: bandHarmEgg
import { statusDraw } from './status.js';
import { beamSparks, scorchStub, drawPepperCloud, drawTwister, drawSneeze, drawDecoyAt, TWIST_T } from './powers2.js'; // 2026-11-20: Practice content in the campaign
import { paintVortex } from './warp.js';
import { drawFrog, FROG_ART } from './frog.js';
import { FROG } from '../sim/frog.js';
import { drawFish } from './sea.js';
import { FISH } from '../sim/sea.js';
import { drawGator } from './bayou.js';
import { GATOR } from '../sim/bayou.js';
import { drawEagle, drawLavaRock, drawMeltHole, drawIcicle } from './v3art.js';
import { drawSalHeat, drawEmberBall } from './salamander.js'; // the game's own red-hot wall (the salamander's harm beat)
import { CREEP_HIT } from './movethorn.js'; // 0.8.18 the moving thorn

const TAU = Math.PI * 2;
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const ease = (u) => { u = clamp(u, 0, 1); return u < 0.5 ? 2 * u * u : 1 - 2 * (1 - u) * (1 - u); };
const seg = (t, a, b) => clamp((t - a) / (b - a), 0, 1);
export const LOOP = 4.6;
let ERR1 = false; // an actor that throws is reported once, and its portrait plays instead

// the move that beats each villain, and the one line under the cartoon (short: the picture does the talking)
const P = (move, cap, more = {}) => ({ move, cap, ...more });
const SHOW = {
  weasel: P('turn', 'Turn the ring as it crouches: BONK!', { fx: 'bonk' }),
  'boss:weasel': P('turn', 'He crouches under a gap: turn it away. BONK!', { fx: 'bonk' }),
  snake: P('turn', 'Turn the gap away from its head', { fx: 'bonk' }),
  'boss:snake': P('tap', 'Tap your chick, then run the eggs home', { power: 'thunder', fx: 'zap' }),
  rats: P('turn', 'Turn a gap under the rolling egg', { fx: 'bonk' }),
  'boss:ratking': P('turn', 'Trap him with a ring turn, then hit him', { fx: 'bonk' }),
  octopus: P('tap', 'Zap it with a chick: it lets the egg go', { power: 'thunder', fx: 'zap' }),
  fish: P('fish', 'The school carries eggs along, even to a gap'),
  frog: P('frog', 'Turn its ring: the tongue misses'),
  eagle: P('turn', 'Turn a wall over the egg: the eagle bonks', { fx: 'bonk' }),
  'boss:eagle': P('turn', 'Turn a wall over the egg it dives at', { fx: 'bonk' }),
  salamander: P('turn', 'Turn its ring: it rides away from the egg', { fx: 'bonk' }),
  frostsal: P('turn', 'Turn its ring away. A fire orb melts it', { fx: 'bonk' }),
  faceoff: P('faceoff', 'Fire meets frost: both are knocked out', { loop: 5.2 }),
  'boss:salamander': P('dodge', 'Roll eggs off the glowing mark', { haz: 'lava' }),
  spike: P('stone', 'Roll a stone egg into it: it flips over'),
  urchin: P('turn', 'Shut his gap: SPLAT!', { fx: 'bonk' }), // 0.8.17 urchin
  'boss:golem': P('stone', 'Roll a stone egg into him: he flips'),
  'boss:blizzard': P('tap', 'Freeze him with a chick, then hurry', { power: 'freeze', fx: 'freeze' }),
  chameleon: P('turn', 'Grab the orbs first, turn him away', { fx: 'bonk' }),
  hermit: P('turn', 'Turn a gap under it: the egg drops free', { fx: 'bonk' }),
  puffer: P('tap', 'A zap pops it', { power: 'thunder', fx: 'zap' }),
  jelly: P('tap', 'Zap it with a chick to stun it', { power: 'thunder', fx: 'zap' }),
  gator: P('turn', 'Turn the gap away from his jaws', { fx: 'bonk' }),
  'boss:gator': P('drop', 'When he is dizzy, drop an egg on him', { fx: 'dizzy' }),
  'boss:raccoon': P('turn', 'Turn his ring against him!', { fx: 'bonk' }), // 0.8.17 bandit (0.8.18: he cranks a ring)
  turtle: P('drop', 'Drop an egg on its shell: it flips', { fx: 'flip' }),
  mosquito: P('tap', 'A chick blasts them away', { power: 'bomb', fx: 'blast' }),
  spider: P('wait', 'Slip the egg past while it spins'),
  beetle: P('turn', 'Turn the ring: he walks into a wall', { fx: 'bonk' }),
  jack: P('turn', 'Park it short of a gap, then let go', { fx: 'bonk' }),
  'boss:kingcrab': P('turn', 'Turn the ring while a claw is in', { fx: 'bonk' }),
  'boss:owl': P('tap', 'Stun it with a chick, then slip past', { power: 'thunder', fx: 'zap' }),
  icicles: P('dodge', 'Turn the egg away before they fall', { haz: 'icicles' }),
  lava: P('dodge', 'Roll the egg off the glowing mark', { haz: 'lava' }),
  lightning: P('dodge', 'Turn the egg away from the flicker', { haz: 'lightning' }),
  embers: P('dodge', 'Keep the egg out from under the embers', { haz: 'embers' }),
  quake: P('wait', 'Park the egg in a dip, then move'),
  rain: P('wait', 'Turn in small steps, let eggs settle'),
  current: P('ride', 'Let the current carry it to a gap'),
  gusts: P('ride', 'Turn a gap downwind: it blows in'),
  popthorns: P('wait', 'Wait for the thorns to drop, then go'),
  vines: P('wait', 'Drop through before the vine closes'),
  doors: P('wait', 'Park the egg on the door: it opens', { haz: 'door' }),
  curse: P('dodge', 'Steer the egg round the curse orb', { haz: 'curse' }),
  thornorb: P('dodge', 'Steer the egg round the thorn orb', { haz: 'thornorb' }),
};
export function howToPlan(kind, o = {}) {
  const p = SHOW[kind] || SHOW[String(kind).replace(/^boss:/, '')] || P('turn', 'Turn the ring to keep the egg away', { fx: 'bonk' });
  const q = { kind, ...p };
  // o.harm (the level card): the scene opens with what the threat DOES to an egg, then the move that beats it
  if (o.harm && HARM[kind]) { const [t, word] = HARM[kind]; q.harm = { t, word }; q.loop = (p.loop || LOOP) + HARM_T; }
  return q;
}
// "What it does, then what to do" (2026-11-23, mykee: the level card is the only lesson now, "they should be
// self-explanatory"). Each threat's scene on the level card opens with a short beat of the harm it does, acted on the
// same stage with the same art (the egg grabbed, cracked, blocked, pushed, bitten...), ending in a red cross; then the
// counter plays as before, ending in the tick. THREAT: the two or three words that name the harm (the card's reminder
// tiles and the caption under that first beat). A kind whose own rig already shows its attack in the scene (the snake
// lunging, the weasel pouncing, the rats rolling the egg, the crawlers, the frog plugging, the fish carrying) has no harm
// beat, only the words.
export const HARM_T = 2.7;
const HARM = {
  octopus: ['steal', 'GRAB!'], hermit: ['steal', 'TAKEN!'], 'boss:kingcrab': ['steal', 'GRAB!'],
  eagle: ['snatch', 'SNATCH!'], 'boss:eagle': ['snatch', 'SNATCH!'], 'boss:owl': ['snatch', 'SNATCH!'],
  icicles: ['fall', 'CRACK!'], lava: ['fall', 'CRACK!'], lightning: ['fall', 'ZAP!'], embers: ['fall', 'CRACK!'], 'boss:salamander': ['fall', 'CRACK!'],
  jelly: ['sting', 'STING!'], 'boss:blizzard': ['frost', 'FROZEN!'],
  urchin: ['bump', 'CRACK!'], // 0.8.17 urchin: his dash
  thornorb: ['orb', 'CRACK!'], curse: ['orb', 'FUSE x2!'], popthorns: ['pop', 'CRACK!'],
  puffer: ['block', 'BLOCKED!'], spider: ['block', 'WEBBED!'], vines: ['block', 'BLOCKED!'], turtle: ['block', 'STUCK!'], doors: ['block', 'SHUT!'],
  current: ['push', 'PUSHED!'], gusts: ['push', 'BLOWN!'], beetle: ['push', 'PUSHED!'], 'boss:golem': ['bump', 'CRACK!'], quake: ['push', 'SHAKE!'], rain: ['push', 'SLIDE!'],
  mosquito: ['lift', 'LIFTED!'], gator: ['bite', 'CHOMP!'], jack: ['bounce', 'BOING!'],
  'boss:raccoon': ['sack', 'NABBED!'], // 0.8.17 bandit: his rig acts it (howact.js)
  // 2026-11-23 the crawlers (their own rigs act it, howact.js harmActor): the jet heats the wall, the tongue takes an orb, the hip shoves
  salamander: ['chomp', 'EATEN!'], frostsal: ['frostbite', 'FROZEN!'], chameleon: ['tongue', 'GULP!'], spike: ['bump', 'CRACK!'], // 0.8.14: the salamanders bite, the thorn-back's ram cracks
};
export const THREAT = {
  snake: 'Eats eggs', weasel: 'Steals eggs', rats: 'Roll eggs away', octopus: 'Grabs eggs', fish: 'Sweep eggs', frog: 'Snatches eggs',
  eagle: 'Snatches eggs', salamander: 'Eats eggs', frostsal: 'Bites, freezes', faceoff: 'They fight', spike: 'Rams, cracks', chameleon: 'Steals orbs', hermit: 'Carries eggs',
  puffer: 'Plugs a gap', jelly: 'Stings eggs', gator: 'Bites eggs', turtle: 'Clamps eggs', mosquito: 'Lift eggs up', spider: 'Webs gaps',
  beetle: 'Pushes eggs', jack: 'Flings eggs', icicles: 'Fall on eggs', lava: 'Rocks fall', lightning: 'Zaps eggs', gusts: 'Blow eggs',
  embers: 'Burn eggs', quake: 'Shakes eggs', rain: 'Slippery rings', current: 'Pushes eggs', popthorns: 'Spikes pop up', vines: 'Seal gaps',
  doors: 'Shut gaps', curse: 'Fuse x2', thornorb: 'Cracks eggs',
  urchin: 'Dashes, cracks', // 0.8.17 urchin
  'boss:weasel': 'Steals eggs', 'boss:snake': 'Two snakes', 'boss:blizzard': 'Bites, freezes', 'boss:golem': 'Rams, cracks', 'boss:salamander': 'Spits lava',
  'boss:eagle': 'Dives for eggs', 'boss:ratking': 'Pounces', 'boss:kingcrab': 'Claws eggs', 'boss:gator': 'Shakes rings', 'boss:owl': 'Swoops at eggs', 'boss:raccoon': 'Cranks rings', // 0.8.17 bandit
};
SHOW.penguin = P('turn', 'Turn a wall into his slide: BONK!', { fx: 'bonk' }); THREAT.penguin = 'Shoves eggs'; // 0.8.17 pip
SHOW.monkey = P('turn', 'Flick his ring hard: whoa, he lets go!', { fx: 'bonk' }); THREAT.monkey = 'Grabs eggs'; // 0.8.17 coco
for (const c of ['ice', 'woods', 'sea', 'cave', 'goggles', 'bow', '']) { const k = c ? 'kits:' + c : 'kits'; SHOW[k] = P('turn', 'Turn their ring hard: they tumble!', { fx: 'bonk' }); THREAT[k] = 'Carry eggs off'; HARM[k] = ['kits', 'TAKEN!']; } // 0.8.18 kits: mama raccoon's kits (howact.js kitsActor acts both beats)
SHOW.emberspit = P('turn', 'Turn the gap out of his line', { fx: 'bonk' }); THREAT.emberspit = 'Spits embers'; HARM.emberspit = ['fall', 'CRACK!']; // 0.8.18 lava
SHOW.fireup = P('turn', 'Turn its ring: he rides away', { fx: 'bonk' }); THREAT.fireup = 'Goes white-hot'; // 0.8.18 lava (the info panel and the lesson teach the water)
SHOW.creeper = P('turn', 'Turn it away'); THREAT.creeper = 'Slides, pops'; HARM.creeper = ['creep', 'POP!']; // 0.8.18 the moving thorn
export const threatWords = (kind) => THREAT[kind] || THREAT[String(kind).replace(/^boss:/, '')] || 'Hunts eggs';
// the first-five ladder (2026-11-20, owner: every level from 2 on hands over a new toy, shown on its level card with the
// game's own art): the red flame, the twin orb, the thorn curtain, the portal, the glow chick. move 'toy', plan.toy names it.
const TOY = {
  flame: 'Roll an egg into the red flame: thorns burn',
  twin: 'The twin orb makes two eggs of one',
  curtain: 'A flame egg burns the thorn curtain',
  portal: 'The swirl drops an egg rings lower',
  glow: 'Tap the glow chick: its flash burns thorns',
  bulk: 'Tap the bulk chick: it squashes thorns', // 2026-11-23: L18 had no picture for its new chick
  // 2026-11-20: Practice content placed in the campaign (warp L22/L27, combos L43/L44/L47)
  warp: 'The warp gate sends the next attacker far away',
  bait: 'Decoy + warp: creatures chase the decoy away',
  sweep: 'Laser + spin: the beam sweeps, every thorn cut',
  twister: 'Pepper + spin: a twister sneezes them away',
  magnet: 'Shock + iron: iron eggs stick to the live ring',
};
const TOY_NAME = { flame: 'Red flame', twin: 'Twin orb', curtain: 'Thorn curtain', portal: 'Portal', glow: 'Glow chick', bulk: 'Bulk chick', warp: 'Warp gate', bait: 'Bait and switch', sweep: 'Sweep beam', twister: 'Pepper twister', magnet: 'Electromagnet' };
const NEW_TOYS = ['warp', 'bait', 'sweep', 'twister', 'magnet']; // these need the game's own art (o.world)
// foe: the creature a toy scene shows (the warp gate takes the level's own: 'salamander', 'eagle', else a snake)
export function toyPlan(id, foe) { return { kind: null, toy: id, move: 'toy', cap: TOY[id] || '', name: TOY_NAME[id] || id, foe }; }
// 0.8.10 (mykee on L11: "we are not providing relevant information ... where the floor is slippery"): a ring floor that
// behaves on its own gets its own scene on the first level that has it. loop: a longer scene (ice plays it twice: too late, then early)
const FLOOR = { ice: ['Ice: eggs slide', 'Ice floor', 7.4], honey: ['Honey: eggs stick', 'Honey', 4.8], cloud: ['Cloud: eggs bounce', 'Cloud floor', 4.8] };
export const FLOORS = Object.keys(FLOOR);
export function floorPlan(surf) { const F = FLOOR[surf] || FLOOR.ice; return { kind: null, move: 'floor', surf, cap: F[0], name: F[1], loop: F[2] }; }
// 0.8.10 (mykee on L9: "Do they have to click on it?"): the power chick on the first level that has one: a saved egg fills
// its badge, the finger taps it when it glows, the chick flies at the villain
export function chickTeach(id, villain = 'snake') { return { ...chickPlan(id, 'Full? Tap your chick', villain), teach: 1, name: 'Your chick' }; }
// no villain in this level: the basic move
export const BASIC = { kind: null, move: 'basic', cap: 'Drag a ring to turn it. Drop eggs into the basket.' };
// Papa Rooster (the farm friend): tap him and he chases a thief off, the egg comes back
export const ROOSTER = { kind: 'weasel', move: 'rooster', fx: 'flee', cap: 'Tap Papa Rooster: he chases the thief away' };
// a chick's power on the Chicks tab: tap the chick, its power hits a villain
const CHICK_FX = { freeze: 'freeze', thunder: 'zap', bomb: 'blast', decoy: 'flee', tornado: 'blast', glue: 'glue', phoenix: 'carry', tock: 'stop', bubble: 'bubble' };
export function chickPlan(id, cap, villain = 'snake') {
  return { kind: villain, move: 'tap', power: id, fx: CHICK_FX[id] || 'zap', cap };
}
const PCOL = { freeze: '#8fd8ff', thunder: '#ffe14a', bomb: '#ff8a3a', decoy: '#ffd0a0', tornado: '#9ff0d6', glue: '#c9a3ff', phoenix: '#ff9a3a', tock: '#ffd27a', bubble: '#9be8ff', rooster: '#ff5a3a' };

// ------------------------------------------------------------------ the stage
export function drawHowTo(ctx, plan, x, y, w, h, t, o = {}) {
  o._drop = null; o._carry = null; o._bubble = 0;
  const LP = plan.loop || LOOP, calm = !!o.calm, T0 = calm ? (plan.move === 'floor' ? (plan.surf === 'ice' ? 4.75 : 1.4) : 2.25) : ((t % LP) + LP) % LP;
  // the harm beat first (howToPlan(kind, { harm })), then the counter on its own clock; a soft cut between the two
  const HB = plan.harm && !calm ? HARM_T : 0, hp = HB > 0 && T0 < HB, T = hp || !HB ? T0 : T0 - HB;
  o._phase = hp ? 'harm' : 'beat'; o._pt = T;
  const fade = calm ? 1 : hp ? Math.min(seg(T0, 0, 0.25), 1 - seg(T0, HB - 0.3, HB)) : Math.min(seg(T, 0, 0.25), 1 - seg(T0, LP - 0.3, LP));
  const U = h, Z = Math.min(h, w * 0.62), cx = x + w / 2; // U: the stage's height (vertical placing); Z: the size of things (a tall stage does not blow them up)
  const Wd = o.world || null;
  ctx.save();
  // the panel: the level's own backdrop (else a soft sky and a meadow strip), rounded; o.bare (0.8.18, the level card's
  // hero): no panel and no veil, the scene's things stand on the page's own world (its world.back paints nothing)
  rr(ctx, x, y, w, h, Math.min(18, h * 0.08)); ctx.clip();
  if (!(Wd && Wd.back && Wd.back(ctx, x, y, w, h))) {
    const g = ctx.createLinearGradient(0, y, 0, y + h);
    g.addColorStop(0, o.sky0 || '#9fdcff'); g.addColorStop(0.7, o.sky1 || '#e6f7ff'); g.addColorStop(1, o.sky1 || '#e6f7ff');
    ctx.fillStyle = g; ctx.fillRect(x, y, w, h);
    ctx.fillStyle = o.ground || '#8bd36a'; ctx.beginPath(); ctx.ellipse(cx, y + h * 1.06, w * 0.75, h * 0.2, 0, 0, TAU); ctx.fill();
  }
  // 2026-11-23 (mykee: "the background is highlighted", "extreme close-up", villains cut by the stage's edge): the
  // backdrop stands back behind a veil in the world's own sky colour, and a scene with a villain in it is seen from a
  // step back (the ground stays put), so the whole villain is in the picture.
  if (Wd && !o.bare) { ctx.save(); ctx.globalAlpha = 0.42; ctx.fillStyle = o.sky1 || '#f6ead0'; ctx.fillRect(x, y, w, h); ctx.globalAlpha = 0.16; ctx.fillStyle = '#fff6e0'; ctx.fillRect(x, y, w, h); ctx.restore(); }
  ctx.globalAlpha = fade;

  // ring geometry: centre above the panel; phi = 0 is straight down
  // with the game's art the ring, the egg and the villain keep their in-game sizes (k = pixels per metre)
  const R = Wd ? Math.min(w * 0.86, h * 1.3) : w * 0.94, kW = Wd ? R / Wd.ringR : 0, band = Wd ? 0.16 * kW : Z * 0.12, floor = R - band / 2;
  const C = { x: cx, y: y + U * (Wd ? 0.6 : 0.64) - R };
  const at = (phi, lift) => ({ x: C.x + Math.sin(phi) * (floor - lift), y: C.y + Math.cos(phi) * (floor - lift) });
  const nest = { x: cx, y: y + U * 0.93 };
  const eggS = Wd ? 0.56 * 1.06 * kW : Z * 0.24, vD = Z * (Wd ? 0.8 : 0.5);
  const m = hp ? 'harm' : !Wd && (plan.move === 'frog' || plan.move === 'fish' || (plan.move === 'toy' && NEW_TOYS.includes(plan.toy)) || plan.move === 'floor') ? 'basic' : plan.move; // the rigs need the game's art
  const vLift = vD * (Wd ? 0.3 : 0.42);
  // where the villain stops: its nose just short of the egg, worked out in pixels so a big villain never overlaps it
  const vEnd = -Math.asin(clamp((eggS * 0.42 + vD * 0.46) / floor, 0.05, 0.95));
  const drawE = (X, Y, S, st, wr, look) => (Wd ? Wd.egg(ctx, X, Y, st, wr, C, kW, t, look) : egg(ctx, X, Y, S, st, T, wr));
  let toy = null; // move 'toy': { orb, look, deco, twin, portal, flash, burst } (drawn with the game's art through o.world)

  // ---- the timeline of each move -> ring turn th, egg angle eA, egg drop eD (0..1), villain angle vA, villain state
  let eLift = 0, eAlpha = 1, slideV = 0, miss = 0, door = null, th = 0, eA = 0, eD = 0, vA = -0.75, vOff = 0, vRot = 0, vAlpha = 1, vFx = '', fxK = 0, hand = null, stone = false, haz = null, btn = null, shot = null, done = 0;
  const act = hp ? harmActor(plan.kind) : actorFor(plan), SG = act && act.stage ? act.stage(m) : null;
  const gap0 = SG ? SG.g0 : 0.4, dTh = SG ? SG.dTh : -gap0; // the gap starts to the right of the egg and comes under it (an actor may set its own scene)
  const walk = ease(seg(T, 0.2, 1.3));
  const SA = act ? { x, y, w, h, cx, C, floor, band, k: Wd ? kW : Z / 2.5, at, g0: gap0, eggS, ground: Wd ? y + h * 0.9 : y + h * 0.95, calm } : null;
  if (m === 'harm') {
    vAlpha = 0; toy = { deco: { thorns: 0 }, look: null };
    harmBeat(ctx, plan, T, t, { x, y, w, h, cx, C, floor, band, at, eggS, vD, vEnd, gap0, Z, U, Wd, kW, nest, calm, drawE }, (q) => {
      if (q.th != null) th = q.th; if (q.eA != null) eA = q.eA; if (q.eLift != null) eLift = q.eLift; if (q.eAlpha != null) eAlpha = q.eAlpha;
      if (q.slideV != null) slideV = q.slideV; if (q.eD != null) eD = q.eD; if (q.haz) haz = q.haz; if (q.hand) hand = q.hand; if (q.door != null) door = q.door;
      Object.assign(toy, q.toy || {});
    });
  } else if (m === 'basic') {
    vAlpha = 0;
    const d = ease(seg(T, 0.9, 1.9)); th = -gap0 * d;
    hand = dragHand(at, T, 0.9, 1.9, 0.5, 0.5 - gap0);
    eD = seg(T, 2.0, 2.45); done = seg(T, 2.45, 2.8);
  } else if (m === 'turn') {
    vA = vEnd - 0.3 * (1 - walk);
    const d = ease(seg(T, 1.45, 2.25)); th = SG && SG.th ? SG.th(T) : dTh * d; // 0.8.18 bandit: an actor may turn the ring itself first (his crank)
    hand = SG && SG.hand ? dragHand(at, T, 1.35, 2.25, SG.hand[0], SG.hand[1]) : dragHand(at, T, 1.35, 2.25, 0.5, 0.5 - gap0);
    if (SG && SG.egg) eA = SG.egg(T);
    if (T > 1.85) { vFx = plan.fx || 'bonk'; fxK = seg(T, 1.85, 2.9); }
    vA += th;
    if (vFx) { vOff = 1; vRot = -fxK * 3.5; vAlpha = 1 - seg(T, 2.55, 2.95); }
    eD = seg(T, 2.3, 2.75); done = seg(T, 2.75, 3.1);
  } else if (m === 'tap' || m === 'rooster') {
    vA = vEnd - 0.3 * (1 - walk);
    btn = { x: x + Math.max(w * 0.1, Z * 0.16), y: y + U * 0.8, r: Z * 0.13, id: m === 'rooster' ? 'rooster' : plan.power || 'thunder' };
    if (m === 'tap') { // 0.8.10: the HUD's own chick badge: a saved egg tops up its meter, it beats gold, the finger taps it
      btn.r = Z * 0.2; btn.x = x + Math.max(w * 0.12, btn.r * 1.25); btn.y = y + U * 0.76;
      btn.m = 0.6 + 0.4 * ease(seg(T, 0.6, 1.0)); btn.busy = T > 1.62;
      const sv = { x: nest.x - eggS * 0.45, y: nest.y - eggS * 0.42 }; btn.saved = { x: sv.x, y: T < 0.45 ? y - eggS + (sv.y - y + eggS) * Math.pow(seg(T, 0.1, 0.45), 2) : sv.y, a: seg(T, 0.05, 0.12) }; // an egg comes home first: that is what fills the badge
      if (T > 0.45 && T < 1.0) { const k = ease(seg(T, 0.45, 0.95)); btn.spark = { x: sv.x + (btn.x - sv.x) * k, y: sv.y + (btn.y - sv.y) * k - Math.sin(k * Math.PI) * U * 0.2, k }; }
    }
    hand = tapHand(btn, T, 1.25, 1.7);
    const hit = 2.15;
    const onEgg = plan.fx === 'carry' || plan.fx === 'bubble'; // the phoenix and the bubble go for the egg, not the villain
    if (T > 1.62 && T < hit) { const k = ease(seg(T, 1.62, hit)), v = onEgg ? at(0, eggS * 0.5) : act && act.aim ? act.aim(SA) : at(vA, vLift); shot = { x: btn.x + (v.x - btn.x) * k, y: btn.y + (v.y - btn.y) * k - Math.sin(k * Math.PI) * U * 0.25, k }; }
    if (T >= hit) {
      vFx = m === 'rooster' ? 'flee' : plan.fx || 'zap'; fxK = seg(T, hit, hit + 1.2);
      if (plan.fx === 'carry') { vFx = ''; o._carry = ease(seg(T, hit, hit + 0.9)); }
      if (plan.fx === 'bubble') { o._bubble = 1; vFx = T > hit + 0.35 ? 'dizzy' : ''; fxK = seg(T, hit + 0.35, hit + 1.4); }
    }
    if (vFx === 'flee' || vFx === 'blast') { vOff = vFx === 'blast' ? 1 : 0; if (vFx === 'flee') vA -= ease(fxK) * 0.9; vRot = vFx === 'blast' ? -fxK * 6 : 0; vAlpha = 1 - seg(T, hit + 0.6, hit + 1.1); }
    const d = ease(seg(T, 2.75, 3.3)); th = dTh * d;
    if (SG && SG.egg) eA = SG.egg(T);
    if (vFx !== 'flee' && vFx !== 'blast') vA += th; // a frozen or stunned villain rides the ring
    eD = seg(T, 3.3, 3.7); done = seg(T, 3.7, 4.0);
    if (o._carry != null) { th = 0; eD = 0; done = seg(T, hit + 0.9, hit + 1.2); }
  } else if (m === 'faceoff') { // 0.8.14 fire meets frost over the egg (howact.js faceoff acts it): no ring turn, the egg just lives
    vAlpha = 0; done = seg(T, FACE_T.out + 0.5, FACE_T.out + 0.9);
  } else if (m === 'stone') {
    stone = T > 0.7; vA = vEnd + 0.05;
    const d = ease(seg(T, 1.3, 2.0)); th = 0.3 * d; eA = 0.48 - 0.5 * d; // turning the ring rolls the stone egg down into it
    hand = dragHand(at, T, 1.2, 2.0, -0.2, 0.1);
    if (T > 1.95) { vFx = 'flip'; fxK = seg(T, 1.95, 3.0); vRot = Math.PI * ease(seg(T, 1.95, 2.3)); vA -= 0.6 * seg(T, 2.2, 3.0); vAlpha = 1 - seg(T, 2.5, 3.0); }
    const d2 = ease(seg(T, 2.3, 2.9)); th = 0.3 * d + (-gap0 - 0.3) * d2; eA = (0.48 - 0.5 * d) * (1 - d2);
    eD = seg(T, 2.95, 3.35); done = seg(T, 3.35, 3.7);
  } else if (m === 'drop') { // an egg from the ring above lands on the villain
    vA = vEnd - 0.3 * (1 - walk); eA = 0;
    const fall = seg(T, 1.6, 2.05);
    if (T > 2.0) { vFx = plan.fx || 'dizzy'; fxK = seg(T, 2.0, 3.0); if (vFx === 'flee') { vA -= ease(fxK) * 0.9; vAlpha = 1 - seg(T, 2.5, 3.0); } if (vFx === 'flip') { vRot = Math.PI * ease(seg(T, 2.0, 2.3)); vAlpha = 1 - seg(T, 2.6, 3.1); } }
    hand = dragHand(at, T, 1.1, 1.6, 0.9, 0.55, 0.55);
    const d = ease(seg(T, 2.6, 3.2)); th = -gap0 * d;
    if (vFx !== 'flee') vA += th;
    eD = seg(T, 3.25, 3.65); done = seg(T, 3.65, 4.0);
    o._drop = { fall, vA };
  } else if (m === 'dodge') {
    haz = { k: plan.haz || 'lava', warn: seg(T, 0.2, 0.6) * (1 - seg(T, 2.35, 2.5)), fall: seg(T, 2.0, 2.4), boom: seg(T, 2.4, 3.0) };
    vAlpha = 0;
    const d = ease(seg(T, 1.0, 1.7)); th = 0.5 * d; eA = 0.5 * d; // the turn carries the egg off the mark
    hand = dragHand(at, T, 0.9, 1.7, -0.25, 0.25);
    const d2 = ease(seg(T, 2.9, 3.4)); th = 0.5 * d + (-gap0 - 0.5) * d2; eA = 0.5 * d * (1 - d2);
    eD = seg(T, 3.45, 3.85); done = seg(T, 3.85, 4.2);
  } else if (m === 'toy') {
    vAlpha = 0;
    const id = plan.toy, eggAt = (lift) => at(0, lift);
    toy = { deco: { thorns: 0 }, look: null };
    // an orb drifts down onto the egg: it is taken (a burst in its colour) and the egg changes
    const orbIn = (type, t0, t1) => { const k = ease(seg(T, t0, t1)), p0 = at(-0.42, eggS * 1.9), p1 = eggAt(eggS * 0.55); if (T < t1 + 0.05) toy.orb = { type, x: p0.x + (p1.x - p0.x) * k, y: p0.y + (p1.y - p0.y) * k, a: 1 - seg(T, t1 - 0.05, t1 + 0.05) }; if (T > t1 && T < t1 + 0.45) toy.burst = { x: p1.x, y: p1.y, k: seg(T, t1, t1 + 0.45), col: type === 'twin' ? '#ffe58a' : type === 'hatch_glow' ? '#fff27a' : type === 'hatch_bulk' ? '#b6f070' : '#ff8a3a' }; };
    if (id === 'flame' || id === 'curtain') {
      orbIn('fire_red', 0.35, 1.0);
      if (T > 1.0) toy.look = { fire: 1 };
      const d = ease(seg(T, 1.2, 2.1)); th = -gap0 * d;
      hand = dragHand(at, T, 1.1, 2.1, 0.5, 0.5 - gap0);
      if (id === 'flame') { toy.deco = { thorns: 1, burnt: d > 0.5 }; eD = seg(T, 2.25, 2.65); done = seg(T, 2.65, 3.0); }
      else { toy.deco = { curtain: seg(T, 2.1, 2.9) }; eD = seg(T, 2.95, 3.35); done = seg(T, 3.35, 3.7); }
    } else if (id === 'twin') {
      orbIn('twin', 0.35, 1.0);
      const sp = ease(seg(T, 1.0, 1.4)), d = ease(seg(T, 1.6, 2.4)); th = -gap0 * d;
      hand = dragHand(at, T, 1.5, 2.4, 0.5, 0.5 - gap0);
      eD = seg(T, 2.45, 2.85);
      const roll = ease(seg(T, 2.85, 3.1)), e2A = -0.17 * sp * (1 - roll);
      toy.twin = { show: T > 1.0, a: e2A, eD: seg(T, 3.1, 3.5) };
      done = seg(T, 3.5, 3.85);
    } else if (id === 'portal') {
      const r = ease(seg(T, 0.55, 1.35)); eA = -0.36 * r; th = 0.36 * r;
      hand = dragHand(at, T, 0.45, 1.35, 0.15, -0.21);
      const pin = at(-0.36, eggS * 0.5), pout = { x: nest.x + Z * 0.06, y: (C.y + floor + band + nest.y) / 2 - Z * 0.02 };
      const sink = seg(T, 1.35, 1.7), pop = seg(T, 1.95, 2.2);
      toy.portal = { pin, pout, sink, pop, outA: seg(T, 1.6, 1.9) * (1 - seg(T, 3.4, 3.8)), drop: seg(T, 2.2, 2.6) };
      done = seg(T, 2.6, 2.95);
    } else if (NEW_TOYS.includes(id)) { // 2026-11-20: Practice content placed in the campaign, shown with the game's own art
      const k = kW, W2 = (X, Y) => ({ x: (X - C.x) / k, y: -(Y - C.y) / k }), inW = (fn) => { ctx.save(); ctx.translate(C.x, C.y); ctx.scale(k, -k); try { fn(); } finally { ctx.restore(); } };
      const eggPx = () => at(eA, eggS * 0.5), wAng = (phi) => phi - Math.PI / 2; // a stage angle (0 = straight down) -> world angle
      const combo = (t0) => { if (T > t0 && T < t0 + 0.5) toy.burst = { x: eggPx().x, y: eggPx().y, k: seg(T, t0, t0 + 0.5), col: '#ffd23f' }; if (T > t0 && T < t0 + 0.9) toy.word = { s: 'COMBO!', k: seg(T, t0, t0 + 0.9) }; };
      const turnIn = (t0, t1) => { const d = ease(seg(T, t0, t1)); th = -gap0 * d; hand = dragHand(at, T, t0 - 0.1, t1, 0.5, 0.5 - gap0); };
      if (id === 'warp') { // the gate swallows the next creature that goes for the egg and spits it out far away
        orbIn('warp', 0.3, 0.85);
        turnIn(2.95, 3.5); eD = seg(T, 3.55, 3.95); done = seg(T, 3.95, 4.3);
        const foe = plan.foe || 'snake', act2 = foe === 'eagle' ? null : actorFor({ kind: foe, move: 'tap' });
        const SA2 = { x, y, w, h, cx, C, floor, band, k, at, g0: gap0, eggS, ground: y + h * 0.9, calm, T: Math.min(T, 1.75), t, m: 'tap', th: 0, fx: '', eA: 0 };
        const head = act2 && act2.aim ? act2.aim(SA2) : { x: x + w * 0.68, y: at(0, 0).y - eggS * 1.45 };
        const g1 = { x: head.x, y: head.y }, ex = { x: x + w * 0.24, y: y + h * 0.28 }, gR = 0.5 * k;
        const drawFoe = () => {
          if (act2) act2.draw(ctx, SA2);
          else { const u = ease(seg(T, 0.9, 1.75)), p0 = { x: x + w * 1.1, y: y - h * 0.05 }; drawEagle(ctx, p0.x + (head.x - p0.x) * u, p0.y + (head.y - p0.y) * u, 3.0 * k * 0.38, t, { w: { dive: 1 }, face: -1, pitch: 0.35 }); } // EAGLE_LEN 3 m: scaled down to fit the stage
        };
        toy.under = () => {
          if (T > 0.85 && T < 1.85) { const e0 = eggPx(), a = t * 4; ctx.save(); ctx.translate(e0.x + Math.cos(a) * eggS * 0.75, e0.y - eggS * 0.1 + Math.sin(a) * eggS * 0.22); paintVortex(ctx, eggS * 0.2, t, 'in', 1, 1); ctx.restore(); } // armed: a swirl circles the egg
          const op = (t0, t1, c0, c1) => (T < t0 || T > c1 ? 0 : Math.min(back01(seg(T, t0, t1)), 1 - seg(T, c0, c1)));
          const o1 = op(1.75, 1.95, 2.35, 2.6), o2 = op(2.3, 2.5, 3.1, 3.4);
          if (T < 1.85) drawFoe();
          else if (T < 2.35) { const u = ease(seg(T, 1.85, 2.35)); ctx.save(); ctx.translate(g1.x, g1.y); ctx.rotate(u * 5); ctx.scale(1 - 0.96 * u, 1 - 0.96 * u); ctx.translate(-g1.x, -g1.y); ctx.globalAlpha *= 1 - 0.7 * u * u * u; drawFoe(); ctx.restore(); }
          if (o1 > 0.01) { ctx.save(); ctx.translate(g1.x, g1.y); ctx.scale(o1, o1); paintVortex(ctx, gR, t, 'in', 1, 1); ctx.restore(); }
          if (o2 > 0.01) { ctx.save(); ctx.translate(ex.x, ex.y); ctx.scale(o2, o2); paintVortex(ctx, gR, t + 0.7, 'out', 1, 1); ctx.restore(); }
          if (T > 2.45) { const u = seg(T, 2.45, 2.85), sc = 0.04 + 0.96 * back01(u), drift = seg(T, 2.9, 3.9); ctx.save(); ctx.globalAlpha *= 1 - seg(T, 3.4, 3.9); ctx.translate(ex.x - drift * w * 0.25, ex.y + drift * h * 0.1); ctx.rotate((u - 1) * 4); ctx.scale(sc, sc); ctx.translate(-head.x, -head.y); drawFoe(); ctx.restore(); if (u >= 1) dizzy(ctx, ex.x - drift * w * 0.25, ex.y - k * 0.45, k * 0.3, T, 1 - drift); }
        };
      } else if (id === 'bait') { // decoy + warp: the decoy goes through the gate and the gator chases it off
        orbIn('warp', 0.5, 1.05); combo(1.05);
        turnIn(2.85, 3.4); eD = seg(T, 3.45, 3.85); done = seg(T, 3.85, 4.2);
        const dA = 0.25, dp = at(dA, eggS * 0.62), ex = { x: x + w * 0.2, y: y + h * 0.24 }, gR = 0.5 * k;
        toy.under = () => {
          const o1 = T < 1.2 || T > 2.0 ? 0 : Math.min(back01(seg(T, 1.2, 1.4)), 1 - seg(T, 1.75, 2.0)), o2 = T < 1.7 || T > 2.7 ? 0 : Math.min(back01(seg(T, 1.7, 1.9)), 1 - seg(T, 2.4, 2.7));
          if (o1 > 0.01) { const g = at(dA, eggS * 0.15); ctx.save(); ctx.translate(g.x, g.y); ctx.scale(o1, o1 * 0.5); paintVortex(ctx, gR, t, 'in', 1, 1); ctx.restore(); }
          if (o2 > 0.01) { ctx.save(); ctx.translate(ex.x, ex.y); ctx.scale(o2, o2); paintVortex(ctx, gR, t + 0.7, 'out', 1, 1); ctx.restore(); }
          // the decoy: sits by the egg, sinks into the gate spinning, pops out of the far one and tumbles away
          let D = null;
          if (T < 1.35) D = { x: dp.x, y: dp.y, s: 1, r: -dA };
          else if (T < 1.75) { const u = ease(seg(T, 1.35, 1.75)), g = at(dA, eggS * 0.15); D = { x: dp.x + (g.x - dp.x) * u, y: dp.y + (g.y - dp.y) * u, s: 1 - 0.95 * u, r: u * 6 }; }
          else if (T > 1.85) { const u = seg(T, 1.85, 2.1), f = seg(T, 2.1, 2.9); D = { x: ex.x - f * w * 0.3, y: ex.y + f * f * h * 0.5 - Math.sin(f * Math.PI) * h * 0.12, s: 0.05 + 0.95 * back01(u), r: f * -5 }; }
          if (D) inW(() => drawDecoyAt(ctx, (D.x - C.x) / k, -(D.y - C.y) / k, 0.62 * D.s, k, t, D.r));
          // the gator: creeps up on the egg, then turns and runs after the decoy
          const gA0 = -1.05, gA1 = -0.8, run = seg(T, 2.0, 2.9), gA = gA0 + (gA1 - gA0) * ease(seg(T, 0.2, 1.1)) - run * run * 0.9;
          ctx.save(); ctx.globalAlpha *= 1 - seg(T, 2.55, 2.95);
          gatorAt(ctx, at, gA, T > 1.95 ? -1 : 1, k, t, { jaw: T < 1.9 ? 0.25 + 0.25 * Math.abs(Math.sin(t * 5)) : 0.6, gait: t * 6 * (T < 1.1 || T > 2 ? 1 : 0.2), eye: 'open' }, floor);
          ctx.restore();
        };
      } else if (id === 'sweep') { // laser + spin: the beam sweeps round and cuts the thorns by the gap
        orbIn('laser', 0.3, 0.85);
        const s2 = ease(seg(T, 0.85, 1.35)); if (T > 0.85 && T < 1.4) { const p0 = at(-0.42, eggS * 1.9), p1 = eggPx(); toy.orb2 = { type: 'spin', x: p0.x + (p1.x - p0.x) * s2, y: p0.y + (p1.y - p0.y) * s2 }; }
        combo(1.35);
        const bU = seg(T, 1.45, 2.45), bPhi = 1.0 - 2.0 * bU, gapA = gap0;
        toy.deco = { thorns: 1, burnt: bPhi < gapA + 0.05 };
        turnIn(2.65, 3.2); eD = seg(T, 3.25, 3.65); done = seg(T, 3.65, 4.0);
        const cutT = 1.45 + ((1.0 - gapA) / 2.0) * 1.0;
        toy.over = () => {
          if (T > 1.35 && T < 2.7) inW(() => { // the spin's wind round the ring
            ctx.strokeStyle = `rgba(240,255,250,${0.75 * (1 - seg(T, 2.4, 2.7))})`; ctx.lineCap = 'round'; ctx.lineWidth = Math.max(0.03, 2.5 / k);
            for (let j = 0; j < 4; j++) { const r = Wd.ringR * (0.82 + 0.06 * j), a0 = -Math.PI / 2 - 1 + t * 3 + j * 1.3; ctx.beginPath(); ctx.arc(0, 0, r, a0, a0 + 0.5); ctx.stroke(); }
          });
          if (T > cutT && T < cutT + 1.1) inW(() => { for (const s of [-1, 1]) { const a = wAng(gapA + s * 0.244), r = Wd.ringR - 0.1; scorchStub(ctx, r * Math.cos(a), r * Math.sin(a), a + Math.PI, 0.4, k, (T - cutT) / 1.1); } });
          if (bU > 0 && bU < 1) { // the beam from the beak in the middle of the vault (above the panel)
            const a = wAng(bPhi), c = Math.cos(a), s = Math.sin(a), far = Wd.ringR + 1.2;
            inW(() => {
              ctx.save(); ctx.lineCap = 'round';
              for (let i = 1; i <= 6; i++) { ctx.globalAlpha = 0.25 * (1 - i / 7); ctx.fillStyle = '#ff6a4a'; ctx.beginPath(); ctx.moveTo(0, 0); ctx.arc(0, 0, far, a + i * 0.035, a + (i - 1) * 0.035, true); ctx.closePath(); ctx.fill(); }
              ctx.globalAlpha = 1;
              for (const [lw, col] of [[0.36, 'rgba(255,60,40,0.45)'], [0.16, '#ff5a3c'], [0.065, '#fff4ec']]) { ctx.strokeStyle = col; ctx.lineWidth = lw; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(far * c, far * s); ctx.stroke(); }
              ctx.restore();
              beamSparks(ctx, Wd.ringR * c, Wd.ringR * s, a - Math.PI / 2, k, t, 6, 1.2);
            });
          }
        };
      } else if (id === 'twister') { // pepper + spin: the smoke winds into a twister and the gator sneezes himself away
        orbIn('pepper', 0.3, 0.85);
        const s2 = ease(seg(T, 1.0, 1.5)); if (T > 1.0 && T < 1.55) { const p0 = at(-0.42, eggS * 1.9), p1 = eggPx(); toy.orb2 = { type: 'spin', x: p0.x + (p1.x - p0.x) * s2, y: p0.y + (p1.y - p0.y) * s2 }; }
        combo(1.5);
        turnIn(2.95, 3.5); eD = seg(T, 3.55, 3.95); done = seg(T, 3.95, 4.3);
        const gA = -0.5, sn0 = 2.0;
        toy.under = () => {
          const su = (T - sn0) / 1.3, ah = seg(T, sn0, sn0 + 0.45), choo = seg(T, sn0 + 0.45, sn0 + 1.2), off = seg(T, sn0 + 0.6, sn0 + 1.4);
          ctx.save(); ctx.globalAlpha *= 1 - seg(T, sn0 + 1.1, sn0 + 1.45);
          const p = at(gA, 0);
          ctx.translate(-off * off * w * 0.45, -Math.sin(off * Math.PI) * h * 0.25); ctx.translate(p.x, p.y); ctx.rotate(-off * 2.4); ctx.translate(-p.x, -p.y);
          gatorAt(ctx, at, gA, 1, k, t, { jaw: T < sn0 ? 0.2 + 0.3 * Math.abs(Math.sin(t * 5)) : ah < 1 ? 0.15 + 0.5 * ah : 0.85 * (1 - choo), eye: T < sn0 ? 'open' : ah < 1 ? 'squint' : 'spiral', sneeze: choo > 0 && choo < 1 ? 1 - choo : 0, stars: off > 0 ? 1 : 0, gait: 0, nose: T > sn0 && ah < 1 ? -0.18 * ah : 0 }, floor);
          ctx.restore();
        };
        toy.over = () => {
          const e0 = eggPx(), P = W2(e0.x, e0.y);
          if (T > 0.85 && T < 1.6) inW(() => drawPepperCloud(ctx, P.x, P.y - 0.05, 0.6, Math.min(seg(T, 0.85, 1.15), 1 - seg(T, 1.5, 1.6)), k, t));
          if (T > 1.5 && T < 1.5 + TWIST_T) { const u = (T - 1.5) / TWIST_T, g = at(gA * ease(clamp((u - 0.3) / 0.4, 0, 1)), 0), G2 = W2(g.x, g.y); inW(() => drawTwister(ctx, P.x + (G2.x - P.x) * 0.6 * ease(clamp((u - 0.25) / 0.45, 0, 1)), P.y - 0.2, 0.55, u, k, t)); }
          { const su = (T - sn0) / 1.3, off = seg(T, sn0 + 0.6, sn0 + 1.4); if (su > 0 && su < 1 && off < 0.4) { const q = at(gA + 0.2, k * 0.35); inW(() => { const P = W2(Math.max(q.x, x + w * 0.22), Math.max(q.y - h * 0.06, y + h * 0.14)); drawSneeze(ctx, P.x, P.y, Math.PI * 0.8, su, k, t, 0.45); }); } }
        };
      } else if (id === 'magnet') { // shock + iron: the iron egg sticks to the live ring and rides it up the wall
        orbIn('iron', 0.3, 0.85);
        const s2 = ease(seg(T, 0.95, 1.45)); if (T > 0.95 && T < 1.5) { const p0 = at(-0.42, eggS * 1.9), p1 = eggPx(); toy.orb2 = { type: 'shock', x: p0.x + (p1.x - p0.x) * s2, y: p0.y + (p1.y - p0.y) * s2 }; }
        combo(1.45);
        const d = ease(seg(T, 1.6, 2.5)), up = -0.5;
        th = up * d; hand = dragHand(at, T, 1.5, 2.5, -0.1, -0.1 + up);
        const slide = ease(seg(T, 2.85, 3.15)), gapNow = gap0 + up;
        eA = T < 2.85 ? th : up + (gapNow - up) * slide;
        eD = seg(T, 3.15, 3.55); done = seg(T, 3.55, 3.9);
        if (T > 0.85) toy.look = { iron: 1, rot: eD > 0 ? 0 : eA };
        const live = Math.min(seg(T, 1.45, 1.6), 1 - seg(T, 2.65, 2.85));
        toy.over = () => {
          if (live > 0.01 && Wd.live) Wd.live(ctx, C, k, t, live);
          if (live > 0.3 && T > 1.6) { const e0 = at(eA, 0); ctx.save(); ctx.strokeStyle = '#bfe9ff'; ctx.lineWidth = Math.max(1.5, k * 0.02); ctx.lineJoin = 'round'; for (let i = 0; i < 2; i++) { const R = (Math.sin(t * 37 + i * 9) + 1) / 2, ox = (i ? 1 : -1) * eggS * 0.3; ctx.beginPath(); ctx.moveTo(e0.x + ox, e0.y); ctx.lineTo(e0.x + ox * 0.6 + (R - 0.5) * 6, e0.y - eggS * 0.15); ctx.lineTo(e0.x + ox * 0.4, e0.y - eggS * 0.3); ctx.stroke(); } ctx.restore(); }
        };
      }
    } else if (id === 'bulk') { // the green orb hatches the bulk chick; a tap puffs it up: it rolls over the thorns, bridges the gap, then lets go
      orbIn('hatch_bulk', 0.3, 0.8);
      const puffT = 1.55, sq = 2.3, offT = 3.05, big = T >= puffT && T < offT;
      toy.look = T > 0.8 ? { hide: 1 } : null;
      toy.deco = { thorns: 1, burnt: T > sq };
      { const ck = eggAt(eggS * 0.5); hand = T < 1.7 ? tapHand({ x: ck.x, y: ck.y, r: eggS * 0.5 }, T, 1.2, 1.55) : dragHand(at, T, 1.8, 2.85, 0.5, 0.5 - gap0); }
      if (T > puffT && T < puffT + 0.7) toy.word = { s: 'PUFF!', k: seg(T, puffT, puffT + 0.7) };
      if (T > sq && T < sq + 0.7) toy.word = { s: 'SQUASH!', k: seg(T, sq, sq + 0.7) };
      const d = ease(seg(T, 1.9, 2.85)); th = -gap0 * d;
      eD = seg(T, offT + 0.1, offT + 0.5); done = seg(T, offT + 0.5, offT + 0.85);
      toy.over = () => {
        if (T <= 0.8) return;
        const sC = 0.5 * kW, base = eggAt(0.3 * kW), land = nest.y - eggS * 0.42, kx = eD, X = base.x + (nest.x - base.x) * kx, Y = base.y + (land - base.y) * kx * kx;
        const u = (sC * 1.5) / 100;
        drawKindChick(ctx, 'bulk', X, done > 0 ? land : Y, sC, t, big ? { pow: 1, powT: 5 - (T - puffT) * (5 / (offT - puffT)), rx: (0.68 * kW) / u, ry: (0.41 * kW) / u, rot: 0 } : { ready: T < puffT, hatch: T < 1.4 ? (T - 0.8) : undefined });
      };
    } else { // glow
      orbIn('hatch_glow', 0.3, 0.8);
      if (T > 0.8) toy.look = { chick: T > 1.05 };
      toy.deco = { thorns: 1, burnt: T > 1.95 };
      { const ck = eggAt(eggS * 0.5); hand = tapHand({ x: ck.x, y: ck.y, r: eggS * 0.5 }, T, 1.25, 1.6); } // tap the chick itself, as in play
      if (T > 1.6 && T < 2.4) { const e0 = eggAt(eggS * 0.5); toy.flash = { x: e0.x, y: e0.y, k: seg(T, 1.6, 2.4) }; }
      const d = ease(seg(T, 2.4, 3.1)); th = -gap0 * d;
      eD = seg(T, 3.15, 3.55); done = seg(T, 3.55, 3.9);
    }
  } else if (m === 'floor') { // 0.8.10: a ring floor of its own (the game's ring art in that material, through o.world)
    vAlpha = 0; toy = { deco: { mat: plan.surf, thorns: 0 }, look: null };
    const fall = (t0, t1) => { const k = seg(T, t0, t1); return (1 - k * k) * h * 0.55 * (T < t1 ? 1 : 0); }; // dropped in from the ring above
    if (plan.surf === 'ice') { // too late: it lands, slides fast, flies over the gap into the thorn on its far edge. Early: the gap waits where it lands
      toy.deco = { mat: 'ice', thorns: 1, one: 1 }; toy.gap = 0.3;
      if (T < 3.3) {
        eLift = fall(0.2, 0.62);
        const u = seg(T, 0.62, 1.5); eA = -0.62 * Math.cos(Math.PI * 0.736 * u); slideV = T > 0.62 && T < 1.5 ? Math.sin(Math.PI * 0.736 * u) : 0; // a pendulum with no friction: it would climb as high as it fell
        if (eA > -0.04 && T < 1.5) eLift += Math.sin(seg(eA, -0.04, 0.42) * Math.PI * 0.55) * eggS * 0.55; // too fast: it flies over the gap
        if (T >= 1.5) { eLift = eggS * 0.55 * Math.sin(Math.PI * 0.55) * (1 - seg(T, 1.5, 1.7)); miss = seg(T, 1.5, 2.9); toy.look = { cracks: 3 }; if (T < 2.2) toy.word = { s: 'CRACK!', k: seg(T, 1.5, 2.2), red: 1 }; }
        eAlpha = 1 - seg(T, 2.4, 2.9);
      } else {
        const d = ease(seg(T, 3.4, 4.1)); th = -0.66 * d; hand = dragHand(at, T, 3.4, 4.1, 0.55, -0.11);
        eA = -0.68; eLift = fall(4.3, 4.68); eAlpha = seg(T, 4.25, 4.32);
        const u = seg(T, 4.68, 4.95); eA = -0.68 + 0.23 * u * u; slideV = T > 4.68 && T < 4.95 ? 0.5 + 0.5 * u : 0;
        eD = seg(T, 4.95, 5.35); done = seg(T, 5.35, 5.75);
      }
    } else if (plan.surf === 'honey') { // it sits in the honey and rides the turn up the wall, then the honey lets go and it rolls into the gap
      toy.deco = { mat: null, honey: { off: 0.5, len: 0.8 } };
      const g0 = -0.5, d = ease(seg(T, 0.7, 1.7)); th = 0.5 * d;
      hand = dragHand(at, T, 0.7, 1.7, -0.02, 0.48);
      const let1 = ease(seg(T, 2.35, 2.85)); eA = th * (1 - let1);
      if (T > 1.9 && T < 2.35) eA += Math.sin(t * 40) * 0.012; // the honey stretches, then gives
      if (T > 2.35 && T < 2.85) toy.word = { s: 'SLURP!', k: seg(T, 2.35, 2.95) };
      eD = seg(T, 2.95, 3.35); done = seg(T, 3.35, 3.7);
      toy.gap = g0;
    } else { // cloud: the egg bounces high off the soft floor, right over the gap; once it sits still, the turn brings the gap under it
      toy.deco = { mat: 'cloud' };
      const hops = [[0.2, 0.55, 0], [0.55, 1.15, 1.9], [1.15, 1.6, 1.0], [1.6, 1.9, 0.45]];
      for (const [a, b, H] of hops) if (T >= a && T < b) { const k = seg(T, a, b); eLift = H ? 4 * k * (1 - k) * H * eggS : (1 - k * k) * h * 0.55; }
      eA = 0.0 + 0.4 * Math.sin(seg(T, 0.55, 1.15) * Math.PI) * (T < 1.15 ? 1 : 0); // the big bounce carries it over the gap and back
      const d = ease(seg(T, 2.25, 3.0)); th = -gap0 * d; hand = dragHand(at, T, 2.15, 3.0, 0.5, 0.5 - gap0);
      eD = seg(T, 3.05, 3.45); done = seg(T, 3.45, 3.8);
    }
  } else if (m === 'frog' || m === 'fish') { // 2026-11-20: the frog and the fish school on their own game rigs
    vAlpha = 0; toy = { deco: { thorns: 0 }, look: null };
    const k = kW;
    if (m === 'frog') { // 0.8.18: it locks on the egg, licks its lips, a dotted line shows where its tongue will go; the finger
      // turns its ring: it rides away on it while the gap comes under the egg, the tongue falls short and slaps the rim: BONK,
      // dizzy stars, and the egg drops home
      const fA0 = -0.36, d = ease(seg(T, 1.25, 2.0)); th = -gap0 * d; hand = dragHand(at, T, 1.15, 2.0, fA0 + 0.08, fA0 + 0.08 - gap0);
      eD = seg(T, 2.05, 2.45); done = seg(T, 2.5, 2.85);
      const lock = seg(T, 0.25, 0.6), shot = seg(T, 1.95, 2.15), back = seg(T, 2.15, 2.3), dizzy = seg(T, 2.3, 2.45) * (1 - seg(T, 3.4, 3.7));
      toy.under = () => {
        const sPx = FROG.w * FROG_ART * k, um = 100 / (FROG.w * FROG_ART), phi = fA0 + th, p = at(phi, 0);
        const op = { face: 1, id: 3, look: { x: 0.9, y: 0.25 }, greed: T < 1.95 ? lock : 0, lick: T > 0.6 && T < 1.9 ? ((T - 0.6) / 1.3) % 1 : -1, puff: 0.6 * lock * (T < 1.95 ? 1 : 0) };
        if (T >= 1.95 && T < 2.3) { // the shot: out to where the egg was, short of it, then back into its face
          const reach = 0.95 * um * (T < 2.15 ? ease(shot) : 1 - ease(back)), e0 = at(0, eggS * 0.5);
          const dx = e0.x - p.x, dy = e0.y - p.y, a = phi, lx = (dx * Math.cos(a) + dy * Math.sin(a)) / (sPx / 100), ly = (-dx * Math.sin(a) + dy * Math.cos(a)) / (sPx / 100), n = Math.hypot(lx, ly) || 1;
          op.tongue = { x: 30 + (lx / n) * reach, y: -22 + (ly / n) * reach }; op.tout = T < 2.15 ? 1 : 0; op.mouth = 1;
          if (T > 2.12) { op.bonk = 1; op.lean = -0.3; }
        }
        if (dizzy > 0) op.stun = dizzy;
        if (T < 1.95 && lock > 0) { // the line its tongue will take
          const e0 = at(0, eggS * 0.5), m0 = { x: p.x + Math.cos(phi) * sPx * 0.42 + Math.sin(phi) * sPx * 0.3, y: p.y - Math.sin(phi) * sPx * 0.42 - Math.cos(phi) * sPx * 0.25 };
          ctx.save(); ctx.globalAlpha *= lock * (1 - seg(T, 1.6, 1.95)); ctx.setLineDash([2, eggS * 0.18]); ctx.lineCap = 'round'; ctx.lineWidth = Math.max(2.5, eggS * 0.07); ctx.strokeStyle = '#ff7a9c';
          ctx.beginPath(); ctx.moveTo(m0.x, m0.y); ctx.lineTo(e0.x, e0.y); ctx.stroke(); ctx.restore();
        }
        ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(-phi); drawFrog(ctx, 0, 0, sPx, t, op); ctx.restore();
        if (T > 2.12 && T < 2.6 && !calm) { const q = seg(T, 2.12, 2.6), b = at(phi + 0.2, eggS * 0.45); ctx.save(); ctx.globalAlpha *= 1 - q; ctx.strokeStyle = '#ffe14a'; ctx.lineWidth = Math.max(2, eggS * 0.06); for (let i = 0; i < 6; i++) { const a = (i / 6) * TAU; ctx.beginPath(); ctx.moveTo(b.x + Math.cos(a) * eggS * 0.15 * (1 + q), b.y + Math.sin(a) * eggS * 0.15 * (1 + q)); ctx.lineTo(b.x + Math.cos(a) * eggS * 0.35 * (1 + q), b.y + Math.sin(a) * eggS * 0.35 * (1 + q)); ctx.stroke(); } ctx.restore(); }
      };
    } else { // the school swims along the channel and carries the egg to the gap
      const sp = 0.62, ph = (TT) => -1.2 + sp * (TT - 0.2), tDrop = 0.2 + (gap0 - 0.03 + 1.2) / sp;
      eA = clamp(ph(T) + 0.03, 0, gap0); eD = seg(T, tDrop, tDrop + 0.4); done = seg(T, tDrop + 0.4, tDrop + 0.75);
      toy.under = () => {
        const L = FISH.len * 1.4 * k, phS = ph(T);
        ctx.save();
        ctx.strokeStyle = 'rgba(225,250,255,0.5)'; ctx.lineCap = 'round'; ctx.lineWidth = Math.max(1.5, k * 0.03); ctx.setLineDash([k * 0.16, k * 0.22]); ctx.lineDashOffset = -t * k * 0.6;
        for (let j = 0; j < 2; j++) { ctx.beginPath(); arc(ctx, C, floor - eggS * (0.35 + 0.35 * j), phS - 0.55, phS + 0.05); ctx.stroke(); }
        ctx.restore();
        for (let j = 0; j < 7; j++) {
          const phi = phS - j * 0.075 - (j % 2) * 0.03, lift = eggS * (0.22 + 0.62 * ((j * 0.37) % 1)) + Math.sin(t * 2.2 + j) * eggS * 0.06, p = at(phi, lift);
          ctx.save(); ctx.globalAlpha *= Math.min(seg(T, 0.1, 0.5), 1 - seg(T, 3.7, 4.2)); drawFish(ctx, p.x, p.y, L, -phi + Math.sin(t * 3 + j) * 0.08, t, { flip: 1, beat: t * 10 + j * 1.3 }); ctx.restore();
        }
      };
    }
  } else if (plan.haz === 'door') { // a gate door: turn the shut door under the egg, it slides open, the egg drops
    vAlpha = 0;
    const d = ease(seg(T, 0.6, 1.4)); th = -gap0 * d;
    hand = dragHand(at, T, 0.5, 1.4, 0.5, 0.5 - gap0);
    door = ease(seg(T, 1.9, 2.25)) * (1 - seg(T, 3.6, 3.9));
    eD = seg(T, 2.3, 2.7); done = seg(T, 2.7, 3.05);
  } else if (m === 'ride') { // 2026-11-23: the current or the wind is a help: a turn puts a gap downstream, the flow carries the egg in
    vAlpha = 0; toy = { deco: { thorns: 0 }, look: null };
    const d = ease(seg(T, 0.5, 1.3)); th = -0.2 * d; hand = dragHand(at, T, 0.4, 1.3, 0.5, 0.3); // the gap comes round a little, downstream of the egg
    const gNow = gap0 + th, P = seg(T, 1.4, 2.4); eA = gNow * ease(P); slideV = P > 0 && P < 1 ? Math.sin(P * Math.PI) : 0;
    eD = seg(T, 2.45, 2.85); done = seg(T, 2.85, 3.2);
    const gust = plan.kind === 'gusts';
    toy.over = () => {
      const a = Math.min(seg(T, 0.1, 0.4), 1 - seg(T, 2.6, 3.0)); ctx.save(); ctx.globalAlpha *= a; ctx.lineCap = 'round';
      if (!gust) { ctx.strokeStyle = 'rgba(80,170,230,0.8)'; ctx.lineWidth = Math.max(2, eggS * 0.07); ctx.setLineDash([eggS * 0.35, eggS * 0.3]); ctx.lineDashOffset = t * eggS * 2.2; for (let j = 0; j < 3; j++) { ctx.beginPath(); const r = floor - eggS * (0.3 + 0.45 * j); for (let i = 0; i <= 24; i++) { const ph = -0.9 + 1.8 * i / 24, X = C.x + Math.sin(ph) * r, Y = C.y + Math.cos(ph) * r; if (i) ctx.lineTo(X, Y); else ctx.moveTo(X, Y); } ctx.stroke(); } }
      else { const e0 = at(0, eggS * 0.5); ctx.strokeStyle = 'rgba(255,255,255,0.9)'; ctx.lineWidth = Math.max(2, eggS * 0.06); for (let i = 0; i < 5; i++) { const u = ((t * 1.3 + i * 0.23) % 1), Y = e0.y - eggS * (0.1 + 0.35 * (i % 3)) - U * 0.12 * (i % 2), X = x + w * (1.2 - u * 1.3); ctx.beginPath(); ctx.moveTo(X, Y); ctx.quadraticCurveTo(X - w * 0.12, Y - eggS * 0.15, X - w * 0.22, Y); ctx.stroke(); } }
      ctx.restore();
    };
  } else { // 'wait': something blocks the way for a beat (thorns, a web, the weather), then the egg goes through
    vAlpha = 0;
    const up = T < 1.7 ? 1 : 1 - seg(T, 1.7, 2.0);
    haz = { k: 'thorns', up };
    if (plan.kind === 'spider') { vAlpha = up; vA = vEnd; } // the spider is on the stage while its web (the thorns) shuts the gap, then it is gone
    const d = ease(seg(T, 2.05, 2.8)); th = -gap0 * d;
    hand = dragHand(at, T, 1.95, 2.8, 0.5, 0.5 - gap0);
    eD = seg(T, 2.85, 3.25); done = seg(T, 3.25, 3.6);
  }

  { // the camera (see the veil above): a step back for a scene with a villain, and a step to the villain's side
    const zm = o.zoom || (Wd && (hp || ['turn', 'tap', 'rooster', 'stone', 'drop', 'frog', 'fish', 'faceoff'].includes(plan.move) || (plan.move === 'toy' && NEW_TOYS.includes(plan.toy)) || plan.kind === 'spider') ? 0.8 : Wd && plan.move === 'floor' ? 0.86 : 1), pan = SG && SG.pan ? SG.pan * w : !act && plan.kind && vAlpha > 0 && zm !== 1 ? 0.05 * w : 0; // a portrait villain stands on the left
    if (zm !== 1 || pan) { ctx.translate(cx + pan, y + h); ctx.scale(zm, zm); ctx.translate(-cx, -(y + h)); }
  }
  if (act && act.under) { ctx.save(); try { Object.assign(SA, { T, t, m, th, fx: plan.fx, eA }); act.under(ctx, SA); } catch (e) { SA._ar = null; } ctx.restore(); } // 0.8.17 bandit: an actor under the ring (its edge pinches his arm)
  // ---- the ring: a thick slab with one gap (the game's own ring when it is given)
  const gapA = (toy && toy.gap != null ? toy.gap : gap0) + th, gw = 0.24;
  if (Wd) Wd.ring(ctx, C, kW, gapA, t, door, toy ? toy.deco : null);
  else {
    ctx.lineCap = 'round';
    for (const [lw, col] of [[band + 4, o.ringEdge || '#5a3416'], [band, o.ring || '#b9854e']]) {
      ctx.strokeStyle = col; ctx.lineWidth = lw;
      arc(ctx, C, R, gapA + gw / 2, gapA + TAU - gw / 2);
    }
    ctx.strokeStyle = 'rgba(255,255,255,0.35)'; ctx.lineWidth = band * 0.22;
    arc(ctx, C, R - band * 0.25, gapA + gw / 2 + 0.03, gapA + TAU - gw / 2 - 0.03);
  }
  if (door != null && !Wd && door < 1) { // stand-in doors: two red leaves closing the gap from its edges
    ctx.lineCap = 'butt'; const sh = (gw / 2) * (1 - door);
    for (const [lw, col] of [[band + 4, '#4a140c'], [band, '#b8432f']]) { ctx.strokeStyle = col; ctx.lineWidth = lw; arc(ctx, C, R, gapA - gw / 2, gapA - gw / 2 + sh); arc(ctx, C, R, gapA + gw / 2 - sh, gapA + gw / 2); }
  }
  // the basket
  if (Wd) Wd.nest(ctx, nest.x, nest.y, Math.max(Z * 0.7, eggS * 2.2), done, t); else drawBasket(ctx, nest.x, nest.y, Z * 0.42, done);
  // a hazard's warning mark on the floor, and its fall
  if (haz && haz.k === 'thorns') {
    if (plan.kind === 'vines' && haz.up > 0.02) { ctx.save(); ctx.lineCap = 'round'; ctx.strokeStyle = '#2f6a2a'; ctx.lineWidth = Math.max(3, eggS * 0.1); ctx.beginPath(); for (let i = 0; i <= 16; i++) { const p = at(0.12 + th + 0.2 * haz.up * (i / 16), Math.sin(i * 1.3) * eggS * 0.06); if (i) ctx.lineTo(p.x, p.y); else ctx.moveTo(p.x, p.y); } ctx.stroke(); ctx.restore(); }
    for (let i = 0; i < 3; i++) { const p = at(0.14 + i * 0.07 + th, 0), up = haz.up; thornTri(ctx, p.x, p.y, Z * 0.07 * (0.25 + 0.75 * up), Math.atan2(C.x - p.x, p.y - C.y)); }
  } else if (haz) {
    const mk = at(0, 0);
    if (haz.warn > 0) { ctx.save(); ctx.globalAlpha *= haz.warn * (0.55 + 0.45 * Math.sin(T * 14)); ctx.fillStyle = '#ff3a2a'; ctx.beginPath(); ctx.ellipse(mk.x, mk.y - Z * 0.01, Z * 0.13, Z * 0.04, 0, 0, TAU); ctx.fill(); ctx.restore(); }
    const hk = haz.k === 'curse' || haz.k === 'thornorb' ? haz.k : haz.k;
    if (hk === 'curse' || hk === 'thornorb') { drawVillainPortrait(ctx, hk, mk.x, mk.y - Z * 0.09, Z * 0.2, t); }
    else if (hk === 'lava') { // 0.8.14 (mykee: the Lava rocks card must show lava rocks): the game's own rock, target mark and melt hole
      const rr = eggS * 0.46, f = ease(haz.fall), top = y - rr * 2, land = mk.y - rr * 0.8, rx = mk.x + (1 - f) * Z * 0.3, ry = top + (land - top) * f;
      if (haz.warn > 0 && haz.boom <= 0) { // the dashed target ring the game draws while a rock flies in
        ctx.save(); ctx.beginPath(); ctx.arc(mk.x, mk.y - eggS * 0.2, eggS * (0.8 - 0.25 * haz.fall), 0, TAU); ctx.fillStyle = `rgba(255,90,20,${0.12 + 0.18 * haz.fall})`; ctx.fill();
        ctx.strokeStyle = `rgba(255,214,90,${0.6 + 0.4 * Math.sin(T * 16)})`; ctx.lineWidth = Math.max(3, eggS * 0.06); ctx.setLineDash([eggS * 0.15, eggS * 0.11]); ctx.stroke(); ctx.restore();
      }
      if (haz.boom > 0.45) drawMeltHole(ctx, mk.x, mk.y + band / 2, eggS * 1.7 * ease(seg(haz.boom, 0.45, 0.8)), band, t, 1); // then it melts a hole in the ring
      if (haz.fall > 0 && haz.boom <= 0) {
        ctx.save(); ctx.strokeStyle = 'rgba(60,40,35,0.4)'; ctx.lineCap = 'round'; ctx.lineWidth = rr * 0.7; ctx.beginPath(); ctx.moveTo(rx, ry); ctx.lineTo(rx + Z * 0.07, ry - rr * 2.6); ctx.stroke(); ctx.restore();
        drawLavaRock(ctx, rx, ry, rr * (0.55 + 0.45 * f), t, 1);
      } else if (haz.boom > 0 && haz.boom < 0.8) { // it sits glowing on the ring, then sinks into the hole it melts
        const sink = seg(haz.boom, 0.45, 0.8);
        ctx.save(); ctx.globalAlpha *= 1 - sink; drawLavaRock(ctx, mk.x, land + rr * 0.9 * sink, rr * (1 - 0.3 * sink), t, 1); ctx.restore();
        if (haz.boom < 0.3) burst(ctx, mk.x, mk.y - Z * 0.05, Z * 0.22 * (0.5 + haz.boom * 2), 1 - haz.boom / 0.3, '#ff8a3a');
      }
    }
    else if (hk === 'emberspit') { // 0.8.18 an ember lobs in from the left and lands by the egg as a bubbling pool
      const rr = eggS * 0.3, f = haz.fall, top = y + eggS * 0.4, land = mk.y - rr * 0.6, ex = mk.x - (1 - f) * Z * 0.5, ey = land + (top - land) * (1 - f) - Math.sin(Math.PI * f) * eggS * 0.6;
      if (haz.fall > 0 && haz.boom <= 0) drawEmberBall(ctx, ex, ey, rr * (0.7 + 0.3 * f), t, calm);
      else if (haz.boom > 0) {
        const g = ease(Math.min(1, haz.boom * 3));
        ctx.save(); ctx.fillStyle = '#5a1606'; ctx.beginPath(); ctx.ellipse(mk.x, mk.y - band * 0.05, eggS * 0.9 * g, eggS * 0.22 * g, 0, Math.PI, TAU); ctx.fill();
        ctx.fillStyle = '#e8420c'; ctx.beginPath(); ctx.ellipse(mk.x, mk.y - band * 0.05, eggS * 0.8 * g, eggS * 0.17 * g, 0, Math.PI, TAU); ctx.fill();
        ctx.fillStyle = '#ffe696'; ctx.beginPath(); ctx.ellipse(mk.x, mk.y - band * 0.05, eggS * 0.38 * g, eggS * 0.08 * g, 0, Math.PI, TAU); ctx.fill(); ctx.restore();
        if (haz.boom < 0.4) burst(ctx, mk.x, mk.y - Z * 0.04, Z * 0.18 * (0.5 + haz.boom * 2), 1 - haz.boom / 0.4, '#ff8a3a');
      }
    }
    else if (hk === 'icicles') { // 0.8.14: the game's own icicle hangs over the mark, shakes, then drops and shatters
      const ih = eggS * 1.5, hang = y + ih * 0.5 + 2, land = mk.y - ih * 0.5, f = haz.fall * haz.fall, shake = haz.warn > 0 && haz.fall <= 0 ? Math.sin(T * 38) * eggS * 0.035 * haz.warn : 0;
      if (haz.boom <= 0) drawIcicle(ctx, mk.x + shake, hang + (land - hang) * f, ih, t);
      else if (haz.boom < 1) burst(ctx, mk.x, mk.y - Z * 0.05, Z * 0.22 * (0.5 + haz.boom), 1 - haz.boom, '#d9f4ff');
    }
    else if (haz.boom <= 0 || haz.boom < 1) {
      const top = y + Z * 0.2, sy = top + (mk.y - Z * 0.1 - top) * ease(haz.fall);
      if (haz.boom <= 0) { ctx.beginPath(); ctx.arc(mk.x, sy, Z * 0.16, 0, TAU); ctx.fillStyle = 'rgba(30,36,52,0.85)'; ctx.fill(); ctx.lineWidth = 2.5; ctx.strokeStyle = '#ff6a4a'; ctx.stroke(); drawVillainPortrait(ctx, hk, mk.x, sy, Z * 0.3, t); }
      if (haz.boom > 0) burst(ctx, mk.x, mk.y - Z * 0.05, Z * 0.22 * (0.5 + haz.boom), 1 - haz.boom, hk === 'icicles' ? '#d9f4ff' : hk === 'lightning' ? '#fff27a' : '#ff8a3a');
    }
  }
  // ---- the villain: its own rig acting the scene (howact.js), else its portrait on the ring
  let AR = null;
  if (act) {
    ctx.save();
    try { SA.T = T; SA.t = t; SA.m = m; SA.th = th; SA.fx = plan.fx; SA.eA = eA; AR = act.draw(ctx, SA); } catch (e) { AR = null; if (!ERR1) { ERR1 = true; try { console.warn('howto actor', plan.kind, e); } catch (e2) { /* no console */ } } }
    ctx.restore();
    if (AR && AR.bonk > 0 && AR.bonk < 1) { ctx.save(); ctx.globalAlpha *= 1 - seg(AR.bonk, 0.6, 1); word(ctx, AR.word || 'BONK!', clamp(AR.x, x + Z * 0.3, x + w - Z * 0.3), Math.max(y + Z * 0.16, AR.y), Z * 0.15 * (1 + 0.3 * Math.sin(Math.min(1, AR.bonk * 2.5) * Math.PI)), '#fff', '#c8321e'); ctx.restore(); }
  }
  if (!AR && vAlpha > 0.01 && plan.kind) {
    const v = at(vA, vLift);
    ctx.save(); ctx.globalAlpha *= vAlpha;
    // knocked back (bonk / blast): off to the left, a little up, then tumbling down out of the vault
    const kb = vOff && (vFx === 'bonk' || vFx === 'blast') ? ease(fxK) : 0, kx = -w * (Wd ? 0.26 : 0.45) * kb, ky = -Z * 0.3 * Math.sin(Math.PI * Math.min(1, kb * 1.4)) + U * 0.7 * kb * kb;
    ctx.translate(v.x + kx, v.y + ky);
    if (vRot) ctx.rotate(vRot);
    ctx.rotate(-vA * 0.6);
    if (vFx === 'flee') ctx.scale(-1, 1);
    const held = vFx === 'freeze' || vFx === 'stop' || vFx === 'glue';
    // frozen: the game's own ice (status.js): the villain's colours go icy inside a shell that follows its outline
    if (vFx === 'freeze' && fxK > 0) statusDraw(ctx, { x0: -vD * 0.56, y0: -vD * 0.56, x1: vD * 0.56, y1: vD * 0.56 }, (c) => drawVillainPortrait(c, plan.kind, 0, 0, vD, 0), { k: 'ice', age: fxK * 1.2, left: 9, hold: 0, zap: -1, crack: 0, seed: 7 + plan.kind.length }, {});
    else drawVillainPortrait(ctx, plan.kind, 0, 0, vD, held ? 0 : t);
    if (vFx === 'glue' && fxK > 0) { ctx.globalAlpha *= 0.6; ctx.fillStyle = '#c9a3ff'; ctx.beginPath(); ctx.ellipse(0, vD * 0.3, vD * 0.5, vD * 0.16, 0, 0, TAU); ctx.fill(); }
    if (vFx === 'bubble' && fxK > 0) { ctx.strokeStyle = 'rgba(160,230,255,0.9)'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(0, 0, vD * 0.55, 0, TAU); ctx.stroke(); }
    ctx.restore();
    if ((vFx === 'zap' || vFx === 'dizzy' || vFx === 'flip' || vFx === 'stop') && fxK > 0 && fxK < 1) dizzy(ctx, v.x, v.y - vD * 0.5, vD * 0.35, T, 1 - fxK);
    if (vFx === 'zap' && fxK < 0.4) zig(ctx, v.x, v.y, vD * 0.6, T, 1 - fxK / 0.4);
    if ((vFx === 'bonk' || vFx === 'flip') && fxK < 0.5) { ctx.save(); ctx.globalAlpha *= 1 - seg(fxK, 0.3, 0.5); word(ctx, 'BONK!', Math.max(x + Z * 0.45, Math.min(cx - w * 0.12, v.x + vD * 0.3)), Math.max(y + Z * 0.16, v.y - vD * 0.3), Z * 0.16 * (1 + 0.3 * (1 - seg(fxK, 0, 0.12))), '#fff', '#c9342c'); ctx.restore(); }
    if (vFx === 'blast' && fxK < 0.4) burst(ctx, v.x, v.y, vD * (0.45 + fxK), 1 - fxK / 0.4, PCOL[plan.power] || '#ff8a3a');
  }
  // ---- the toys: the orb on its way, the portals (the game's own art through o.world)
  if (toy && toy.orb && toy.orb.a > 0.01) { ctx.save(); ctx.globalAlpha *= toy.orb.a; if (Wd && Wd.orb) Wd.orb(ctx, toy.orb.type, toy.orb.x, toy.orb.y, eggS * 0.42, t); else { ctx.fillStyle = '#ff8a3a'; ctx.beginPath(); ctx.arc(toy.orb.x, toy.orb.y, eggS * 0.35, 0, TAU); ctx.fill(); } ctx.restore(); }
  if (toy && toy.orb2 && Wd && Wd.orb) Wd.orb(ctx, toy.orb2.type, toy.orb2.x, toy.orb2.y, eggS * 0.42, t);
  if (toy && toy.under) toy.under();
  if (toy && toy.portal && Wd && Wd.portal) {
    const P = toy.portal;
    Wd.portal(ctx, P.pin.x, P.pin.y, kW * 0.9, t, false);
    if (P.outA > 0.01) { ctx.save(); ctx.globalAlpha *= P.outA; Wd.portal(ctx, P.pout.x, P.pout.y, kW * 0.9 * (0.6 + 0.4 * P.outA), t, true); ctx.restore(); }
  }
  // ---- the egg: on the floor at its angle, or dropping through the gap to the basket
  if (toy && toy.portal) { // in at the purple swirl, out of the orange one, down into the basket
    const P = toy.portal, land = nest.y - (Wd ? eggS * 0.42 : Z * 0.08);
    if (done > 0) drawE(nest.x, land, eggS, false, false);
    else if (P.sink < 1) { const b = at(eA, eggS * 0.5); ctx.save(); ctx.translate(P.pin.x, P.pin.y); ctx.rotate(P.sink * 5); ctx.scale(1 - P.sink * 0.95, 1 - P.sink * 0.95); ctx.translate(-P.pin.x, -P.pin.y); drawE(b.x + (P.pin.x - b.x) * P.sink, b.y + (P.pin.y - b.y) * P.sink, eggS, false, false); ctx.restore(); }
    else if (P.pop > 0) { const k = P.drop * P.drop, ex = P.pout.x + (nest.x - P.pout.x) * P.drop, ey = P.pout.y + (land - P.pout.y) * k; ctx.save(); const sc = 0.1 + 0.9 * P.pop; ctx.translate(ex, ey); ctx.scale(sc, sc); ctx.translate(-ex, -ey); drawE(ex, ey, eggS, false, false); ctx.restore(); }
  } else {
    if (btn && btn.saved && btn.saved.a > 0) { ctx.save(); ctx.globalAlpha *= btn.saved.a; drawE(btn.saved.x, btn.saved.y, eggS, false, false); ctx.restore(); } // the egg saved before the scene's (its spark fills the badge)
    if (toy && toy.twin && toy.twin.show) { // the twin: a second egg beside the first, home just after it
      const b2 = at(toy.twin.a, eggS * 0.5), land = nest.y - (Wd ? eggS * 0.42 : Z * 0.08), q = toy.twin.eD;
      const ex = done > 0 ? nest.x - eggS * 0.55 : b2.x + (nest.x - eggS * 0.55 - b2.x) * q, ey = done > 0 ? land : b2.y + (land - b2.y) * q * q;
      drawE(ex, ey, eggS, false, false);
    }
  {
    const base = at(eA, eggS * 0.5 + eLift);
    let ex = base.x, ey = base.y, sq = 1;
    if (eAlpha < 1) { ctx.save(); ctx.globalAlpha *= clamp(eAlpha, 0, 1); }
    if (o._drop && o._drop.fall < 1 && m === 'drop') { // the egg from above, falling onto the villain
      const top = y - U * 0.12, tgt = at(o._drop.vA, vD * 0.75);
      if (o._drop.fall > 0) { const k = o._drop.fall * o._drop.fall; drawE(tgt.x, top + (tgt.y - top) * k, eggS, false); }
      else drawE(tgt.x, top, eggS, false);
    }
    const land = nest.y - (Wd ? eggS * 0.42 : Z * 0.08);
    if (eD > 0) { const k = eD * eD; ex = base.x + (nest.x - base.x) * eD; ey = base.y + (land - base.y) * k; if (eD >= 1) sq = 1; }
    if (o._carry != null && o._carry > 0) { const k = o._carry; ex = base.x + (nest.x - base.x) * k; ey = base.y + (land - base.y) * k - Math.sin(k * Math.PI) * U * 0.35; ctx.save(); ctx.globalAlpha *= 1 - seg(k, 0.85, 1); drawStrikeChick(ctx, 'phoenix', ex, ey - eggS * 0.7, eggS * 1.3, t, {}); ctx.restore(); }
    if (done > 0) { ex = nest.x; ey = land; }
    if (o._bubble && !eD && !done) { ctx.save(); ctx.strokeStyle = 'rgba(150,225,255,0.95)'; ctx.lineWidth = 3; ctx.fillStyle = 'rgba(190,240,255,0.25)'; ctx.beginPath(); ctx.arc(ex, ey, eggS * 0.75, 0, TAU); ctx.fill(); ctx.stroke(); ctx.restore(); }
    const worry = AR ? !eD && !done && !!AR.threat : !eD && vAlpha > 0.5 && plan.kind && Math.abs(vA - eA) < 0.7;
    if (slideV > 0.15 && !eD) { // sliding on ice: speed lines trail the egg
      ctx.save(); ctx.strokeStyle = 'rgba(255,255,255,0.85)'; ctx.lineCap = 'round'; ctx.lineWidth = Math.max(2, eggS * 0.07);
      for (let i = 0; i < 3; i++) { const a0 = eA - 0.1 - i * 0.025, a1 = a0 - 0.18 * slideV, rr2 = floor - eggS * (0.25 + 0.25 * i); ctx.globalAlpha *= 0.9; ctx.beginPath(); for (let j = 0; j <= 8; j++) { const a = a0 + (a1 - a0) * (j / 8); const X = C.x + Math.sin(a) * rr2, Y = C.y + Math.cos(a) * rr2 - eLift; if (j) ctx.lineTo(X, Y); else ctx.moveTo(X, Y); } ctx.stroke(); }
      ctx.restore();
    }
    // 0.8.14 (mykee: "it does not look like the mice is carrying the eggs"): an egg the rats push really rolls, and rights
    // itself as it drops
    const rollA = plan.kind === 'rats' && !done ? ((eA * floor) / (eggS * 0.5)) * 0.55 * (1 - clamp(eD * 2.5, 0, 1)) : 0;
    if (rollA) { ctx.save(); ctx.translate(ex, ey); ctx.rotate(rollA); ctx.translate(-ex, -ey); }
    if (!(toy && toy.look && toy.look.hide)) drawE(ex, ey, eggS * sq, stone, worry, toy ? toy.look : null); // hide: the toy draws its own actor there (the bulk chick)
    if (rollA) ctx.restore();
    if (eAlpha < 1) ctx.restore();
    if (miss > 0 && miss < 1) { ctx.save(); ctx.globalAlpha *= Math.min(1, miss * 6) * (1 - seg(miss, 0.8, 1)); cross(ctx, ex - eggS * 0.62, ey + eggS * 0.1, Z * 0.085); ctx.restore(); } // the egg is lost: a red cross (the tick's twin)
  }
  }
  if (toy && toy.over) toy.over();
  if (toy && toy.word && toy.word.k < 1) { const e0 = at(eA, eggS * 1.6), q = toy.word.k; ctx.save(); ctx.globalAlpha *= 1 - seg(q, 0.7, 1); word(ctx, toy.word.s, toy.word.red ? clamp(e0.x - eggS * 0.9, x + Z * 0.4, x + w * 0.5) : clamp(e0.x, x + Z * 0.4, x + w - Z * 0.4), toy.word.red ? Math.max(y + Z * 0.3, e0.y + eggS * 0.2) : e0.y - q * Z * 0.08, Z * 0.15 * (1 + 0.35 * (1 - seg(q, 0, 0.15))), toy.word.red ? '#fff' : '#ffe14a', toy.word.red ? '#c9342c' : '#8a4a00'); ctx.restore(); }
  if (toy && toy.burst && toy.burst.k < 1) { const B = toy.burst; ctx.save(); ctx.globalAlpha *= 1 - B.k; ctx.strokeStyle = B.col; ctx.lineWidth = Math.max(2, eggS * 0.12 * (1 - B.k)); ctx.beginPath(); ctx.arc(B.x, B.y, eggS * (0.4 + 0.9 * B.k), 0, TAU); ctx.stroke(); ctx.restore(); }
  if (toy && toy.flash) { // the glow chick's flash: a bright ring that sweeps out over the thorns
    const F = toy.flash, R2 = Z * (0.1 + 0.55 * ease(F.k));
    ctx.save(); ctx.globalAlpha *= 1 - F.k;
    ctx.fillStyle = 'rgba(255,246,170,0.35)'; ctx.beginPath(); ctx.arc(F.x, F.y, R2, 0, TAU); ctx.fill();
    ctx.strokeStyle = '#fff27a'; ctx.lineWidth = Math.max(2, Z * 0.025); ctx.stroke();
    ctx.restore();
  }
  // the power or the rooster on its way
  if (btn && btn.m != null) { // the real HUD badge (render/strike.js): its meter, its gold heartbeat, a pulsing ring while it waits for the tap
    if (btn.spark) { const S2 = btn.spark; ctx.save(); ctx.globalAlpha *= 1 - seg(S2.k, 0.85, 1); ctx.fillStyle = 'rgba(255,230,120,0.45)'; ctx.beginPath(); ctx.arc(S2.x, S2.y, Z * 0.09, 0, TAU); ctx.fill(); star5(ctx, S2.x, S2.y, Z * 0.07 * (1 + 0.25 * Math.sin(S2.k * 9))); ctx.restore(); }
    if (T > 1.0 && T < 1.7) { const q = calm ? 0.4 : ((T - 1.0) * 1.6) % 1; ctx.save(); ctx.globalAlpha *= (1 - q) * 0.9; ctx.strokeStyle = '#ffcf3a'; ctx.lineWidth = Math.max(3, btn.r * 0.16 * (1 - q)); ctx.beginPath(); ctx.arc(btn.x, btn.y, btn.r * (1.15 + 0.6 * q), 0, TAU); ctx.stroke(); ctx.restore(); }
    drawStrikeButton(ctx, btn.x - btn.r, btn.y - btn.r, btn.r * 2, { id: btn.id, m: btn.m, busy: btn.busy, t: T, fullT: 1.0, wobT: -9, pressed: !!(hand && hand.press), calm });
  } else if (btn) {
    ctx.save();
    const pr = btn.r * (hand && hand.press ? 0.92 : 1);
    ctx.beginPath(); ctx.arc(btn.x, btn.y + 3, pr, 0, TAU); ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.fill();
    ctx.beginPath(); ctx.arc(btn.x, btn.y, pr, 0, TAU); ctx.fillStyle = btn.id === 'rooster' ? '#ffcf4a' : '#fff4dc'; ctx.fill(); ctx.lineWidth = 3; ctx.strokeStyle = '#7a4a12'; ctx.stroke();
    if (btn.id === 'rooster') { if (o.rooster) o.rooster(ctx, btn.x, btn.y, pr * 1.3); }
    else drawStrikeChick(ctx, btn.id, btn.x, btn.y + pr * 0.15, pr * 1.45, t, {});
    ctx.restore();
  }
  if (shot) {
    const col = PCOL[btn.id] || '#fff';
    ctx.save(); ctx.globalAlpha *= 0.9;
    if (btn.id === 'rooster' && o.rooster) o.rooster(ctx, shot.x, shot.y, Z * 0.32);
    else if (btn.m != null) { ctx.globalAlpha = fade; drawStrikeChick(ctx, btn.id, shot.x, shot.y, Z * 0.26, t, { mood: 'ready', feet: false, fog: false, wing: Math.abs(Math.sin(t * 24)), trail: 0.8, stretch: 0.18 * Math.sin(shot.k * Math.PI) }); } // the chick itself flies the arc
    else { ctx.fillStyle = col; ctx.beginPath(); ctx.arc(shot.x, shot.y, Z * 0.05, 0, TAU); ctx.fill(); ctx.globalAlpha *= 0.4; ctx.beginPath(); ctx.arc(shot.x, shot.y, Z * 0.09, 0, TAU); ctx.fill(); }
    ctx.restore();
  }
  // the win: a tick over the basket
  if (done > 0) { ctx.save(); ctx.globalAlpha *= Math.min(1, done * 2); tick(ctx, nest.x + Z * 0.27, nest.y - Z * 0.2, Z * 0.1 * (0.6 + 0.4 * ease(done))); ctx.restore(); }
  // the hand on top of everything
  if (hand && hand.a > 0.01) drawHand(ctx, hand.x, hand.y, Z * 0.26, hand.press, hand.a * fade);
  ctx.restore();
}

// a hand that presses at angle a0 on the ring and drags to a1 between t0 and t1 (lift: how far above the floor)
function dragHand(at, T, t0, t1, a0, a1, lift = 0) {
  const a = seg(T, t0 - 0.3, t0) * (1 - seg(T, t1 + 0.1, t1 + 0.4));
  const k = ease(seg(T, t0, t1)), p = at(a0 + (a1 - a0) * k, lift - 6);
  return { x: p.x, y: p.y, press: T >= t0 && T <= t1 + 0.05, a };
}
function tapHand(b, T, t0, t1) {
  const a = seg(T, t0 - 0.35, t0) * (1 - seg(T, t1 + 0.1, t1 + 0.4));
  const press = T >= t0 + 0.12 && T <= t1;
  return { x: b.x + b.r * 0.15, y: b.y + b.r * 0.2 + (press ? 0 : b.r * 0.3), press, a };
}
function arc(ctx, C, r, a0, a1) { // angles from straight down, clockwise on screen
  ctx.beginPath();
  const n = 48;
  for (let i = 0; i <= n; i++) { const a = a0 + (a1 - a0) * (i / n), x = C.x + Math.sin(a) * r, y = C.y + Math.cos(a) * r; if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y); }
  ctx.stroke();
}
function rr(ctx, x, y, w, h, r) { ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); }
// the game's egg: cream shell, a face; worried when a villain is close, grey stone when it is a stone egg
function egg(ctx, x, y, s, stone, T, worry) {
  const w = s * 0.78, h = s;
  ctx.save(); ctx.translate(x, y);
  if (worry) ctx.rotate(Math.sin(T * 22) * 0.08);
  ctx.beginPath();
  for (let i = 0; i <= 24; i++) { const a = (i / 24) * TAU, sy = Math.sin(a), px = (w / 2) * Math.cos(a) * (1 + 0.13 * sy), py = (h / 2) * sy; if (i) ctx.lineTo(px, py); else ctx.moveTo(px, py); }
  ctx.closePath();
  const g = ctx.createLinearGradient(-w / 2, -h / 2, w / 2, h / 2);
  if (stone) { g.addColorStop(0, '#c9c4bd'); g.addColorStop(1, '#7d776f'); } else { g.addColorStop(0, '#ffffff'); g.addColorStop(1, '#f1dcb6'); }
  ctx.fillStyle = g; ctx.fill(); ctx.lineWidth = Math.max(1.5, s * 0.06); ctx.strokeStyle = stone ? '#3e3a35' : '#6b4526'; ctx.stroke();
  // face
  const ey = h * 0.06, ex = w * 0.2, er = s * 0.065;
  ctx.fillStyle = '#2a1608';
  for (const sx of [-1, 1]) { ctx.beginPath(); ctx.ellipse(sx * ex, ey, er * 0.85, er * (worry ? 1.25 : 1), 0, 0, TAU); ctx.fill(); }
  ctx.fillStyle = '#fff'; for (const sx of [-1, 1]) { ctx.beginPath(); ctx.arc(sx * ex + er * 0.3, ey - er * 0.35, er * 0.35, 0, TAU); ctx.fill(); }
  ctx.strokeStyle = '#2a1608'; ctx.lineWidth = Math.max(1, s * 0.04); ctx.beginPath();
  if (worry) ctx.arc(0, ey + h * 0.2, w * 0.08, Math.PI * 1.15, Math.PI * 1.85); else ctx.arc(0, ey + h * 0.09, w * 0.1, 0.2, Math.PI - 0.2);
  ctx.stroke();
  if (!stone) { ctx.fillStyle = 'rgba(255,120,120,0.35)'; for (const sx of [-1, 1]) { ctx.beginPath(); ctx.ellipse(sx * w * 0.3, ey + h * 0.12, w * 0.08, h * 0.04, 0, 0, TAU); ctx.fill(); } }
  ctx.restore();
}
function drawBasket(ctx, x, y, w, glow) {
  ctx.save();
  if (glow > 0) { ctx.globalAlpha *= 0.5 * glow; ctx.fillStyle = '#fff3a0'; ctx.beginPath(); ctx.ellipse(x, y - w * 0.05, w * 0.7, w * 0.3, 0, 0, TAU); ctx.fill(); }
  ctx.restore(); ctx.save();
  const h = w * 0.36;
  ctx.fillStyle = '#5a3008'; ctx.beginPath(); ctx.ellipse(x, y - h * 0.5, w / 2, h * 0.22, 0, 0, TAU); ctx.fill();
  ctx.beginPath(); ctx.moveTo(x - w / 2, y - h * 0.5); ctx.quadraticCurveTo(x - w * 0.45, y + h * 0.45, x, y + h * 0.48); ctx.quadraticCurveTo(x + w * 0.45, y + h * 0.45, x + w / 2, y - h * 0.5); ctx.closePath();
  ctx.fillStyle = '#c98f3a'; ctx.fill(); ctx.lineWidth = 2.5; ctx.strokeStyle = '#4a2a0a'; ctx.stroke();
  ctx.strokeStyle = 'rgba(90,50,10,0.55)'; ctx.lineWidth = 1.5;
  for (let i = 1; i < 3; i++) { ctx.beginPath(); ctx.moveTo(x - w * (0.48 - i * 0.04), y - h * 0.5 + i * h * 0.3); ctx.quadraticCurveTo(x, y - h * 0.3 + i * h * 0.33, x + w * (0.48 - i * 0.04), y - h * 0.5 + i * h * 0.3); ctx.stroke(); }
  ctx.lineWidth = 4; ctx.strokeStyle = '#e8b45a'; ctx.beginPath(); ctx.ellipse(x, y - h * 0.5, w / 2, h * 0.22, 0, 0, Math.PI); ctx.stroke();
  ctx.restore();
}
function thornTri(ctx, x, y, s, rot) {
  ctx.save(); ctx.translate(x, y); ctx.rotate(rot); ctx.beginPath(); ctx.moveTo(-s * 0.45, 0); ctx.lineTo(0, -s); ctx.lineTo(s * 0.45, 0); ctx.closePath(); ctx.fillStyle = '#d23a3a'; ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = '#3a0d0d'; ctx.stroke(); ctx.restore();
}
function dizzy(ctx, x, y, r, T, a) {
  ctx.save(); ctx.globalAlpha *= clamp(a * 2, 0, 1);
  for (let i = 0; i < 3; i++) { const an = T * 5 + (i * TAU) / 3, sx = x + Math.cos(an) * r, sy = y + Math.sin(an) * r * 0.35; star5(ctx, sx, sy, r * 0.28); }
  ctx.restore();
}
function star5(ctx, x, y, r) {
  ctx.beginPath(); for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + (i * Math.PI) / 5, rr2 = i % 2 ? r * 0.45 : r; ctx.lineTo(x + Math.cos(a) * rr2, y + Math.sin(a) * rr2); } ctx.closePath();
  ctx.fillStyle = '#ffd23a'; ctx.fill(); ctx.lineWidth = 1.5; ctx.strokeStyle = '#8a5a00'; ctx.stroke();
}
function zig(ctx, x, y, r, T, a) {
  ctx.save(); ctx.globalAlpha *= a; ctx.strokeStyle = '#fff27a'; ctx.lineWidth = 3; ctx.lineJoin = 'round';
  for (let k = 0; k < 4; k++) { const an = k * 1.6 + T * 3; ctx.beginPath(); ctx.moveTo(x + Math.cos(an) * r * 0.3, y + Math.sin(an) * r * 0.3); ctx.lineTo(x + Math.cos(an + 0.3) * r * 0.65, y + Math.sin(an + 0.3) * r * 0.65); ctx.lineTo(x + Math.cos(an - 0.1) * r * 0.8, y + Math.sin(an - 0.1) * r * 0.8); ctx.lineTo(x + Math.cos(an + 0.2) * r * 1.05, y + Math.sin(an + 0.2) * r * 1.05); ctx.stroke(); }
  ctx.restore();
}
function burst(ctx, x, y, r, a, col) {
  ctx.save(); ctx.globalAlpha *= clamp(a, 0, 1); ctx.fillStyle = col;
  ctx.beginPath(); for (let i = 0; i < 16; i++) { const an = (i * Math.PI) / 8, rr2 = i % 2 ? r * 0.5 : r; ctx.lineTo(x + Math.cos(an) * rr2, y + Math.sin(an) * rr2); } ctx.closePath(); ctx.fill();
  ctx.restore();
}
function word(ctx, str, x, y, size, fill, stroke) {
  ctx.save(); ctx.font = `800 ${Math.round(size)}px "Fredoka", "Baloo 2", system-ui, sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.lineJoin = 'round'; ctx.lineWidth = size * 0.28; ctx.strokeStyle = stroke; ctx.strokeText(str, x, y); ctx.fillStyle = fill; ctx.fillText(str, x, y); ctx.restore();
}
function cross(ctx, x, y, r) {
  ctx.save(); ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fillStyle = '#d23a2a'; ctx.fill(); ctx.lineWidth = 2.5; ctx.strokeStyle = '#fff'; ctx.stroke();
  ctx.lineWidth = r * 0.28; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(x - r * 0.4, y - r * 0.4); ctx.lineTo(x + r * 0.4, y + r * 0.4); ctx.moveTo(x + r * 0.4, y - r * 0.4); ctx.lineTo(x - r * 0.4, y + r * 0.4); ctx.stroke(); ctx.restore();
}
function tick(ctx, x, y, r) {
  ctx.save(); ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fillStyle = '#3cb043'; ctx.fill(); ctx.lineWidth = 2.5; ctx.strokeStyle = '#fff'; ctx.stroke();
  ctx.lineWidth = r * 0.28; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.beginPath(); ctx.moveTo(x - r * 0.45, y); ctx.lineTo(x - r * 0.1, y + r * 0.35); ctx.lineTo(x + r * 0.5, y - r * 0.35); ctx.stroke(); ctx.restore();
}
// an overshooting ease (a gate pops open)
function back01(u) { u = clamp(u, 0, 1); const c = 2.2; return 1 + (c + 1) * Math.pow(u - 1, 3) + c * Math.pow(u - 1, 2); }
// the gator on the stage floor at angle phi (the game's rig, render/bayou.js), face +1 = snout to the right
function gatorAt(ctx, at, phi, face, k, t, o, floor) {
  const p = at(phi, 0), s = GATOR.L * k * 0.85;
  ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(-phi + (o.nose || 0) * face); ctx.scale(face, 1);
  drawGator(ctx, s, t, { walk: 1, bend: floor, ...o });
  ctx.restore();
}

// ------------------------------------------------------------------ the harm beat (howToPlan(kind, { harm: true }))
// What the threat does to an egg, acted on the stage before the counter: the same ring, egg and nest, the threat in its
// own art (the eagle and the gator on their game rigs, the rest in their portraits). Times in seconds of HARM_T.
// set(q) hands the stage its timeline (ring turn th, egg angle eA, lift, alpha, hazard, hand) and toy layers (under/over/word/look).
function harmBeat(ctx, plan, T, t, S, set) {
  const { x, y, w, h, at, eggS, vD, vEnd, gap0, Z, U, Wd, kW, floor, band } = S, kind = plan.kind, H = plan.harm, q = { toy: {} }, Q = q.toy;
  const under = [], over = [];
  const pv = (X, Y, d, o2 = {}) => { ctx.save(); ctx.globalAlpha *= o2.a == null ? 1 : o2.a; ctx.translate(X, Y); if (o2.rot) ctx.rotate(o2.rot); if (o2.sx) ctx.scale(o2.sx, o2.sy || o2.sx); drawVillainPortrait(ctx, kind, 0, 0, d, o2.still ? 0 : t); ctx.restore(); };
  const say = (t0, s2 = H.word) => { if (T > t0 && T < t0 + 1.25) Q.word = { s: s2, k: seg(T, t0, t0 + 1.25), red: 1 }; };
  const lost = (t0, P) => over.push(() => { if (T > t0) { ctx.save(); ctx.globalAlpha *= seg(T, t0, t0 + 0.2) * (1 - seg(T, HARM_T - 0.35, HARM_T)); cross(ctx, P.x, P.y, Z * 0.1 * (0.7 + 0.3 * ease(seg(T, t0, t0 + 0.25)))); ctx.restore(); } });
  const E0 = at(0, eggS * 0.5), egg = (X, Y, look) => S.drawE(X, Y, eggS, false, true, look);
  const turnGap = (t0, t1) => { const d = ease(seg(T, t0, t1)); q.th = -gap0 * d; q.hand = dragHand(at, T, t0, t1, 0.5, 0.5 - gap0); return d; };
  const ty = H.t;
  if (ty === 'kits') { q.eA = kitsHarmEgg(T); q.eLift = eggS * 0.12 * seg(T, 0.35, 0.5); q.eAlpha = 1 - seg(T, 2.0, 2.4); say(1.5); lost(1.9, E0); } // 0.8.18 kits: carried out to mama's sack (howact.js draws the crew)
  else if (ty === 'sack') { Object.assign(q, bandHarmEgg({ band, floor, eggS, g0: gap0, k: Wd ? kW : Z / 2.5 }, T)); say(1.9); lost(2.1, at(q.eA, eggS * 0.5)); } // 0.8.17 bandit (0.8.18: cranked up to him, grabbed, into his sack)
  else if (ty === 'steal') { // it comes along the floor, takes the egg and goes off with it
    const walk = ease(seg(T, 0.2, 1.0)), go = ease(seg(T, 1.3, 2.3)), up = kind === 'octopus' ? 1 : 0;
    const vA = vEnd - 0.55 * (1 - walk) - 0.9 * go, v = at(vA, vD * 0.3 + up * go * U * 0.45);
    if (T > 1.05) { q.eA = -0.9 * go; q.eLift = up * go * U * 0.45 + eggS * 0.15 * seg(T, 1.05, 1.2); }
    q.eAlpha = 1 - seg(T, 2.0, 2.4);
    over.push(() => pv(v.x, v.y, vD, { rot: -vA * 0.6, a: 1 - seg(T, 2.0, 2.4) }));
    say(1.05); lost(1.7, E0);
  } else if (ty === 'snatch') { // it dives from the sky, grabs the egg and flies off with it
    const P0 = { x: x + w * 1.08, y: y - h * 0.1 }, hold = { x: E0.x, y: E0.y - eggS * 0.75 }, P2 = { x: x - w * 0.2, y: y - h * 0.15 };
    const dive = ease(seg(T, 0.25, 1.05)), go = ease(seg(T, 1.3, 2.25));
    const bx = T < 1.3 ? P0.x + (hold.x - P0.x) * dive : hold.x + (P2.x - hold.x) * go, by = T < 1.3 ? P0.y + (hold.y - P0.y) * dive : hold.y + (P2.y - hold.y) * go * go;
    if (T > 1.1) Q.look = { hide: 1 };
    const bird = () => {
      if ((kind === 'eagle' || kind === 'boss:eagle') && Wd) drawEagle(ctx, bx, by - eggS * 0.2, 3.0 * kW * 0.38 * (kind === 'boss:eagle' ? 1.15 : 1), t, T < 1.1 ? { w: { dive: 1 }, face: -1, pitch: 0.35 } : { w: { carry: 1 }, face: -1, phase: t * 6, toes: 1 });
      else pv(bx, by, vD, { rot: T < 1.1 ? -0.3 : 0.2 });
    };
    over.push(() => { if (T > 1.1) egg(bx, by + eggS * 0.75); bird(); });
    say(1.1); lost(1.75, E0);
  } else if (ty === 'fall') { // the warning glow under the egg, then it lands on it
    q.haz = { k: kind === 'boss:salamander' ? 'lava' : kind, warn: seg(T, 0.15, 0.6) * (1 - seg(T, 1.1, 1.2)), fall: seg(T, 0.75, 1.15), boom: seg(T, 1.15, 1.75) };
    if (T > 1.15) Q.look = { cracks: 3 };
    say(1.15); lost(1.5, { x: E0.x - eggS * 0.62, y: E0.y + eggS * 0.1 });
  } else if (ty === 'sting') { // it drifts down onto the egg, its sting cracks it, it drifts on
    const dn = ease(seg(T, 0.2, 1.1)), off = ease(seg(T, 1.6, 2.5)), Y0 = Math.max(y + vD * 0.35, E0.y - U * 0.6), Y1 = E0.y - eggS * 0.85;
    const jx = E0.x + w * 0.3 * off, jy = Y0 + (Y1 - Y0) * dn - off * U * 0.4;
    if (T > 1.15) Q.look = { cracks: 3 };
    over.push(() => { pv(jx, jy, vD * 0.9, { a: 1 - seg(T, 2.2, 2.5) }); if (T > 1.1 && T < 1.6) zig(ctx, E0.x, E0.y, eggS * 0.9, T, 1 - seg(T, 1.1, 1.6)); });
    say(1.15); lost(1.5, { x: E0.x - eggS * 0.62, y: E0.y + eggS * 0.1 });
  } else if (ty === 'frost') { // he walks up to the egg and his lick freezes it
    const walk = ease(seg(T, 0.2, 1.0)), vA = vEnd - 0.55 * (1 - walk), v = at(vA, vD * 0.3), ice = seg(T, 1.1, 1.4);
    if (T > 1.15) Q.look = { cracks: 2 };
    under.push(() => pv(v.x, v.y, vD, { rot: -vA * 0.6 }));
    over.push(() => { if (ice > 0) { ctx.save(); ctx.globalAlpha *= 0.55 * ice; ctx.fillStyle = '#cdefff'; ctx.strokeStyle = '#7fc7ee'; ctx.lineWidth = Math.max(2, eggS * 0.06); ctx.beginPath(); ctx.ellipse(E0.x, E0.y, eggS * 0.5, eggS * 0.6, 0, 0, TAU); ctx.fill(); ctx.stroke(); ctx.restore(); if (T < 1.6) burst(ctx, E0.x, E0.y, eggS * 0.8, 1 - seg(T, 1.1, 1.6), '#d9f4ff'); } });
    say(1.15); lost(1.6, { x: E0.x - eggS * 0.62, y: E0.y + eggS * 0.1 });
  } else if (ty === 'orb') { // the egg is rolled into the orb and takes it
    const d = ease(seg(T, 0.3, 1.1)), oA = 0.16, hit = oA - (eggS * 0.8) / floor;
    q.th = 0.25 * d; q.hand = dragHand(at, T, 0.3, 1.1, -0.25, 0.0); q.eA = -0.45 + (hit + 0.45) * d;
    const O = at(oA, eggS * 0.5), Ee = at(hit, eggS * 0.5);
    under.push(() => { if (T < 1.12) pv(O.x, O.y, eggS * 1.7); else if (T < 1.5) burst(ctx, O.x, O.y, eggS * 0.7, 1 - seg(T, 1.12, 1.5), kind === 'curse' ? '#b46cff' : '#ff5a4a'); });
    if (kind === 'curse') { // the fuse: a little clock whose hand races
      over.push(() => { if (T > 1.15) { const X = Ee.x, Y = Ee.y - eggS * 1.25, r = eggS * 0.32; ctx.save(); ctx.globalAlpha *= seg(T, 1.15, 1.3) * (1 - seg(T, HARM_T - 0.35, HARM_T)); ctx.fillStyle = '#fff4dc'; ctx.strokeStyle = '#6a2a8a'; ctx.lineWidth = Math.max(2, r * 0.2); ctx.beginPath(); ctx.arc(X, Y, r, 0, TAU); ctx.fill(); ctx.stroke(); const a = (calmT(S) ? 1 : t * 14); ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(X, Y); ctx.lineTo(X + Math.sin(a) * r * 0.75, Y - Math.cos(a) * r * 0.75); ctx.stroke(); ctx.restore(); } });
      say(1.15);
    } else { if (T > 1.15) Q.look = { cracks: 3 }; say(1.15); lost(1.5, { x: Ee.x - eggS * 0.62, y: Ee.y + eggS * 0.1 }); }
  } else if (ty === 'pop') { // forge spikes pump up under the resting egg
    const up = T < 0.85 ? 0.15 + 0.15 * Math.sin(T * 9) : 0.3 + 0.7 * ease(seg(T, 0.85, 1.05));
    q.eLift = Z * 0.05 * up;
    under.push(() => { for (let i = -1; i <= 1; i++) { const p = at(i * 0.065, 0); thornTri(ctx, p.x, p.y, Z * 0.08 * (0.25 + 0.75 * up), Math.atan2(S.C.x - p.x, p.y - S.C.y)); } });
    if (T > 1.05) Q.look = { cracks: 3 };
    say(1.05); lost(1.45, { x: E0.x - eggS * 0.62, y: E0.y + eggS * 0.1 });
  } else if (ty === 'block') { // the gap comes under the egg, but something sits in it: the egg bumps and stays
    const d = turnGap(0.35, 1.25), gA = gap0 + (q.th || 0), G0 = at(gA, -band * 0.05), bump = seg(T, 1.3, 1.7);
    q.eLift = Math.sin(bump * Math.PI) * eggS * 0.35;
    if (kind === 'doors') q.door = 0;
    if (kind === 'turtle') { const walk = ease(seg(T, 0.05, 0.35)), V = at(-0.5 * (1 - walk), eggS * 0.95 + (q.eLift || 0)); over.push(() => pv(V.x, V.y, vD * 0.85, { rot: 0 })); }
    else if (kind === 'puffer') under.push(() => { const sw = 0.85 + 0.15 * Math.sin(t * 3) + 0.25 * seg(T, 1.25, 1.4); pv(G0.x, G0.y, vD * 0.75 * sw); });
    else if (kind === 'spider') under.push(() => {
      const k = seg(T, 0.1, 0.6), a0 = at(gA - 0.14, -band * 0.1), a1 = at(gA + 0.14, -band * 0.1);
      ctx.save(); ctx.globalAlpha *= 0.9 * k; ctx.strokeStyle = '#f4f4f4'; ctx.lineWidth = Math.max(1.5, eggS * 0.035);
      for (let i = 0; i < 5; i++) { const f = (i + 0.5) / 5, b0 = at(gA - 0.14, -band * (0.4 - f * 0.6)), b1 = at(gA + 0.14, -band * (0.4 - f * 0.6)); ctx.beginPath(); ctx.moveTo(b0.x, b0.y); ctx.lineTo(b1.x, b1.y); ctx.stroke(); }
      ctx.beginPath(); ctx.moveTo(a0.x, a0.y - band * 0.3); ctx.lineTo(a1.x, a1.y + band * 0.3); ctx.moveTo(a0.x, a0.y + band * 0.3); ctx.lineTo(a1.x, a1.y - band * 0.3); ctx.stroke(); ctx.restore();
      const V = at(gA + 0.32, vD * 0.3); pv(V.x, V.y, vD * 0.8, { rot: -(gA + 0.32) * 0.6 });
    });
    else if (kind === 'vines') under.push(() => {
      const k = seg(T, 0.05, 0.6), a0 = gA - 0.14;
      ctx.save(); ctx.lineCap = 'round'; ctx.strokeStyle = '#2f6a2a'; ctx.lineWidth = Math.max(3, eggS * 0.1); ctx.beginPath();
      for (let i = 0; i <= 16; i++) { const a = a0 + 0.28 * k * (i / 16), p = at(a, -band * 0.05 + Math.sin(i * 1.3) * eggS * 0.06); if (i) ctx.lineTo(p.x, p.y); else ctx.moveTo(p.x, p.y); }
      ctx.stroke(); ctx.restore();
      for (let i = 1; i <= 4; i++) { const a = a0 + 0.28 * k * (i / 5), p = at(a, 0); thornTri(ctx, p.x, p.y, Z * 0.06, Math.atan2(S.C.x - p.x, p.y - S.C.y)); }
    });
    say(1.35); lost(1.55, { x: G0.x + eggS * 0.9, y: G0.y + eggS * 0.2 });
  } else if (ty === 'push') { // the egg is shoved along the floor, away from the gap
    Q.gap = -0.42; const P = seg(T, 0.6, 1.9); q.eA = 0.72 * ease(P); q.slideV = P > 0 && P < 1 ? -Math.sin(P * Math.PI) : 0;
    if (kind === 'quake') { q.th = Math.sin(t * 45) * 0.03 * (T > 0.5 && T < 1.9 ? 1 : 0); q.eLift = Math.abs(Math.sin(T * 9)) * eggS * 0.4 * (T > 0.5 && T < 1.9 ? 1 : 0); }
    if (kind === 'beetle' || kind === 'boss:golem') { const walk = ease(seg(T, 0.05, 0.6)), vA = (q.eA || 0) - (eggS * 0.45 + vD * 0.35) / floor - 0.4 * (1 - walk), V = at(vA, vD * 0.3); under.push(() => pv(V.x, V.y, vD, { rot: -vA * 0.6 })); }
    else over.push(() => { // the flow: the current's dashes, the gust's streaks, the rain
      const a = Math.min(seg(T, 0.2, 0.6), 1 - seg(T, 1.9, 2.3));
      ctx.save(); ctx.globalAlpha *= a; ctx.lineCap = 'round';
      if (kind === 'current') { ctx.strokeStyle = 'rgba(80,170,230,0.8)'; ctx.lineWidth = Math.max(2, eggS * 0.07); ctx.setLineDash([eggS * 0.35, eggS * 0.3]); ctx.lineDashOffset = -t * eggS * 2.2; for (let j = 0; j < 3; j++) { ctx.beginPath(); const r = floor - eggS * (0.3 + 0.45 * j); for (let i = 0; i <= 24; i++) { const ph = -0.9 + 1.8 * i / 24, X = S.C.x + Math.sin(ph) * r, Y = S.C.y + Math.cos(ph) * r; if (i) ctx.lineTo(X, Y); else ctx.moveTo(X, Y); } ctx.stroke(); } }
      else if (kind === 'rain') { ctx.strokeStyle = 'rgba(90,150,220,0.7)'; ctx.lineWidth = Math.max(1.5, eggS * 0.04); for (let i = 0; i < 14; i++) { const X = x + ((i * 0.137 + 0.05) % 1) * w, Y = y + (((t * 1.4 + i * 0.29) % 1)) * h; ctx.beginPath(); ctx.moveTo(X, Y); ctx.lineTo(X - eggS * 0.08, Y + eggS * 0.35); ctx.stroke(); } }
      else if (kind !== 'quake') { ctx.strokeStyle = 'rgba(255,255,255,0.9)'; ctx.lineWidth = Math.max(2, eggS * 0.06); for (let i = 0; i < 5; i++) { const u = ((t * 1.3 + i * 0.23) % 1), Y = E0.y - eggS * (0.1 + 0.35 * (i % 3)) - U * 0.12 * (i % 2), X = x + w * (u * 1.3 - 0.2); ctx.beginPath(); ctx.moveTo(X, Y); ctx.quadraticCurveTo(X + w * 0.12, Y - eggS * 0.15, X + w * 0.22, Y); ctx.stroke(); } }
      ctx.restore();
    });
    say(1.2);
  } else if (ty === 'lift') { // the swarm comes down on the egg and carries it up over the gap
    const dn = ease(seg(T, 0.15, 0.85)); turnGap(1.0, 1.8); q.eLift = U * 0.2 * ease(seg(T, 0.9, 1.4));
    const Y0 = y + vD * 0.3, V = { x: E0.x, y: Y0 + (E0.y - (q.eLift || 0) - eggS * 0.85 - Y0) * dn };
    over.push(() => pv(V.x, V.y + Math.sin(t * 8) * eggS * 0.05, vD * 0.85));
    say(1.4); lost(1.9, at(0, -band * 0.6));
  } else if (ty === 'bite') { // the egg rolls toward his gap: CHOMP
    const d = ease(seg(T, 0.3, 1.05)); q.eA = 0.3 * d; q.eAlpha = T < 1.2 ? 1 : 0; Q.gap = 0.42;
    const snap = T > 1.1 && T < 1.35, gp = 0.66;
    under.push(() => {
      if (Wd) gatorAt(ctx, at, gp, -1, kW, t, { jaw: snap ? 0.05 : T < 1.1 ? 0.35 + 0.25 * Math.abs(Math.sin(t * 5)) : 0.12, eye: 'open', gait: 0 }, floor);
      else { const V = at(gp, vD * 0.3); pv(V.x, V.y, vD); }
    });
    if (T > 1.2 && T < 1.7) over.push(() => burst(ctx, at(0.34, eggS * 0.5).x, at(0.34, eggS * 0.5).y, eggS * 0.7, 1 - seg(T, 1.2, 1.7), '#fff3c0'));
    say(1.15); lost(1.5, at(0.3, eggS * 0.5));
  } else if (ty === 'chomp' || ty === 'frostbite') { // 0.8.14 the salamander's bite (its rig acts it): a warning ring closes on the egg, the jaws shut
    const fr = ty === 'frostbite', u = seg(T, 1.0, BITE_AT);
    if (T > 1.0 && T < BITE_AT) over.push(() => { ctx.save(); ctx.lineWidth = Math.max(2, eggS * (0.06 + 0.04 * u)); ctx.setLineDash([eggS * 0.22, eggS * 0.14]); ctx.lineDashOffset = -t * eggS * 1.6; ctx.strokeStyle = fr ? `rgba(120,200,255,${0.6 + 0.4 * u})` : `rgba(255,70,40,${0.6 + 0.4 * u})`; ctx.beginPath(); ctx.arc(E0.x, E0.y, eggS * (1.0 - 0.32 * u), 0, TAU); ctx.stroke(); ctx.restore(); });
    if (T > BITE_AT && T < BITE_AT + 0.45) over.push(() => burst(ctx, E0.x, E0.y, eggS * 0.8, 1 - seg(T, BITE_AT, BITE_AT + 0.45), fr ? '#d9f4ff' : '#fff3c0'));
    if (fr) { // bitten and frozen: a crack, then a block of ice round it
      const ice = seg(T, BITE_AT, BITE_AT + 0.25);
      if (T > BITE_AT) Q.look = { cracks: 1 };
      over.push(() => { if (ice > 0) { ctx.save(); ctx.globalAlpha *= 0.55 * ice; ctx.fillStyle = '#cdefff'; ctx.strokeStyle = '#7fc7ee'; ctx.lineWidth = Math.max(2, eggS * 0.06); ctx.beginPath(); ctx.ellipse(E0.x, E0.y, eggS * 0.5, eggS * 0.6, 0, 0, TAU); ctx.fill(); ctx.stroke(); ctx.restore(); } });
      say(BITE_AT + 0.05); lost(BITE_AT + 0.4, { x: E0.x + eggS * 0.62, y: E0.y - eggS * 0.5 });
    } else { // eaten: the egg is gone
      if (T > BITE_AT + 0.03) q.eAlpha = 0;
      say(BITE_AT + 0.05); lost(BITE_AT + 0.35, E0);
    }
  } else if (ty === 'breath') { // its jet lands on the wall under the egg: that patch glows red-hot (drawSalHeat, as in play) and cracks the egg on it
    const hotOn = T > 1.45, h = hotOn ? Math.max(0, 4 - (T - 1.45)) : 0;
    if (hotOn) under.push(() => {
      const a0 = BREATH_AT - Math.PI / 2 - 0.2, HS = HEAT.sim, sg = HS.rings[0].segs[0];
      HS.rings[0].r = Wd ? Wd.ringR : floor / 40; sg.a0 = a0; sg.a1 = a0 + 0.4; sg.hot = h; sg.hotK = 1;
      const k = Wd ? kW : 40; ctx.save(); ctx.globalAlpha *= Math.min(1, seg(T, 1.45, 1.6)) * (1 - seg(T, HARM_T - 0.35, HARM_T)); ctx.translate(S.C.x, S.C.y); ctx.scale(k, -k);
      try { drawSalHeat(ctx, HS, k, t); } finally { ctx.restore(); }
    });
    if (T > 1.65) Q.look = { cracks: 3 };
    say(1.65); lost(1.95, { x: E0.x - eggS * 0.62, y: E0.y + eggS * 0.1 });
  } else if (ty === 'tongue') { // the orb by the egg is gone in one lick
    const O = at(CHAM_ORB, eggS * 0.4), gone = seg(T, 1.35, 1.75), M = at(CHAM_ORB - 0.3, eggS * 0.3);
    under.push(() => { if (gone < 1) { const X = O.x + (M.x - O.x) * gone, Y = O.y + (M.y - O.y) * gone, r = eggS * 0.42 * (1 - 0.7 * gone); if (Wd && Wd.orb) Wd.orb(ctx, 'fire_red', X, Y, r, t); else { ctx.fillStyle = '#ff8a3a'; ctx.beginPath(); ctx.arc(X, Y, r * 0.8, 0, TAU); ctx.fill(); } } });
    say(1.75);
  } else if (ty === 'creep') { if (T > CREEP_HIT) Q.look = { cracks: 3 }; say(CREEP_HIT); lost(CREEP_HIT + 0.4, { x: E0.x - eggS * 0.62, y: E0.y + eggS * 0.1 }); // 0.8.18 creeper: its head runs into the egg
  } else if (ty === 'bump') { // he walks on into the egg and shoves it along
    Q.gap = 1.1; q.eA = BUMP_A * ease(seg(T, 1.0, 1.9)); q.slideV = 0;
    if (T > 1.2) Q.look = { cracks: 1 }; // 0.8.14: his thorny hide cracks what he rams
    say(1.2);
  } else if (ty === 'bounce') { // the egg rolls onto its lid and is flung right over the gap
    const jA = -0.22, J = at(jA, vD * 0.18), roll = ease(seg(T, 0.2, 0.8)), fly = seg(T, 0.85, 1.65);
    q.eA = T < 0.85 ? -0.6 + (jA + 0.6) * roll : jA + (0.95 - jA) * fly; q.eLift = T < 0.85 ? 0 : Math.sin(fly * Math.PI) * U * 0.45;
    under.push(() => pv(J.x, J.y, vD * 0.8, { sy: T > 0.85 && T < 1.05 ? 1.25 : 1, sx: 1 }));
    say(0.85); lost(1.7, at(gap0, -band * 0.6));
  }
  if (under.length) Q.under = () => under.forEach((f) => f());
  if (over.length) Q.over = () => over.forEach((f) => f());
  set(q);
}
const calmT = (S) => !!S.calm;
// a stand-in for the sim that drawSalHeat reads: one ring, one hot section (one object, reused every frame)
const HEAT = { sim: { sals: [{ ph: 'none' }], rings: [{ r: 2.1, body: { getAngle: () => 0 }, segs: [{ alive: true, hot: 0, hotK: 1, a0: 0, a1: 0 }] }] } };
