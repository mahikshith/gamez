// node tools/hen/build.mjs [--sheet out.png] : exports assets/hen/<part>.svg (cropped) + assets/hen/parts.json,
// and renders a model sheet of poses/expressions so the design can be reviewed before it goes into the rig.
import { createRequire } from 'node:module';
import { writeFileSync, mkdirSync } from 'node:fs';
import { PARTS, ORDER } from './parts.mjs';
const require = createRequire(import.meta.url);
const { chromium } = require('/opt/node22/lib/node_modules/playwright');
const OUT = new URL('../../assets/hen/', import.meta.url);
const args = process.argv.slice(2);
const sheet = args.includes('--sheet') ? args[args.indexOf('--sheet') + 1] : null;

// a pose: per part {x, y, r (deg), sx, sy, hide}; root {x, y, sx, sy, r}
const POSES = {
  idle: { show: ['eye_l', 'eye_r', 'pupil_l', 'pupil_r'] },
  happy: { show: ['eyes_happy', 'mouth', 'beak_bot'], beak_bot: { y: 10 }, wing_l: { r: 40 }, wing_r: { r: -40 } },
  cheer: { root: { y: -60, sx: 0.92, sy: 1.08 }, show: ['eyes_happy', 'mouth', 'beak_bot'], beak_bot: { y: 16 }, mouth: { sy: 1.3 },
    wing_l: { r: 118 }, wing_r: { r: -118 }, foot_l: { r: 25, y: -6 }, foot_r: { r: -25, y: -6 }, tail: { r: 18 } },
  worried: { show: ['eye_l', 'eye_r', 'pupil_l', 'pupil_r', 'brows_worry', 'sweat'], pupil_l: { sx: 0.7, sy: 0.7, x: 4 }, pupil_r: { sx: 0.7, sy: 0.7, x: 4 },
    eye_l: { sx: 1.06, sy: 1.08 }, eye_r: { sx: 1.06, sy: 1.08 }, wing_l: { r: 60 }, wing_r: { r: -60 }, root: { sx: 0.96, sy: 1.04 } },
  sad: { show: ['eyes_shut', 'brows_worry', 'tear'], root: { sx: 1.06, sy: 0.94 }, wing_l: { r: -14, y: 10 }, wing_r: { r: 14, y: 10 }, tail: { r: -14 } },
  wow: { show: ['eye_l', 'eye_r', 'pupil_l', 'pupil_r', 'mouth', 'beak_bot'], beak_bot: { y: 22 }, mouth: { sy: 1.6, y: 6 }, eye_l: { sx: 1.1, sy: 1.12 },
    eye_r: { sx: 1.1, sy: 1.12 }, wing_l: { r: 100 }, wing_r: { r: -100 }, root: { sx: 0.94, sy: 1.07 } },
};
const OPTIONAL = new Set(['eyes_happy', 'eyes_shut', 'brows_worry', 'brows_proud', 'mouth', 'beak_bot', 'tear', 'sweat', 'eye_l', 'eye_r', 'pupil_l', 'pupil_r']);

function henSVG(pose, size = 512) {
  const P = POSES[pose];
  const R = P.root || {};
  let g = '';
  for (const id of ORDER) {
    if (OPTIONAL.has(id) && !(P.show || []).includes(id)) continue;
    const t = P[id] || {};
    const [px, py] = PARTS[id].pivot;
    const tr = `translate(${(t.x || 0) + px} ${(t.y || 0) + py}) rotate(${t.r || 0}) scale(${t.sx || 1} ${t.sy || 1}) translate(${-px} ${-py})`;
    g += `<g id="${id}" transform="${tr}">${PARTS[id].svg.replaceAll('id="', `id="${pose}-`).replaceAll('url(#', `url(#${pose}-`)}</g>`;
  }
  const rt = `translate(${256 + (R.x || 0)} ${470 + (R.y || 0)}) rotate(${R.r || 0}) scale(${R.sx || 1} ${R.sy || 1}) translate(-256 -470)`;
  const sh = 1 - Math.min(0.5, Math.abs(R.y || 0) / 140);
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-30 -80 572 572" width="${size}" height="${size}">
    <ellipse cx="256" cy="474" rx="${120 * sh}" ry="${15 * sh}" fill="rgba(60,30,0,0.16)"/><g transform="${rt}">${g}</g></svg>`;
}

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1600, height: 1000 }, deviceScaleFactor: 1 });

// 1) crop + export each part
mkdirSync(OUT, { recursive: true });
const all = ORDER.map((id) => `<g id="${id}">${PARTS[id].svg}</g>`).join('');
await page.setContent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">${all}</svg>`);
const boxes = await page.evaluate((ids) => Object.fromEntries(ids.map((id) => {
  const b = document.getElementById(id).getBBox();
  return [id, [b.x, b.y, b.width, b.height]];
})), ORDER);
const meta = {};
for (const id of ORDER) {
  const pad = 14; // room for antialiasing and stroke caps
  const [x, y, w, h] = boxes[id];
  const vx = Math.floor(x - pad), vy = Math.floor(y - pad), vw = Math.ceil(w + 2 * pad), vh = Math.ceil(h + 2 * pad);
  writeFileSync(new URL(`${id}.svg`, OUT), `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${vx} ${vy} ${vw} ${vh}" width="${vw}" height="${vh}">${PARTS[id].svg}</svg>\n`);
  meta[id] = { x: vx, y: vy, w: vw, h: vh, pivot: PARTS[id].pivot };
}
writeFileSync(new URL('parts.json', OUT), JSON.stringify({ order: ORDER, ground: 470, parts: meta }, null, 1));
console.log(`exported ${ORDER.length} parts`);

// 2) model sheet
if (sheet) {
  const cells = Object.keys(POSES).map((p) => `<div class="c">${henSVG(p, 360)}<b>${p}</b></div>`).join('');
  await page.setContent(`<html><body style="margin:0;background:#FFF8EC;font:800 26px sans-serif;color:#5b3a1e">
    <div style="display:grid;grid-template-columns:repeat(3,400px);gap:10px;padding:20px">${cells}</div>
    <style>.c{display:flex;flex-direction:column;align-items:center;background:#fff;border-radius:28px;padding:10px 0 16px}</style></body></html>`);
  await page.screenshot({ path: sheet, fullPage: true });
  console.log('sheet', sheet);
}
await browser.close();
