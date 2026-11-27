// node tools/test-back.mjs : Back (0.8.17, mykee: "back button should be intuitive"). Drives the dev build (dist/dev,
// `node tools/build.mjs --target web --dev` first) through every row of the Back table: the top pop-up closes first,
// then each page goes back to the page the player came from; in play Back pauses; on the home page the game lets the
// Android shell ask for a second press. Escape on the web and the phone's Back (window.__eggBack, EGG_APP) are the same
// press (main.js backPress); both are checked.
import { createRequire } from 'node:module';
const { chromium } = createRequire(import.meta.url)('playwright'); // (as the .cjs QA tools: found through NODE_PATH)
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'), page = path.join(root, 'dist/dev/index.html');
if (!fs.existsSync(page)) { console.log('FAIL no dev build: node tools/build.mjs --target web --dev'); process.exit(1); }
const srv = http.createServer((q, r) => fs.readFile(page, (e, d) => { r.writeHead(200, { 'content-type': 'text/html' }); r.end(d); })).listen(0);
const url = `http://localhost:${srv.address().port}/?shop=app`;
let fails = 0, n = 0;
const ok = (c, m) => { n++; console.log((c ? 'ok   ' : 'FAIL ') + m); if (!c) fails++; };

const b = await chromium.launch();
const open = async (app) => {
  const p = await b.newPage({ viewport: { width: 450, height: 1000 } });
  p.errs = []; p.on('pageerror', (e) => p.errs.push(e.message));
  if (app) await p.addInitScript(() => { window.EGG_APP = true; });
  await p.goto(url);
  await p.waitForFunction(() => window.__egg && ['title', 'levels', 'play'].includes(__egg.G.screen), null, { timeout: 60000 });
  await p.evaluate(() => {
    const E = __egg; window.requestAnimationFrame = () => 0; window.F = (k) => { for (let i = 0; i < k; i++) E.frame(1 / 60); };
    window.SAVE = (unl = 20) => { const st = {}; for (let i = 1; i < unl; i++) st[i] = 2; E.setSave({ unlocked: unl, stars: st, age: '13+', wallet: { coins: 400 }, spin: { wins: 1, bank: 2, n: 5 }, seen: { pickN: 2, rsTried: 1, setOpen: 1, shopHand: 1 } }); const s = E.save; for (let i = 1; i <= 60; i++) s.intro[i] = 1; s.strikeSeen = new Proxy({}, { get: () => 1 }); E.G.toasts = []; E.G.toast = null; E.G.leftAsked = true; E.G.leaveAsk = null; E.G.remAsk = null; E.G.nudge = null; E.G.offer = null; E.G.offerTried = true; };
    window.HOME = () => { E.G.settingsOpen = false; E.G.detail = null; E.G.offer = null; E.G.album = null; E.G.screen = 'title'; E.G.screenT = 5; F(3); };
    window.PLAYING = (lv = 10) => { E.start(lv); F(20); for (let k = 0; k < 4 && E.G.screen === 'intro'; k++) { E.press(k % 2 ? 'inext' : 'go'); F(3); } if (E.G.screen === 'intro') E.G.screen = 'play'; F(30); E.G.offer = null; E.G.nudge = null; };
    window.WHERE = () => ({ screen: E.G.screen, settings: !!E.G.settingsOpen, sub: !!E.G.setSub, detail: E.G.detail || null, offer: !!E.G.offer, album: !!E.G.album, sheet: !!(E.G.spin && E.G.spin.sheet), card: E.wonder.state.card || null, modal: !!(E.G.got || E.G.detail || E.G.offer || E.G.getMore || E.G.chickBuy || E.G.treasure || E.G.leaveAsk || E.G.stuckAsk), tab: E.G.screen === 'intro' ? E.G.itab || 'level' : null });
  });
  return p;
};
const p = await open(false);
const esc = async () => { await p.keyboard.press('Escape'); await p.evaluate(() => F(20)); return p.evaluate(() => WHERE()); };
// one row: set up (in the page), check where it stands, press Back, check where it lands
const rows = [];
const row = async (name, from, setup, want) => {
  const at = await p.evaluate(setup);
  const got = await esc();
  const good = Object.entries(want).every(([k, v]) => (typeof v === 'function' ? v(got[k], got, at) : got[k] === v));
  ok(good, `${name}: Back goes to ${JSON.stringify(want, (k, v) => (typeof v === 'function' ? '(check)' : v))}${good ? '' : ' -- got ' + JSON.stringify(got) + ' at ' + JSON.stringify(at)}`);
  rows.push([name, from]);
};

await p.evaluate(() => SAVE(20));
await row('home', 'app start', () => { HOME(); return WHERE(); }, { screen: 'title' });
// 0.8.19: the first Back on home shows the hen's leave scene (STAY / LEAVE); the second is never held: the game answers false and the shell leaves
ok(await p.evaluate(() => { const E = __egg, up = !!(E.G.leaveAsk && E.G.leaveAsk.exit), second = E.back(); return up && second === false && !E.G.leaveAsk; }), 'home: Back shows the leave scene once, a second Back leaves');
await row('world map', 'home (PLAY)', () => { HOME(); __egg.press('levels'); F(30); return WHERE(); }, { screen: 'title' });
await row('level card', 'map', () => { __egg.press('levels'); F(20); __egg.press('lv:9'); F(30); return WHERE(); }, { screen: 'levels' });
// 0.8.18: the chick picker opens from the chick's face on the level card; Back closes it (the card stays), then the map
await row('chick picker', 'level card (the chick\'s face)', () => { __egg.press('levels'); F(20); __egg.press('lv:9'); F(30); __egg.press('face:chick'); F(20); return WHERE(); }, { screen: 'intro', tab: (v, got, at) => v === 'level' && at.tab === 'chicks' });
await row('level card', 'chick picker closed', () => WHERE(), { screen: 'levels' });
await row('play', 'level card', () => { PLAYING(10); return WHERE(); }, { screen: 'pause' });
// 0.8.19 (mykee: "we forgot the quit option"): Back on the pause page asks once with the leave scene; a second Back leaves to the map
await row('pause page', 'play', () => WHERE(), { screen: 'pause' });
ok(await p.evaluate(() => !!__egg.G.leaveAsk && !__egg.G.leaveAsk.exit && __egg.G.sim.state === 'play'), 'pause page: Back asks once (the leave scene), the level still in hand');
await row('leave scene', 'pause page', () => WHERE(), { screen: 'levels' });
ok(await p.evaluate(() => !__egg.G.leaveAsk), 'the second Back left: no second question');
await row('shop', 'pause page', () => { const E = __egg; PLAYING(10); E.press('pause'); F(5); const s = E.G.sim, t = s.t, tl = s.timeLeft; window.SIM0 = { s, t, tl }; E.press('shop'); F(60); return WHERE(); }, { screen: 'pause' });
ok(await p.evaluate(() => __egg.G.sim === SIM0.s && __egg.G.sim.t === SIM0.t && __egg.G.sim.timeLeft === SIM0.tl && __egg.G.sim.state === 'play'), 'shop from pause: the same level, paused, its clock did not run');
await row('Settings', 'pause page', () => { __egg.press('settings'); F(10); return WHERE(); }, { screen: 'pause', settings: false });
await row('info panel ("i")', 'pause page', () => { __egg.press('info'); F(10); return WHERE(); }, { screen: 'pause' });
await row('Practice', 'pause page', () => { __egg.press('practice'); F(10); return WHERE(); }, { screen: 'pause' });
ok(await p.evaluate(() => __egg.G.sim === SIM0.s && __egg.G.sim.state === 'play'), 'Practice from pause: the same level, paused');
await row('info panel ("i")', 'play', () => { const E = __egg; E.press('resume'); F(5); E.press('info'); F(10); return WHERE(); }, { screen: 'play' });
await row('win page', 'a won level', () => { PLAYING(9); __egg.showResult('win'); F(30); return WHERE(); }, { screen: 'levels' });
await row('fail page', 'a lost level', () => { PLAYING(9); __egg.showResult('fail'); F(30); __egg.G.stuckAsk = null; return WHERE(); }, { screen: 'levels' });
await row('"Stuck?" pop-up', 'fail page (the third loss)', () => { const E = __egg; SAVE(12); for (let n = 0; n < 3; n++) { if (n && E.G.screen === 'fail') E.press('retry'); else PLAYING(11); F(30); E.G.sim.state = 'failed'; E.endRun(false); for (let k = 0; k < 300 && E.G.screen !== 'fail'; k++) F(1); } F(100); return WHERE(); }, { screen: 'fail', modal: false });
ok(await p.evaluate(() => !__egg.G.stuckAsk), '"Stuck?" pop-up: it was up, and Back closed it ("Keep trying")');
await row('Settings', 'home', () => { HOME(); __egg.press('settings'); F(10); return WHERE(); }, { screen: 'title', settings: false });
await row('privacy page', 'Settings', () => { const E = __egg; E.press('settings'); F(5); E.press('xs:privacy'); F(10); return WHERE(); }, { settings: true, sub: false });
await row('shop', 'home', () => { HOME(); __egg.press('shop'); F(30); return WHERE(); }, { screen: 'title' });
await row('shop', 'map', () => { HOME(); __egg.press('levels'); F(20); __egg.press('shop'); F(30); return WHERE(); }, { screen: 'levels' });
await row('pay page (Unlock Everything)', 'home', () => { HOME(); __egg.press('home:premium'); F(30); return WHERE(); }, { screen: 'title', detail: null });
await row('pay page', 'an offer ("No videos")', () => { HOME(); const E = __egg; E.G.offer = { id: 'skip_videos', sku: 'eggscape_premium', fit: 1, value: 2.5, title: 'Rewards without waiting', line: 'Unlock Everything gives every reward at once.' }; F(5); E.press('of:buy'); F(30); return WHERE(); }, { screen: 'title', detail: null, offer: true });
await row('pay page', 'Settings ("No videos")', () => { HOME(); const E = __egg; E.press('settings'); F(5); E.press('set:novideo'); F(30); return WHERE(); }, { screen: 'title', detail: null, settings: true });
await row('a card in the shop', 'shop', () => { HOME(); const E = __egg; E.press('shop'); F(20); E.G.detail = 'iap:eggscape_premium'; E.G.payBack = false; F(5); return WHERE(); }, { screen: 'store', detail: null });
await row('an offer card', 'home', () => { HOME(); __egg.G.offer = { id: 'free_coins', item: 'coins', title: 'Free coins', line: 'Watch a video for coins' }; F(5); return WHERE(); }, { screen: 'title', offer: false });
await row('Extras', 'home', () => { HOME(); __egg.press('extras'); F(20); return WHERE(); }, { screen: 'title' });
await row('combo album', 'Extras', () => { HOME(); const E = __egg; E.press('extras'); F(10); E.press('xs:album'); F(20); return WHERE(); }, { screen: 'extras', album: false });
await row('Practice', 'Extras', () => { HOME(); const E = __egg; E.press('extras'); F(10); E.press('practice'); F(20); return WHERE(); }, { screen: 'extras' });
await row('Lucky Spin', 'map', () => { HOME(); const E = __egg; E.press('levels'); F(30); E.press('spin'); F(30); return WHERE(); }, { screen: 'levels' });
await row('prizes and odds', 'Lucky Spin', () => { HOME(); const E = __egg; E.press('levels'); F(30); E.press('spin'); F(30); E.press('spin:odds'); F(10); return WHERE(); }, { screen: 'spin', sheet: false });
// the side quests (a vault at a world's door on the map)
const side = async () => p.evaluate(() => { const E = __egg, w = 1, stars = {}, top = Math.min(60, w * 6 + 6); for (let i = 1; i <= top; i++) stars[i] = 2; const seen = {}; E.sidePlan().forEach((q) => { seen[q.key] = 1; });
  E.setSave({ unlocked: top + 1, stars, gates: Object.fromEntries([...Array(10).keys()].map((k) => [k, 1])), wonder: {}, side: { seen } }); E.G.offer = null; E.G.nudge = null; E.G.remAsk = null; HOME(); E.press('levels'); F(3); E.sideFocus(w); F(40); E.press('sq:' + w); for (let k = 0; k < 400 && E.G.screen !== 'wonder'; k++) F(1); F(20); });
await side();
await row('side quest card', 'map (its door)', () => WHERE(), { screen: 'levels' });
await side();
await row('side quest in play', 'its card', () => { __egg.press('wv:go'); F(30); return WHERE(); }, { screen: 'wonder', card: 'pause' });
await row('side quest pause page', 'side quest in play', () => WHERE(), { screen: 'wonder', card: null });
await row('side quest end page', 'side quest', () => { __egg.wonder.state.game.end('won'); F(200); return WHERE(); }, { screen: 'levels' });
await p.evaluate(() => SAVE(20));
await row('level card with a chick to buy (sheet)', 'map', () => { const E = __egg; E.press('levels'); F(10); E.press('lv:9'); F(20); E.G.chickBuy = 'bomb'; F(2); return WHERE(); }, { screen: 'intro', modal: false });
await p.close();

// the phone's Back (the Android shell calls window.__eggBack): the same press; false only on the home page
const q = await open(true);
const r = await q.evaluate(() => { const E = __egg, out = {}; SAVE(20); HOME(); out.homeFn = typeof window.__eggBack; out.home = window.__eggBack(); out.homeStays = E.G.screen;
  E.press('levels'); F(20); out.map = window.__eggBack(); F(10); out.mapTo = E.G.screen;
  PLAYING(10); out.play = window.__eggBack(); F(5); out.playTo = E.G.screen; out.pause = window.__eggBack(); F(5); out.pauseTo = E.G.screen;
  return out; });
ok(r.homeFn === 'function' && r.home === false && r.homeStays === 'title', 'phone Back on home: the game lets the shell ask "Press back again to leave" (returns false, stays home)');
ok(r.map === true && r.mapTo === 'title', 'phone Back on the map: home');
ok(r.play === true && r.playTo === 'pause' && r.pause === true && r.pauseTo === 'play', 'phone Back in play pauses, on the pause page resumes');
const javaToast = fs.readFileSync(path.join(root, 'android/app/src/main/java/com/eggscape/game/MainActivity.java'), 'utf8');
ok(/Press back again to leave/.test(javaToast) && /now - lastBack < 2000/.test(javaToast), 'the Android shell: a second Back within 2 s leaves, the first says "Press back again to leave"');
ok(!p.errs.length && !q.errs.length, 'no page errors' + (p.errs.length || q.errs.length ? ': ' + [...p.errs, ...q.errs].join(' | ') : ''));
await b.close(); srv.close();
console.log(fails ? `\n${fails} of ${n} FAILED` : `\nBack: all ${n} checks pass`);
process.exit(fails ? 1 : 0);
