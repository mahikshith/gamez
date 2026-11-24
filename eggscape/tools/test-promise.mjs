// What a rule promises, a page must offer (mykee, 0.8.15: "the features have to live up to the rules being built"):
// node tools/test-promise.mjs
// The rules are tested one by one elsewhere. This file checks the joins between them and the pages, the place where a
// prize was once won that no page let the player use (the eighth booster on a row that held six).
import { readFileSync, readdirSync } from 'node:fs';
import * as SP from '../src/spin.js';
import * as E from '../src/economy.js';
let bad = 0;
const ok = (c, m) => { console.log((c ? 'ok   ' : 'FAIL ') + m); if (!c) bad++; };
const src = (f) => readFileSync(new URL('../src/' + f, import.meta.url), 'utf8');
const MAIN = src('main.js'), STORE = src('ui/store.js'), SLOT = src('render/slot.js'), AUDIO = src('audio.js'), ART = src('render/villain-art.js');
const SIMS = readdirSync(new URL('../src/sim/', import.meta.url)).filter((f) => f.endsWith('.js')).map((f) => src('sim/' + f)).join('\n');

{ // every booster: a picture, a way to pick it before a level, and something in the level that reads it
  for (const b of E.BOOSTER_ORDER) {
    ok(STORE.includes(`id === '${b}'`), `${b}: has its own picture`);
    ok(new RegExp(`opts\\.${b}\\b`).test(SIMS) || new RegExp(`boost\\.${b}\\b`).test(MAIN), `${b}: the level does something with it`);
  }
  let all = true;
  for (let n = 1; n <= 14; n++) for (let fit = 2; fit <= 9; fit++) {
    const list = Array.from({ length: n }, (_, i) => i), seen = [];
    const P0 = E.pageOf(list, fit, 0), pages = P0.more ? P0.more.pages : 1;
    for (let pg = 0; pg < pages; pg++) { const P = E.pageOf(list, fit, pg); if (P.items.length + (P.more ? 1 : 0) > fit) all = false; seen.push(...P.items); }
    if (seen.length !== n || seen.some((v, i) => v !== i)) all = false;
    if (E.pageOf(list, fit, pages).items[0] !== 0) all = false; // after the last page the first comes again
  }
  ok(all, 'a row of tiles never leaves one out: 1 to 14 things in a row of 2 to 9, every one is on exactly one page');
  ok(STORE.includes('pageOf(all, fit') && STORE.includes("'strip:more'") && MAIN.includes("id === 'strip:more'"), 'the level card\'s booster row uses it, and its next-page tile is handled');
  ok(E.BOOSTER_ORDER.length + 1 > 6, '(there are more boosters than the six tiles a phone row holds, so this matters)');
}
{ // every prize of the Lucky Spin: it changes the wallet, the reveal knows its kind, the reels and the odds sheet know its row
  const rich = { ...E.defaultWallet(), coins: 100 }, kinds = new Set();
  for (const row of SP.TABLE) for (const x of [0, 0.5, 0.99]) {
    const P = SP.prizeFor(row, rich, () => x, 1); kinds.add(P.kind);
    const before = JSON.stringify(E.sanitizeWallet(rich)), after = JSON.stringify(SP.grant({ ...rich }, P));
    if (before === after) ok(false, `the ${row.id} prize (${P.kind}) changes nothing in the wallet`);
  }
  ok(true, `every prize puts something in the wallet (${[...kinds].join(', ')})`);
  for (const k of kinds) if (k !== 'coins') ok(MAIN.includes(`P.kind === '${k}'`), `the prize reveal knows a ${k}`);
  for (const o of SP.odds()) {
    ok(new RegExp(`\\b${o.id}: \\[`).test(SLOT), `row ${o.id}: has its colour on the odds sheet`);
    ok(o.kind === 'rare' || SLOT.includes(`sl.kind === '${o.kind}'`) || MAIN.includes(`s.kind === '${o.kind}'`), `row ${o.id}: has its picture on the reels`);
    ok(o.kind === 'rare' || MAIN.includes(`s.kind === '${o.kind}'`), `row ${o.id}: has its name on the odds sheet`);
  }
  ok(!/every spin wins/i.test(MAIN + SLOT) || !SP.SPIN.miss, 'no page says every spin wins while the villains can take one');
}
{ // every way to spin that the rules open has a button, and the button a handler
  const save = { unlocked: 9, wallet: { ...E.defaultWallet(), coins: 500 }, spin: { n: 5, bank: 1 } };
  const ways = new Set(); let W = SP.ways(save, 'd'); if (W.free) ways.add('free');
  SP.spin(save, 'free', 'd', () => 0.9); W = SP.ways(save, 'd'); if (W.retry) ways.add('retry'); if (W.ad) ways.add('ad'); if (W.coin != null) ways.add('coin');
  ok(ways.size === 4, 'the rules open four ways to spin: free, video, coins, Try again');
  for (const [way, id] of [['free', 'spin:go'], ['ad', 'spin:ad'], ['coin', 'spin:coin'], ['retry', 'spin:retry']]) ok(MAIN.includes(`ui.button('${id}'`) && MAIN.includes(`case '${id}'`), `${way}: a button on the page and a handler behind it`);
}
{ // the villains on the reels: each has a portrait and a voice that exists
  const m = MAIN.match(/const SPIN_VILLAINS = \{([^}]*)\}/), list = m ? [...m[1].matchAll(/(\w+): '(\w+)'/g)].map((x) => [x[1], x[2]]) : [];
  ok(list.length >= 6, `${list.length} villains can come up on the reels`);
  for (const [who, voice] of list) ok(new RegExp(`\\n  '?${who}'?\\(ctx`).test(ART) && AUDIO.includes(`'${voice}'`), `${who}: a portrait and the voice ${voice}`);
}
{ // no button without a handler: every button id written out on a page is handled somewhere
  const ids = new Set(); for (const x of (MAIN + STORE).matchAll(/ui\.button\('([a-zA-Z0-9:_-]+)'/g)) ids.add(x[1]);
  const QUIET = new Set(['dt:owned', 'owned:']); // chips that say "Yours": drawn disabled, they take no tap
  const dead = [...ids].filter((id) => !QUIET.has(id) && !(MAIN.includes(`case '${id}`) || MAIN.includes(`id === '${id}'`) || MAIN.includes(`startsWith('${id}')`) || MAIN.includes(`startsWith('${id.includes(':') ? id.slice(0, id.indexOf(':') + 1) : id}')`)));
  ok(ids.size > 60 && !dead.length, `${ids.size} buttons, none without a handler` + (dead.length ? ': ' + dead.join(' ') : ''));
}
console.log(bad ? `\n${bad} FAILED` : '\nall promise checks passed');
process.exit(bad ? 1 : 0);
