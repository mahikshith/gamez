// Level generator: turns src/data/specs.js into src/data/levels.js.
// Each spec is laid out many times under placement rules, then every candidate is played by
// the lookahead planner twice: once exact (a strong player) and once with real replay drift (a rough one). A layout is
// kept only if the planner clears it with no broken eggs in at least minMoves moves. Among the
// keepers, early levels take the easiest and late levels the hardest, so the curve climbs.
//
// Usage: node tools/gen.mjs [ids] [--tries N] [--jobs N]     (writes src/data/levels.js)
//        node tools/gen.mjs --assemble                         (rewrite levels.js from tools/gen-out)
//        node tools/gen.mjs --worker <id> --tries N --out <file>
import { fork } from 'node:child_process';
import { writeFileSync, readFileSync, mkdirSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { SPECS } from '../src/data/specs.js';
import { rng } from '../src/sim/geom.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..');
const OUT_DIR = join(ROOT, 'tools', 'gen-out');
const BOTTOM = -90;
const GAP_LEN = 0.78;
const THORN_STEP = 11;
// ostrich levels: gaps under OSTRICH_GAP (sim.js, 0.9 m) are barred for the big egg, and every ring gets one
// clearly wide gap it always drops through (checked by ostrichDrops below)
const OSTRICH_GAP = 0.9, WIDE_GAP = 1.1;

const wrapD = (a) => ((((a + 180) % 360) + 360) % 360) - 180;
const dist = (a, b) => Math.abs(wrapD(a - b));
const halfDeg = (len, r) => ((len / r) * 180) / Math.PI / 2;
// level fields copied from the spec as they are (not laid out)
const LEVEL_KEYS = ['boss', 'bossFight', 'gravity', 'water', 'lava', 'wind', 'nest', 'weather', 'weatherOpts', 'snake', 'bonus', 'fox', 'eagle', 'icicles', 'eggKinds', 'gusts', 'salamander'];

// ---------- layout ----------
function radii(spec) {
  const out = [];
  let r = 1.05;
  spec.rings.forEach((_, i) => { if (i > 0) r += spec.spacing ?? 1; out.push(r); });
  return out;
}

// floor = true: just above the channel's floor ring, where eggs travel (portals, F12)
function channelPoint(spec, rs, ch, a, floor = false) {
  const r = floor && ch < rs.length ? rs[ch] - 0.08 - 0.32 : ch === 0 ? 0.45 : ch >= rs.length ? rs[rs.length - 1] + 0.55 : (rs[ch - 1] + rs[ch]) / 2;
  const t = (a * Math.PI) / 180;
  return [+(r * Math.cos(t)).toFixed(2), +(r * Math.sin(t)).toFixed(2)];
}

// pads per ring when the spec does not say: generous early, scarce late
function defaultPads(spec, i) {
  if (i === 0) return spec.id <= 6 ? 1 : 0;
  return spec.id <= 8 ? 2 : spec.id <= 15 ? 2 : 1;
}

// a ring geared (through any chain of gears) to a one-way ring can only turn one way itself
function trainOneway(spec, i) {
  const R = spec.rings;
  let a = i, b = i;
  while (a > 0 && R[a - 1].gear) a--;
  while (b < R.length - 1 && R[b].gear) b++;
  for (let j = a; j <= b; j++) if (R[j].oneway) return true;
  return false;
}

function layRing(spec, i, r, R, prev) {
  const rs = spec.rings[i];
  const ring = {};
  if (rs.mat) ring.mat = rs.mat;
  if (rs.motor) ring.motor = rs.motor;
  if (rs.motorFlip) ring.motorFlip = rs.motorFlip;
  if (rs.oneway) ring.oneway = Math.sign(rs.oneway); // v3 ratchet ring (G22)
  if (rs.ice) ring.ice = rs.ice; // v3.2 hard ice: only the pick chick drills it open
  if (rs.retract) ring.retract = { phase: +(R() * rs.retract.period).toFixed(2), ...rs.retract };
  if (rs.gear) {
    // geared to the next ring out: turning either turns the other the opposite way
    if (rs.motor || spec.rings[i + 1]?.motor || i + 1 >= spec.rings.length) throw new Error(`L${spec.id}: ring ${i} gear needs a non-motor ring outside it`);
    ring.gear = i + 1;
  }

  // gaps: never at the bottom at start, spread apart, not stacked on the ring inside
  const gaps = [];
  const nG = rs.noGap ? 0 : rs.gaps ?? 1;
  const xs = [...(rs.gapX || [])];
  for (let g = 0; g < nG; g++) {
    let ok = false;
    // a swinging ring (motorFlip) only turns through motor * flip degrees and back, so its first
    // gap must lie inside that swing or it never passes under the eggs
    const swing = rs.motorFlip ? Math.abs(rs.motor) * rs.motorFlip : 0;
    for (let t = 0; t < 200 && !ok; t++) {
      const a = g === 0 && swing ? Math.round(wrapD(BOTTOM - Math.sign(rs.motor) * (45 + R() * (swing - 60)))) : Math.round(R() * 360 - 180);
      if (dist(a, BOTTOM) < (i === 0 ? 55 : 42)) continue;
      if (gaps.some((o) => dist(o.a, a) < 75)) continue;
      if (prev && prev.gaps.some((o) => dist(o.a, a) < 30)) continue;
      let len = xs.length && Math.max(...xs) >= 3 && g === 0 ? 0.7 : GAP_LEN;
      if ((spec.eggKinds || []).includes('ostrich') && g === nG - 1) len = WIDE_GAP; // the last gap is the ostrich's way down
      gaps.push({ a, x: 1, len });
      ok = true;
    }
    if (!ok) return null;
  }
  // biggest multiplier goes on the narrowest gap
  xs.sort((p, q) => q - p).forEach((x, k) => { if (gaps[k]) gaps[k].x = x; });
  gaps.forEach((g) => { if (g.len === GAP_LEN) delete g.len; if (g.x === 1) delete g.x; });
  // v3 thorn curtains: the first `curtain` gaps (the multiplier gaps first) only open to fire
  gaps.slice(0, rs.curtain || 0).forEach((g) => { g.curtain = 1; });
  // gap shutters: every gap on the ring gets a door on the same rhythm, out of step with each other
  if (rs.shut) gaps.forEach((g) => { g.shut = { period: rs.shut.period, open: rs.shut.open, phase: +(R() * rs.shut.period).toFixed(2) }; });
  ring.gaps = gaps;
  const gapHalf = (g) => halfDeg(g.len || GAP_LEN, r);

  // thorn clusters. Every pocket between two floor clusters must hold a gap: an egg that lands in a
  // pocket with no way out can never leave it (turning the ring drags a thorn into it). So floor
  // clusters sit one per arc between gaps, and clusters beyond that become ceiling thorns pointing
  // out. Retracting and motor rings are exempt (their thorns open on a rhythm / point out anyway).
  const thorns = [];
  const [smin, smax] = rs.size || [1, 2];
  const nT = rs.thorns ?? 0;
  const span = (n) => ((n - 1) * THORN_STEP) / 2 + 7;
  // v3: curtained gaps are no way out of a pocket, so pockets are counted on open gaps only (a floor
  // cluster sits in the arc just after an open gap); a ring with no open gap is one pocket (fire opens it)
  const big = (spec.eggKinds || []).includes('ostrich');
  const open = gaps.filter((g) => !g.curtain && !(big && (g.len || GAP_LEN) < OSTRICH_GAP)); // an ostrich can't use a narrow gap
  const free = rs.retract || rs.motor || !gaps.length;
  const sortedG = [...gaps].sort((p, q) => p.a - q.a);
  const after = (open.length ? open : gaps.slice(0, 1)).map((g) => sortedG.indexOf(g)).sort((p, q) => p - q);
  const nFloor = free ? Infinity : after.length - Math.min(after.length, rs.barriers || 0); // barriers take arcs too
  // a one-way ring (or one geared to it) can't turn back, so a floor cluster could trap an egg on the far side of its pocket's
  // gap: its thorns all point out (a ceiling for the channel beyond)
  for (let k = 0; k < nT; k++) {
    const floor = !trainOneway(spec, i) && (free || k < nFloor);
    let ok = false;
    for (let t = 0; t < 300 && !ok; t++) {
      const n = floor ? smin + Math.floor(R() * (smax - smin + 1)) : Math.min(2, smin);
      const w = span(n);
      let a;
      if (floor && !free) {
        const j = after[k], g0 = sortedG[j], g1 = sortedG[(j + 1) % sortedG.length];
        const lo = g0.a + gapHalf(g0) + w + 12;
        const hi = (g1.a <= g0.a ? g1.a + 360 : g1.a) - gapHalf(g1) - w - 12;
        if (hi < lo) return null;
        // a thorn pocket hugs one edge of the gap: only one way round reaches it safely
        a = Math.round(wrapD(rs.pocket && k === 0 ? (R() < 0.5 ? lo : hi) : lo + R() * (hi - lo)));
      } else a = Math.round(R() * 360 - 180);
      if (floor && dist(a, BOTTOM) < (i === 0 ? 60 : 35) + w) continue;
      if (gaps.some((g) => dist(g.a, a) < gapHalf(g) + w + 12)) continue;
      if (thorns.some((o) => !o.side === floor && dist(o.a, a) < span(o.n) + w + 22)) continue;
      thorns.push(floor ? { a, n } : { a, n, side: 'out', h: 0.26 });
      ok = true;
    }
    if (!ok) return null;
  }
  // a motor ring's floor never stops, so floor thorns on it would be certain death: they point out
  // instead and become a low ceiling that punishes bouncy landings in the channel beyond
  if (rs.motor) for (const t of thorns) { t.side = 'out'; t.h = 0.2; t.n = Math.min(t.n, 2); }
  for (let k = 0; k < (rs.out || 0); k++) {
    let ok = false;
    for (let t = 0; t < 200 && !ok; t++) {
      const a = Math.round(R() * 360 - 180);
      if (gaps.some((g) => dist(g.a, a) < gapHalf(g) + 18)) continue;
      if (thorns.some((o) => o.side === 'out' && dist(o.a, a) < 40)) continue;
      thorns.push({ a, n: 1, side: 'out', h: 0.3 });
      ok = true;
    }
  }

  // the puzzle: from the start bottom, at least one way round reaches a gap without sweeping thorns
  if (!rs.motor && open.length && i > 0) {
    const inner = thorns.filter((t) => t.side !== 'out');
    const safe = (dir) => {
      if (rs.oneway && dir === Math.sign(rs.oneway)) return false; // dir 1 = the ring turns clockwise
      const gapAt = Math.min(...open.map((g) => (((dir * (g.a - BOTTOM)) % 360) + 360) % 360 - gapHalf(g)));
      const thornAt = Math.min(Infinity, ...inner.map((t) => (((dir * (t.a - BOTTOM)) % 360) + 360) % 360 - span(t.n)));
      return gapAt < thornAt;
    };
    const s1 = safe(1), s2 = safe(-1);
    if (!s1 && !s2) return null;
    if (spec.id >= 4 && s1 && s2 && inner.length >= 2 && R() < 0.7) return null; // usually one wrong way
  }

  // items on free floor, away from where eggs start
  const items = [];
  for (const type of rs.items || []) {
    let ok = false;
    for (let t = 0; t < 200 && !ok; t++) {
      const a = Math.round(R() * 360 - 180);
      if (dist(a, BOTTOM) < 40) continue;
      if (gaps.some((g) => dist(g.a, a) < gapHalf(g) + 14)) continue;
      if (thorns.some((o) => o.side !== 'out' && dist(o.a, a) < span(o.n) + 16)) continue;
      if (items.some((o) => dist(o.a, a) < 40)) continue;
      items.push({ type, a });
      ok = true;
    }
    if (!ok) return null;
  }

  // v3 wooden barriers (G14): walls on this channel floor, one per free arc after an open gap (they close
  // a pocket like a floor thorn cluster); away from the eggs' start and the gaps
  const bars = [];
  const floorTh = thorns.filter((t) => t.side !== 'out');
  for (let k = 0; k < (rs.barriers || 0); k++) {
    const j = after[(free ? 0 : Math.min(floorTh.length, after.length - 1)) + k] ?? after[after.length - 1];
    const g0 = sortedG[j] || { a: 0, x: 1 }, g1 = sortedG.length ? sortedG[(j + 1) % sortedG.length] : { a: 360 };
    let ok = false;
    for (let t = 0; t < 200 && !ok; t++) {
      const lo = g0.a + (gaps.length ? gapHalf(g0) : 0) + 14, hi = (g1.a <= g0.a ? g1.a + 360 : g1.a) - (gaps.length ? gapHalf(g1) : 0) - 14;
      if (hi < lo) return null;
      const a = Math.round(wrapD(lo + R() * (hi - lo)));
      if (dist(a, BOTTOM) < (i === 0 ? 60 : 30)) continue;
      if (floorTh.some((o) => dist(o.a, a) < span(o.n) + 14) || bars.some((b) => dist(b, a) < 30)) continue;
      bars.push(a);
      ok = true;
    }
    if (!ok) return null;
  }
  // v3 grates (I4): extra quail-only openings on free floor
  for (let k = 0; k < (rs.grate || 0); k++) {
    let ok = false;
    for (let t = 0; t < 200 && !ok; t++) {
      const a = Math.round(R() * 360 - 180), w = halfDeg(0.7, r);
      if (dist(a, BOTTOM) < 40 || gaps.some((g) => dist(g.a, a) < gapHalf(g) + w + 14)) continue;
      if (thorns.some((o) => o.side !== 'out' && dist(o.a, a) < span(o.n) + w + 10) || bars.some((b) => dist(b, a) < w + 12)) continue;
      gaps.push({ a, grate: 1 });
      ok = true;
    }
    if (!ok) return null;
  }
  if (bars.length) ring.bars = bars;

  // sponge pads sit between thorns and gaps; early levels pad the first landing
  const pads = [];
  const nP = rs.pads ?? defaultPads(spec, i);
  const blocked = (a, w) => gaps.some((g) => dist(g.a, a) < gapHalf(g) + w + 4) || bars.some((b) => dist(b, a) < w + 6) ||
    thorns.some((o) => o.side !== 'out' && dist(o.a, a) < span(o.n) + w + 2) ||
    pads.some((p) => dist(p.a, a) < halfDeg(p.len, r) + w + 8);
  for (let k = 0; k < nP; k++) {
    for (let t = 0; t < 200; t++) {
      const len = +(1.0 + R() * 0.9).toFixed(2);
      const w = halfDeg(len, r);
      const a = k === 0 && i > 0 && spec.id <= 5 ? BOTTOM + Math.round((R() - 0.5) * 20) : Math.round(R() * 360 - 180);
      if (blocked(a, w)) continue;
      pads.push({ a, len });
      break;
    }
  }
  // honey pads (F24) are placed like sponge pads, on free floor
  const honey = [];
  for (let k = 0; k < (rs.honey || 0); k++) {
    for (let t = 0; t < 200; t++) {
      const len = +(0.8 + R() * 0.5).toFixed(2);
      const w = halfDeg(len, r);
      const a = Math.round(R() * 360 - 180);
      if (blocked(a, w) || honey.some((p) => dist(p.a, a) < halfDeg(p.len, r) + w + 8)) continue;
      honey.push({ a, len });
      break;
    }
  }
  // blunt grey spikes (crack only) replace the last `blunt` clusters (F22)
  thorns.slice(thorns.length - Math.min(thorns.length, rs.blunt || 0)).forEach((t) => { t.kind = 'blunt'; });
  if (thorns.length) ring.thorns = thorns.map((t) => ({ a: t.a, n: t.n, ...(t.side ? { side: t.side, h: t.h } : {}), ...(t.kind ? { kind: t.kind } : {}) }));
  if (items.length) ring.items = items;
  if (pads.length) ring.pads = pads;
  if (honey.length) ring.honey = honey;
  return ring;
}

export function layout(spec, seed) {
  const R = rng(seed);
  const rs = radii(spec);
  const rings = [];
  if (spec.rings[spec.rings.length - 1].motor) throw new Error(`L${spec.id}: the outermost ring cannot be a motor ring`);
  for (let i = 0; i < spec.rings.length; i++) {
    const ring = layRing(spec, i, rs[i], R, rings[i - 1]);
    if (!ring) return null;
    rings.push(ring);
  }
  const L = { id: spec.id, theme: spec.theme, name: spec.name, eggs: spec.eggs, target: spec.target, time: 150, spacing: spec.spacing, material: spec.material };
  for (const k of LEVEL_KEYS) if (spec[k] !== undefined) L[k] = spec[k];
  L.tip = spec.tip;
  if (spec.portals) L.portals = spec.portals.map((p) => ({ a: channelPoint(spec, rs, ...p.from, true), b: channelPoint(spec, rs, ...p.to, true), ...(p.emit ? { emit: p.emit, every: p.every || 8 } : {}), ...(p.pull !== undefined ? { pull: p.pull } : {}) }));
  // v3 barriers live on the level: [{ring, a}] in the ring's frame
  const bars = [];
  rings.forEach((ring, i) => { for (const a of ring.bars || []) bars.push({ ring: i, a }); delete ring.bars; });
  if (bars.length) L.barriers = bars;
  // orbs float (F3): ring `items` and level `orbs` both become level orbs {type, ch, a}
  const orbs = (spec.orbs || []).map((o) => ({ type: o.type, ch: o.ch, a: o.a ?? Math.round(R() * 360 - 180) }));
  rings.forEach((ring, i) => { for (const it of ring.items || []) orbs.push({ type: it.type, ch: i, a: it.a }); delete ring.items; });
  if (orbs.length) L.orbs = orbs;
  if (spec.bombs) L.bombs = spec.bombs.map((b) => { const [x, y] = channelPoint(spec, rs, b.ch, b.a); return { x, y }; });
  if (spec.rocks) L.rocks = spec.rocks.map((k) => { const [x, y] = channelPoint(spec, rs, k.ch, k.a); return { x, y, ...(k.s ? { s: k.s } : {}) }; });
  L.rings = rings;
  L.seed = seed;
  return L;
}

// ---------- Daily Vault (C7) ----------
// A seeded template: 4-5 rings with a random mix of v2 mechanics, a moving nest and maybe weather.
// node tools/gen.mjs --daily N validates N of them into src/data/daily.js; the game picks one by date.
export function dailySpec(k) {
  const R = rng(9001 + k * 7);
  const pick = (a) => a[Math.floor(R() * a.length)];
  const base = pick(SPECS.filter((s) => !s.lava && !s.water));
  const n = 4 + (R() < 0.5 ? 1 : 0);
  const rings = [];
  for (let i = 0; i < n; i++) {
    const ring = { gaps: i === 0 ? 1 : 1 + (R() < 0.6 ? 1 : 0), thorns: i === 0 ? (R() < 0.5 ? 1 : 0) : 1 + (R() < 0.5 ? 1 : 0), size: [1, 3] };
    if (i === 1) ring.gapX = [2];
    if (i === n - 1) ring.gapX = [3];
    if (i > 0 && R() < 0.3) ring.shut = { period: 4 + Math.round(R() * 2), open: 0.5 };
    if (i > 0 && R() < 0.3) ring.blunt = 1;
    if (i > 0 && R() < 0.2) ring.honey = 1;
    if (i > 0 && i < n - 1 && R() < 0.2 && !rings[i - 1].gear) ring.gear = true;
    rings.push(ring);
  }
  const types = ['fire_red', 'fire_green', 'stone', 'bubble', 'water', 'twin', 'thunder', 'thorn'];
  return {
    id: 900 + k, theme: base.theme, name: 'Daily Vault', eggs: 3, target: 2, spacing: 1.05, material: base.material, minMoves: 3,
    nest: { amp: +(1.0 + R() * 0.6).toFixed(1), period: 6 + Math.round(R() * 2), pattern: pick(['sine', 'slide', 'stopgo']) },
    weather: pick([undefined, undefined, 'rain', 'quake', 'thunder', 'embers']),
    orbs: [{ type: pick(types), ch: 1 }, { type: pick(types), ch: 2 }],
    bonus: { kind: 'turns' }, tip: 'A new vault every day, the same for everyone.', rings,
  };
}

// ---------- evaluation (worker) ----------
// A layout is kept when, on Medium, the planner wins with 2+ stars in at least minMoves moves, the
// "align every gap at once" exploit does not clear it (F15; L1-L2 exempt), and with the real fuse it is still
// winnable on Hard (1+ star) and on Easy. Levels 1-5 must also survive the rough (replayed) pass.
export async function evaluate(spec, L) {
  const { solve, alignAll } = await import('./planner.mjs');
  const t0 = Date.now();
  const p = solve(L);
  const stars = p.state === 'won' ? (p.broken === 0 ? (p.perfect ? 3 : 2) : 1) : 0;
  const rec = { seed: L.seed, stars, plannerT: p.t, moves: p.moves, turns: p.turns, pSaved: p.saved, pBroken: p.broken };
  const fail = (why) => ({ ok: false, why, rec: { ...rec, secs: Math.round((Date.now() - t0) / 1000) } });
  if (stars < 2 || p.moves < (spec.minMoves || 2)) return fail('medium');
  // every special egg must be saved in the validated run, and an ostrich must have a gap it always fits
  if (p.special.saved < p.special.total) return fail('special');
  if (spec.useTap && !p.taps) return fail('tap'); // a chick's intro level: the strong player must find its power worth using
  if ((L.eggKinds || []).includes('ostrich')) { const od = await ostrichDrops(L); rec.drops = od.join(''); if (od.includes(0)) return fail('ostrich'); }
  const ex = alignAll(L);
  rec.exploit = ex;
  if (ex >= 2 && spec.id > 2) return fail('exploit'); // L1-L2 are the gentle tutorials: lining up gaps is the lesson
  if (spec.id <= 5) {
    // a second, sloppier pass: each move is replayed for real, so small drifts play out the way they
    // would for a human. Robust layouts survive it.
    const q = solve(L, { replay: true });
    Object.assign(rec, { roughState: q.state, roughBroken: q.broken });
    if (q.state !== 'won') return fail('rough');
  }
  const T = { ...L, time: fuse(rec, spec.id) };
  const h = solve(T, { mode: 'hard' }), e = solve(T, { mode: 'easy' });
  Object.assign(rec, { hard: h.state === 'won' ? (h.broken === 0 ? 2 : 1) : 0, hardT: h.t, easy: e.state === 'won' ? (e.broken === 0 ? 2 : 1) : 0, secs: Math.round((Date.now() - t0) / 1000) });
  // Easy must be clearable for 2 stars (no broken egg): the star gates (I5) count on it
  if (!rec.hard || rec.easy < 2) return fail(rec.hard ? 'easy' : 'hard');
  if (e.special.saved < e.special.total) return fail('easy-special');
  // bonus targets come from the planner's own run: a few turns more, a third more time
  if (L.bonus?.kind === 'turns' && !L.bonus.n) L.bonus = { kind: 'turns', n: p.turns + 2 };
  if (L.bonus?.kind === 'time' && !L.bonus.s) L.bonus = { kind: 'time', s: Math.ceil((p.t * 1.35) / 5) * 5 };
  return { ok: true, rec };
}

// Ostrich drop check: on every ring with gaps, at least one gap (a thorn curtain counts as burnt) lets the big egg
// through when it is released just above it, in each of 8 orientations. Returns 1/0 per ring (rings with no gap: 1).
export async function ostrichDrops(L0) {
  const { Sim } = await import('../src/sim/sim.js');
  const { Vec2 } = await import('planck');
  return L0.rings.map((rg, i) => {
    const gaps = (rg.gaps || []).filter((g) => !g.grate);
    if (!gaps.length) return 1;
    return gaps.some((g) => {
      for (let o = 0; o < 8; o++) {
        const L = { ...L0, eggs: 1, eggKinds: ['ostrich'], orbs: [], portals: [], snake: undefined, salamander: undefined, eagle: undefined, fox: undefined, lava: undefined, icicles: undefined, barriers: [], bossFight: undefined,
          rings: L0.rings.map((r) => ({ ...r, thorns: [], pads: [], honey: [], gaps: (r.gaps || []).map((q) => ({ ...q, curtain: undefined, shut: undefined })) })) };
        const sim = new Sim(L, { mode: 'medium' });
        const e = sim.aliveEggs()[0], ring = sim.rings[i], want = -Math.PI / 2 - (g.a * Math.PI) / 180;
        ring.body.setTransform(Vec2(0, 0), want);
        e.body.setTransform(Vec2(0, -(ring.r - 0.42)), (o / 8) * Math.PI * 2);
        let ok = false;
        for (let s = 0; s < 360 && !ok; s++) { for (const r of sim.rings) r.target = r.body.getAngle(); sim.step(); ok = sim.channelOf(e) > i; }
        if (!ok) return false;
      }
      return true;
    }) ? 1 : 0;
  });
}

async function worker(id, tries, out) {
  const spec = id >= 900 ? dailySpec(id - 900) : SPECS.find((s) => s.id === id);
  const found = [];
  let seed = id * 7919;
  for (let n = 0; n < tries; n++) {
    let L = null;
    for (let g = 0; g < 500 && !L; g++) L = layout(spec, ++seed);
    if (!L) break;
    const r = await evaluate(spec, L);
    console.error(`L${id} #${n} seed=${L.seed} ${r.ok ? 'KEEP' : 'drop:' + r.why} ${JSON.stringify(r.rec)}`);
    if (r.ok) found.push({ ...r.rec, level: L });
    if (found.length >= (process.env.KEEP ? +process.env.KEEP : 1)) break;
  }
  writeFileSync(out, JSON.stringify(found));
}

// difficulty of a kept layout, for picking along the curve
const hardness = (c) => c.moves * 1.5 + c.plannerT / 8 + (c.roughBroken || 0) * 2 + (c.stars === 2 ? 1 : 0) + (c.hard === 1 ? 2 : 0);

// Sawtooth (per environment of 5): the first level after a boss is a breather, the boss the hardest, a climb between.
function pick(id, found) {
  if (!found.length) return null;
  const sorted = [...found].sort((a, b) => hardness(a) - hardness(b));
  const k = (id - 1) % 5;
  const q = id <= 2 || k === 0 ? 0 : k === 4 ? 1 : 0.25 + 0.25 * (k - 1);
  return sorted[Math.round(q * (sorted.length - 1))];
}

// the fox's fuse: generous on L1-L2, tight from L3 (F30). Easy/Hard scale it at run time.
function fuse(c, id) {
  const t = id <= 2 ? c.plannerT * 3 + 25 : c.plannerT * 2.2 + 15;
  return Math.max(id <= 2 ? 45 : 30, Math.min(160, Math.round(t / 5) * 5));
}

function writeLevels(chosen) {
  const head = `// GENERATED by tools/gen.mjs from src/data/specs.js. Do not hand-edit: change the spec and regenerate.
// Every level here was cleared by the lookahead planner with no broken eggs.
// Angles in degrees, ring-local at start; -90 is straight down.
// gaps: {a, len (m), x (score multiplier), shut {period, open, phase}}; thorns: {a, n, side 'in'|'out', h, kind 'blunt'}
// pads: sponge {a, len (m)}; honey: {a, len}; gear: index of the ring it turns. orbs: {type, ch, a} float in
// channel ch. time = the fox's fuse in seconds (Medium; Easy x1.6, Hard x0.8).

export const LEVELS = [\n`;
  const body = chosen.map((L) => {
    const { rings, ...rest } = L;
    const top = JSON.stringify(rest).replace(/"(\w+)":/g, '$1: ').replace(/,(?=\w+: )/g, ', ');
    const rl = rings.map((r) => '      ' + JSON.stringify(r).replace(/"(\w+)":/g, '$1: ').replace(/,(?=\w+: )/g, ', ')).join(',\n');
    return `  {\n    ${top.slice(1, -1)},\n    rings: [\n${rl},\n    ],\n  }`;
  }).join(',\n');
  writeFileSync(join(ROOT, 'src', 'data', 'levels.js'), head + body + ',\n];\n');
}

async function main() {
  const args = process.argv.slice(2);
  const opt = (k, d) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : d; };
  if (args[0] === '--worker') return worker(Number(args[1]), Number(opt('--tries', 10)), opt('--out'));
  const assembleOnly = args.includes('--assemble'); // rebuild levels.js from tools/gen-out without searching
  if (args.includes('--daily')) return daily(Number(opt('--daily', 60)), Number(opt('--tries', 6)), Number(opt('--jobs', 3)), assembleOnly);
  const ids = args[0] && !args[0].startsWith('--') ? args[0].split(',').map(Number) : SPECS.map((s) => s.id);
  const tries = Number(opt('--tries', 10));
  const jobs = Number(opt('--jobs', 3));
  mkdirSync(OUT_DIR, { recursive: true });
  const queue = [...ids].sort((a, b) => b - a); // big levels first, they take longest
  const run = (id) => new Promise((res) => {
    const out = join(OUT_DIR, `L${id}.json`);
    const p = fork(fileURLToPath(import.meta.url), ['--worker', String(id), '--tries', String(tries), '--out', out], { stdio: 'inherit' });
    p.on('exit', res);
  });
  if (assembleOnly) queue.length = 0;
  await Promise.all(Array.from({ length: jobs }, async () => { while (queue.length) await run(queue.shift()); }));

  // assemble: every spec, using fresh results where we have them
  const chosen = [];
  const report = [];
  // levels with no fresh results keep their current layout (so a few levels can be regenerated alone)
  const { LEVELS: OLD } = await import('../src/data/levels.js').catch(() => ({ LEVELS: [] }));
  for (const spec of SPECS) {
    const f = join(OUT_DIR, `L${spec.id}.json`);
    const found = existsSync(f) ? JSON.parse(readFileSync(f, 'utf8')) : [];
    const old = OLD.find((L) => L.id === spec.id);
    if (!found.length && old && !args.includes('--strict')) {
      for (const k of ['theme', 'name', 'eggs', 'target', 'material', 'tip', 'world', 'intro', ...LEVEL_KEYS]) if (k !== 'bonus' && spec[k] !== undefined) old[k] = spec[k];
      for (const k of LEVEL_KEYS) if (k !== 'bonus' && spec[k] === undefined) delete old[k]; // a hazard the spec dropped goes too
      chosen.push(old);
      report.push(`L${spec.id}: kept its layout`);
      continue;
    }
    const c = pick(spec.id, found);
    if (!c) { report.push(`L${spec.id}: NO VALID LAYOUT`); continue; }
    // names, tips, nest and other non-layout fields always come from the current spec
    for (const k of ['theme', 'name', 'eggs', 'target', 'material', 'tip', 'world', 'intro', ...LEVEL_KEYS]) {
      if (k === 'bonus' && c.level.bonus && spec.bonus && c.level.bonus.kind === spec.bonus.kind) continue; // keeps the n / s found by the planner
      if (spec[k] !== undefined) c.level[k] = spec[k]; else delete c.level[k];
    }
    c.level.time = fuse(c, spec.id); // seed stays: it seeds the sim's rng (weather, debris), so play matches validation
    chosen.push(c.level);
    report.push(`L${spec.id}: kept ${found.length}, seed ${c.seed}, stars ${c.stars}, planner ${c.plannerT}s/${c.moves} moves, exploit ${c.exploit}, hard ${c.hard} (${c.hardT}s), easy ${c.easy}, fuse ${c.level.time}s, hardness ${hardness(c).toFixed(1)}`);
  }
  console.log(report.join('\n'));
  if (chosen.length === SPECS.length) writeLevels(chosen);
  else console.log(`\nNot writing levels.js: ${SPECS.length - chosen.length} level(s) have no valid layout.`);
}

async function daily(n, tries, jobs, assembleOnly) {
  mkdirSync(OUT_DIR, { recursive: true });
  const queue = assembleOnly ? [] : Array.from({ length: n }, (_, k) => 900 + k);
  const run = (id) => new Promise((res) => {
    const p = fork(fileURLToPath(import.meta.url), ['--worker', String(id), '--tries', String(tries), '--out', join(OUT_DIR, `D${id - 900}.json`)], { stdio: 'inherit' });
    p.on('exit', res);
  });
  await Promise.all(Array.from({ length: jobs }, async () => { while (queue.length) await run(queue.shift()); }));
  const levels = [];
  for (let k = 0; k < n; k++) {
    const f = join(OUT_DIR, `D${k}.json`);
    const c = existsSync(f) ? JSON.parse(readFileSync(f, 'utf8'))[0] : null;
    if (!c) continue;
    c.level.time = fuse(c, 10);
    levels.push(c.level);
  }
  const rows = levels.map((L) => '  ' + JSON.stringify(L).replace(/"(\w+)":/g, '$1: ')).join(',\n');
  writeFileSync(join(ROOT, 'src', 'data', 'daily.js'), `// GENERATED by tools/gen.mjs --daily: validated Daily Vault layouts; the game picks one by date (C7).\nexport const DAILY = [\n${rows},\n];\n`);
  console.log(`daily.js: ${levels.length} of ${n} layouts validated`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main();
