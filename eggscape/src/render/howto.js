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
import { drawStrikeChick } from './strike.js';
import { actorFor } from './howact.js'; // 2026-11-20: the villain's own game rig acts the scene (snake, weasel, rats, crawlers)
import { statusDraw } from './status.js';
import { beamSparks, scorchStub, drawPepperCloud, drawTwister, drawSneeze, drawDecoyAt, TWIST_T } from './powers2.js'; // 2026-11-20: Practice content in the campaign
import { paintVortex } from './warp.js';
import { drawFrog, FROG_ART } from './frog.js';
import { FROG } from '../sim/frog.js';
import { drawFish } from './sea.js';
import { FISH } from '../sim/sea.js';
import { drawGator } from './bayou.js';
import { GATOR } from '../sim/bayou.js';
import { drawEagle } from './v3art.js';

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
  frog: P('frog', 'It plugs gaps. A flaming egg scares it off'),
  eagle: P('turn', 'Turn a wall over the egg: the eagle bonks', { fx: 'bonk' }),
  'boss:eagle': P('turn', 'Turn a wall over the egg it dives at', { fx: 'bonk' }),
  salamander: P('turn', 'Turn its ring: it slides off', { fx: 'bonk' }),
  'boss:salamander': P('dodge', 'Roll eggs off the glowing mark', { haz: 'lava' }),
  spike: P('stone', 'Roll a stone egg into it: it flips over'),
  'boss:golem': P('stone', 'Roll a stone egg into him: he flips'),
  'boss:blizzard': P('tap', 'Freeze him with a chick, then hurry', { power: 'freeze', fx: 'freeze' }),
  chameleon: P('turn', 'Grab the orbs first, turn him away', { fx: 'bonk' }),
  hermit: P('turn', 'Turn a gap under it: the egg drops free', { fx: 'bonk' }),
  puffer: P('tap', 'A zap pops it', { power: 'thunder', fx: 'zap' }),
  jelly: P('tap', 'Zap it with a chick to stun it', { power: 'thunder', fx: 'zap' }),
  gator: P('turn', 'Turn the gap away from his jaws', { fx: 'bonk' }),
  'boss:gator': P('drop', 'When he is dizzy, drop an egg on him', { fx: 'dizzy' }),
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
  current: P('wait', 'Let the current carry the egg to a gap'),
  gusts: P('wait', 'Put a wall in the way of the wind'),
  popthorns: P('wait', 'Wait for the thorns to drop, then go'),
  vines: P('wait', 'Drop through before the vine closes'),
  doors: P('wait', 'Park the egg on the door: it opens', { haz: 'door' }),
  curse: P('dodge', 'Steer the egg round the curse orb', { haz: 'curse' }),
  thornorb: P('dodge', 'Steer the egg round the thorn orb', { haz: 'thornorb' }),
};
export function howToPlan(kind) {
  const p = SHOW[kind] || SHOW[String(kind).replace(/^boss:/, '')] || P('turn', 'Turn the ring to keep the egg away', { fx: 'bonk' });
  return { kind, ...p };
}
// the first-five ladder (2026-11-20, owner: every level from 2 on hands over a new toy, shown on its level card with the
// game's own art): the red flame, the twin orb, the thorn curtain, the portal, the glow chick. move 'toy', plan.toy names it.
const TOY = {
  flame: 'Roll an egg into the red flame: thorns burn',
  twin: 'The twin orb makes two eggs of one',
  curtain: 'A flame egg burns the thorn curtain',
  portal: 'The swirl drops an egg rings lower',
  glow: 'Tap the glow chick: its flash burns thorns',
  // 2026-11-20: Practice content placed in the campaign (warp L22/L27, combos L43/L44/L47)
  warp: 'The warp gate sends the next attacker far away',
  bait: 'Decoy + warp: creatures chase the decoy away',
  sweep: 'Laser + spin: the beam sweeps, every thorn cut',
  twister: 'Pepper + spin: a twister sneezes them away',
  magnet: 'Shock + iron: iron eggs stick to the live ring',
};
const TOY_NAME = { flame: 'Red flame', twin: 'Twin orb', curtain: 'Thorn curtain', portal: 'Portal', glow: 'Glow chick', warp: 'Warp gate', bait: 'Bait and switch', sweep: 'Sweep beam', twister: 'Pepper twister', magnet: 'Electromagnet' };
const NEW_TOYS = ['warp', 'bait', 'sweep', 'twister', 'magnet']; // these need the game's own art (o.world)
// foe: the creature a toy scene shows (the warp gate takes the level's own: 'salamander', 'eagle', else a snake)
export function toyPlan(id, foe) { return { kind: null, toy: id, move: 'toy', cap: TOY[id] || '', name: TOY_NAME[id] || id, foe }; }
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
  const calm = !!o.calm, T = calm ? 2.25 : ((t % LOOP) + LOOP) % LOOP;
  const fade = calm ? 1 : Math.min(seg(T, 0, 0.25), 1 - seg(T, LOOP - 0.3, LOOP));
  const U = h, Z = Math.min(h, w * 0.62), cx = x + w / 2; // U: the stage's height (vertical placing); Z: the size of things (a tall stage does not blow them up)
  const Wd = o.world || null;
  ctx.save();
  // the panel: the level's own backdrop (else a soft sky and a meadow strip), rounded
  rr(ctx, x, y, w, h, Math.min(18, h * 0.08)); ctx.clip();
  if (!(Wd && Wd.back && Wd.back(ctx, x, y, w, h))) {
    const g = ctx.createLinearGradient(0, y, 0, y + h);
    g.addColorStop(0, o.sky0 || '#9fdcff'); g.addColorStop(0.7, o.sky1 || '#e6f7ff'); g.addColorStop(1, o.sky1 || '#e6f7ff');
    ctx.fillStyle = g; ctx.fillRect(x, y, w, h);
    ctx.fillStyle = o.ground || '#8bd36a'; ctx.beginPath(); ctx.ellipse(cx, y + h * 1.06, w * 0.75, h * 0.2, 0, 0, TAU); ctx.fill();
  }
  ctx.globalAlpha = fade;

  // ring geometry: centre above the panel; phi = 0 is straight down
  // with the game's art the ring, the egg and the villain keep their in-game sizes (k = pixels per metre)
  const R = Wd ? Math.min(w * 0.86, h * 1.3) : w * 0.94, kW = Wd ? R / Wd.ringR : 0, band = Wd ? 0.16 * kW : Z * 0.12, floor = R - band / 2;
  const C = { x: cx, y: y + U * (Wd ? 0.6 : 0.64) - R };
  const at = (phi, lift) => ({ x: C.x + Math.sin(phi) * (floor - lift), y: C.y + Math.cos(phi) * (floor - lift) });
  const nest = { x: cx, y: y + U * 0.93 };
  const eggS = Wd ? 0.56 * 1.06 * kW : Z * 0.24, vD = Z * (Wd ? 0.8 : 0.5);
  const m = !Wd && (plan.move === 'frog' || plan.move === 'fish' || (plan.move === 'toy' && NEW_TOYS.includes(plan.toy))) ? 'basic' : plan.move; // the rigs need the game's art
  const vLift = vD * (Wd ? 0.3 : 0.42);
  // where the villain stops: its nose just short of the egg, worked out in pixels so a big villain never overlaps it
  const vEnd = -Math.asin(clamp((eggS * 0.42 + vD * 0.46) / floor, 0.05, 0.95));
  const drawE = (X, Y, S, st, wr, look) => (Wd ? Wd.egg(ctx, X, Y, st, wr, C, kW, t, look) : egg(ctx, X, Y, S, st, T, wr));
  let toy = null; // move 'toy': { orb, look, deco, twin, portal, flash, burst } (drawn with the game's art through o.world)

  // ---- the timeline of each move -> ring turn th, egg angle eA, egg drop eD (0..1), villain angle vA, villain state
  let door = null, th = 0, eA = 0, eD = 0, vA = -0.75, vOff = 0, vRot = 0, vAlpha = 1, vFx = '', fxK = 0, hand = null, stone = false, haz = null, btn = null, shot = null, done = 0;
  const act = actorFor(plan), SG = act && act.stage ? act.stage(m) : null;
  const gap0 = SG ? SG.g0 : 0.4, dTh = SG ? SG.dTh : -gap0; // the gap starts to the right of the egg and comes under it (an actor may set its own scene)
  const walk = ease(seg(T, 0.2, 1.3));
  const SA = act ? { x, y, w, h, cx, C, floor, band, k: Wd ? kW : Z / 2.5, at, g0: gap0, eggS, ground: Wd ? y + h * 0.9 : y + h * 0.95, calm } : null;
  if (m === 'basic') {
    vAlpha = 0;
    const d = ease(seg(T, 0.9, 1.9)); th = -gap0 * d;
    hand = dragHand(at, T, 0.9, 1.9, 0.5, 0.5 - gap0);
    eD = seg(T, 2.0, 2.45); done = seg(T, 2.45, 2.8);
  } else if (m === 'turn') {
    vA = vEnd - 0.3 * (1 - walk);
    const d = ease(seg(T, 1.45, 2.25)); th = dTh * d;
    hand = SG && SG.hand ? dragHand(at, T, 1.35, 2.25, SG.hand[0], SG.hand[1]) : dragHand(at, T, 1.35, 2.25, 0.5, 0.5 - gap0);
    if (SG && SG.egg) eA = SG.egg(T);
    if (T > 1.85) { vFx = plan.fx || 'bonk'; fxK = seg(T, 1.85, 2.9); }
    vA += th;
    if (vFx) { vOff = 1; vRot = -fxK * 3.5; vAlpha = 1 - seg(T, 2.55, 2.95); }
    eD = seg(T, 2.3, 2.75); done = seg(T, 2.75, 3.1);
  } else if (m === 'tap' || m === 'rooster') {
    vA = vEnd - 0.3 * (1 - walk);
    btn = { x: x + Math.max(w * 0.1, Z * 0.16), y: y + U * 0.8, r: Z * 0.13, id: m === 'rooster' ? 'rooster' : plan.power || 'thunder' };
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
    const orbIn = (type, t0, t1) => { const k = ease(seg(T, t0, t1)), p0 = at(-0.42, eggS * 1.9), p1 = eggAt(eggS * 0.55); if (T < t1 + 0.05) toy.orb = { type, x: p0.x + (p1.x - p0.x) * k, y: p0.y + (p1.y - p0.y) * k, a: 1 - seg(T, t1 - 0.05, t1 + 0.05) }; if (T > t1 && T < t1 + 0.45) toy.burst = { x: p1.x, y: p1.y, k: seg(T, t1, t1 + 0.45), col: type === 'twin' ? '#ffe58a' : type === 'hatch_glow' ? '#fff27a' : '#ff8a3a' }; };
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
    } else { // glow
      orbIn('hatch_glow', 0.3, 0.8);
      if (T > 0.8) toy.look = { chick: T > 1.05 };
      toy.deco = { thorns: 1, burnt: T > 1.95 };
      { const ck = eggAt(eggS * 0.5); hand = tapHand({ x: ck.x, y: ck.y, r: eggS * 0.5 }, T, 1.25, 1.6); } // tap the chick itself, as in play
      if (T > 1.6 && T < 2.4) { const e0 = eggAt(eggS * 0.5); toy.flash = { x: e0.x, y: e0.y, k: seg(T, 1.6, 2.4) }; }
      const d = ease(seg(T, 2.4, 3.1)); th = -gap0 * d;
      eD = seg(T, 3.15, 3.55); done = seg(T, 3.55, 3.9);
    }
  } else if (m === 'frog' || m === 'fish') { // 2026-11-20: the frog and the fish school on their own game rigs
    vAlpha = 0; toy = { deco: { thorns: 0 }, look: null };
    const k = kW;
    if (m === 'frog') { // it hops into the gap and plugs it; a flaming egg scares it off, the gap is free again
      const fA0 = -0.62, hop = seg(T, 0.8, 1.25), esc = seg(T, 1.9, 2.5);
      { const u = ease(seg(T, 1.0, 1.55)), p0 = at(-0.3, eggS * 1.9), p1 = at(0, eggS * 0.55); if (T < 1.6) toy.orb = { type: 'fire_red', x: p0.x + (p1.x - p0.x) * u, y: p0.y + (p1.y - p0.y) * u, a: 1 - seg(T, 1.5, 1.6) }; if (T > 1.55 && T < 2.0) toy.burst = { x: p1.x, y: p1.y, k: seg(T, 1.55, 2.0), col: '#ff8a3a' }; }
      if (T > 1.55) toy.look = { fire: 1 };
      const d = ease(seg(T, 2.55, 3.1)); th = -gap0 * d; hand = dragHand(at, T, 2.45, 3.1, 0.5, 0.5 - gap0);
      eD = seg(T, 3.15, 3.55); done = seg(T, 3.55, 3.9);
      toy.under = () => {
        const sPx = FROG.w * FROG_ART * k, op = { face: 1, look: { x: 0.7, y: 0.1 }, id: 3 };
        let phi = fA0, lift = 0, al = 1;
        if (T < 0.8) { op.crouch = seg(T, 0.35, 0.8); op.puff = Math.sin(seg(T, 0.4, 0.8) * Math.PI); }
        else if (T < 1.25) { phi = fA0 + (gap0 - fA0) * ease(hop); lift = Math.sin(hop * Math.PI) * k * 0.8; op.stretch = Math.sin(hop * Math.PI); }
        else if (T < 1.9) { phi = gap0; lift = -band * 0.35; op.face = -1; op.plug = 1; op.squash = 0.5 * (1 - seg(T, 1.25, 1.45)); op.scared = seg(T, 1.6, 1.75); op.look = { x: 0.8, y: 0.3 }; if (T > 1.75) op.shake = 2; }
        else { phi = gap0 + 0.7 * esc; lift = Math.sin(esc * Math.PI * 0.7) * k * 1.8 + esc * k * 0.6; op.stretch = Math.min(1, esc * 3); op.scared = 1; al = 1 - seg(T, 2.25, 2.5); }
        const p = at(phi, lift);
        ctx.save(); ctx.globalAlpha *= al; ctx.translate(p.x, p.y); ctx.rotate(-phi + (T > 1.9 ? -0.5 * Math.sin(esc * Math.PI) : 0)); drawFrog(ctx, 0, 0, sPx, t, op); ctx.restore();
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
  } else { // 'wait': something blocks the way for a beat (thorns, a web, the weather), then the egg goes through
    vAlpha = 0;
    const up = T < 1.7 ? 1 : 1 - seg(T, 1.7, 2.0);
    haz = { k: 'thorns', up };
    if (plan.kind === 'spider') { vAlpha = up; vA = vEnd; } // the spider is on the stage while its web (the thorns) shuts the gap, then it is gone
    const d = ease(seg(T, 2.05, 2.8)); th = -gap0 * d;
    hand = dragHand(at, T, 1.95, 2.8, 0.5, 0.5 - gap0);
    eD = seg(T, 2.85, 3.25); done = seg(T, 3.25, 3.6);
  }

  // ---- the ring: a thick slab with one gap (the game's own ring when it is given)
  const gapA = gap0 + th, gw = 0.24;
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
    for (let i = 0; i < 3; i++) { const p = at(0.14 + i * 0.07 + th, 0), up = haz.up; thornTri(ctx, p.x, p.y, Z * 0.07 * (0.25 + 0.75 * up), Math.atan2(C.x - p.x, p.y - C.y)); }
  } else if (haz) {
    const mk = at(0, 0);
    if (haz.warn > 0) { ctx.save(); ctx.globalAlpha *= haz.warn * (0.55 + 0.45 * Math.sin(T * 14)); ctx.fillStyle = '#ff3a2a'; ctx.beginPath(); ctx.ellipse(mk.x, mk.y - Z * 0.01, Z * 0.13, Z * 0.04, 0, 0, TAU); ctx.fill(); ctx.restore(); }
    const hk = haz.k === 'curse' || haz.k === 'thornorb' ? haz.k : haz.k;
    if (hk === 'curse' || hk === 'thornorb') { drawVillainPortrait(ctx, hk, mk.x, mk.y - Z * 0.09, Z * 0.2, t); }
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
    if (AR && AR.bonk > 0 && AR.bonk < 1) { ctx.save(); ctx.globalAlpha *= 1 - seg(AR.bonk, 0.6, 1); word(ctx, 'BONK!', clamp(AR.x, x + Z * 0.3, x + w - Z * 0.3), Math.max(y + Z * 0.16, AR.y), Z * 0.15 * (1 + 0.3 * Math.sin(Math.min(1, AR.bonk * 2.5) * Math.PI)), '#fff', '#c8321e'); ctx.restore(); }
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
    if (toy && toy.twin && toy.twin.show) { // the twin: a second egg beside the first, home just after it
      const b2 = at(toy.twin.a, eggS * 0.5), land = nest.y - (Wd ? eggS * 0.42 : Z * 0.08), q = toy.twin.eD;
      const ex = done > 0 ? nest.x - eggS * 0.55 : b2.x + (nest.x - eggS * 0.55 - b2.x) * q, ey = done > 0 ? land : b2.y + (land - b2.y) * q * q;
      drawE(ex, ey, eggS, false, false);
    }
  {
    const base = at(eA, eggS * 0.5);
    let ex = base.x, ey = base.y, sq = 1;
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
    drawE(ex, ey, eggS * sq, stone, worry, toy ? toy.look : null);
  }
  }
  if (toy && toy.over) toy.over();
  if (toy && toy.word && toy.word.k < 1) { const e0 = at(eA, eggS * 1.6), q = toy.word.k; ctx.save(); ctx.globalAlpha *= 1 - seg(q, 0.7, 1); word(ctx, toy.word.s, clamp(e0.x, x + Z * 0.4, x + w - Z * 0.4), e0.y - q * Z * 0.08, Z * 0.15 * (1 + 0.35 * (1 - seg(q, 0, 0.15))), '#ffe14a', '#8a4a00'); ctx.restore(); }
  if (toy && toy.burst && toy.burst.k < 1) { const B = toy.burst; ctx.save(); ctx.globalAlpha *= 1 - B.k; ctx.strokeStyle = B.col; ctx.lineWidth = Math.max(2, eggS * 0.12 * (1 - B.k)); ctx.beginPath(); ctx.arc(B.x, B.y, eggS * (0.4 + 0.9 * B.k), 0, TAU); ctx.stroke(); ctx.restore(); }
  if (toy && toy.flash) { // the glow chick's flash: a bright ring that sweeps out over the thorns
    const F = toy.flash, R2 = Z * (0.1 + 0.55 * ease(F.k));
    ctx.save(); ctx.globalAlpha *= 1 - F.k;
    ctx.fillStyle = 'rgba(255,246,170,0.35)'; ctx.beginPath(); ctx.arc(F.x, F.y, R2, 0, TAU); ctx.fill();
    ctx.strokeStyle = '#fff27a'; ctx.lineWidth = Math.max(2, Z * 0.025); ctx.stroke();
    ctx.restore();
  }
  // the power or the rooster on its way
  if (btn) {
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
