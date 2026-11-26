// The 0.8.17 extras' rules: the daily chest's "Opens in" (src/clock.js), the combo album (src/album.js), Reset progress
// (src/reset.js) and the privacy policy's two copies (src/data/privacy.js, docs/privacy.html). node tools/test-extras.mjs
import fs from 'fs';
import * as CK from '../src/clock.js';
import * as AL from '../src/album.js';
import * as RS from '../src/reset.js';
import { COMBOS } from '../src/sim/powers2.js';
import { FAUCETS } from '../src/engine/mint.js';
import { defaultWallet, grantIap } from '../src/economy.js';
import { onGrant, clean as guardClean, revoke } from '../src/guard.js';
import { PRIVACY, PRIVACY_URL, PRIVACY_CONTACT } from '../src/data/privacy.js';
let bad = 0;
const ok = (c, m) => { console.log((c ? 'ok   ' : 'FAIL ') + m); if (!c) bad++; };
const T = (y, mo, d, h = 0, mi = 0, s = 0) => new Date(y, mo - 1, d, h, mi, s).getTime();

{ // the chest's countdown follows the game's day (CK.step), never the bare phone date
  let c = CK.step(null, T(2026, 11, 26, 17, 48));
  ok(CK.nextDayAt(c) === T(2026, 11, 27), 'the next day starts at the local midnight after the game day');
  ok(CK.opensText(CK.opensIn(c, T(2026, 11, 26, 17, 48))) === 'Opens in 6h 12m', '17:48 -> "Opens in 6h 12m"');
  ok(CK.opensText(CK.opensIn(c, T(2026, 11, 26, 23, 48))) === 'Opens in 12m', 'under an hour: "Opens in 12m"');
  ok(CK.opensText(CK.opensIn(c, T(2026, 11, 26, 23, 59, 30))) === 'Opens in 1m', 'the last seconds still say 1m, never 0m');
  ok(CK.opensText(CK.opensIn(c, T(2026, 11, 26, 0, 0, 1))) === 'Opens in 24h 00m', 'just after midnight: 24h 00m');
  ok(CK.opensText(3 * 3600e3 + 5 * 6e4) === 'Opens in 3h 05m', 'minutes keep two digits after the hours');
  // the promise holds: at the moment it reaches 0 the day really turns, one minute before it has not
  const at = CK.nextDayAt(c);
  ok(CK.step(c, at - 6e4).day === '2026-11-26' && CK.step(c, at).day === '2026-11-27', 'the day turns exactly when the countdown ends');
  // the phone's clock set back a day: the game day stays, and so does the countdown (no early chest)
  c = CK.step(c, T(2026, 11, 26, 20, 0));
  const back = T(2026, 11, 25, 22, 0);
  ok(CK.step(c, back).day === '2026-11-26', 'a clock set back keeps the game day');
  ok(CK.opensIn(c, back) === T(2026, 11, 27) - back, 'and the countdown still runs to the real next day');
  // the phone's clock was ahead and came back to today: the day turns only after the latest moment seen
  const ahead = CK.step(CK.step(null, T(2026, 11, 26, 9)), T(2026, 11, 27, 0, 30));
  ok(ahead.day === '2026-11-27' && CK.nextDayAt(ahead) === T(2026, 11, 28), 'a day reached early counts to the midnight after it');
  ok(CK.nextDayAt(CK.clean(null)) === 0, 'no clock yet: nothing promised');
}
{ // the combo album
  const E = AL.albumOf({});
  ok(E.total === COMBOS.length && E.n === 0 && !E.done && !E.prize && E.fresh.length === 0, `an empty album: 0 / ${COMBOS.length}`);
  const seen = { combo_shatter: 1, combo_cannon: 1, combo_twister: 1, 'album:shatter': 1 };
  const D = AL.albumOf(seen);
  ok(D.n === 3 && D.list.filter((c) => c.found).map((c) => c.id).join() === 'shatter,cannon,twister', 'found = the combos fired in play (seen.combo_<id>)');
  ok(D.fresh.join() === 'cannon,twister', 'new until the tile was shown');
  ok(AL.albumOf(AL.albumSeen(seen, D.fresh)).fresh.length === 0, 'shown on the page: the new marks go');
  const all = {}; for (const C of COMBOS) all['combo_' + C.id] = 1;
  const F = AL.albumOf(all);
  ok(F.done && F.prize && F.n === F.total, 'all found: the prize waits');
  ok(!AL.albumOf({ ...all, albumPrize: 1 }).prize, 'the prize is once only');
  ok(AL.ALBUM_PRIZE === FAUCETS.album.coins && FAUCETS.album.ceiling === 'once ever', 'the prize is the mint\'s one-time album faucet');
  const H = COMBOS.map((C) => AL.hintPower(C.id));
  ok(COMBOS.every((C, i) => H[i] === C.a || H[i] === C.b), 'a hint names one of the combo\'s own two powers');
  ok(new Set(H).size === H.length, 'no two locked tiles name the same power');
  ok(AL.hintText('shatter', (p) => p.toUpperCase()) === `Something with ${AL.hintPower('shatter').toUpperCase()}...`, 'the hint reads "Something with <power>..."');
  ok(AL.albumOf(null).n === 0 && AL.albumOf('x').total === COMBOS.length, 'a missing seen object is an empty album');
}
{ // Reset progress: progress goes, settings, the day and every real-money purchase stay
  const fresh = () => ({ unlocked: 1, stars: {}, wallet: defaultWallet(), seen: {}, intro: {}, sfx: true, music: true, gfx: 'auto' });
  let w = { ...defaultWallet(), coins: 4200, daily: '2026-11-26' }, g = guardClean(null);
  const buy = (sku, tok) => { const b = w, r = grantIap(w, sku, tok, 1); const q = onGrant(g, sku, tok, b, r.wallet, r.granted, 1); g = q.guard; w = q.wallet; };
  buy('eggscape_premium', 'tok-prem'); buy('starter_nest', 'tok-start');
  const old = { unlocked: 34, stars: { 1: 3, 2: 2 }, wallet: w, guard: g, seen: { combo_shatter: 1, 'album:shatter': 1, setOpen: 1, pickN: 3 }, sfx: false, music: false, calm: true, gfx: 'low', age: 'adult', sid: 'abcdef0123456789', clock: { day: '2026-11-26', max: 5 }, eng: { her: 'yes', other: 1 } };
  const s = RS.resetSave(old, fresh());
  ok(s.unlocked === 1 && Object.keys(s.stars).length === 0, 'levels and stars are erased');
  ok(!s.seen.combo_shatter && !s.seen['album:shatter'] && !s.seen.pickN && s.seen.setOpen === 1, 'the album and the seen marks go (Settings\' own mark stays)');
  ok(s.sfx === false && s.music === false && s.calm === true && s.gfx === 'low' && s.age === 'adult', 'the settings and the age answer stay');
  ok(s.sid === old.sid && s.clock.day === '2026-11-26' && s.eng.her === 'yes' && !s.eng.other, 'the support id, the game\'s day and the reminder answer stay');
  ok(s.wallet.noAds && s.wallet.starter && s.wallet.skins.includes('golden') && s.wallet.henSkins.includes('cocoa'), 'the purchases are granted again (the unlocks)');
  ok(s.wallet.coins === 0, 'and pay no coins twice (the restore path: no token)');
  ok(s.wallet.daily === '2026-11-26' && s.wallet.tokens.includes('tok-prem'), 'today\'s claims and the purchase codes stay (no second chest today, no second payout)');
  ok(JSON.stringify(s.guard) === JSON.stringify(guardClean(g)), 'the refund record stays with the purchases');
  ok(RS.purchasesOf(old).sort().join() === 'eggscape_premium,starter_nest', 'purchasesOf lists the one-time purchases');
  const rv = revoke(g, w, 'starter_nest', 2);
  ok(!RS.purchasesOf({ ...old, guard: rv.guard, wallet: rv.wallet }).includes('starter_nest'), 'a refunded purchase is not given back by a reset');
  ok(RS.purchasesOf({ wallet: { ...defaultWallet(), noAds: true } }).join() === 'eggscape_premium', 'an unlock from before the refund record still comes back');
  const n = RS.resetSave({}, fresh());
  ok(n.unlocked === 1 && n.wallet.coins === 0 && !n.wallet.noAds, 'an empty save resets to a fresh one');
}
{ // the policy: one text, two copies
  const html = fs.readFileSync(new URL('../docs/privacy.html', import.meta.url), 'utf8');
  const esc = (t) => t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  ok(PRIVACY.every(([h]) => html.includes(esc(h))), 'every heading of the in-game policy is in docs/privacy.html');
  ok(PRIVACY.every(([, ...p]) => p.every((q) => html.includes(esc(q).split('https://')[0]))), 'and every paragraph');
  ok(html.includes(PRIVACY_CONTACT) && PRIVACY_CONTACT === '[contact email]', 'the contact is left for the owner');
  ok(PRIVACY_URL === '' || /^https:\/\//.test(PRIVACY_URL), 'the hosted address is https (or not set yet)');
}
console.log(bad ? `${bad} FAILED` : 'all extras checks passed');
process.exit(bad ? 1 : 0);
