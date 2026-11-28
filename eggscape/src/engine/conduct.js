// The Conductor: at each moment (home, map, win, fail, pause, leaving, after a prize) every subsystem may have something
// to show. Shown all at once they shout over each other, so the Conductor takes the candidates and names ONE to lead,
// the rest in order behind it (0.8.15). It is the only place that decides between systems; each system still decides
// its own content. The Brain's gate (src/brain.js) stays the rule for when the player may be asked for anything.
//
// A candidate: { id, sys, kind, near (0..1, how close: a meter 2/3 full is 0.67), price (coins) }
//   kind 'gift'     something already his, waiting to be opened (a banked spin, a chest that is ready)
//        'rescue'   the way back in after a loss (one egg short: Rewind; third loss: the cheer-up spin)
//        'progress' a step toward a gift (the spin meter, stars to the next chest, the streak)
//        'suggest'  something his coins reach, or nearly reach
//        'video'    a reward for a chosen video        'coins' a thing for coins        'money' a paid offer
// Order: what is his comes first, then help, then what he is close to, and asking comes last. Among asks the Oracle's
// guess of what this player takes puts video or coins first, but only once that guess has earned trust on this phone.
import * as BR from '../brain.js';
import * as OR from './oracle.js';

export const RANK = { gift: 0, rescue: 1, progress: 2, suggest: 3, video: 4, coins: 5, money: 6 };
// ctx: { now, levelId, walked (the player opened this page himself: asks need no gate), predict (an Oracle answer, else asked for) }
export function lead(save, moment, cands, ctx = {}) {
  const list = (Array.isArray(cands) ? cands : []).filter((c) => c && c.id && RANK[c.kind] != null);
  const G = ctx.walked ? { money: true, nudge: true, why: 'the player opened it' } : BR.gate(save, moment, ctx);
  const held = [], ok = [];
  for (const c of list) {
    if (c.kind === 'money' && !G.money) held.push({ id: c.id, why: G.why });
    else if ((c.kind === 'video' || c.kind === 'coins') && !G.nudge) held.push({ id: c.id, why: G.why });
    else ok.push(c);
  }
  const P = ctx.predict || OR.predict(save, ctx), swap = OR.trusted(save, 'video') && OR.trusted(save, 'coins') && P.coins.p > P.video.p + 0.1;
  // after a loss the way back in comes before a gift that can wait (the player's mind is on the level)
  const rank = (c) => (moment === 'fail' && c.kind === 'rescue' ? -1 : swap && c.kind === 'video' ? RANK.coins : swap && c.kind === 'coins' ? RANK.video : RANK[c.kind]);
  ok.sort((a, b) => rank(a) - rank(b) || (b.near || 0) - (a.near || 0));
  const first = ok[0] || null;
  const why = first ? `${first.kind}${first.near != null ? ' ' + Math.round(first.near * 100) + '%' : ''} leads of ${ok.length}${held.length ? `; held ${held.map((h) => h.id).join(' ')} (${held[0].why})` : ''}${swap ? '; coins before video (Oracle)' : ''}` : held.length ? `nothing: ${held[0].why}` : 'nothing to show';
  if (!ctx.quiet) BR.why(save, moment, first ? first.id : null, why, ctx.now);
  return { lead: first, order: ok, held, why };
}

// the one thing to point at after coins arrive (a spin, a chest, a treasure, a win): the best thing the purse now
// reaches, else the nearest thing just out of reach. items: [{ key, price, owned, kind }] -> { key, price, short } | null
export const SUGGEST = { reach: 0.25, shortMax: 80 };
export function suggest(save, items, ctx = {}) {
  const coins = Math.max(0, Number(save.wallet && save.wallet.coins) || 0);
  const open = (Array.isArray(items) ? items : []).filter((i) => i && i.price > 0 && !i.owned && (!ctx.kinds || ctx.kinds.includes(i.kind)));
  const can = open.filter((i) => i.price <= coins).sort((a, b) => b.price - a.price)[0];
  if (can && (ctx.gained == null || can.price > coins - ctx.gained)) return { key: can.key, price: can.price, short: 0 }; // these coins are what made it reachable
  const near = open.filter((i) => i.price > coins && i.price - coins <= Math.min(SUGGEST.shortMax, i.price * SUGGEST.reach)).sort((a, b) => (a.price - coins) - (b.price - coins))[0];
  if (near) return { key: near.key, price: near.price, short: near.price - coins };
  return can ? { key: can.key, price: can.price, short: 0 } : null;
}
