// 0.8.17 guards: refunds take a one-time purchase back (src/guard.js), the game's day only moves forward (src/clock.js),
// and video rewards met offline wait for a connection (src/waiting.js).
// node tools/test-guard.mjs   (exits 1 on a failure)
globalThis.window = globalThis.window || {};
const E = await import('../src/economy.js');
const GD = await import('../src/guard.js');
const { ads } = await import('../src/ads.js');
let fails = 0;
const ok = (c, msg) => { if (!c) { fails++; console.log('FAIL', msg); } else console.log('ok  ', msg); };
const H = 3600 * 1000, T0 = 1764000000000;

// ---------------------------------------------------------------- refunds
// a grant as ads.js makes it: grantIap, then the guard remembers it with its token
function buy(st, sku, tok, again = false, now = T0) {
  const before = st.wallet, r = E.grantIap(before, sku, again ? '' : tok, now);
  const g = GD.onGrant(st.guard, sku, tok, before, r.wallet, r.granted, now);
  return { wallet: g.wallet, guard: g.guard };
}
const chk = (st, owned, now) => { const r = GD.check(st.guard, st.wallet, owned, now); return { wallet: r.wallet, guard: r.guard, revoked: r.revoked }; };

// a player who bought an outfit with coins first, then Unlock Everything
let w0 = E.defaultWallet();
w0.coins = 500; w0 = E.buyHenSkin(w0, 'farmer'); // 160 coins: his own
let st = { wallet: w0, guard: null };
st = buy(st, 'eggscape_premium', 'tokP');
ok(st.wallet.noAds && st.wallet.coins === 340 + 1500 && st.guard.ents.eggscape_premium.tok === 'tokP' && st.guard.ents.eggscape_premium.coins === 1500, 'premium grant remembered with its token and its coins');
ok(st.guard.ents.eggscape_premium.add.eggs.includes('golden') && st.guard.ents.eggscape_premium.add.chicks.length === E.CHICK_IDS.length, 'the grant record holds what it really added');
st.wallet = { ...st.wallet, henSkin: 'golden', skin: 'golden' };
st.wallet.coins -= 1700; // he spent most of it
let r = chk(st, [], T0 + H);
ok(r.wallet.noAds && !r.revoked.length, 'first check without it: nothing taken (one flaky answer never punishes)');
r = chk(r, [], T0 + H + 20 * 60 * 1000);
ok(r.wallet.noAds && !r.revoked.length, 'second check 20 min later: still nothing (an hour apart)');
r = chk(r, [], T0 + 2 * H + 1);
ok(!r.wallet.noAds && r.revoked.join() === 'eggscape_premium', 'two checks an hour apart: revoked');
ok(r.wallet.coins === 0, 'coins taken back only as far as the purse goes (never below zero)');
ok(r.wallet.henSkins.includes('farmer') && r.wallet.henSkin === 'classic' && r.wallet.skin === 'classic' && !E.ownsHenSkin(r.wallet, 'golden') && !E.ownsSkin(r.wallet, 'golden'), 'golden hen and egg un-owned and un-equipped; the outfit he bought with coins stays');
ok(r.wallet.chicks.length === 0 && E.iapAvailable(r.wallet, 'eggscape_premium'), 'the bundle\'s chicks go; the shop offers it again');
ok(GD.takeNote(r.guard).line === 'Your Unlock Everything purchase was refunded, so it has been removed.' && GD.takeNote(GD.takeNote(r.guard).guard).line === '', 'one calm line, once');
const rv = r;
r = chk(r, [], T0 + 9 * H);
ok(r.wallet.coins === 0 && !r.revoked.length, 'a revoked purchase is not revoked twice');

// buy again: everything comes back (a new token, a normal purchase)
let b2 = buy({ wallet: rv.wallet, guard: rv.guard }, 'eggscape_premium', 'tokP2');
ok(b2.wallet.noAds && b2.wallet.coins === 1500 && E.ownsHenSkin(b2.wallet, 'golden') && b2.wallet.chicks.length === E.CHICK_IDS.length && !b2.guard.ents.eggscape_premium.off, 're-buy restores everything');
// the same purchase seen again after all (a false revoke): the unlock and the coins taken come back
let rich = buy({ wallet: { ...E.defaultWallet(), coins: 10 }, guard: null }, 'eggscape_premium', 'tokQ');
rich = chk(chk(rich, [], T0 + H), [], T0 + 3 * H);
ok(!rich.wallet.noAds && rich.wallet.coins === 10, 'revoked: 1500 coins taken, 10 left');
const back = buy(rich, 'eggscape_premium', 'tokQ', true);
ok(back.wallet.noAds && back.wallet.coins === 1510, 'the same token listed again: unlock and coins back');

// listed again between two misses: the count starts over
let fl = buy({ wallet: E.defaultWallet(), guard: null }, 'eggscape_premium', 'tokF');
fl = chk(fl, [], T0 + H); fl = chk(fl, ['eggscape_premium'], T0 + 2 * H); fl = chk(fl, [], T0 + 3 * H);
ok(fl.wallet.noAds, 'seen again in between: the misses start over');
// never on errors: anything that is not a list changes nothing
let er = buy({ wallet: E.defaultWallet(), guard: null }, 'eggscape_premium', 'tokE');
for (const bad of [null, undefined, 'error', { a: 1 }, 7]) er = chk(er, bad, T0 + 5 * H);
er = chk(er, [], 0);
ok(er.wallet.noAds && !Object.keys(er.guard.miss).length, 'never on errors (not a list, no time)');

// a dev / test unlock (no token: the stub, an older shell, setSave) is never tracked, never stripped
let dev = { wallet: { ...E.defaultWallet(), noAds: true }, guard: null };
dev = buy(dev, 'eggscape_premium', '');
dev = chk(chk(chk(dev, [], T0 + H), [], T0 + 3 * H), [], T0 + 9 * H);
ok(dev.wallet.noAds && !Object.keys(dev.guard.ents).length, 'stub unlock kept (no token: never tracked)');

// consumables are not tracked
let cp = buy({ wallet: E.defaultWallet(), guard: null }, 'coins_850', 'tokC');
cp = chk(chk(cp, [], T0 + H), [], T0 + 3 * H);
ok(cp.wallet.coins === 850 && !cp.guard.ents.coins_850, 'coin packs are left alone');

// Unlock Everything refunded, The Whole Coop still owned: the coop keeps every perk
let two = buy({ wallet: E.defaultWallet(), guard: null }, 'eggscape_premium', 'tP');
two = buy(two, 'eggscape_collector', 'tC');
two = chk(chk(two, ['eggscape_collector'], T0 + H), ['eggscape_collector'], T0 + 3 * H);
ok(two.wallet.noAds && two.wallet.collector && E.ownsHenSkin(two.wallet, 'golden') && two.wallet.chicks.length === Object.keys(E.CHICK_PRICES).length, 'another bundle still owned keeps what it gives');
two = chk(chk(two, [], T0 + 4 * H), [], T0 + 6 * H);
ok(!two.wallet.noAds && !two.wallet.collector && two.wallet.henSkins.join() === 'classic' && E.sanitizeWallet(two.wallet).henSkins.join() === 'classic', 'the coop refunded too: every outfit it added goes (and stays gone after a reload)');

// the starter nest: its flag goes, so the shop offers it again
let sn = buy({ wallet: E.defaultWallet(), guard: null }, 'starter_nest', 'tS');
sn = chk(chk(sn, [], T0 + H), [], T0 + 3 * H);
ok(!sn.wallet.starter && E.iapAvailable(sn.wallet, 'starter_nest') && !sn.wallet.henSkins.includes('cocoa') && sn.wallet.coins === 0, 'starter nest refunded: offered again, Cocoa Hen and coins gone');
// restore on every start (again: true) keeps the first record's coins
let rs = buy({ wallet: E.defaultWallet(), guard: null }, 'eggscape_premium', 'tR');
rs = buy(rs, 'eggscape_premium', 'tR', true);
ok(rs.guard.ents.eggscape_premium.coins === 1500 && rs.wallet.coins === 1500, 'the restore at every start keeps the grant record');
// an old save (granted before this record existed): the restore adds the record, nothing is paid twice
let ol = { wallet: E.grantIap(E.defaultWallet(), 'eggscape_premium', 'tO', 1).wallet, guard: undefined };
ol = buy(ol, 'eggscape_premium', 'tO', true);
ok(ol.guard.ents.eggscape_premium && ol.guard.ents.eggscape_premium.coins === 0 && ol.wallet.coins === 1500, 'an old grant gets its record at the next restore (its coins are not reclaimed)');

// the bridge: window.__eggStore after a successful query
const save = { wallet: E.defaultWallet() };
let said = [];
ads.attach(save, () => {}, () => {});
ads.onRevoke((s) => said.push(...s));
ok(window.__eggGrant('eggscape_premium', 'tokW') === true && save.wallet.noAds && save.guard.ents.eggscape_premium.tok === 'tokW', '__eggGrant remembers the token');
ok(window.__eggStore('not json') === false && window.__eggStore('{"a":1}') === false && save.wallet.noAds, '__eggStore ignores anything that is not a list');
const realNow = Date.now;
Date.now = () => T0; window.__eggStore('[]');
Date.now = () => T0 + 2 * H; window.__eggStore('[]');
Date.now = realNow;
ok(!save.wallet.noAds && said.join() === 'eggscape_premium', '__eggStore revokes after two checks and tells the game once');

// ---------------------------------------------------------------- the game's day (clock.js)
const CK = await import('../src/clock.js');
const D = (s, h = 12) => new Date(`${s}T${String(h).padStart(2, '0')}:00:00`).getTime();
let c = CK.step(null, D('2026-11-25'));
ok(c.day === '2026-11-25', 'first day');
c = CK.step(c, D('2026-11-25', 20));
ok(c.day === '2026-11-25', 'same day');
c = CK.step(c, D('2026-11-26', 9));
ok(c.day === '2026-11-26', 'the next day comes');
let cb = CK.step(c, D('2026-11-24'));
ok(cb.day === '2026-11-26', 'a clock that goes back keeps the remembered day');
cb = CK.step(cb, D('2026-11-26', 10));
ok(cb.day === '2026-11-26', 'and forward again to the real day: still the same day (no new chests)');
// toggle back and forth many times: no new day
let tg = c;
for (let i = 0; i < 10; i++) { tg = CK.step(tg, D('2026-11-20')); tg = CK.step(tg, D('2026-11-26', 11)); }
ok(tg.day === '2026-11-26', 'toggling the date back and forth never repeats a day');
let jump = CK.step(c, D('2026-12-20'));
ok(jump.day === '2026-12-20' && jump.n === c.n + 1 && jump.gap === 1, 'a jump of more than 2 days with no app run in between counts as one day');
jump = CK.step(jump, D('2026-12-20', 13));
ok(jump.day === '2026-12-20' && jump.n === c.n + 1, 'and the same jumped day gives nothing more');
let jb = CK.step(jump, D('2026-11-26', 13));
ok(jb.day === '2026-12-20', 'back to the real date after a jump: no new day until the real date passes it');
jump = CK.step(jump, D('2026-12-21', 8));
ok(jump.day === '2026-12-21' && jump.n === c.n + 2, 'the next day after the jump is one new day');
let two2 = CK.step(c, D('2026-11-28'));
ok(two2.day === '2026-11-28' && two2.gap === 2, 'two days away: both counted (a normal weekend)');
// uptime (the phone's time since start, which the date setting cannot change) proves a long real absence
let up = CK.step(null, D('2026-11-25'), 1000);
up = CK.step(up, D('2026-12-01'), 1000 + 6 * 24 * H);
ok(up.day === '2026-12-01' && up.gap === 6, 'with uptime showing the days really passed, a long absence counts in full');
let fake = CK.step(null, D('2026-11-25'), 1000);
fake = CK.step(fake, D('2026-12-01'), 1000 + 60 * 1000);
ok(fake.gap === 1, 'uptime says a minute passed: the jump counts as one day');
ok(CK.clean({ day: 'x', max: 'y' }).day === '' && CK.step(CK.clean(undefined), D('2026-11-25')).day === '2026-11-25', 'old saves start clean');
ok(CK.at(c, D('2026-11-24')) >= D('2026-11-26', 9), 'a clamped "now" for the rules that keep their own day keys never goes back');

// ---------------------------------------------------------------- rewards that wait for a connection (waiting.js)
const WT = await import('../src/waiting.js');
let q = [];
q = WT.keep(q, { kind: 'coins', n: 40, key: 'free:2026-11-25:0' }, T0, { early: true });
ok(q.length === 0, 'nothing waits before level 3 is won');
q = WT.keep(q, { kind: 'coins', n: 40, key: 'free:2026-11-25:0' }, T0);
q = WT.keep(q, { kind: 'coins', n: 40, key: 'free:2026-11-25:0' }, T0 + 1);
ok(q.length === 1, 'the same moment is kept once');
q = WT.keep(q, { kind: 'coins', n: 52, key: 'double:7:1' }, T0 + 2);
q = WT.keep(q, { kind: 'spin', n: 1, key: 'spin:2026-11-25:0' }, T0 + 3);
q = WT.keep(q, { kind: 'coins', n: 30, key: 'free:2026-11-25:1' }, T0 + 4);
ok(q.length === 3 && q[0].key === 'double:7:1' && q[2].key === 'free:2026-11-25:1', 'at most 3: the newest replace the oldest');
ok(WT.keep(q, { kind: 'gems', n: 9, key: 'x' }, T0).length === 3 && WT.keep([], { kind: 'coins', n: 0, key: 'z' }, T0).length === 0, 'only coins and spins, and never nothing');
let pay = WT.claim({ list: q, paid: null }, q[0].id, '2026-11-26');
ok(pay.item && pay.item.n === 52 && pay.state.list.length === 2 && pay.state.paid.n === 52, 'a claim pays what it was kept with and counts in the day\'s ceiling');
let big = { list: [], paid: { day: '2026-11-26', n: WT.WAIT.dayCap - 10 } };
big.list = WT.keep(big.list, { kind: 'coins', n: 40, key: 'k' }, T0);
pay = WT.claim(big, big.list[0].id, '2026-11-26');
ok(!pay.item && pay.state.list.length === 1, 'over the day\'s ceiling it keeps waiting (never expires, never shrinks)');
pay = WT.claim(big, big.list[0].id, '2026-11-27');
ok(pay.item && pay.item.n === 40, 'the next day it pays in full');
ok(WT.clean({ list: [{ kind: 'coins', n: 5, key: 'a', id: 'w1' }, { kind: 'x' }, 5] }).list.length === 1, 'old or broken saves are cleaned');

if (fails) { console.log(`\n${fails} FAILED`); process.exit(1); }
console.log('\nall guard tests passed');
