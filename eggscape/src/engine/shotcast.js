// The cast for the camera director (engine/shots.js): one small adapter per villain family that answers "where is its
// body, is it entering / telling / striking, what is its target". Reads the sim, never writes it. A new move plugs in by
// adding its phase name to its family's sets here (an unknown phase is 'idle' unless the body is close to an egg).
//   actor = { key, fam, x, y, r, act: 'enter' | 'tell' | 'strike' | 'idle', tx, ty }
const S = (...a) => new Set(a);
const NEAR = 2.2;
const LEAD = 2.4; // s before a waiting villain comes out that the camera already goes to its door (so it is there when he is) // m: a villain this close to an egg is acting, whatever its phase is called

// phase names -> act, per family (first match wins)
const PH = {
  // the weasel, the rats, the rat king (sim/thieves.js T.ph)
  thief: { enter: S('in'), tell: S('crouch', 'brace', 'stalk', 'prowl', 'laugh'), strike: S('leap', 'grab', 'inner', 'carry', 'push', 'stash', 'toss', 'cross', 'drop', 'sqSkid', 'sqBall', 'sqThrow', 'bonk', 'trapped') },
  // Bandit the raccoon (sim/bandit.js B.ph)
  bandit: { enter: S('sneak', 'climb', 'hop'), tell: S('crouch', 'spit', 'reach', 'whistle'), strike: S('crank', 'grab', 'strain', 'stuff', 'dash', 'duel', 'shaken', 'fall', 'sit', 'cower', 'dust', 'huh', 'perchStun', 'laugh', 'scared') }, // (on a ring he is always in the shot)
  // mama raccoon (sim/kits.js K.ph) and her crew of kits (K.g.ph)
  mama: { enter: S('walk'), tell: S('untie'), strike: S() },
  kits: { enter: S('run', 'climbIn'), tell: S('pop', 'lift'), strike: S('go', 'up', 'hop', 'down', 'carry', 'out', 'yard', 'tumble', 'dangle', 'flee') },
  // every other family (sim/strike.js stkTargets): the phase words the sims share
  any: { enter: S('in', 'enter', 'rise', 'arrive', 'walk', 'sneak', 'surface', 'emerge'), tell: S('warn', 'tell', 'aim', 'windup', 'wind', 'crouch', 'coil', 'charge', 'brace', 'spit', 'look'), strike: S('strike', 'leap', 'grab', 'tongue', 'snatch', 'hold', 'carry', 'eat', 'bite', 'lunge', 'toss', 'push', 'pull', 'reach', 'dash', 'swipe', 'gulp', 'hug', 'drag') },
};
const R = { thief: 0.45, bandit: 0.6, mama: 0.65, kits: 0.4, boss: 0.8, any: 0.4 };
const actOf = (fam, ph) => { const P = PH[fam] || PH.any; return P.enter.has(ph) ? 'enter' : P.tell.has(ph) ? 'tell' : P.strike.has(ph) ? 'strike' : 'idle'; };

export function castOf(sim) {
  const out = [];
  if (!sim) return out;
  const eggs = sim.aliveEggs().map((e) => e.body.getPosition());
  const add = (key, fam, p, ph, r, lead = 0) => {
    if (!p || !Number.isFinite(p.x) || !Number.isFinite(p.y)) return;
    let act = actOf(fam, ph), tx, ty, bd = 1e9;
    for (const q of eggs) { const d = Math.hypot(q.x - p.x, q.y - p.y); if (d < bd) { bd = d; tx = q.x; ty = q.y; } }
    if (act === 'idle' && bd < NEAR) act = 'strike';
    const a = { key, fam, x: p.x, y: p.y, r: r || R[fam] || R.any, act, ph };
    if (lead) a.lead = 1; // not out yet: the camera goes to its door ahead of it (the audit does not count these frames as acting)
    if ((act === 'tell' || act === 'strike') && bd < 4) { a.tx = tx; a.ty = ty; } // its target: the egg it is closest to
    out.push(a);
  };
  const seen = new Set();
  // ---- the thieves
  (sim.thieves || []).forEach((T, i) => { seen.add('th' + i); if (T.ph === 'wait' && T.t < LEAD && sim.state === 'play') add('th' + i, 'thief', sim.thDenPt(T), 'in', T.boss ? 0.6 : 0, 1); else if (sim.thLive(T)) add('th' + i, 'thief', sim.thBody(T), T.eid && T.ph !== 'in' ? 'carry' : T.ph, T.boss ? 0.6 : 0); });
  // ---- Bandit
  const B = sim.band;
  if (B && !B.done && B.ph !== 'wait' && B.ph !== 'hide' && B.ph !== 'defeated') {
    const p = sim.bandPerched(B) || B.ph === 'climb' ? sim.bandBody(B, 0.45, 0) : { x: B.x, y: sim.groundY + 0.55 };
    const bl = B.ph === 'idle' && B.ri < 0 && B.t < LEAD;
    add('band', 'bandit', p, bl ? 'sneak' : B.ph, 0, bl ? 1 : 0);
  }
  // ---- mama raccoon and the kits
  const K = sim.kit;
  if (K && !K.done && K.ph !== 'gone' && (K.ph !== 'wait' || K.t < LEAD) && Number.isFinite(K.x)) {
    add('mama', 'mama', { x: K.x, y: sim.groundY + 0.7 }, K.ph === 'wait' ? 'walk' : K.ph, 0, K.ph === 'wait' ? 1 : 0);
    if (K.g && sim.kitOut(K.g)) add('kits', 'kits', sim.kitBody(K.g), K.g.ph);
  }
  // ---- everyone else, from the strike's own list of live villains
  if (sim.stkTargets) for (const V of sim.stkTargets()) {
    if (seen.has(V.key) || V.type === 'thief') continue;
    if (V.boss && (B || (sim.thiefBoss && sim.thiefBoss()))) continue; // the boss marker of a raccoon or a thief: the body is above
    add(V.key, V.type, V, V.ref && typeof V.ref.ph === 'string' ? V.ref.ph : V.ref && typeof V.ref.phase === 'string' ? V.ref.phase : '', V.boss ? R.boss : 0);
  }
  return out;
}
