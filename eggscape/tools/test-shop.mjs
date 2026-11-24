// Shop 2.0 (2026-11-20): kits, sets, free samples, the bonus chest, try-it-free trials, bundle values, The Whole Coop.
// node tools/test-shop.mjs   (exits 1 on a failure)
globalThis.window = globalThis.window || {};
const E = await import('../src/economy.js');
const DR = await import('../src/director.js');
let fails = 0;
const ok = (c, msg) => { if (!c) { fails++; console.log('FAIL', msg); } else console.log('ok  ', msg); };
const W = (o = {}) => E.sanitizeWallet({ ...E.defaultWallet(), ...o });
const sum = (a) => a.reduce((x, y) => x + y, 0);

// ---- bundle value: computed from the tables, never typed in
{
  const boosts = sum(E.BOOSTER_ORDER.map((id) => E.BOOSTERS[id].price));
  ok(E.bundleValue('starter_nest') === 600 + 2 * boosts + 3 * E.CHARGE_ITEM.price + E.HEN_SKINS.cocoa.price, 'starter value = coins + 2 of each boost + 3 charges + Cocoa Hen');
  ok(E.bundleValue('eggscape_premium') === 1500 + sum(E.CHICK_IDS.map((id) => E.CHICK_PRICES[id])) + E.SKINS.golden.price + 30 * E.CHARGE_ITEM.price, 'premium value = coins + six chicks + Golden egg + a month of the daily charge (the Golden Hen has no coin price)');
  ok(E.bundleValue('bundle_helper') === 800 + 2 * boosts + 5 * E.CHARGE_ITEM.price + 3 * E.ITEMS.ally.price, 'helper value = coins + boosts + charges + tickets');
  const coop = 3000 + 30 * E.CHARGE_ITEM.price + sum(Object.values(E.CHICK_PRICES)) + sum(E.HEN_SKIN_ORDER.map((id) => E.HEN_SKINS[id].price)) + sum(E.SKIN_ORDER.map((id) => E.SKINS[id].price));
  ok(E.bundleValue('eggscape_collector') === coop, 'coop value = coins + every chick, outfit and egg + a month of the daily charge');
  const rate = E.IAP.coins_250.coins / E.IAP.coins_250.usd;
  for (const sku of [...E.BUNDLES, 'bundle_helper']) ok(E.bundleTimes(sku) === Math.floor(E.bundleValue(sku) / (E.IAP[sku].usd * rate)) && E.bundleTimes(sku) >= 2, `${sku}: ${E.bundleTimes(sku)}x value (rounded down)`);
  ok(E.bundleTimes('coins_3300') === 0 && E.bundleTimes('egg_bank') === 0, 'coin packs and the bank carry no value badge');
  ok(E.bundleTimes('eggscape_collector') > E.bundleTimes('eggscape_premium'), 'the dearest bundle is the best value (good / better / best)');
}

// ---- The Whole Coop, with and without Premium; tokens
{
  let r = E.grantIap(W(), 'eggscape_collector', 'tC1', 10);
  const c = r.wallet;
  ok(r.granted && c.coins === 3000 && c.collector && c.noAds, 'coop: 3000 coins, Premium included');
  ok(E.HEN_SKIN_ORDER.every((id) => E.ownsHenSkin(c, id)) && E.SKIN_ORDER.every((id) => E.ownsSkin(c, id)), 'coop: every hen outfit and every egg');
  ok(Object.keys(E.CHICK_PRICES).every((id) => E.ownsChick(c, id)), 'coop: all nine chicks, the premium three too');
  ok(!E.iapAvailable(c, 'eggscape_collector') && !E.iapAvailable(c, 'eggscape_premium'), 'coop owned: neither is for sale');
  r = E.grantIap(c, 'eggscape_collector', 'tC1', 11);
  ok(!r.granted && r.wallet.coins === 3000, 'coop token again: no second payout');
  const p = E.grantIap(W(), 'eggscape_premium', 'tP', 1).wallet;
  ok(E.iapAvailable(p, 'eggscape_collector'), 'premium owners can still buy the coop');
  r = E.grantIap(p, 'eggscape_collector', 'tC2', 2);
  ok(r.granted && r.wallet.coins === 1500 + 3000 && r.wallet.collector && E.ownsChick(r.wallet, 'phoenix'), 'coop over Premium: its own 3000 coins, the rest unlocked');
  const re = E.grantIap(W(), 'eggscape_collector', '', 3);
  ok(!re.granted && re.wallet.collector && re.wallet.coins === 0 && E.ownsSkin(re.wallet, 'robot'), 'restore without a new token: everything unlocked, no coins');
  const loaded = E.sanitizeWallet({ collector: true, skins: ['classic'], henSkins: ['classic'] });
  ok(E.SKIN_ORDER.every((id) => E.ownsSkin(loaded, id)) && E.ownsHenSkin(loaded, 'royal'), 'a collector save gets every skin on load (new skins included)');
  const coopHen = E.grantIap(W({ henSkin: 'cocoa', henSkins: ['classic', 'cocoa'] }), 'eggscape_collector', 'tC3', 1).wallet;
  ok(coopHen.henSkin === 'cocoa', 'the coop does not change the outfit the player wears');
}

// ---- kits
{
  ok(E.kitPrice('rescue') === 110 && E.kitPrice('time') === 140 && E.kitPrice('toolbox') === 300, 'kit prices: parts less 20% / 25%, rounded to 10');
  for (const id of E.KIT_ORDER) {
    const K = E.KITS[id], full = sum(K.parts.map((b) => E.BOOSTERS[b].price));
    ok(E.kitPrice(id) === Math.round(full * (1 - K.off) / 10) * 10 && E.kitSave(id) === full - E.kitPrice(id) && E.kitSave(id) > 0, `${id}: saves ${E.kitSave(id)}`);
  }
  const w = E.buyKit(W({ coins: 500, owned: { stone: 1 } }), 'rescue');
  ok(w && w.coins === 390 && E.ownedCount(w, 'stone') === 2 && E.ownedCount(w, 'nest') === 1 && E.ownedCount(w, 'sponge') === 1, 'rescue kit: one of each part');
  ok(E.buyKit(W({ coins: 100 }), 'rescue') === null, 'too few coins: null');
  const full = W({ coins: 999, owned: { golden: E.MAX_OWNED } });
  ok(E.kitFull(full, 'time') && E.buyKit(full, 'time') === null && E.kitFull(full, 'toolbox') && !E.kitFull(full, 'rescue'), 'a part at the max: that kit is Full, all or nothing');
  const tb = E.buyKit(W({ coins: 300 }), 'toolbox');
  ok(tb && tb.coins === 0 && E.BOOSTER_ORDER.every((b) => E.ownedCount(tb, b) === 1), 'toolbox: one of every boost');
}

// ---- sets
{
  const w0 = W({ coins: 1000 });
  ok(E.setPrice(w0, 'winter') === Math.round((E.HEN_SKINS.santa.price + E.SKINS.candy.price) * 0.75 / 10) * 10, 'set price: 75% of both parts, rounded to 10');
  const w = E.buySet(w0, 'explorer');
  ok(w && E.ownsHenSkin(w, 'pirate') && E.ownsSkin(w, 'treasure') && w.henSkin === 'pirate' && w.skin === 'treasure' && w.coins === 1000 - E.setPrice(w0, 'explorer'), 'buying a set owns and equips both');
  ok(!E.setAvailable(w, 'explorer') && E.buySet(w, 'explorer') === null, 'an owned set is gone');
  const half = W({ coins: 1000, henSkins: ['classic', 'santa'] });
  ok(!E.setAvailable(half, 'winter'), 'one part owned: the set is hidden (fewer than two parts missing)');
  ok(E.buySet(W({ coins: 10 }), 'storm') === null, 'too few coins: null');
}

// ---- free samples
{
  const d1 = '2026-11-20', d2 = '2026-11-21';
  let w = W({ owned: { stone: 2 } });
  const s1 = E.sampleFor(w, d1);
  ok(!s1.video && !s1.done && s1.id !== 'stone', 'first sample: a boost the player does not hold, no video');
  w = E.claimSample(w, d1);
  ok(w && E.ownedCount(w, s1.id) === 1 && w.sampled.includes(s1.id), 'claimed: the boost is added and remembered');
  ok(E.sampleFor(w, d1).done && E.claimSample(w, d1) === null, 'once a day');
  ok(E.sampleFor(w, d1).id === s1.id, 'today\'s tile keeps showing what was claimed');
  const s2 = E.sampleFor(w, d2);
  ok(!s2.done && s2.id !== s1.id && !s2.video, 'next day: another boost never sampled');
  const all = W({ sampled: E.BOOSTER_ORDER.slice() });
  const v = E.sampleFor(all, d1);
  ok(v.video && E.BOOSTERS[v.id] && E.sampleFor(all, d1).id === v.id, 'all seven sampled: today\'s boost for a video, stable for the day');
  const days = new Set(['2026-11-20', '2026-11-21', '2026-11-22', '2026-11-23', '2026-11-24', '2026-11-25'].map((d) => E.sampleFor(all, d).id));
  ok(days.size > 1, 'the free boost rotates by date');
  const maxed = E.claimSample(W({ coins: 0, sampled: E.BOOSTER_ORDER.slice(), owned: Object.fromEntries(E.BOOSTER_ORDER.map((b) => [b, E.MAX_OWNED])) }), d1);
  ok(maxed && maxed.coins === E.BOOSTERS[v.id].price, 'a boost at the max is paid at its coin price');
  ok(E.sanitizeWallet({ sampled: ['stone', 'nope', 'stone'], sampleDay: 3 }).sampled.join() === 'stone', 'sanitize: sampled kept clean');
}

// ---- the bonus chest
{
  const a = E.bonusChest(14), b = E.bonusChest(14);
  ok(a.coins === 40 && a.booster === b.booster && E.BOOSTERS[a.booster], 'bonus chest: 40 coins and a boost picked by the level id');
  const w = E.openBonusChest(W({ coins: 5 }), 14);
  ok(w.coins === 45 && E.ownedCount(w, a.booster) === 1, 'opened: coins and the boost paid');
  globalThis.location = { search: '?shop=app' }; globalThis.__DEV__ = true; // the dev build's app-shop preview: real money shown
  const { ads, INTER } = await import('../src/ads.js');
  ok(ads.moneyShop && INTER.on === false, 'no interstitials in the app');
  ok(!ads.bonusDue({ levelId: 20 }), 'not before INTER.levels levels went by');
  for (let i = 0; i < INTER.levels; i++) await ads.between({ levelId: 20 });
  ok(!ads.bonusDue({ levelId: INTER.from - 1 }), 'never before level INTER.from');
  ok(!ads.bonusDue({ levelId: 20, frustrated: true }), 'never on a losing streak');
  ok(ads.bonusDue({ levelId: 20 }), 'due by the old cadence');
  ads.noteBonus();
  ok(!ads.bonusDue({ levelId: 20 }), 'shown: the cadence starts again');
}

// ---- try it free (the Director's trials, eggs and hen outfits)
{
  const s = { unlocked: 12, wallet: W() };
  ok(DR.canTry(s, 'hen', 'pirate', false) && !DR.canTry(s, 'hen', 'golden', false) && !DR.canTry(s, 'hen', 'pirate', true), 'an unowned outfit can be tried; the Golden Hen and owned ones cannot');
  ok(DR.startTry(s, 'hen', 'pirate', 1) && DR.trialHen(s) === 'pirate', 'trying the Pirate Captain');
  ok(!DR.canTry(s, 'hen', 'pirate', false), 'each outfit once');
  ok(DR.startTry(s, 'skin', 'galaxy', 1) && DR.trialSkin(s) === 'galaxy' && DR.trialHen(s) === 'pirate', 'an egg and an outfit can run together');
  ok(DR.startTry(s, 'hen', 'diver', 2) && DR.trialHen(s) === 'diver', 'one outfit at a time: trying another replaces it');
  for (let i = 0; i < DR.DIR.skinLevels; i++) DR.tickTrial(s);
  ok(!DR.trialHen(s) && !DR.trialSkin(s), `both end after ${DR.DIR.skinLevels} levels`);
  const n = DR.homeNudge(s, { now: 5 });
  ok(n && n.kind === 'keep' && n.what === 'skin' && n.id === 'galaxy', 'home asks "Keep it?" for the egg first');
  DR.clearKeepAsk(s, 'skin');
  const h = DR.homeNudge(s, { now: 5 });
  ok(h && h.kind === 'keep' && h.what === 'hen' && h.id === 'diver' && h.price === E.HEN_SKINS.diver.price, 'then for the outfit, at its coin price');
  DR.clearKeepAsk(s, 'hen');
  const b = { unlocked: 12, wallet: W() };
  DR.startTry(b, 'hen', 'elf', 1); b.wallet = E.buyHenSkin({ ...b.wallet, coins: 999 }, 'elf');
  for (let i = 0; i < DR.DIR.skinLevels; i++) DR.tickTrial(b);
  ok(!DR.homeNudge(b, { now: 5 }) || DR.homeNudge(b, { now: 5 }).kind !== 'keep', 'bought during the trial: no "Keep it?"');
  const e = { unlocked: 12, wallet: W() };
  DR.startTry(e, 'skin', 'lava', 1); DR.endTrial(e, 'skin');
  ok(!DR.trialSkin(e) && !DR.homeNudge(e, { now: 5 }), 'putting on something else ends a trial quietly');
  const old = { dir: { trial: { id: 'dino', left: 2 } } };
  ok(DR.trialSkin(old) === 'dino' && DR.trialHen(old) === null, 'old saves: the egg trial carries on, no hen trial');
}

// ---- TODAY'S DEAL (0.8.9): one coin item a day at 30% off, the same pick for the same day and wallet, once a day
{
  const days = Array.from({ length: 40 }, (_, i) => `2026-12-${String((i % 28) + 1).padStart(2, '0')}${i >= 28 ? 'x' : ''}`);
  const w0 = W({ coins: 5000 });
  ok(days.every((d) => JSON.stringify(E.dailyDeal(w0, d)) === JSON.stringify(E.dailyDeal(W({ coins: 5000 }), d))), 'the pick is the same for the same day and wallet');
  ok(days.every((d) => JSON.stringify(E.dailyDeal(w0, d)) === JSON.stringify(E.dailyDeal(W({ coins: 7 }), d))), 'the pick and price do not depend on the balance');
  ok(new Set(days.map((d) => E.dailyDeal(w0, d).key)).size >= 5, 'the deal changes from day to day');
  const own = W({ coins: 5000, skins: ['classic', 'galaxy', 'dino', 'pearl'], henSkins: ['classic', 'santa', 'pirate'] });
  const owned = (w, k) => { const id = k.slice(k.indexOf(':') + 1); return k.startsWith('skin:') ? E.ownsSkin(w, id) : k.startsWith('hen:') ? E.ownsHenSkin(w, id) : k.startsWith('set:') ? !E.setAvailable(w, id) : E.kitFull(w, id); };
  ok(days.every((d) => { const D = E.dailyDeal(own, d); return D && !owned(own, D.key) && !/golden$/.test(D.key.startsWith('hen:') ? D.key : ''); }), 'never an owned item (nor the Golden Hen)');
  const r10 = (n) => Math.round(n / 10) * 10;
  ok(days.every((d) => { const D = E.dailyDeal(w0, d); return D.price === r10(D.was * 0.7) && D.price % 10 === 0 && D.price < D.was; }), 'price is 30% off, rounded to 10');
  const day = days[0], D = E.dailyDeal(w0, day), b = E.buyDeal(w0, day);
  ok(b && b.coins === 5000 - D.price && (owned(b, D.key) || D.key.startsWith('kit:')), `buying it: ${D.key} for ${D.price} (was ${D.was})`);
  ok(E.buyDeal(b, day) === null && E.dailyDeal(b, day).done, 'once a day: afterwards it is "Got it"');
  const next = E.dailyDeal(b, days[1]);
  ok(next && !next.done && E.buyDeal(b, days[1]), 'a new deal the next day');
  const poor = W({ coins: 5 });
  ok(days.every((d) => E.buyDeal(poor, d) === null) && poor.coins === 5, 'too few coins: nothing bought, the wallet never goes negative');
  ok(days.every((d) => { const x = E.buyDeal(W({ coins: E.dailyDeal(w0, d).price }), d); return x && x.coins === 0; }), 'exactly enough: the balance lands on 0');
  const k = W({ coins: 5000, owned: { stone: 9 } });
  ok(days.every((d) => !['kit:rescue', 'kit:toolbox'].includes(E.dailyDeal(k, d).key)), 'a kit that would overflow a full slot is never the deal');
  const p = E.grantIap(W({ coins: 500 }), 'eggscape_premium', 'tq', 1).wallet, kp = E.dailyDeal(p, day).key;
  const p2 = E.buyHenSkin({ ...p, coins: 999 }, kp.startsWith('hen:') && kp !== 'hen:santa' ? 'santa' : 'elf');
  ok(E.dailyDeal(p2, day).key === kp, 'buying some other item does not move the day\'s deal');
  const all = E.grantIap(W(), 'eggscape_collector', 'tz', 1).wallet; all.owned = Object.fromEntries(E.BOOSTER_ORDER.map((id) => [id, 9]));
  ok(E.dailyDeal(all, day) === null && E.buyDeal({ ...all, coins: 9999 }, day) === null, 'nothing left to offer: no deal');
  ok(E.sanitizeWallet({ dealDay: 3, dealKey: {} }).dealDay === '' && E.sanitizeWallet(b).dealKey === D.key, 'the deal fields survive a save and a bad save');
}

// ---- the shop mark (0.8.14): on when the coins reach something new, off once the shop showed it, never early
{
  const it = (key, kind, price, o = {}) => ({ key, kind, price, owned: false, tried: false, ...o });
  const items = [it('skin:speckled', 'skin', 120), it('skin:golden', 'skin', 300), it('hen:pirate', 'hen', 300), it('hen:royal', 'hen', 400), it('chick:bomb', 'chick', 450),
    it('set:x', 'set', 500), it('boost:stone', 'boost', 60), it('kit:rescue', 'kit', 90), it('skin:dino', 'skin', 200, { owned: true })];
  const S = (coins, o = {}) => ({ stars: { 3: 2 }, wallet: W({ coins }), seen: {}, ...o });
  let m = DR.shopMark(S(50), { items });
  ok(!m.on && m.n === 0 && m.pick === null, 'too few coins for anything but boosts: no mark, no pick (boosts and kits never count)');
  m = DR.shopMark(S(310), { items });
  ok(m.on && m.n === 3, `310 coins: three things not owned (Speckled, Golden, Pirate), the owned Dino and the boosts not counted (n ${m.n})`);
  ok(m.pick && (m.pick.key === 'hen:pirate' || m.pick.key === 'skin:golden') && m.pick.price === 300, 'the pick is the dearest affordable egg or outfit: ' + (m.pick && m.pick.key));
  const tried = items.map((i) => (i.key === 'skin:speckled' ? { ...i, tried: true } : i));
  ok(DR.shopMark(S(310), { items: tried }).pick.key === 'skin:speckled', 'something worn on a free try comes first');
  ok(DR.shopMark(S(460), { items: items.filter((i) => i.kind === 'chick' || i.kind === 'boost') }).pick.key === 'chick:bomb', 'no egg or outfit in reach: a reached chick is the pick');
  const s = S(310); DR.seenShop(s, DR.shopMark(s, { items }));
  ok(s.seen.shopSawN === 3 && !DR.shopMark(s, { items }).on, 'the shop opened: the mark goes off');
  s.wallet = W({ coins: 420 });
  ok(DR.shopMark(s, { items }).on && DR.shopMark(s, { items }).n === 4, 'the coins reach a further item (Royal Hen): it comes back');
  const early = S(900, { stars: { 1: 3, 2: 3 } });
  ok(!DR.shopMark(early, { items }).on && DR.shopMark(early, { items }).n > 0, 'never on before level 3 is won (earlyDays)');
  const bought = S(310, { seen: { shopSawN: 3 } }), fewer = items.map((i) => (i.key === 'hen:pirate' ? { ...i, owned: true } : i));
  bought.wallet = W({ coins: 10 }); DR.seenShop(bought, DR.shopMark(bought, { items: fewer }));
  bought.wallet = W({ coins: 310 });
  ok(DR.shopMark(bought, { items: fewer }).on, 'after a purchase the count seen drops with it, so saving up again lights the mark');
}

console.log(fails ? `${fails} FAILED` : 'all shop checks passed');
process.exit(fails ? 1 : 0);
