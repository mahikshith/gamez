// Bandit the raccoon IN PLAY (0.8.17, L6): his own art (render/raccoon.js, never redrawn here) driven by the sim
// (sim/bandit.js). He stands on the yard under the vault's lower-left side; his near arm reaches up to the mouth of the
// gap he goes through and from there on a bent arm (drawn here, in his fur and ink) runs onto the outer channel's floor
// to his paw. He is drawn after the basket and BEFORE the rings, so the ring's edge closes over his arm when it pinches.
//   drawBandit(ctx, sim, t, k, calm)     world space (y up, metres), k = px per metre
//   bandHides(sim, egg)                  the eggs he draws himself (in his sack, hugged while he stuffs it)
//   banditEvent(ev, fx, U)               sounds, popups and tips (U: { popup, audio, once, hitStop, calm })
//   drawBanditEmblem / drawBanditCard    the boss bar chip and the intro portrait
// Calm (save.calm): no shake, no flash, the telegraph mark does not pulse.
import { RACCOON_M, raccoonPose, raccoonBlend, drawRaccoon } from './raccoon.js';
import { BAND } from '../sim/bandit.js';
import { RING_TH } from '../sim/geom.js';

const TAU = Math.PI * 2;
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const ss = (a, b, x) => { const u = clamp((x - a) / (b - a), 0, 1); return u * u * (3 - 2 * u); };
const INK = '#221622', FUR = '#9494aa', PAW = '#40394e', PAWHI = '#5d5570', HURT = '#ef4634';
const ICE = { fur: '#aec8e0', paw: '#8aa6c2', ink: '#5a7a96' }; // his colours iced over (raccoon.js mixes 55% toward #bfe6ff)

// his pose this frame, from the sim's phase: [state, u, extra pose fields, draw options]
function look(sim, B, t) {
  const X = sim.bx && sim.bx.boss, P = (k) => clamp(1 - B.t / Math.max(1e-3, B.dur), 0, 1);
  const o = { eye: 'normal' }, add = {};
  let st = 'idle', u = 0;
  switch (B.ph) {
    case 'sneak': st = 'sneak'; u = 0.001 + B.odo / 0.36; break;
    case 'dash': st = 'sneak'; u = 0.001 + B.odo / 0.5; o.eye = 'lock'; break;
    case 'scared': st = Math.abs(sim.bandGeo().x0 - B.x) > 0.03 ? 'sneak' : 'idle'; u = 0.001 + B.odo / 0.4; o.eye = 'wide'; add.sweat = 1; add.ear = 0.8; break;
    case 'peek': st = 'peek'; u = P(); break;
    case 'reach': st = 'reach'; u = 0.14 + 0.3 * clamp(B.ext / Math.max(0.1, sim.bandPath(B).L1 + sim.bandPath(B).L2), 0, 1); break;
    case 'grope': case 'tease': st = 'reach'; u = 0.6; break;
    case 'strain': st = 'reach'; u = 0.6; add.sweat = 1; add.brow = -0.6; add.jaw = 0.4; add.teeth = 1; break;
    case 'yank': case 'retract': st = 'reach'; u = 0.6; break;
    case 'stuff': st = 'grab'; u = 0.55 * P(); break;
    case 'laugh': st = 'laugh'; break;
    case 'huh': st = 'idle'; o.eye = 'wide'; add.brow = -0.5; add.smile = -0.2; break;
    case 'miss': st = 'idle'; add.brow = -0.7; add.smile = -0.4; break;
    case 'pinch': st = 'pinched'; u = 0.16 * P(); break;
    case 'yelp': st = 'pinched'; u = 0.16 + 0.84 * P(); break;
    case 'stun': st = 'dizzy'; u = 0; break;
    case 'whistle': st = 'whistle'; u = P(); break;
    case 'dizzy': st = 'dizzy'; u = P(); break;
    case 'defeated': st = 'defeated'; u = clamp((sim.t - (B.t0 ?? sim.t)) / 2, 0, 1); break;
  }
  if (B.end === 'win' && B.ph !== 'defeated') { st = 'idle'; add.brow = -0.8; add.smile = -0.6; add.ear = 0.6; } // he sulks
  if (B.end === 'lose' && B.ph !== 'defeated') st = 'laugh';
  return { st, u, o, add, frozen: (X && X.stk > 0) || B.fz > 0 || B.held };
}

// the rig point (forward, down) of a world point, from his feet
const rigOf = (B, gY, x, y) => [((x - B.x) * B.face * 100) / RACCOON_M, (-(y - gY) * 100) / RACCOON_M];
// put the art's near paw exactly on a rig point (the inverse of raccoon.js drawRaccoon's torso frame)
function pawTo(p, w) {
  const sx = 1 + p.sq * 0.7, sy = 1 - p.sq, cr = Math.cos(p.rot), sr = Math.sin(p.rot);
  const X = w[0] / sx - p.dx, Y = w[1] / sy + p.by;
  p.a0x = X * cr + Y * sr; p.a0y = -X * sr + Y * cr;
}
// the art's own px point of a torso-frame point (raccoon.js toPx), at feet (0, 0)
function toPx(p, lx, ly, u, face) {
  const sx = 1 + p.sq * 0.7, sy = 1 - p.sq, cr = Math.cos(p.rot), sr = Math.sin(p.rot);
  return { x: (p.dx + lx * cr - ly * sr) * sx * u * face, y: (-p.by + lx * sr + ly * cr) * sy * u };
}
const FZ = { on: false, t: 0 };

export function bandHides(sim, e) {
  const B = sim.band;
  return !!B && (B.sack.includes(e.id) || (B.ph === 'stuff' && B.eid === e.id));
}

export function drawBandit(ctx, sim, t, k, calm) {
  const B = sim.band;
  if (!B) return;
  const gY = sim.groundY, s = RACCOON_M * k, u = s / 100, L = look(sim, B, t);
  if (L.frozen && !FZ.on) { FZ.on = true; FZ.t = t; } else if (!L.frozen) FZ.on = false;
  const tt = FZ.on ? FZ.t : t;
  const path = sim.bandPath(B), inArm = (B.ph === 'reach' || B.ph === 'grope' || B.ph === 'tease' || B.ph === 'strain' || B.ph === 'yank' || B.ph === 'retract' || B.ph === 'pinch') && B.ext > 0;
  const opt = {};
  const paw = sim.bandPaw(B), out = inArm && B.ext > path.L1; // the paw is past the gap's mouth: the bent arm runs on from there
  const tgt = out ? path.G0 : paw;
  if (inArm || B.ph === 'yelp') opt.to = rigOf(B, gY, tgt.x, tgt.y);
  let p = raccoonPose(L.st, tt, L.u, opt);
  Object.assign(p, L.add);
  if (inArm) pawTo(p, opt.to); // exact: the arm meets the bent part at the gap's mouth
  p = calm ? p : raccoonBlend('bandit', p, t, inArm ? 40 : 12);
  if (inArm) pawTo(p, opt.to);
  const ice = L.frozen, face = B.face;
  // the telegraph: a dashed mark on the gap he is eyeing, and the "!" over his head
  if (B.ph === 'peek' && !sim.state.startsWith('w')) {
    const ring = sim.bandOuter(), q = clamp(1 - B.t / B.dur, 0, 1), pulse = calm ? 1 : 0.75 + 0.25 * Math.sin(t * 12), r = 0.42 + (calm ? 0 : 0.08 * (1 - q));
    const gx = ring.r * Math.cos(B.ga), gy = ring.r * Math.sin(B.ga);
    ctx.save(); ctx.lineWidth = 3 / k; ctx.setLineDash([7 / k, 5 / k]); ctx.strokeStyle = `rgba(255,207,106,${0.9 * pulse})`;
    ctx.beginPath(); ctx.arc(gx, gy, r, 0, TAU); ctx.stroke(); ctx.setLineDash([]);
    ctx.fillStyle = `rgba(255,140,60,${0.18 * pulse})`; ctx.fill(); ctx.restore();
  }
  // world -> his px space (y down, origin at his feet)
  ctx.save();
  ctx.translate(B.x, gY); ctx.scale(1 / k, -1 / k);
  const W = (x, y) => ({ x: (x - B.x) * k, y: -(y - gY) * k });
  try {
    // the eggs in his sack peek out over its neck (drawn first: the sack and his tail go over them)
    const n = B.sack.length;
    if (n && B.ph !== 'defeated') {
      const sk = toPx(p, p.skx, p.sky, u, face);
      for (let i = 0; i < Math.min(4, n); i++) {
        const ex = sk.x + (i - (Math.min(4, n) - 1) / 2) * 11 * u, ey = sk.y - 22 * u - (i % 2) * 3 * u;
        egg(ctx, ex, ey, 17 * u, (i - 1.5) * 0.25);
      }
    }
    // the art's own paw at the gap's mouth is hidden: the bent arm goes on from there
    const G0 = out ? W(path.G0.x, path.G0.y) : null, hidePaw = out && B.ph !== 'yelp';
    if (hidePaw) { ctx.save(); ctx.beginPath(); ctx.rect(-4000, -4000, 8000, 8000); ctx.moveTo(G0.x + 11 * u, G0.y); ctx.arc(G0.x, G0.y, 11 * u, 0, TAU); ctx.clip('evenodd'); }
    drawRaccoon(ctx, 0, 0, s, tt, p, { face, frozen: ice ? 1 : 0, eye: L.o.eye, egg: B.ph === 'stuff' ? undefined : false });
    if (hidePaw) ctx.restore();
    if (hidePaw) {
      // the bent arm: from a little back along his straight arm, through the gap's mouth, onto the floor, along it to the paw
      const sh = toPx(p, -7, -13, u, face), dx = G0.x - sh.x, dy = G0.y - sh.y, dl = Math.hypot(dx, dy) || 1;
      const pts = [[G0.x - (dx / dl) * 14 * u, G0.y - (dy / dl) * 14 * u], [G0.x, G0.y]];
      const k1 = clamp((B.ext - path.L1) / path.L2, 0, 1), G1 = W(path.G0.x + (path.G1.x - path.G0.x) * k1, path.G0.y + (path.G1.y - path.G0.y) * k1);
      pts.push([G1.x, G1.y]);
      const m = Math.ceil(Math.abs(B.arc) * path.ri / 0.18);
      for (let i = 1; i <= m; i++) { const a = B.ga + (B.arc * i) / m, q = W(path.ri * Math.cos(a), path.ri * Math.sin(a)); pts.push([q.x, q.y]); }
      const hurt = B.ph === 'pinch';
      armTo(ctx, pts, u, ice, hurt, B.eid ? 1 : 0, calm ? 0 : t);
      if (hurt) { // the ring's edge across his arm: a jolt of lines where it bites
        const ring = sim.bandOuter(), c = W(ring.r * Math.cos(B.ga), ring.r * Math.sin(B.ga));
        ctx.strokeStyle = '#ffe14a'; ctx.lineWidth = 2.2 * Math.max(1, u * 3);
        for (let i = 0; i < 6; i++) { const a = (i / 6) * TAU + 0.3, r0 = 10 * u * 3, r1 = r0 + 9 * u * 3; ctx.beginPath(); ctx.moveTo(c.x + Math.cos(a) * r0, c.y + Math.sin(a) * r0); ctx.lineTo(c.x + Math.cos(a) * r1, c.y + Math.sin(a) * r1); ctx.stroke(); }
      }
    }
    // a question mark when he lost the gap; the stars of a stun are the art's own
    if (B.ph === 'huh') bubble(ctx, toPx(p, p.hx + 30, p.hy - 64, u, face), 13 * u * 2.2, '?');
    if (B.ph === 'peek' && B.t / B.dur < 0.75) bubble(ctx, toPx(p, p.hx + 30, p.hy - 64, u, face), 13 * u * 2.2, '!');
  } finally { ctx.restore(); }
}
// the bent arm along pts (px, y down: from the gap's mouth on) and his paw at its end; shared with the level card (howact.js)
function armTo(ctx, pts, u, ice, hurt, hold, t) {
  const lw = Math.max(2.3, 1.15 / u) * u, wd = 10.5 * u;
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  const line = () => { ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1]); for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]); };
  line(); ctx.lineWidth = wd + lw * 2; ctx.strokeStyle = ice ? ICE.ink : INK; ctx.stroke();
  line(); ctx.lineWidth = wd; ctx.strokeStyle = ice ? ICE.fur : FUR; ctx.stroke();
  // his paw: a dark mitt, fingers spread to grope (curled round an egg he holds), red and throbbing when pinched
  const H = pts[pts.length - 1], Hp = pts[pts.length - 2], ang = Math.atan2(H[1] - Hp[1], H[0] - Hp[0]);
  mitt(ctx, H[0], H[1], ang, 8.2 * u * (hurt && t ? 1 + 0.12 * Math.sin(t * 30) : 1), lw, ice ? ICE.paw : hurt ? HURT : PAW, ice ? ICE.ink : INK, hold, t);
}
// the level card's Bandit (howact.js): drawn at his feet (fx, fy) in px (y down), s px per 100 rig units, the art's state
// st at u; o.arm: px points from the gap's mouth to his paw (his near paw goes to the first, the bent arm runs on)
export function drawBanditStage(ctx, fx, fy, s, t, st, u0, o = {}) {
  const u = s / 100, face = o.face || 1, arm = o.arm && o.arm.length > 1 ? o.arm : null, opt = {};
  const to = arm ? arm[0] : o.to;
  if (to) opt.to = [((to[0] - fx) * face) / u, (to[1] - fy) / u];
  const p = raccoonPose(st, t, u0, opt);
  Object.assign(p, o.add || {});
  if (arm) pawTo(p, opt.to);
  ctx.save(); ctx.translate(fx, fy);
  try {
    const G0 = arm ? { x: arm[0][0] - fx, y: arm[0][1] - fy } : null;
    if (arm) { ctx.save(); ctx.beginPath(); ctx.rect(-4000, -4000, 8000, 8000); ctx.moveTo(G0.x + 11 * u, G0.y); ctx.arc(G0.x, G0.y, 11 * u, 0, TAU); ctx.clip('evenodd'); }
    drawRaccoon(ctx, 0, 0, s, t, p, { face, eye: o.eye || 'normal', egg: o.hug ? undefined : false });
    if (arm) {
      ctx.restore();
      const sh = toPx(p, -7, -13, u, face), dx = G0.x - sh.x, dy = G0.y - sh.y, dl = Math.hypot(dx, dy) || 1;
      armTo(ctx, [[G0.x - (dx / dl) * 14 * u, G0.y - (dy / dl) * 14 * u], ...arm.map((q) => [q[0] - fx, q[1] - fy])], u, false, !!o.hurt, 0, o.calm ? 0 : t);
    }
    if (o.bubble) bubble(ctx, toPx(p, p.hx + 30, p.hy - 64, u, face), 13 * u * 2.2, o.bubble);
  } finally { ctx.restore(); }
}
function egg(ctx, x, y, h, rot) {
  const w = h * 0.76;
  ctx.save(); ctx.translate(x, y); ctx.rotate(rot);
  ctx.beginPath(); for (let i = 0; i <= 24; i++) { const a = (i / 24) * TAU, s2 = Math.sin(a); ctx.lineTo((w / 2) * Math.cos(a) * (1 + 0.13 * s2), (h / 2) * s2); }
  ctx.closePath(); ctx.fillStyle = '#fff1d6'; ctx.fill(); ctx.lineWidth = Math.max(1, h * 0.08); ctx.strokeStyle = INK; ctx.stroke();
  ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.ellipse(-w * 0.16, -h * 0.18, w * 0.1, h * 0.14, 0.4, 0, TAU); ctx.fill();
  ctx.restore();
}
function mitt(ctx, x, y, ang, r, lw, col, ink, hold, t) {
  ctx.save(); ctx.translate(x, y); ctx.rotate(ang);
  const wig = hold ? 0 : Math.sin(t * 13) * 0.25;
  const blob = () => { ctx.beginPath(); ctx.ellipse(0, 0, r * 1.15, r * 0.95, 0, 0, TAU); };
  for (let i = -1; i <= 1; i++) { // fingers
    const a = i * 0.55 + wig * (i + 1), fx = Math.cos(a) * r * (hold ? 0.95 : 1.35), fy = Math.sin(a) * r * (hold ? 0.95 : 1.2);
    ctx.beginPath(); ctx.ellipse(fx, fy, r * 0.48, r * 0.36, a, 0, TAU); ctx.lineWidth = lw * 2; ctx.strokeStyle = ink; ctx.stroke(); ctx.fillStyle = col; ctx.fill();
  }
  blob(); ctx.lineWidth = lw * 2; ctx.strokeStyle = ink; ctx.stroke(); ctx.fillStyle = col; ctx.fill();
  ctx.beginPath(); ctx.ellipse(-r * 0.2, -r * 0.3, r * 0.5, r * 0.22, 0, 0, TAU); ctx.fillStyle = col === PAW ? PAWHI : 'rgba(255,255,255,0.25)'; ctx.fill();
  ctx.restore();
}
function bubble(ctx, P, r, ch) {
  ctx.save();
  ctx.beginPath(); ctx.arc(P.x, P.y, r, 0, TAU); ctx.fillStyle = '#fffbe8'; ctx.fill(); ctx.lineWidth = Math.max(1.5, r * 0.14); ctx.strokeStyle = INK; ctx.stroke();
  ctx.fillStyle = ch === '!' ? '#d23a2a' : '#3a2a5a'; ctx.font = `900 ${Math.round(r * 1.45)}px sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(ch, P.x, P.y + r * 0.08);
  ctx.restore();
}

// ---------- events: sounds (the game's own), popups, the first-time tips
export function banditEvent(ev, fx, U) {
  const { popup, audio, once } = U, calm = !!U.calm;
  switch (ev.type) {
    case 'bandPeek':
      audio.play('weasel_sniff', { vol: 0.55, pitch: 0.75 });
      once('bandit', 'Bandit! When his paw comes up through a gap, turn that ring: PINCH!', 4.4);
      break;
    case 'bandReach': audio.play('wind_gust', { vol: 0.35, pitch: 1.8 }); break;
    case 'bandGrab': audio.play('grab', { vol: 0.75, pitch: 0.8 }); popup(ev.x, ev.y + 0.6, ev.golden ? 'Ooh, gold!' : 'Snatched!', { color: '#ff9a6a', size: 18, life: 0.9 }); break;
    case 'bandCatch': audio.play('grab', { vol: 0.75, pitch: 0.9 }); popup(ev.x, ev.y + 0.7, 'Caught it!', { color: '#ff9a6a', size: 18, life: 1 }); once('banditCatch', 'Bandit catches eggs that fall on his side of the yard. Pinch him three times to get them back.', 4); break;
    case 'bandStuff':
      audio.play('squish', { vol: 0.5, pitch: 0.7 });
      popup(ev.x, ev.y + 0.8, 'In the sack!', { color: '#ff7a5a', size: 18, life: 1 });
      once('banditSack', 'He bagged an egg! Pinch his paw three times and his sack spills every egg back.', 4.4);
      break;
    case 'bandMiss': audio.play('egg_bump', { vol: 0.3, pitch: 0.7 }); break;
    case 'bandHuh': audio.play('squish', { vol: 0.35, pitch: 1.6 }); popup(ev.x, ev.y + 0.7, 'Huh?', { color: '#bff0a0', size: 16, life: 0.8 }); break;
    case 'bandStrain': audio.play('squish', { vol: 0.5, pitch: 0.5 }); break;
    case 'bandHeavy': audio.play('rock_hit', { vol: 0.6, pitch: 0.8 }); popup(ev.x, ev.y + 0.5, 'Too heavy!', { color: '#bff0a0', size: 18, life: 1 }); break;
    case 'bandDash': audio.play('egg_bump', { vol: 0.35, pitch: 1.9 }); break;
    case 'bandPinch': {
      const word = ev.why === 'hot' ? 'HOT!' : ev.why === 'zap' ? 'ZAP!' : ev.why === 'flash' ? 'FLASH!' : ev.why === 'pinch' ? 'PINCH!' : 'OUCH!';
      audio.play('thorn_snap', { vol: 0.85, pitch: 0.9 }); audio.play('weasel_yelp', { vol: 0.8, pitch: 0.7 });
      fx.sparkle(ev.x, ev.y, 14, '#ffe08a');
      if (!calm) { fx.shake = Math.max(fx.shake || 0, 0.25); if (U.hitStop) U.hitStop(0.06); }
      popup(ev.x, ev.y + 0.7, word, { color: '#ff6a4a', size: 24, life: 1.2, sub: ev.left > 0 ? `${ev.left} more to bag him` : '' });
      break;
    }
    case 'bandDizzy': audio.play('stun_stars', { vol: 0.7 }); break;
    case 'bandDefeat':
      audio.play('creature_hurt', { vol: 0.8, pitch: 0.7 }); audio.play('tada', { vol: 0.6 });
      popup(ev.x, ev.y + 1.0, 'BAGGED!', { color: '#ffd63c', size: 28, life: 1.6, sub: ev.n ? 'his sack spills!' : '' });
      if (!calm) fx.shake = Math.max(fx.shake || 0, 0.3);
      break;
    case 'bandSpill': audio.play('release', { vol: 0.6, pitch: 1.1 }); fx.sparkle(ev.x, ev.y, 10, '#bff0a0'); popup(ev.x, ev.y + 0.6, 'Egg back!', { color: '#bff0a0', size: 18, life: 1.1 }); break;
    case 'bandWhistle':
      audio.play('wind_gust', { vol: 0.45, pitch: 2.4 }); if (ev.weasel) audio.play('weasel_snicker', { vol: 0.6 });
      popup(ev.x, ev.y + 0.9, 'FWEEET!', { color: '#ffe680', size: 22, life: 1.1 });
      if (ev.weasel) once('banditWhistle', 'He whistled for the weasel! It hunts for a little while, then goes home.', 4);
      break;
    case 'bandDrop': if (ev.why === 'cold' || ev.why === 'daze' || ev.why === 'scare') popup(ev.x, ev.y + 0.5, 'Dropped it!', { color: '#bff0a0', size: 16, life: 0.8 }); break;
    case 'bandFreeze': audio.play('glass_crack', { vol: 0.5 }); break;
    case 'bandStun': audio.play('stun_stars', { vol: 0.6 }); break;
    case 'bandScared': audio.play('egg_bump', { vol: 0.5, pitch: 1.9 }); popup(ev.x, ev.y + 0.6, 'Eek!', { color: '#bff0ff', size: 18, life: 0.8 }); break;
  }
}

// ---------- his face in a round chip (the boss bar, the info panel) and his intro card
export function drawBanditEmblem(ctx, r, t) {
  const s = r * 1.55, u = s / 100, p = raccoonPose('peek', t, 0.55 + 0.45 * Math.sin(t * 1.3) ** 2);
  drawRaccoon(ctx, -6 * u, 74 * u + r * 0.1, s, t, p, { egg: false });
}
export function drawBanditCard(ctx, x, y, w, h, t, age) {
  const H0 = Math.min(h, w * 2.06), W0 = H0 / 2.06, pad = Math.max(2, H0 * 0.025);
  const e = age == null ? 1 : clamp(age / 0.45, 0, 1), pop = e < 1 ? 0.6 + 0.4 * (1 - Math.pow(1 - e, 3)) + Math.sin(e * Math.PI) * 0.08 : 1;
  const dw = (W0 - pad * 2) * pop, dh = (H0 - pad * 2) * pop, cx = x + w / 2, cy = y + h / 2 + Math.sin(t * 2.1) * h * 0.012, r = dw * 0.07;
  const rr = (px, py, pw, ph, rad) => { ctx.beginPath(); if (ctx.roundRect) ctx.roundRect(px, py, pw, ph, rad); else ctx.rect(px, py, pw, ph); };
  ctx.save();
  ctx.globalAlpha *= Math.min(1, e * 2);
  ctx.fillStyle = 'rgba(0,0,0,0.28)'; rr(cx - dw / 2 + pad * 0.6, cy - dh / 2 + pad * 1.2, dw, dh, r); ctx.fill();
  ctx.fillStyle = '#5a3a1c'; rr(cx - dw / 2 - pad, cy - dh / 2 - pad, dw + pad * 2, dh + pad * 2, r + pad); ctx.fill();
  ctx.fillStyle = '#f2c25a'; rr(cx - dw / 2 - pad * 0.45, cy - dh / 2 - pad * 0.45, dw + pad * 0.9, dh + pad * 0.9, r + pad * 0.45); ctx.fill();
  rr(cx - dw / 2, cy - dh / 2, dw, dh, r);
  ctx.save(); ctx.clip();
  const g = ctx.createLinearGradient(0, cy - dh / 2, 0, cy + dh / 2);
  g.addColorStop(0, '#16203f'); g.addColorStop(0.62, '#2f3f5a'); g.addColorStop(1, '#6a5a32');
  ctx.fillStyle = g; ctx.fillRect(cx - dw / 2, cy - dh / 2, dw, dh);
  ctx.fillStyle = '#f6eccb'; ctx.beginPath(); ctx.arc(cx - dw * 0.22, cy - dh * 0.34, dw * 0.12, 0, TAU); ctx.fill(); // a full moon: a raid night
  ctx.fillStyle = 'rgba(255,248,220,0.85)';
  for (let i = 0; i < 7; i++) { const sx = cx - dw * 0.42 + (((i * 41) % 84) / 100) * dw, sy = cy - dh * 0.46 + (((i * 57) % 30) / 100) * dh; ctx.fillRect(sx, sy, Math.max(1, dw * 0.012), Math.max(1, dw * 0.012)); }
  const fy = cy + dh * 0.36;
  ctx.fillStyle = '#4a6a2a'; ctx.fillRect(cx - dw / 2, fy, dw, dh); ctx.fillStyle = '#35501e'; ctx.fillRect(cx - dw / 2, fy + dh * 0.05, dw, dh);
  ctx.strokeStyle = '#140c08'; ctx.lineWidth = Math.max(1, dw * 0.012); ctx.beginPath(); ctx.moveTo(cx - dw / 2, fy); ctx.lineTo(cx + dw / 2, fy); ctx.stroke();
  // the egg he has his eye on, and Bandit himself licking his lips
  egg(ctx, cx + dw * 0.32, fy - dh * 0.085, dh * 0.15, 0.1 * Math.sin(t * 2));
  const s = dw * 0.86, cyc = (t % 3.2) / 3.2;
  drawRaccoon(ctx, cx - dw * 0.08, fy, s, t, raccoonPose('peek', t, ss(0, 0.6, cyc) * (1 - ss(0.9, 1, cyc))), { egg: false });
  ctx.restore();
  ctx.restore();
  return true;
}
