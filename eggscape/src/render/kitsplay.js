// Mama raccoon and her kits IN PLAY (0.8.18): her art is Bandit's rig (render/raccoon.js, the same size as Bandit on the
// yard) with lashes, her own sack beside her as a prop and the level's world costume; the kits are render/kits.js. Driven by
// the sim (sim/kits.js); everything here is drawn from its state, so rewind and the hint show exactly what happened.
//   drawKits(ctx, sim, t, k, calm, layer)   world space (y up, metres), k px per metre; layer 'front' (after the eggs)
//   kitsEvent(ev, fx, U)                    sounds and one or two wordless pops
//   kitsCostume(level)                      the costume a level's raccoons wear
//   drawKitsDemo(ctx, ...)                  a short canned scene (level card, info panel, Practice tile)
// Mama's faces (the owner's bar: "it will give certain expressions"): eager while they set off, PROUD while they carry
// (shut happy eyes, clasped paws), a GASP when they tumble or dangle (paws to cheeks, jaw dropped), SMUG when an egg comes
// home (heavy lids, a sideways look, a pat on the sack), COMFORTING the crying one, SCOLDING after a dangle (a wagging
// finger), SULKY when she gives up. Calm (save.calm): no blends, no beam, no flutter; PERF.low: no costume beam, flat kits.
import { RACCOON_M, raccoonPose, raccoonBlend, raccoonFin, drawRaccoon, drawSack } from './raccoon.js';
import { BANDIT_SCALE } from './banditplay.js';
import { kitPose, kitBlend, drawKit, KIT_M } from './kits.js';
// who does what on a carry (by kit: 0 keen, 1 clumsy, 2 sleepy): the keen one walks ahead beckoning, the clumsy one hauls
// in front, the sleepy one leans on the egg from behind. off: m from the egg's middle, + ahead
const ROLE = (i) => (i === 0 ? { st: 'walk', off: LEAD, lead: 1 } : i === 1 ? { st: 'pull', off: CO } : { st: 'push', off: -CO });
// each keeps his own distance in a line (m, + further back): the keen one out in front, the clumsy one drifting about, the
// sleepy one falling behind and scurrying to catch up
const drift = (i, t, calm) => (calm ? 0 : i === 0 ? 0.05 * Math.sin(t * 1.3) : i === 1 ? 0.12 * Math.sin(t * 0.9 + 2) + 0.05 * Math.sin(t * 2.7) : 0.3 * (0.5 + 0.5 * Math.sin(t * 0.7 + 4)) + 0.04 * Math.sin(t * 2.1));
const KS = 2.0; // the kits in play two sizes up from the rig's metres (2026-11-27 review: each kit at least 0.85 of an egg, a third of mama;
// standing he is about 0.89 m with his big head, the egg 0.59 m drawn). Anything past the ring above is a faint ghost (ringclip.js)
const SP = 0.62; // m between kits in a line (they stand about 0.6 m wide with the tail)
const CO = 0.66; // m from the egg's middle to the puller in front and the pusher behind; the leader walks LEAD ahead
const LEAD = 1.6; // (2026-11-27: was 1.35, the leader stood half inside the puller)
import { costumeOf } from './costume.js';
import { RING_TH } from '../sim/geom.js';
import { PERF } from '../perf.js';
import { UNTIE_POP, KITS } from '../sim/kits.js';
import { drawInChannel } from './ringclip.js';

const TAU = Math.PI * 2;
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const ss = (a, b, x) => { const u = clamp((x - a) / (b - a), 0, 1); return u * u * (3 - 2 * u); };
const lerp = (a, b, k) => a + (b - a) * k;
const PLAY_M = RACCOON_M * BANDIT_SCALE;
export function kitsCostume(L) { return (L && L.kits && L.kits.costume) || costumeOf(L && L.theme); }
const uOf = (o) => clamp(1 - o.t / Math.max(1e-3, o.dur), 0, 1);
const OUT = new Set(['lift', 'carry', 'up', 'down', 'hop', 'out', 'yard']);
const BAD = new Set(['tumble', 'dangle']);

// ---------------------------------------------------------------- mama's pose: [state, u, overrides (world targets w, pose fields o), draw options]
export function mamaLook(K, G, t, sackX) {
  const o = {}, w = {}, dr = { eye: 'normal' }, P = uOf(K);
  let st = 'sit', u = 0, prop = true;
  const sitBase = () => Object.assign(o, { tail: 0.25, tc: 1.0, tw: Math.sin(t * 1.4) * 0.4 });
  switch (K.ph) {
    case 'wait': case 'gone': return null;
    case 'walk': st = 'sneak'; u = 0.001 + K.x / 0.36; prop = false; Object.assign(o, { smile: 0.9, brow: 0.6, lid: 0.25 }); break;
    case 'leave': st = 'sneak'; u = 0.001 - K.x / 0.5; prop = false; Object.assign(o, { brow: -0.8, smile: -0.7, lid: 0.45, ear: 0.7, looky: 0.6, look: -0.3 }); break;
    case 'untie': { // reach down to the knot, yank it up with a flourish, then ta-da!
      sitBase(); const dn = ss(0, 0.25, P) * (1 - ss(0.3, 0.42, P)), up = ss(0.3, 0.45, P), ta = ss(0.45, 0.6, P) * (1 - ss(0.9, 1, P) * 0.3);
      w.a0 = [lerp(lerp(14, 52, dn), 30, up), lerp(lerp(-20, -18, dn), -84, up)];
      w.a1 = [lerp(25, 62, ta), lerp(-19, -64, ta)];
      if (ta > 0.1) w.a0 = [lerp(30, -26, ta), lerp(-84, -70, ta)];
      Object.assign(o, { look: lerp(0.8, 0.2, ta), looky: lerp(0.8, -0.2, ta), happy: ta > 0.4 ? 1 : 0, smile: 1, jaw: 0.6 * ta, teeth: ta > 0.4 ? 1 : 0, brow: 0.3, hr: -0.2 * ta, g0: lerp(0.9, 0.1, ta), g1: 0.1, ear: -0.2, tail: 0.3 + 0.6 * ta, tw: Math.sin(t * 9) * 0.6 * ta });
      break;
    }
    case 'smug': { // heavy lids, a slow sideways look, chin up, patting the sack
      sitBase(); const pat = Math.max(0, Math.sin(t * 6)) * ss(0.2, 0.4, P);
      w.a0 = [34, -46 + 4 * pat]; w.a1 = [16, -34];
      Object.assign(o, { lid: 0.5, lidLo: 0.15, look: -0.75, looky: 0.1, smile: 1, brow: 0.75, hr: -0.18, ear: -0.15, cheek: 0.3, tail: 0.5, tw: Math.sin(t * 3) * 0.8 });
      break;
    }
    case 'comfort': { // leaning to the crying kit, head on one side, a soft face, patting him
      sitBase(); const pat = Math.max(0, Math.sin(t * 7)) * ss(0.1, 0.3, P);
      w.a0 = [50, -44 + 6 * pat]; w.a1 = [26, -24]; // (her paw on the crying kit's head: he sits right under it)
      Object.assign(o, { rot: 0.18, hr: 0.28, lid: 0.35, look: 0.7, looky: 0.8, brow: -0.6, smile: 0.35, ear: 0.3 });
      break;
    }
    case 'scold': { // a wagging finger, the other paw on her hip, a stern frown
      sitBase(); const wag = Math.sin(t * 11);
      w.a0 = [46 + 6 * wag, -70]; w.a1 = [-4, -26];
      Object.assign(o, { hand: 1, brow: 1, smile: -0.6, jaw: 0.25 + 0.2 * Math.abs(Math.sin(t * 9)), look: 0.7, looky: 0.7, lid: 0.25, hr: 0.1 + 0.05 * wag, ear: -0.2 });
      dr.eye = 'angry';
      break;
    }
    case 'sulk': { // scooping the kits up (her paws down to them, then into the sack), a pout
      sitBase(); const sc = Math.sin(ss(0, 0.8, P) * Math.PI);
      w.a0 = [lerp(18, 58, sc), lerp(-20, -6, sc)]; w.a1 = [lerp(26, 48, sc), lerp(-20, -4, sc)];
      Object.assign(o, { brow: -0.85, smile: -0.8, lid: 0.45, ear: 0.75, look: 0.6, looky: 0.8, hr: 0.2, cheek: 0.6 });
      break;
    }
    default: { // watch / rest: her face follows the kits
      sitBase();
      const ph = G.ph, carry = OUT.has(ph), bad = BAD.has(ph) || (ph === 'flee' && (G.why === 'tumble' || G.why === 'dangle' || G.why === 'dive'));
      if (bad) { // the GASP: paws to her cheeks, jaw dropped, ears flat
        const g = ss(0, 0.15, 1 - G.t / Math.max(1e-3, G.dur));
        w.a0 = [lerp(14, -14, g), lerp(-20, -78, g)]; w.a1 = [lerp(25, 54, g), lerp(-19, -84, g)];
        Object.assign(o, { jaw: 0.9, teeth: 1, smile: -0.4, brow: -1, ear: 0.9, pup: 0.5, lid: 0, hr: -0.15, sweat: 1, puff: 0.6, tail: 0.9 });
        dr.eye = 'wide';
      } else if (carry) { // PROUD: paws clasped under her chin, eyes shut happy, a little bounce
        const b = Math.abs(Math.sin(t * 4));
        w.a0 = [24, -52 - 2 * b]; w.a1 = [30, -52 - 2 * b];
        Object.assign(o, { happy: 1, smile: 1, jaw: 0.35, teeth: 1, brow: -0.2, cheek: 0.4, by: 25 + 2.5 * b, hr: -0.12 + 0.06 * Math.sin(t * 2), ear: -0.2, tail: 0.5, tw: Math.sin(t * 6) * 0.8, g0: 0.7, g1: 0.7 });
      } else if (K.ph === 'rest') { Object.assign(o, { lid: 0.3, smile: 0.6, brow: 0.3 }); w.a0 = [40, -30]; w.a1 = [24, -24]; }
      else { // eager: leaning in, paws rubbing
        const r = Math.sin(t * 7) * (G.wait ? 0 : 1);
        w.a0 = [20 + 2 * r, -40]; w.a1 = [27 - 2 * r, -40];
        Object.assign(o, { rot: 0.08, smile: 0.9, brow: 0.5, lid: 0.15, ear: -0.15, pup: 1.1 });
        if (G.wait) Object.assign(o, { brow: 0.1, smile: 0.2, hr: -0.1 });
      }
    }
  }
  if (K.end === 'win') { st = 'sit'; Object.assign(o, { brow: -0.8, smile: -0.7, lid: 0.45, ear: 0.7 }); dr.eye = 'normal'; }
  if (K.end === 'lose') { st = 'laugh'; }
  return { st, u, o, w, dr, prop };
}
// a world point into the sitting rig's floor frame (rig units, y down), for mama at (mx, gy) facing face
const toRig = (W, mx, gy, face) => ({ x: ((W.x - mx) * 100 * face) / PLAY_M, y: (-(W.y - gy) * 100) / PLAY_M });

export function drawMama(ctx, x, gy, k, t, K, G, o = {}) {
  const L = mamaLook(K, G, t);
  if (!L) return;
  const face = K.ph === 'leave' ? -1 : 1, s = PLAY_M * k;
  let p = raccoonPose(L.st, t, L.u, L.st === 'sit' ? { perch: true, R: -1, eye: o.eyeAt ? (() => { const r = toRig(o.eyeAt, x, gy, face); return [r.x, r.y]; })() : null } : {});
  if (L.st === 'sit') { p.f0x -= 4; p.f1x -= 2; }
  Object.assign(p, L.o);
  if (L.w.a0 || L.w.a1) { const q = raccoonFin({ ...p }, { ...(L.w.a0 ? { a0: L.w.a0 } : {}), ...(L.w.a1 ? { a1: L.w.a1 } : {}) }); if (L.w.a0) { p.a0x = q.a0x; p.a0y = q.a0y; } if (L.w.a1) { p.a1x = q.a1x; p.a1y = q.a1y; } }
  if (!o.calm && o.id) p = { ...raccoonBlend(o.id, p, t, 10) };
  ctx.save(); ctx.translate(x, gy); ctx.scale(1 / k, -1 / k);
  try { drawRaccoon(ctx, 0, 0, s, t, p, { face, eye: L.dr.eye, egg: false, lashes: true, costume: o.costume, calm: o.calm, low: o.low, noSack: L.prop, frozen: o.frozen }); }
  finally { ctx.restore(); }
}
// her sack as a prop on the yard: open while the kits are out, eggs peeking over its neck
function drawSackProp(ctx, sim, K, t, k, calm) {
  const g = sim.kitGeo(), s = PLAY_M * k * 1.25, G = K.g;
  const open = K.ph === 'untie' ? ss(UNTIE_POP - 0.12, UNTIE_POP, uOf(K)) : G.ph !== 'sack' || K.ph === 'sulk' ? 1 : 0.15;
  const wob = calm ? 0 : (K.ph === 'untie' ? 0.15 * Math.sin(t * 30) * (1 - ss(0.2, UNTIE_POP, uOf(K))) * ss(0, 0.1, uOf(K)) : 0);
  ctx.save(); ctx.translate(g.sack, sim.groundY); ctx.scale(1 / k, -1 / k);
  try {
    const u = s / 100, n = K.sack.length;
    for (let i = 0; i < Math.min(3, n); i++) egg(ctx, (i - (Math.min(3, n) - 1) / 2) * 12 * u, -40 * u - (i % 2) * 3 * u, 18 * u, (i - 1) * 0.3);
    drawSack(ctx, 0, 0, s, t, { open, rot: wob, squash: K.ph === 'untie' ? 0.06 * Math.sin(t * 20) * (1 - ss(0.3, 0.5, uOf(K))) : 0 });
  } finally { ctx.restore(); }
}
function egg(ctx, x, y, h, rot) {
  const w = h * 0.76;
  ctx.save(); ctx.translate(x, y); ctx.rotate(rot);
  ctx.beginPath(); for (let i = 0; i <= 24; i++) { const a = (i / 24) * TAU, s2 = Math.sin(a); ctx.lineTo((w / 2) * Math.cos(a) * (1 + 0.13 * s2), (h / 2) * s2); }
  ctx.closePath(); ctx.fillStyle = '#fff1d6'; ctx.fill(); ctx.lineWidth = Math.max(1, h * 0.08); ctx.strokeStyle = '#221622'; ctx.stroke();
  ctx.restore();
}

// ---------------------------------------------------------------- the kits
// one kit at a world point on a floor of radius rf at angle a (up = toward the vault's centre), facing along the floor
function kitOnFloor(ctx, rf, a, h, k, t, st, u, face, o) {
  const r = rf - h, px = r * Math.cos(a), py = r * Math.sin(a), th = Math.PI / 2 - (a + Math.PI);
  ctx.save(); ctx.translate(px, py); ctx.scale(1 / k, -1 / k); ctx.rotate(th);
  try { const p = kitPose(st, t, u, o); Object.assign(p, o.add || {}); drawKit(ctx, 0, 0, KIT_M * KS * k, t, p, { ...o, face }); }
  finally { ctx.restore(); }
}
function kitAt(ctx, x, y, rot, k, t, st, u, face, o) {
  ctx.save(); ctx.translate(x, y); ctx.scale(1 / k, -1 / k); ctx.rotate(rot);
  try { const p = kitPose(st, t, u, o); Object.assign(p, o.add || {}); drawKit(ctx, 0, 0, KIT_M * KS * k, t, p, { ...o, face }); }
  finally { ctx.restore(); }
}
// the leader: walks ahead, looking back over his shoulder, one paw beckoning ("this way!")
const LEADER = { look: -1, looky: -0.2, hr: -0.22, a0x: 22, a0y: -30, smile: 1, mouth: 0.45, brow: 0.5 };
// the leader looks back and beckons most of the time, and now and then faces the way he is going
const leaderAdd = (t) => { const k = ss(-0.25, 0.1, Math.sin(t * 0.8 + 1)); return { look: 1 - 2 * k, looky: -0.2 * k, hr: -0.2 - 0.02 * k, a0x: 6 + 16 * k, a0y: -9 - (21 + 3 * Math.sin(t * 9)) * k, smile: 1, mouth: 0.15 + 0.3 * k, brow: 0.5 }; };
// 0.8.19 THE CARRY (the owner: "one of them is always idle when carrying the eggs ... they are moving way too smooth"): TWO
// carry the egg, the clumsy one in front hauling it backwards, the sleepy one heaving from behind, each on his own beat
// (out of step); on the sim's check beat (sim.kitScamp: the carry's heave and stagger) they stagger and bob under the
// weight, and now and then one REGRIPS (a dip into the lift pose and up: the near drop and the catch). The keen one is the
// LOOKOUT, never idle and never a copy: he darts ahead, waves them on, runs back, looks about; every third dash he trips;
// and when the player turns their ring he plants himself and hisses back at it (sim.menaceTurned). All from the clock and
// the sim's state (deterministic); Calm: the plain steady carry, the lookout walking ahead beckoning.
const LOOK_T = 3.4; // s one lookout round: dash out, wave, run back, look about
function carryRole(i, t, G, sim, calm) {
  if (i !== 0) {
    if (calm) return { st: i === 1 ? 'pull' : 'push', off: i === 1 ? CO : -CO, h: 0, u: null, add: null, back: 0 };
    const ph = t + i * 1.9, rg = ph % 5.2 < 0.5, slow = sim.kitScamp ? sim.kitScamp() < 1 : false;
    const bob = slow ? 0.05 * Math.abs(Math.sin(t * (i === 1 ? 7 : 8.5) + i)) : 0;
    if (rg) return { st: 'lift', off: i === 1 ? CO : -CO, h: 0, u: 0.5 + 0.4 * Math.sin(((ph % 5.2) / 0.5) * Math.PI), add: { brow: -0.7, mouth: 0.5 }, back: 0, rate: 1 };
    return { st: i === 1 ? 'pull' : 'push', off: (i === 1 ? CO : -CO) + (slow ? (i === 1 ? -0.05 : 0.05) : 0), h: bob, u: null, add: slow ? { brow: -0.6, mouth: 0.45, ear: 0.5 } : null, back: 0, rate: i === 1 ? 1 : 1.27 };
  }
  if (calm) return { st: 'walk', off: LEAD, h: 0, u: null, add: leaderAdd(t), back: 0 };
  if (sim.menaceTurned && G.c >= 0 && sim.menaceTurned(G.c, 0.8)) return { st: 'wait', off: LEAD * 0.75, h: 0, u: 0, add: { mouth: 0.9, brow: -1, ear: -0.9, look: -1, smile: -0.6 }, back: 1 }; // hiss!
  const c = (t % LOOK_T) / LOOK_T, n = Math.floor(t / LOOK_T);
  if (c < 0.26) { const trip = n % 3 === 2 && c > 0.19; return trip ? { st: 'tumble', off: lerp(0.9, 2.3, ss(0, 0.26, 0.19)), h: 0, u: 0.15 + ((c - 0.19) / 0.07) * 0.5, add: null, back: 0 } : { st: 'run', off: lerp(0.9, 2.3, ss(0, 0.26, c)), h: 0.06 * Math.abs(Math.sin(c * 40)), u: null, add: null, back: 0, rate: 1.8 }; }
  if (c < 0.52) return { st: 'walk', off: 2.3, h: 0, u: 0, add: leaderAdd(t * 2.2), back: 0 }; // waving them on
  if (c < 0.76) return { st: 'run', off: lerp(2.3, 0.95, ss(0.52, 0.76, c)), h: 0, u: null, add: null, back: 1, rate: 1.8 };
  return { st: 'wait', off: 0.95, h: 0, u: 0, add: { look: Math.sin(t * 3) > 0 ? 1 : -1, looky: 0.3, brow: 0.4 }, back: 0 }; // looks about
}
function drawCarry(draw, i, t, G, sim, calm, gait, d) {
  const R = carryRole(sim.kit && sim.kit.n === 2 && i === 0 ? 2 : i, t, G, sim, calm); // (two kits: both carry, no lookout)
  draw(R.off * d, R.h, R.st, R.u != null ? R.u : gait * (R.rate || 1) + i * 0.21, R.back ? -d : d, R.add);
}
function drawCrew(ctx, sim, K, t, k, calm, costume, o = {}) {
  const G = K.g, n = K.n, low = !!PERF.low, base = { costume, calm, low };
  const ord = [0, 1, 2].slice(0, n);
  const fl = G.c >= 0 && sim.rings[G.c] ? sim.kitFloor(G.c) : 0, d = G.dir || 1, gu = uOf(G), gait = G.odo / 0.22;
  const sp = (i) => (SP + 0.05 * i) / Math.max(1, fl); // the spacing along a floor (rad)
  switch (G.ph) {
    case 'sack': { // at home beside mama (only while she reacts or rests)
      const g = sim.kitGeo(), gy = sim.groundY;
      if (K.ph === 'comfort' || K.ph === 'scold' || K.ph === 'smug' || K.ph === 'rest' || K.ph === 'sulk') {
        const sc = K.ph === 'sulk' ? ss(0.2, 0.75, uOf(K)) : 0;
        ord.forEach((i) => {
          const x0 = K.ph === 'comfort' ? [0.98, 0.42, 1.52][i] : 0.5 + 0.5 * i, x = g.sack + x0 - sc * x0, y = gy + sc * 0.5; // (comfort: the crying one right under her paw)
          const add = K.ph === 'comfort' && i === 1 ? { tear: 1, brow: -1, smile: -0.8, mouth: 0.5, squeeze: 1, ear: 0.8 } : K.ph === 'scold' ? { ear: 0.9, brow: -0.6, look: -0.6, looky: 0.8, smile: -0.3, blush: i === 1 ? 1 : 0, lid: 0.3 } : K.ph === 'smug' ? { happy: 1, mouth: 0.5, smile: 1 } : K.ph === 'sulk' ? { brow: -0.7, smile: -0.5, ear: 0.6 } : {};
          kitAt(ctx, x, y, 0, k, t, K.ph === 'smug' ? 'ride' : 'sit', 0, -1, { ...base, who: i, add });
        });
      }
      return;
    }
    case 'pop': { // one after another out of the sack's mouth: a roll, the shake, the sniff
      const g = sim.kitGeo(), gy = sim.groundY;
      ord.forEach((i) => { const q = clamp(gu * 1.35 - i * 0.17, 0, 1), x = g.sack + 0.2 + q * (0.45 + 0.48 * i), y = gy + 0.45 * Math.sin(Math.min(1, q / 0.4) * Math.PI) * (1 - q * 0.6); if (q <= 0) return; kitAt(ctx, x, y, 0, k, t, 'pop', q, 1, { ...base, who: i }); });
      return;
    }
    case 'run': case 'yard': {
      const carry = G.ph === 'yard';
      ord.forEach((i) => {
        if (carry) drawCarry((off, h, st, u, face, add) => kitAt(ctx, G.x + off, sim.groundY + h, 0, k, t, st, u, face, { ...base, who: i, add }), i, t, G, sim, calm, gait, d);
        else kitAt(ctx, G.x - d * (0.55 * i + drift(i, t, calm)), sim.groundY, 0, k, t, 'run', gait + i * 0.37, d, { ...base, who: i });
      });
      return;
    }
    case 'climbIn': { // the kit tower: they scramble up one on another, the top one hauling over the rim
      ord.forEach((i) => { const lift = (n - 1 - i) * 0.46 * ss(0, 0.5, gu), y = G.y - 0.2 + lift - (G.y - sim.groundY) * 0.0, x = G.x + 0.05 * Math.sin(t * (9 - 2.5 * i) + i * 2); kitAt(ctx, x, y, 0, k, t, 'climb', 0, i === 1 ? -1 : 1, { ...base, who: i }); });
      return;
    }
    case 'out': { // over the rim with the egg and down to the yard
      ord.forEach((i) => kitAt(ctx, G.x + (i - 1) * 0.58, G.y - 0.15, 0, k, t, 'climb', 0, -1, { ...base, who: i }));
      return;
    }
    case 'flee': { // home: crying (a tumble, a dangle), diving (a crow, a flash), or just running
      const cry = G.why === 'tumble' || G.why === 'dangle', st = G.why === 'dive' || G.why === 'scare' ? 'dive' : cry ? 'cry' : 'run';
      const hold = cry ? clamp(KITS.wail / Math.max(1e-3, G.dur), 0, 0.6) : 0; // the held wail where they fell, then the run
      // (each leaves when he is ready: the cross one storms off first, the bawler after him, the sniffler last and slowest, each on his own arc)
      ord.forEach((i) => { const lag = [0, 0.09, 0.2][i], q = clamp(((gu - hold) / (1 - hold) - lag) / (1 - lag) * [1.25, 1.08, 1][i], 0, 1), F = G.from, S = sim.kitSackPt(K), x = F.x + (S.x - F.x) * ss(0, 1, q), h = Math.max(0.8, (F.y - S.y) * 0.3 + 0.8) * [1, 1.25, 0.8][i], y = F.y + (S.y - F.y) * ss(0, 1, q) + h * Math.sin(q * Math.PI); const wl = q <= 0 && cry; kitAt(ctx, x + (i - 1) * 0.6 * (1 - ss(0, 0.35, q)), y - 0.15, st === 'dive' ? -0.6 * (S.x < F.x ? -1 : 1) : 0, k, t, wl ? 'wail' : st, wl ? 0 : t * 3 + i, wl ? (i % 2 ? 1 : -1) : S.x < F.x ? -1 : 1, { ...base, who: i }); });
      return;
    }
    case 'up': case 'down': case 'hop': {
      const P = G.p || sim.kitBody(G), a = Math.atan2(P.y, P.x), rP = Math.hypot(P.x, P.y);
      ord.forEach((i) => { if (G.eid && G.ph !== 'up') drawCarry((off, h, st, u, face, add) => kitOnFloor(ctx, rP + 0.2, a + off / Math.max(1, rP), h, k, t, st, u, face, { ...base, who: i, add }), i, t, G, sim, calm, gait, d); else kitOnFloor(ctx, rP + 0.2, a - d * (sp(i) * 0.6 * i + drift(i, t, calm) * 0.5 / Math.max(1, rP)), 0.05 * i, k, t, G.ph === 'up' ? 'climb' : 'run', t * 2 + i, d, { ...base, who: i }); });
      return;
    }
    case 'dangle': { // hanging by their tails from the edge of the hole, upside down, flailing
      ord.forEach((i) => { const a = G.a + (i - (n - 1) / 2) * sp(i) * 0.8, r = fl + RING_TH + 0.04, sw = calm ? 0 : [0.08, 0.2, 0.1][i] * Math.sin(t * [5.5, 4, 1.8][i] + i * 1.7), th = Math.PI / 2 - (a + Math.PI) + Math.PI + sw; ctx.save(); ctx.translate(r * Math.cos(a), r * Math.sin(a)); ctx.scale(1 / k, -1 / k); ctx.rotate(th); const p = kitPose('dangle', t, 0, { who: i }); p.tail = -1.3; drawKit(ctx, 0, 0, KIT_M * KS * k, t, p, { ...base, who: i, face: i % 2 ? -1 : 1 }); ctx.restore(); });
      return;
    }
    default: { // on a floor: go, wait, lift, carry, tumble (drawn inside their channel: past the ring above only a ghost)
      if (!fl) return;
      const above = sim.rings[G.c - 1];
      if (above && !o.unclipped) { drawInChannel(ctx, above.r - RING_TH / 2, false, 0.32, () => drawCrew(ctx, sim, K, t, k, calm, costume, { unclipped: 1 })); return; }
      if (G.ph === 'carry') {
        ord.forEach((i) => { if (G.wait) { const R = ROLE(i); kitOnFloor(ctx, fl, G.a + (R.off * d) / fl, 0, k, t, R.lead ? 'wait' : R.st, 0, d, { ...base, who: i, add: R.lead ? null : { looky: -0.8, brow: -0.3 } }); } else drawCarry((off, h, st, u, face, add) => kitOnFloor(ctx, fl, G.a + off / fl, h, k, t, st, u, face, { ...base, who: i, add }), i, t, G, sim, calm, gait, d); });
        return;
      }
      if (G.ph === 'lift') {
        const e = sim.eggs.find((q) => q.id === G.tgt), ea = e ? Math.atan2(e.body.getPosition().y, e.body.getPosition().x) : G.a;
        // (they came in from the way out, so the carry will go back that way: the puller and the leader take that side of the egg, the pusher the far side)
        ord.forEach((i) => { const off = (i === 1 ? -0.5 : i === 2 ? 0.48 : -1.25) * d / fl, a = ea + off; kitOnFloor(ctx, fl, a, 0, k, t, 'lift', clamp(gu * 1.1, 0, 1), i === 2 ? -d : d, { ...base, who: i }); });
        return;
      }
      ord.forEach((i) => {
        const a = G.ph === 'tumble' ? G.a + (i - (n - 1) / 2) * sp(i) * 1.1 : G.a - d * (sp(i) * i + (G.wait ? 0 : drift(i, t, calm) / fl));
        const st = G.ph === 'tumble' ? 'tumble' : G.wait ? 'wait' : 'walk';
        kitOnFloor(ctx, fl, a, 0, k, t, st, G.ph === 'tumble' ? uOf(G) : G.wait ? 0 : gait + i * 0.29, G.ph === 'tumble' ? (i % 2 ? -1 : 1) : d, { ...base, who: i, beat: G.ph === 'tumble' });
      });
    }
  }
}

export function drawKits(ctx, sim, t, k, calm, layer = 'front') {
  const K = sim.kit;
  if (!K || layer !== 'front') return;
  const costume = kitsCostume(sim.level), g = sim.kitGeo(), G = K.g;
  if (K.ph !== 'wait' && K.ph !== 'gone' && K.ph !== 'walk' && K.ph !== 'leave') drawSackProp(ctx, sim, K, t, k, calm);
  const eyeAt = G.ph !== 'sack' ? (G.c >= 0 ? sim.kitBody(G) : { x: G.x, y: G.y }) : null;
  const X = sim.bx && sim.bx.boss, frozen = false;
  if (K.ph !== 'wait' && K.ph !== 'gone') drawMama(ctx, K.x, sim.groundY, k, t, K, G, { costume, calm, low: !!PERF.low, eyeAt, id: 'mama', frozen });
  drawCrew(ctx, sim, K, t, k, calm, costume);
}

// ---------------------------------------------------------------- outside play (0.8.18 "put them everywhere the old designs are")
// mama in pixel space (y down): feet at (x, y), s = px per 100 rig units (in play PLAY_M * k), a canned beat ph/gph
// (her phase, the crew's: 'carry' = proud, 'tumble' = gasp, 'sack' + ph 'smug' = smug, 'comfort', 'scold', 'sulk')
export function drawMamaPx(ctx, x, y, s, t, ph, gph, costume, o = {}) {
  const k = s / PLAY_M, G = { ph: gph || 'sack', t: o.gt ?? 0.5, dur: o.gdur ?? 1, why: o.why, wait: 0 }, K = { ph, t: o.kt ?? 0, dur: o.kdur ?? 1, x: 0, n: 3, sack: [], g: G };
  ctx.save(); ctx.translate(x, y); ctx.scale(k, -k);
  try { drawMama(ctx, 0, 0, k, t, K, G, { costume, calm: !!o.calm, low: !!o.low, eyeAt: o.eyeAt ? { x: (o.eyeAt.x - x) / k, y: -(o.eyeAt.y - y) / k } : null }); }
  finally { ctx.restore(); }
}
// one kit in pixel space: feet at (x, y), s px per 100 rig units, turned rot (rad) about the feet
export function drawKitPx(ctx, x, y, s, t, st, u, face, o = {}) {
  ctx.save(); ctx.translate(x, y); if (o.rot) ctx.rotate(o.rot);
  try { const p = kitPose(st, t, u, o); Object.assign(p, o.add || {}); drawKit(ctx, 0, 0, s, t, p, { ...o, face }); }
  finally { ctx.restore(); }
}
// the portrait (info panel, map, Lucky Spin reel, level card faces, Practice tile): mama in her costume, proud, paws
// clasped, her keen kit in front heaving an egg over his head (d x d box centred at x, y; the caller clips it)
export function kitsPortrait(ctx, x, y, d, t, costume) {
  const s = d * 0.5, fy = y + d * 0.47;
  drawMamaPx(ctx, x - d * 0.13, fy, s, t, 'watch', 'carry', costume);
  const sk = s * 0.62, kx = x + d * 0.2, bob = Math.abs(Math.sin(t * 3.4)) * sk * 0.03;
  egg(ctx, kx + sk * 0.12, fy - sk * 0.47 - bob, sk * 0.3, 0.15 * Math.sin(t * 1.7));
  drawKitPx(ctx, kx, fy, sk, t, 'lift', 0.95, -1, { who: 0, costume });
}
// the level card's scene (render/howact.js kitsActor): the stage hands its clock T, the egg's angle eA and the ring's turn
// th; at(phi, lift) is a stage point (phi 0 = the bottom, + to the right), k px per metre, ground the yard's y.
// turn: three kits carry the egg left along the floor (mama proud on the yard), the hand turns the ring hard: they
// tumble (her gasp), the egg rolls back to the bottom and drops through the gap the turn brought round, they run home
// crying (she comforts). harm: they carry it out over the rim and off to her sack (she pats it, smug).
export const KCARD = { carry: [0.2, 1.35], tumble: 1.55, home: [2.1, 2.8], out: [0.5, 2.2] };
export const kitsCardEgg = (T) => -0.3 * ss(KCARD.carry[0], KCARD.carry[1], T) * (1 - ss(1.6, 2.2, T));
export const kitsHarmEgg = (T) => -0.95 * ss(KCARD.out[0], KCARD.out[1], T);
export function drawKitsCard(ctx, S, costume) {
  const { T, t, k, at, eggS } = S, harm = S.m === 'harm', n = 3, eA = S.eA ?? 0, fl = S.floor;
  const ms = Math.min(PLAY_M * k * 0.9, S.h * 0.36), mx = S.x + ms * 0.62, my = S.ground, sk = KIT_M * KS * k * 0.8; // (about an egg tall, as in play; she is a little bigger here than before) // (small, in the corner under the ring's left: the ring and the egg stay clear)
  // mama on the yard, her face on the beat
  let ph = 'watch', gph = 'carry', gt = 0.5;
  if (harm) { if (T > 2.2) ph = 'smug', gph = 'sack'; }
  else if (T >= KCARD.tumble && T < KCARD.home[0] + 0.3) { gph = 'tumble'; gt = 1 - ss(KCARD.tumble, KCARD.tumble + 0.3, T); }
  else if (T >= KCARD.home[0] + 0.3) ph = 'comfort', gph = 'sack';
  else if (T < KCARD.carry[0] + 0.1) gph = 'go';
  drawMamaPx(ctx, mx, my, ms, t, ph, gph, costume, { gt, gdur: 1, kdur: 1, kt: 0.5, eyeAt: at(eA, eggS) });
  const off = (CO * k) / fl, lead = (LEAD * k) / fl, base = { costume, calm: !!S.calm };
  if (harm) { // the carry out: along the floor, then the egg and its crew fade off toward her sack
    const a = kitsHarmEgg(T), al = 1 - ss(2.0, 2.4, T), gait = T * 5;
    if (al <= 0) return { threat: true, x: at(a, 0).x, y: at(a, 0).y, own: true };
    ctx.save(); ctx.globalAlpha *= al;
    [0, 1, 2].forEach((i) => { const lf = T < KCARD.out[0], R = ROLE(i), aa = a + (R.lead ? (lf ? -lead * 0.85 : -lead) : R.st === 'pull' ? -off : off), P = at(aa, 0); drawKitPx(ctx, P.x, P.y, sk, t, lf ? 'lift' : R.st, lf ? ss(0, KCARD.out[0], T) : gait + i * 0.2, -1, { ...base, who: i, rot: -aa, add: !lf && R.lead ? LEADER : null }); });
    ctx.restore();
    return { threat: true, x: at(a, 0).x, y: at(a, 0).y - sk * 0.4, own: true };
  }
  const car = T < KCARD.tumble, home = ss(KCARD.home[0], KCARD.home[1], T), gait = T * 5;
  const a0 = -0.3 * ss(KCARD.carry[0], KCARD.carry[1], Math.min(T, KCARD.tumble)) + (S.th || 0) * 0.5; // where they fell
  ctx.save(); ctx.globalAlpha *= 1 - ss(KCARD.home[1] - 0.3, KCARD.home[1], T);
  [0, 1, 2].slice(0, n).forEach((i) => {
    if (car) { const R = ROLE(i), aa = eA + (R.lead ? -lead : R.st === 'pull' ? -off : off), P = at(aa, 0); drawKitPx(ctx, P.x, P.y, sk, t, R.st, gait + i * 0.2, -1, { ...base, who: i, rot: -aa, add: R.lead ? LEADER : null }); return; }
    if (home <= 0) { const aa = a0 + (i - 1) * off * 1.2, P = at(aa, 0); drawKitPx(ctx, P.x, P.y, sk, t, 'tumble', 0, i % 2 ? -1 : 1, { ...base, who: i, rot: -aa }); return; }
    if (home < [0.02, 0.12, 0.25][i]) { const aa = a0 + (i - 1) * off * 1.2, P = at(aa, 0); drawKitPx(ctx, P.x, P.y, sk, t, 'wail', 0, i % 2 ? -1 : 1, { ...base, who: i, rot: -aa }); return; }
    const aa = a0 + (i - 1) * off * 1.2 - 0.7 * home, P = at(aa, 0); drawKitPx(ctx, P.x, P.y, sk, t, 'cry', t * 2.4 + i * 0.3, -1, { ...base, who: i, rot: -aa });
  });
  ctx.restore();
  const P = at(car ? eA : a0, 0);
  return { threat: car, bonk: ss(KCARD.tumble, KCARD.tumble + 0.5, T), x: P.x - sk * 0.3, y: P.y - sk * 1.25, own: true, word: T > KCARD.tumble && T < KCARD.home[0] ? 'WHOA!' : undefined };
}

// ---------------------------------------------------------------- events: the game's own sounds, a pop or two, no words
export function kitsEvent(ev, fx, U) {
  const { popup, audio } = U;
  switch (ev.type) {
    case 'kitWalk': audio.play('weasel_sniff', { vol: 0.4, pitch: 1.2 }); break;
    case 'kitUntie': audio.play('release', { vol: 0.5, pitch: 0.8 }); break;
    case 'kitPop': audio.play('bubble_pop', { vol: 0.6, pitch: 1.4 }); audio.play('cluck', { vol: 0.35, pitch: 2.0 }); break;
    case 'kitClimb': audio.play('hen_hop', { vol: 0.45, pitch: 1.6 }); break;
    case 'kitUp': case 'kitHop': audio.play('hen_hop', { vol: 0.35, pitch: 1.8 }); break;
    case 'kitLift': audio.play('squish', { vol: 0.45, pitch: 1.5 }); break;
    case 'kitCarry': audio.play('grab', { vol: 0.6, pitch: 1.4 }); if (ev.golden) fx.sparkle(ev.x, ev.y, 10, '#ffd63c'); break;
    case 'kitOut': audio.play('hen_hop', { vol: 0.45, pitch: 1.5 }); break;
    case 'kitHome': audio.play('squish', { vol: 0.5, pitch: 0.8 }); audio.play('weasel_snicker', { vol: 0.35, pitch: 1.1 }); break;
    case 'kitCatch': audio.play('grab', { vol: 0.7, pitch: 1.0 }); break;
    case 'kitTumble': audio.play('stun_stars', { vol: 0.55, pitch: 1.3 }); audio.play('egg_bump', { vol: 0.4, pitch: 1.6 }); fx.sparkle(ev.x, ev.y, 8, '#ffe08a'); break;
    case 'kitDangle': audio.play('weasel_yelp', { vol: 0.6, pitch: 1.7 }); popup(ev.x, ev.y + 0.6, '!', { color: '#ffe680', size: 22, life: 0.7 }); break;
    case 'kitDive': audio.play('egg_bump', { vol: 0.5, pitch: 2.0 }); break;
    case 'kitBack': if (ev.why === 'tumble' || ev.why === 'dangle' || ev.why === 'dive') audio.play('weasel_yelp', { vol: 0.35, pitch: 2.1 }); break;
    case 'kitSulk': audio.play('creature_hurt', { vol: 0.5, pitch: 0.8 }); break;
    case 'kitSpillAll': audio.play('tada', { vol: 0.5 }); break;
    case 'kitSpill': audio.play('release', { vol: 0.6, pitch: 1.1 }); fx.sparkle(ev.x, ev.y, 10, '#bff0a0'); break;
  }
}
if (typeof __DEV__ === 'undefined' || __DEV__) { try { window.__kits = { drawKit, kitPose, drawMama, mamaLook, drawKits, KIT_M, PLAY_M, drawMamaPx, drawKitPx, kitsPortrait, drawKitsCard }; } catch (_) { /* no window */ } }
