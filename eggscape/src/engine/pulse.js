// The Pulse: the player's record of play (0.8.15). Sessions, days played, the hour of day, time per try, tries, near
// misses: the handful of plain signals that research found to carry most of what can be known about whether a player
// comes back (Jelly Splash study: rounds played, sessions, session length and hours since the last one; three or four
// rules on them were within about a point of a trained model). All of it stays on the phone, in the save.
import { slot } from './hub.js';

export const PULSE = { gapMin: 10, sessions: 12, days: 14, results: 20 };
const MIN = 60000, HOUR = 3600000;
const num = (v) => Math.max(0, Number(v) || 0), int = (v) => Math.floor(num(v));
export const dayOf = (now) => { const d = new Date(now); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
const SAFE = new WeakSet();
export function pulseState(save) {
  const cur = slot(save, 'pulse');
  if (cur && SAFE.has(cur)) return cur;
  const p = cur && typeof cur === 'object' ? cur : {};
  const s = {
    first: num(p.first), seen: num(p.seen), opens: int(p.opens),
    days: Array.isArray(p.days) ? p.days.filter((d) => typeof d === 'string').slice(-PULSE.days) : [], // the days played, oldest first
    sess: Array.isArray(p.sess) ? p.sess.filter((q) => q && typeof q === 'object').slice(-PULSE.sessions).map((q) => ({ t: num(q.t), len: num(q.len), lv: int(q.lv), end: String(q.end || '').slice(0, 8) })) : [], // t start, len ms, lv levels ended, end: how the last level in it went
    hours: Array.isArray(p.hours) && p.hours.length === 24 ? p.hours.map(int) : new Array(24).fill(0), // opens by hour of day
    res: Array.isArray(p.res) ? p.res.filter((q) => q && typeof q === 'object').slice(-PULSE.results).map((q) => ({ id: int(q.id), w: q.w ? 1 : 0, s: num(q.s), n: q.n ? 1 : 0 })) : [], // id, won, seconds, near miss
    gap: num(p.gap), // hours between the last two sessions
  };
  save.eng.pulse = s; SAFE.add(s);
  return s;
}

// the app came to the front (or a first frame): a new session when the last sign of life is more than PULSE.gapMin old.
// Returns true when a new session started.
export function open(save, now = Date.now()) {
  const P = pulseState(save);
  if (!P.first) P.first = now;
  const fresh = !P.sess.length || now - P.seen > PULSE.gapMin * MIN;
  if (fresh) {
    if (P.seen) P.gap = Math.round((now - P.seen) / HOUR * 10) / 10;
    P.opens += 1; P.hours[new Date(now).getHours()] += 1;
    P.sess = [...P.sess, { t: now, len: 0, lv: 0, end: '' }].slice(-PULSE.sessions);
    const d = dayOf(now);
    if (P.days[P.days.length - 1] !== d) P.days = [...P.days, d].slice(-PULSE.days);
  }
  P.seen = now;
  return fresh;
}
// a sign of life (every save): the session grows
export function tick(save, now = Date.now()) {
  const P = pulseState(save), S = P.sess[P.sess.length - 1];
  if (!S || now - P.seen > PULSE.gapMin * MIN) { open(save, now); return; }
  S.len = Math.max(S.len, now - S.t); P.seen = now;
}
// a level ended. r: { id, won, secs, near }
export function result(save, r, now = Date.now()) {
  const P = pulseState(save);
  tick(save, now);
  const S = P.sess[P.sess.length - 1];
  if (S) { S.lv += 1; S.end = r.won ? 'won' : r.near ? 'near' : 'lost'; }
  P.res = [...P.res, { id: int(r.id), w: r.won ? 1 : 0, s: Math.round(num(r.secs)), n: r.near ? 1 : 0 }].slice(-PULSE.results);
}

const avg = (a) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0);
// the record in numbers, as of `now`
export function facts(save, now = Date.now()) {
  const P = pulseState(save), S = P.sess, cur = S[S.length - 1] || null, done = S.slice(0, -1);
  const d7 = []; for (let i = 0; i < 7; i++) d7.push(dayOf(now - i * 24 * HOUR));
  const days7 = P.days.filter((d) => d7.includes(d)).length;
  const today = dayOf(now), sessToday = S.filter((q) => dayOf(q.t) === today).length;
  const r10 = P.res.slice(-10), failRun = (() => { let n = 0; for (let i = P.res.length - 1; i >= 0 && !P.res[i].w; i--) n++; return n; })();
  const tot = P.hours.reduce((a, b) => a + b, 0); let bestHour = -1;
  if (tot >= 3) { let b = 0; for (let h = 0; h < 24; h++) { const v = P.hours[h] * 2 + P.hours[(h + 23) % 24] + P.hours[(h + 1) % 24]; if (v > b) { b = v; bestHour = h; } } }
  return {
    opens: P.opens, daysAll: P.days.length, days7, sessToday, ageDays: P.first ? (now - P.first) / (24 * HOUR) : 0,
    absenceH: P.seen ? (now - P.seen) / HOUR : 0, gapH: P.gap,
    sessMin: cur ? cur.len / MIN : 0, avgSessMin: avg((done.length ? done : S).map((q) => q.len / MIN)), roundsPerSess: avg((done.length ? done : S).map((q) => q.lv)), roundsNow: cur ? cur.lv : 0,
    winRate10: r10.length ? r10.filter((q) => q.w).length / r10.length : 0.5, failRun, near10: r10.filter((q) => q.n).length, avgTrySecs: avg(r10.map((q) => q.s)), lastEnd: cur ? cur.end : '',
    bestHour, hour: new Date(now).getHours(),
  };
}
export function line(save, now = Date.now()) {
  const F = facts(save, now), r = (v) => Math.round(v * 10) / 10;
  return `opens ${F.opens}, days ${F.days7}/7 (${F.daysAll} in all), today ${F.sessToday} sess, this one ${r(F.sessMin)} min ${F.roundsNow} lv (usual ${r(F.avgSessMin)} min ${r(F.roundsPerSess)} lv), last gap ${F.gapH} h, win10 ${r(F.winRate10)}, fail run ${F.failRun}, try ${Math.round(F.avgTrySecs)} s, hour ${F.bestHour < 0 ? '?' : F.bestHour}`;
}
