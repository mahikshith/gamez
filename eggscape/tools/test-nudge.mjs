// The level card's PLAY nudge rule (src/ui/nudge.js): node tools/test-nudge.mjs
import { playNudge } from '../src/ui/nudge.js';
let bad = 0;
const ok = (c, m) => { console.log((c ? 'ok   ' : 'FAIL ') + m); if (!c) bad++; };
const order = ['stone', 'golden', 'time', 'rewind', 'sponge', 'nest', 'snips', 'scare'];
const base = { won3: true, owned: { golden: 1, nest: 2 }, order, first: [], last: [], hide: [], ticked: 0, nudged: false };
ok(playNudge(base) === 'golden', 'owns two that fit, ticked none: points at the first in the strip');
ok(playNudge({ ...base, ticked: 1 }) === null, 'one ticked: PLAY starts');
ok(playNudge({ ...base, nudged: true }) === null, 'the second tap starts (once per card opening)');
ok(playNudge({ ...base, won3: false }) === null, 'before level 3 is won: never');
ok(playNudge({ ...base, owned: {} }) === null, 'owns none: never (no selling here)');
ok(playNudge({ ...base, owned: { golden: 0, scare: 0 } }) === null, 'counts of 0 are not owned');
ok(playNudge({ ...base, owned: { scare: 1 }, last: ['scare'] }) === null, 'owns only one with no use on this level: never');
ok(playNudge({ ...base, owned: { golden: 1, snips: 1 }, first: ['snips'] }) === 'snips', 'the one this level has a clear use for leads');
ok(playNudge({ ...base, owned: { golden: 1 }, hide: ['golden'] }) === null, 'a booster not offered here (the golden-shell ad gave one) does not count');
ok(playNudge(null) === null, 'no state: PLAY starts');
console.log(bad ? `${bad} FAILED` : 'all ok');
process.exit(bad ? 1 : 0);
