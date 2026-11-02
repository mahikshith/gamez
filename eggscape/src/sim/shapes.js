// Vault shapes beyond circles (v3.3 M10): rounded-square and hex rings, a spiral ramp ring, and the rocking vault.
// A shaped ring keeps the circle's bookkeeping: gaps, thorns and pads still sit at ring-local polar angles, and a
// "radius" rad still means ring.r + an offset; ringPt() maps (rad, angle) onto the shape, offsetting along the
// surface normal. Circle rings (ring.prof null) take exactly the old math everywhere.
import { TAU, RING_TH } from './geom.js';

// k: corner radius as a share of the apothem (the flat side's distance from the centre).
export const SHAPES = {
  square: { n: 4, k: 0.42 },
  hex: { n: 6, k: 0.3 },
};
const SPIRAL_RISE = 0.85; // m the spiral climbs in one turn (the seam opening is this minus the ring's thickness)
const CLEAR = 0.56; // m an egg needs where one ring's corner sweeps past the next ring's flat side
const ROCK = { amp: 25, hold: 3.5, swing: 0.9, warn: 1.2 }; // the rocking vault (deg, s): below ~20 deg a parked egg stays put
const ROCK_MODE = { easy: 1.35, medium: 1, hard: 0.8 }; // Easy rocks slower with longer rests

// A ring's profile from its spec (spec.shape) or the level's (level.shape). null = a circle.
export function profileOf(spec, level) {
  const name = spec.shape ?? level.shape;
  if (name === 'spiral') {
    const s = spec.rise ?? SPIRAL_RISE;
    return { kind: 'spiral', s, fmin: 1, fmax: 1, rise: s };
  }
  const S = SHAPES[name];
  if (!S) return null;
  const w = TAU / S.n;
  return { kind: name, n: S.n, k: S.k, w, ap: 1 - S.k, h: (1 - S.k) * Math.tan(w / 2), fmin: 1, fmax: (1 - S.k) / Math.cos(w / 2) + S.k };
}

// Rounded polygon of apothem 1, a flat side facing down (-90 deg): distance to the edge at angle a, and the
// outward normal there.
function poly(P, a) {
  const j = Math.round((a + Math.PI / 2) / P.w), s = -Math.PI / 2 + j * P.w, psi = a - s;
  const c = Math.cos(psi), sn = Math.sin(psi);
  if (Math.abs(sn) <= P.h * c) return { rho: 1 / c, nx: Math.cos(s), ny: Math.sin(s) };
  const vy = Math.sign(sn) * P.h, uv = c * P.ap + sn * vy, t = uv + Math.sqrt(uv * uv - P.ap * P.ap - vy * vy + P.k * P.k);
  const lx = (t * c - P.ap) / P.k, ly = (t * sn - vy) / P.k, cs = Math.cos(s), ss = Math.sin(s);
  return { rho: t, nx: lx * cs - ly * ss, ny: lx * ss + ly * cs };
}

// Spiral (one turn, the seam at local angle 0): the radius climbs by s from just after the seam round to just before.
const turn = (a) => (((a % TAU) + TAU) % TAU) / TAU;
function spiralRho(ring, a) { return ring.r + ring.prof.s * (turn(a) - 0.5); }

// Centreline distance from the vault centre at ring-local angle a.
export function ringRho(ring, a) {
  const P = ring.prof;
  if (!P) return ring.r;
  return P.kind === 'spiral' ? spiralRho(ring, a) : ring.r * poly(P, a).rho;
}
// The same at a world angle.
export function ringRhoW(ring, wa) {
  return ring.prof ? ringRho(ring, wa - ring.body.getAngle()) : ring.r;
}

// Ring-local point at angle a, `rad` measured like a circle's radius (rad - ring.r = offset along the normal).
export function ringPt(ring, a, rad) {
  const P = ring.prof;
  if (!P) return [rad * Math.cos(a), rad * Math.sin(a)];
  const c = Math.cos(a), s = Math.sin(a), off = rad - ring.r;
  if (P.kind === 'spiral') {
    const R = spiralRho(ring, a), d = P.s / TAU, L = Math.hypot(R, d) || 1;
    return [R * c + ((R * c + d * s) / L) * off, R * s + ((R * s - d * c) / L) * off];
  }
  const q = poly(P, a), R = ring.r * q.rho;
  return [R * c + q.nx * off, R * s + q.ny * off];
}
// Outward surface normal at local angle a, as an angle (for art that must stand square on the surface).
export function ringNormal(ring, a) {
  const P = ring.prof;
  if (!P) return a;
  if (P.kind === 'spiral') { const R = spiralRho(ring, a), d = P.s / TAU; return Math.atan2(R * Math.sin(a) - d * Math.cos(a), R * Math.cos(a) + d * Math.sin(a)); }
  const q = poly(P, a);
  return Math.atan2(q.ny, q.nx);
}
// Metres of centreline per radian at local angle a (a circle's r): turns gap and pad lengths into angles.
export function ringSpd(ring, a) {
  if (!ring.prof) return ring.r;
  const e = 1e-3, [x0, y0] = ringPt(ring, a - e, ring.r), [x1, y1] = ringPt(ring, a + e, ring.r);
  return Math.hypot(x1 - x0, y1 - y0) / (2 * e);
}

// Radius for ring i: far enough out that it clears the ring inside it at any relative turn (a corner of the inner
// ring sweeping past this ring's flat side must leave room for an egg).
export function shapeRadius(level, spec, r, prev) {
  if (!prev) return r;
  const P = profileOf(spec, level);
  if (!P && !prev.prof) return r;
  const out = prev.prof ? (prev.prof.kind === 'spiral' ? prev.r + prev.prof.s / 2 : prev.r * prev.prof.fmax) : prev.r;
  const need = out + RING_TH + CLEAR;
  return Math.max(r, P && P.kind === 'spiral' ? need + P.s / 2 : need / (P ? P.fmin : 1));
}
// Furthest any part of the ring reaches (camera framing, nest drop).
export function ringReach(ring) {
  const P = ring.prof;
  return (P ? (P.kind === 'spiral' ? ring.r + P.s / 2 : ring.r * P.fmax) : ring.r) + RING_TH / 2;
}

// Solid arcs for a shaped ring: gap lengths turn into angles at the local surface speed, and a spiral is cut at its
// seam (no segment may bridge the step). Returns [[a0, a1], ...] like solidArcs.
export function shapeArcs(ring, solidArcs) {
  const arcs = solidArcs((a) => ringSpd(ring, a), ring.gaps);
  if (ring.prof.kind !== 'spiral') return arcs;
  const out = [];
  for (const [a0, a1] of arcs) {
    let s = a0;
    for (let m = Math.ceil(a0 / TAU - 1e-9) * TAU; m < a1 - 1e-6; m += TAU) { if (m - s > 1e-3) out.push([s, m]); s = m; }
    if (a1 - s > 1e-3) out.push([s, a1]);
  }
  return out;
}
// Segment count for a solid arc (shapes need finer pieces so corners stay round).
export function segCount(ring, a0, a1) {
  return ring.prof ? Math.max(1, Math.ceil(((a1 - a0) * ringReach(ring)) / 0.14)) : Math.max(1, Math.ceil(((a1 - a0) * ring.r) / 0.2));
}
// Quad for the ring piece between local angles b0 and b1 (a circle gets exactly its old annulus slice).
export function segQuad(ring, b0, b1) {
  const ri = ring.r - RING_TH / 2, ro = ring.r + RING_TH / 2;
  if (!ring.prof) return [[ri * Math.cos(b0), ri * Math.sin(b0)], [ro * Math.cos(b0), ro * Math.sin(b0)], [ro * Math.cos(b1), ro * Math.sin(b1)], [ri * Math.cos(b1), ri * Math.sin(b1)]];
  // a spiral piece that ends on the seam takes its end from its own side of the step
  const e = ring.prof.kind === 'spiral' ? 1e-7 : 0;
  return [ringPt(ring, b0 + e, ri), ringPt(ring, b0 + e, ro), ringPt(ring, b1 - e, ro), ringPt(ring, b1 - e, ri)];
}

// ---------- the rocking vault (level.rock) ----------
// A timed hazard, not a control: the whole vault (every ring) leans one way, rests, comes back level, rests, leans the
// other way. It only matters on flat-sided vaults (a circle's floor is level wherever it turns): a ledge an egg was
// parked on becomes a slope for a few seconds. The angle is a pure function of sim time, so rewind and the planner
// need no extra state.
export function rockOf(level, mode) {
  const R = level.rock;
  if (!R) return null;
  const m = ROCK_MODE[mode] || 1, o = typeof R === 'object' ? R : {};
  return { amp: ((o.amp ?? ROCK.amp) * Math.PI) / 180, hold: (o.hold ?? ROCK.hold) * m, swing: (o.swing ?? ROCK.swing) * m, warn: o.warn ?? ROCK.warn };
}
const ease = (u) => u * u * (3 - 2 * u);
// Lean of the vault at time t (radians, + = counter-clockwise), and the warning: { dir, k } k 0..1 for the swing
// about to start.
export function rockAt(K, t) {
  const leg = K.hold + K.swing, i = Math.floor(t / leg), f = t - i * leg;
  // legs: 0 level -> +, 1 + -> level, 2 level -> -, 3 - -> level (each leg rests first, then swings)
  const from = [0, 1, 0, -1][i % 4], to = [1, 0, -1, 0][i % 4];
  const w = f < K.hold ? 0 : ease((f - K.hold) / K.swing);
  const left = K.hold - f;
  return { a: K.amp * (from + (to - from) * w), next: to - from, warn: left > 0 && left < K.warn ? 1 - left / K.warn : 0 };
}
// Sim hook (after the gear pass, before the bodies get their spin): every ring turns by the lean's change this step,
// on top of whatever the player or a motor does.
export function rockStep(sim, dt) {
  const K = sim.rock;
  if (!K) return;
  const a1 = rockAt(K, sim.t), a0 = rockAt(K, sim.t - dt), d = a1.a - a0.a;
  if (a1.warn > 0 && !(a0.warn > 0)) sim.emit('rockWarn', { dir: a1.next });
  if (!d) return;
  for (const ring of sim.rings) { ring.omega += d / dt; ring.target += d; }
}

// Which channel a world point is in: 0 = the centre chamber, rings.length = outside the vault.
export function chAtPt(rings, x, y) {
  const d = Math.hypot(x, y), wa = Math.atan2(y, x);
  let c = 0;
  for (const r of rings) if (d > ringRhoW(r, wa)) c++;
  return c;
}
