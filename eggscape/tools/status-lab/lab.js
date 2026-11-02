// Lab entry: draws creature sheets on a canvas (see shoot.cjs).
import { drawEagle } from '../../src/render/v3art.js';
import { statusDraw } from '../../src/render/status.js';
import { drawCrawler, SPECIES, crawlerAnim } from '../../src/render/crawlers.js';
import { drawFish } from '../../src/render/sea.js';

const cv = () => document.getElementById('c');
const BG = { dark: '#2b3550', white: '#ffffff', snow: '#dfeaf2' };

function grid(cells, cw, ch, cols, bg, draw, label = true) {
  const rows = Math.ceil(cells.length / cols), c = cv(), dpr = 2;
  c.width = cols * cw * dpr; c.height = rows * (ch + 14) * dpr; c.style.width = cols * cw + 'px'; c.style.height = rows * (ch + 14) + 'px';
  const ctx = c.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  cells.forEach((cell, i) => {
    const x = (i % cols) * cw, y = Math.floor(i / cols) * (ch + 14);
    ctx.save();
    ctx.beginPath(); ctx.rect(x, y, cw, ch + 14); ctx.clip();
    ctx.fillStyle = cell.bg || bg; ctx.fillRect(x, y, cw, ch + 14);
    ctx.save(); ctx.translate(x + cw / 2, y + 14 + ch / 2); draw(ctx, cell, cw, ch); ctx.restore();
    if (label) { ctx.fillStyle = (cell.bg || bg) === '#ffffff' ? '#222' : '#fff'; ctx.font = '11px sans-serif'; ctx.fillText(cell.name, x + 4, y + 11); }
    ctx.restore();
  });
  return c.toDataURL('image/png');
}

const EAGLE_POSES = [
  { name: 'glide', w: { glide: 1 }, phase: 0 },
  { name: 'flap up', w: { flap: 1 }, phase: 4.4 },
  { name: 'flap mid', w: { flap: 1 }, phase: 1.6 },
  { name: 'flap down', w: { flap: 1 }, phase: 2.2 },
  { name: 'hover', w: { hover: 1 }, phase: 1, pitch: 0 },
  { name: 'dive', w: { dive: 1 }, pitch: 1.1 },
  { name: 'strike', w: { strike: 1 }, pitch: -0.2, grab: { x: 40, y: 50 } },
  { name: 'carry', w: { carry: 1 }, phase: 1.2, grab: { x: 5, y: 40 }, toes: 0.1 },
  { name: 'dazed', w: { dazed: 1 }, stars: 1 },
  { name: 'perch', w: { perch: 1 }, pitch: -0.1 },
  { name: 'bank', w: { glide: 1 }, roll: 0.8 },
  { name: 'turn', w: { glide: 1 }, turn: 0.6 },
];

window.lab = {
  sheet(name) {
    if (name === 'eagle' || name === 'eagle-close') {
      const s = name === 'eagle' ? 100 : 240, cw = name === 'eagle' ? 260 : 700, ch = name === 'eagle' ? 150 : 440;
      const cells = EAGLE_POSES.map((p, i) => ({ ...p, bg: i % 2 ? BG.white : BG.dark }));
      const dy = name === 'eagle' ? 0 : 70;
      return grid(name === 'eagle' ? cells : cells.filter((c) => ['glide', 'flap mid', 'dive', 'strike', 'dazed', 'perch'].includes(c.name)), cw, ch, name === 'eagle' ? 4 : 2, BG.dark, (ctx, c) => {
        ctx.translate(0, dy);
        drawEagle(ctx, 0, 0, s, 1.3, { w: c.w, phase: c.phase || 0, pitch: c.pitch || 0, roll: c.roll || 0, turn: c.turn || 0, grab: c.grab, toes: c.toes, stars: c.stars || 0, face: 1 });
      });
    }
    if (name === 'eagle-flap') {
      // the whole flap cycle (8 phases) plus strike and hover, tall cells so a raised wing is never cropped
      const cells = [];
      for (let i = 0; i < 8; i++) cells.push({ name: 'flap ' + i, w: { flap: 1 }, phase: i * 0.8 });
      cells.push({ name: 'strike', w: { strike: 1 }, pitch: -0.2, grab: { x: 40, y: 50 } }, { name: 'hover', w: { hover: 1 }, phase: 1 }, { name: 'carry', w: { carry: 1 }, phase: 1.2, grab: { x: 5, y: 40 }, toes: 0.1 }, { name: 'flap 9', w: { flap: 1 }, phase: 5.6 });
      return grid(cells, 330, 400, 4, BG.dark, (ctx, c) => {
        ctx.translate(0, 70);
        drawEagle(ctx, 0, 0, 200, 1.3, { w: c.w, phase: c.phase || 0, pitch: c.pitch || 0, roll: 0, turn: 0, grab: c.grab, toes: c.toes, stars: 0, face: 1 });
      });
    }
    if (name === 'eagle-big') { // the two worst raised-wing frames at 4x
      const cells = [{ name: 'flap 3', w: { flap: 1 }, phase: 2.4 }, { name: 'strike', w: { strike: 1 }, pitch: -0.2, grab: { x: 40, y: 50 } }, { name: 'flap 7', w: { flap: 1 }, phase: 5.6 }, { name: 'flap 2', w: { flap: 1 }, phase: 1.6 }];
      return grid(cells, 700, 800, 2, BG.dark, (ctx, c) => {
        ctx.translate(0, 150);
        drawEagle(ctx, 0, 0, 400, 1.3, { w: c.w, phase: c.phase || 0, pitch: c.pitch || 0, roll: 0, turn: 0, grab: c.grab, face: 1 });
      });
    }
    if (name === 'eagle-states') {
      // normal, frozen (forming, solid, cracking), thaw, stunned (zap, dizzy) at game scale (s = 100) and a close-up row
      const mk = (st, extra) => ({ st, ...extra });
      const S = (k, age, o = {}) => ({ k, age, left: 9, hold: 1.3, zap: -1, crack: 0, seed: 17, ...o });
      const cells = [
        { name: 'normal', st: null, w: { glide: 1 } },
        { name: 'frozen 0.1s', st: S('ice', 0.1), w: { glide: 1 } },
        { name: 'frozen', st: S('ice', 1), w: { flap: 1 }, phase: 2.2 },
        { name: 'cracking', st: S('ice', 3, { crack: 0.7 }), w: { flap: 1 }, phase: 2.2 },
        { name: 'thaw 0.2', st: S('thaw', 0.2, { crack: 1 }), w: { flap: 1 }, phase: 2.2 },
        { name: 'thaw 0.5', st: S('thaw', 0.5, { crack: 1 }), w: { flap: 1 }, phase: 2.2 },
        { name: 'zap 0.1', st: S('stun', 0.1, { zap: 0.33 }), w: { dazed: 1 }, stars: 1 },
        { name: 'stunned', st: S('stun', 1.2), w: { dazed: 1 }, stars: 1 },
      ].map((c, i) => ({ ...c, bg: i % 2 ? BG.white : BG.dark }));
      const sz = +(window.LAB_S || 100);
      return grid(cells, 2.9 * sz, 1.9 * sz, 4, BG.dark, (ctx, c) => {
        const box = { x0: -1.3 * sz, y0: -1.2 * sz, x1: 1.3 * sz, y1: 1.2 * sz };
        statusDraw(ctx, box, (x) => drawEagle(x, 0, 0, sz, c.st && c.st.k === 'ice' ? c.st.hold : 1.3, { w: c.w, phase: c.phase || 0, stars: c.stars || 0, face: 1, eye: c.st && c.st.k === 'ice' ? 0.5 : 1 }), c.st, { off: Math.max(2.6, sz * 0.045), crys: Math.max(1, sz / 80) });
      });
    }
    if (name.startsWith('crawler')) {
      const [, sp = 'salamander', zoom = '1'] = name.split(':'), K = 36 * +zoom, svl = SPECIES[sp].svl, sz = svl * K;
      const S = (k, age, o = {}) => ({ k, age, left: 9, hold: 1.3, zap: -1, crack: 0, seed: 17, ...o });
      const A = crawlerAnim(); for (let i = 0; i < 30; i++) A.update(0.1, { pose: 'walk', speed: 0 });
      const walk = { pose: 'walk', gait: 0.35 * sz };
      const cells = [
        { name: 'normal walk', st: null, o: walk },
        { name: 'frozen (held stride)', st: S('ice', 1), o: { ...walk, t: 1.3 } },
        { name: 'cracking', st: S('ice', 3, { crack: 0.7 }), o: walk },
        { name: 'thaw 0.2', st: S('thaw', 0.2, { crack: 1 }), o: walk },
        { name: 'thaw 0.5', st: S('thaw', 0.5, { crack: 1 }), o: walk },
        { name: 'normal idle', st: null, o: { pose: 'idle' } },
        { name: 'zap 0.1', st: S('stun', 0.1, { zap: 0.33 }), o: { pose: 'dazed' } },
        { name: 'stunned', st: S('stun', 1.2), o: { pose: 'dazed' } },
      ].map((c, i) => ({ ...c, bg: [0, 1, 2, 3].includes(i) ? (i % 2 ? BG.white : BG.dark) : (i % 2 ? BG.dark : BG.white) }));
      return grid(cells, 2.55 * sz, 1.15 * sz + 30, 4, BG.dark, (ctx, c) => {
        ctx.translate(sz * 0.9, 0);
        drawCrawler(ctx, 0, 0, sz, c.o.t || 1.3, { debug: true, ...c.o, heading: 0, status: c.st, id: 7 }, sp);
      });
    }
    if (name === 'fish') {
      const L = 0.34 * 36 * +(window.LAB_Z || 2.2);
      const S = (k, age, o = {}) => ({ k, age, left: 9, hold: 1.3, zap: -1, crack: 0, seed: 17, ...o });
      const cells = [
        { name: 'normal', st: null }, { name: 'frozen', st: S('ice', 1) }, { name: 'cracking', st: S('ice', 3, { crack: 0.7 }) },
        { name: 'thaw 0.3', st: S('thaw', 0.3, { crack: 1 }) }, { name: 'zap', st: S('stun', 0.1, { zap: 0.3 }), belly: 1 }, { name: 'stunned', st: S('stun', 1), belly: 1 },
      ].map((c, i) => ({ ...c, bg: i % 2 ? BG.white : '#1f5a8a' }));
      return grid(cells, 5 * L, 2.4 * L, 6, BG.dark, (ctx, c) => {
        for (let j = 0; j < 3; j++) {
          const x = (j - 1) * 1.3 * L, y = (j % 2 ? 0.5 : -0.4) * L, st = c.st && { ...c.st, seed: c.st.seed + j * 13 };
          statusDraw(ctx, { x0: x - L, y0: y - 1.4 * L, x1: x + L, y1: y + L }, (cc) => drawFish(cc, x, y, L, c.belly ? 0.3 * j - 0.2 : 0.1 * j, 1.3 + j, { beat: 1 + j, belly: c.belly, dizzy: c.belly }), st, { off: Math.max(1.6, L * 0.12), rim: Math.max(1, L * 0.07), crys: Math.max(0.6, L / 26), quick: true });
        }
      });
    }
    throw new Error('unknown sheet ' + name);
  },
};
