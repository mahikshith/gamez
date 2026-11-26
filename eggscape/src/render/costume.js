// World costumes for the raccoons (0.8.18 kits: "as per the world we could modify the raccoon as well: for icy worlds a
// different kind of raccoon with a different costume"). Light overlays drawn on the same rigs (render/raccoon.js mama and
// Bandit, render/kits.js the kits), in the rig's own head / torso frame, y down, facing +x. One idea each, readable at a
// glance on a phone:
//   ice      a striped woolly hat with a pompom, a scarf with a fluttering tail, frost on the whiskers
//   woods    a big leaf worn as a cap, a daisy tucked by the ear
//   sea      a snorkel mask pushed up on the forehead with its tube, a shell necklace
//   cave     a miner's hard hat with a little lamp (a soft beam; none in calm), a neckerchief
//   goggles  soot-smudged brass goggles up on the forehead, soot on the cheeks, a red bandana
//   bow      (no world: mama's own) a polka-dot bow
// H (the head frame): { top (y of the skull top over its middle), cx (that middle's x), w (half the skull's width), ear
// [x, y] (the near ear's root), s (size: 1 for the grown raccoon) }; N (the neck): { x, y (the front of the neck), w }.
// costumeHead(ctx, kind, H, lw, t, o) / costumeNeck(ctx, kind, N, lw, t, o); o: { calm, frozen, flap (0..1 the scarf's
// flutter), soot (0..1), low (PERF.low: no beam, fewer details) }
const TAU = Math.PI * 2;
const INK = '#221622';
export const COSTUMES = ['ice', 'woods', 'sea', 'cave', 'goggles'];
// a world theme to its costume (levels may name one: level.kits.costume)
export function costumeOf(theme) {
  const t = String(theme || '');
  if (/frozen|blizzard|ice|snow/.test(t)) return 'ice';
  if (/jungle|bramble|mushroom|wood|forest/.test(t)) return 'woods';
  if (/reef|sea|bayou|beach|pond/.test(t)) return 'sea';
  if (/crystal|cave|mine/.test(t)) return 'cave';
  if (/volcano|storm|lab|clock|vault/.test(t)) return 'goggles';
  return 'bow';
}
function ink(c, fill, lw, line = INK) { c.lineWidth = lw * 2; c.strokeStyle = line; c.lineJoin = 'round'; c.stroke(); c.fillStyle = fill; c.fill(); }

// ------------------------------------------------------------------ hats and things on the head
export function costumeHead(ctx, kind, H, lw, t, o = {}) {
  const c = ctx, s = H.s || 1, cx = H.cx, top = H.top, w = H.w;
  c.save(); c.lineCap = 'round'; c.lineJoin = 'round';
  try {
    if (kind === 'ice') { // a woolly beanie: ribbed brim, two stripes, a pompom that bobs
      const by = top + 6 * s, bob = o.calm ? 0 : Math.sin(t * 5.2) * 1.6 * s;
      const dome = () => { c.beginPath(); c.moveTo(cx - w * 0.98, by); c.bezierCurveTo(cx - w * 1.0, top - 19 * s, cx + w * 0.85, top - 21 * s, cx + w * 0.92, by - 1 * s); c.closePath(); };
      dome(); ink(c, '#3a8fd6', lw);
      c.save(); dome(); c.clip();
      c.fillStyle = '#f4f8ff'; for (const k of [0.32, 0.62]) { const y = by - (by - (top - 19 * s)) * k; c.fillRect(cx - w * 1.2, y - 2.6 * s, w * 2.4, 5.2 * s); }
      c.fillStyle = 'rgba(255,255,255,0.35)'; c.beginPath(); c.ellipse(cx - w * 0.45, top - 10 * s, w * 0.28, 4 * s, -0.35, 0, TAU); c.fill();
      c.restore();
      // the brim: a fat ribbed band
      c.beginPath(); c.moveTo(cx - w * 1.04, by + 5 * s); c.quadraticCurveTo(cx, by - 3 * s, cx + w * 0.98, by + 4 * s); c.lineTo(cx + w * 0.96, by - 4 * s); c.quadraticCurveTo(cx, by - 11 * s, cx - w * 1.02, by - 3 * s); c.closePath(); ink(c, '#e9f1fb', lw);
      c.beginPath(); for (let i = 1; i < 9; i++) { const x = cx - w + (i * 2 * w) / 9; c.moveTo(x, by - 5 * s + Math.abs(x - cx) * 0.06); c.lineTo(x, by + 2.5 * s + Math.abs(x - cx) * 0.06); } c.lineWidth = lw * 0.6; c.strokeStyle = '#9fb6cf'; c.stroke();
      // pompom
      const px = cx - w * 0.1, py = top - 21 * s + bob;
      c.beginPath(); for (let i = 0; i <= 14; i++) { const a = (i / 14) * TAU, r = 7.5 * s * (1 + 0.12 * Math.sin(a * 5)); c.lineTo(px + Math.cos(a) * r, py + Math.sin(a) * r); } c.closePath(); ink(c, '#ffffff', lw);
      c.fillStyle = '#d6e4f2'; c.beginPath(); c.ellipse(px + 2 * s, py + 2.5 * s, 4 * s, 3 * s, 0, 0, TAU); c.fill();
    } else if (kind === 'woods') { // a big leaf worn as a cap (stalk forward), a daisy by the ear
      const lx = cx - 2 * s, ly = top - 3 * s, L = w * 1.25, W = 11 * s, tw = o.calm ? 0 : Math.sin(t * 2.1) * 0.05;
      c.save(); c.translate(lx, ly); c.rotate(-0.12 + tw);
      const leaf = () => { c.beginPath(); c.moveTo(-L, 4 * s); c.bezierCurveTo(-L * 0.6, -W * 1.5, L * 0.55, -W * 1.5, L, 0); c.bezierCurveTo(L * 0.55, W * 0.8, -L * 0.5, W * 0.9, -L, 4 * s); c.closePath(); };
      leaf(); ink(c, '#4fae3a', lw);
      c.save(); leaf(); c.clip(); c.fillStyle = '#7fd05a'; c.beginPath(); c.ellipse(-L * 0.25, -W * 0.7, L * 0.55, W * 0.45, -0.1, 0, TAU); c.fill(); c.restore();
      c.beginPath(); c.moveTo(-L * 0.92, 3 * s); c.quadraticCurveTo(0, -W * 0.3, L * 0.95, 0); for (let i = 1; i < 5; i++) { const x = -L + (i * 2 * L) / 5.4, y = -W * 0.28 + Math.abs(x) * 0.02; c.moveTo(x, y); c.lineTo(x + 7 * s, y - 7 * s); c.moveTo(x, y); c.lineTo(x + 6 * s, y + 5 * s); } c.lineWidth = lw * 0.6; c.strokeStyle = '#2f7a24'; c.stroke();
      c.beginPath(); c.moveTo(L, 0); c.quadraticCurveTo(L + 5 * s, -2 * s, L + 7 * s, 3 * s); c.lineWidth = lw * 1.6; c.strokeStyle = INK; c.stroke(); c.lineWidth = lw * 0.8; c.strokeStyle = '#6b4a22'; c.stroke(); // the stalk
      c.restore();
      // a daisy at the near ear
      const [ex, ey] = H.ear, fr = 4.2 * s;
      c.save(); c.translate(ex - 3 * s, ey + 3 * s); c.rotate(o.calm ? 0 : Math.sin(t * 1.7) * 0.15);
      for (let i = 0; i < 7; i++) { const a = (i / 7) * TAU; c.beginPath(); c.ellipse(Math.cos(a) * fr, Math.sin(a) * fr, fr * 0.85, fr * 0.45, a, 0, TAU); ink(c, '#ffffff', lw * 0.55); }
      c.beginPath(); c.arc(0, 0, fr * 0.62, 0, TAU); ink(c, '#ffc93a', lw * 0.55);
      c.restore();
    } else if (kind === 'sea') { // a snorkel mask pushed up on the forehead, the strap round the head, the tube beside it
      const my = top + 1 * s, mx = cx + w * 0.22;
      c.beginPath(); c.moveTo(cx - w * 1.02, my + 4 * s); c.quadraticCurveTo(cx - w * 0.2, my - 4 * s, mx, my); c.lineWidth = lw * 2 + 5 * s; c.strokeStyle = INK; c.stroke(); c.lineWidth = 5 * s; c.strokeStyle = '#ff7a2a'; c.stroke(); // strap
      // the tube: up behind the head from the strap, a bend and an orange cap
      c.beginPath(); c.moveTo(cx - w * 0.75, my + 2 * s); c.lineTo(cx - w * 0.82, top - 16 * s); c.quadraticCurveTo(cx - w * 0.8, top - 23 * s, cx - w * 0.6, top - 22 * s); c.lineWidth = lw * 2 + 6 * s; c.strokeStyle = INK; c.stroke(); c.lineWidth = 6 * s; c.strokeStyle = '#ffd23a'; c.stroke();
      c.beginPath(); c.ellipse(cx - w * 0.56, top - 22 * s, 3.4 * s, 4.2 * s, 0.3, 0, TAU); ink(c, '#ff5a2a', lw * 0.7);
      // the mask: a rounded rim with a pale blue glass
      const mw = 15 * s, mh = 9 * s;
      c.beginPath(); c.ellipse(mx, my - 2 * s, mw, mh, -0.08, 0, TAU); ink(c, '#2ab6d0', lw);
      c.beginPath(); c.ellipse(mx + 0.5 * s, my - 2 * s, mw * 0.74, mh * 0.62, -0.08, 0, TAU); c.fillStyle = '#bff0ff'; c.fill(); c.lineWidth = lw * 0.6; c.strokeStyle = '#167a8c'; c.stroke();
      c.fillStyle = 'rgba(255,255,255,0.9)'; c.beginPath(); c.ellipse(mx - mw * 0.32, my - mh * 0.5, mw * 0.18, mh * 0.16, -0.4, 0, TAU); c.fill();
    } else if (kind === 'cave') { // a yellow hard hat with a lamp at the front (a soft beam forward)
      const by = top + 3 * s;
      if (!o.calm && !o.low) { // the beam (a soft wedge, flickering a little)
        const k = 0.12 + 0.03 * Math.sin(t * 9) * Math.sin(t * 3.3), lx = cx + w * 0.55, ly = top - 9 * s; // (short: it lit half the vault)
        c.save(); c.globalAlpha *= k; c.fillStyle = '#fff2a0'; c.beginPath(); c.moveTo(lx, ly - 2 * s); c.lineTo(lx + 48 * s, ly - 13 * s); c.lineTo(lx + 48 * s, ly + 15 * s); c.closePath(); c.fill(); c.restore();
      }
      const dome = () => { c.beginPath(); c.moveTo(cx - w * 0.92, by); c.bezierCurveTo(cx - w * 0.95, top - 21 * s, cx + w * 0.85, top - 22 * s, cx + w * 0.88, by); c.closePath(); };
      dome(); ink(c, '#f2c21e', lw);
      c.save(); dome(); c.clip(); c.fillStyle = '#ffe36a'; c.beginPath(); c.ellipse(cx - w * 0.3, top - 12 * s, w * 0.4, 5 * s, -0.3, 0, TAU); c.fill(); c.fillStyle = '#d29a0a'; c.fillRect(cx - 2 * s, top - 26 * s, 4 * s, 30 * s); c.restore();
      c.beginPath(); c.moveTo(cx - w * 1.08, by + 2 * s); c.quadraticCurveTo(cx, by - 5 * s, cx + w * 1.1, by + 1 * s); c.lineTo(cx + w * 1.08, by - 3 * s); c.quadraticCurveTo(cx, by - 9 * s, cx - w * 1.05, by - 2 * s); c.closePath(); ink(c, '#e0a812', lw); // brim
      const lx = cx + w * 0.55, ly = top - 9 * s;
      c.beginPath(); c.rect(lx - 6 * s, ly - 4.5 * s, 7 * s, 9 * s); ink(c, '#6a6f7a', lw * 0.7);
      c.beginPath(); c.arc(lx + 1.5 * s, ly, 4.6 * s, 0, TAU); ink(c, '#fff6c8', lw * 0.7);
      c.fillStyle = '#ffffff'; c.beginPath(); c.arc(lx + 0.4 * s, ly - 1.4 * s, 1.6 * s, 0, TAU); c.fill();
    } else if (kind === 'goggles') { // brass goggles up on the forehead, glass dark with soot
      const gy = top - 1 * s, g1 = cx + w * 0.42, g0 = cx - w * 0.22, R = 7.6 * s;
      c.beginPath(); c.moveTo(cx - w * 1.02, gy + 3 * s); c.quadraticCurveTo(cx, gy - 4 * s, cx + w * 0.95, gy + 1 * s); c.lineWidth = lw * 2 + 5 * s; c.strokeStyle = INK; c.stroke(); c.lineWidth = 5 * s; c.strokeStyle = '#5a3a22'; c.stroke();
      c.beginPath(); c.moveTo(g0 + R * 0.8, gy - 1 * s); c.lineTo(g1 - R * 0.8, gy - 1.5 * s); c.lineWidth = lw * 2 + 3 * s; c.strokeStyle = INK; c.stroke(); c.lineWidth = 3 * s; c.strokeStyle = '#b8842a'; c.stroke(); // the bridge
      for (const [x, y, r] of [[g0, gy - 1 * s, R * 0.92], [g1, gy - 2 * s, R]]) {
        c.beginPath(); c.arc(x, y, r, 0, TAU); ink(c, '#d6a23a', lw);
        c.beginPath(); c.arc(x, y, r * 0.68, 0, TAU); c.fillStyle = '#3b4652'; c.fill(); c.lineWidth = lw * 0.6; c.strokeStyle = '#7a5418'; c.stroke();
        c.fillStyle = 'rgba(40,30,30,0.55)'; c.beginPath(); c.ellipse(x + r * 0.2, y + r * 0.2, r * 0.42, r * 0.3, 0.5, 0, TAU); c.fill(); // soot
        c.fillStyle = 'rgba(255,255,255,0.75)'; c.beginPath(); c.ellipse(x - r * 0.25, y - r * 0.28, r * 0.2, r * 0.13, -0.6, 0, TAU); c.fill();
      }
    } else if (kind === 'bow') { // mama's own: a polka-dot bow by the ear
      const [ex, ey] = H.ear, r = 6 * s;
      c.save(); c.translate(ex + 4 * s, ey - 2 * s); c.rotate(-0.3);
      for (const sg of [-1, 1]) { c.beginPath(); c.moveTo(0, 0); c.bezierCurveTo(sg * r * 1.2, -r * 1.3, sg * r * 2.1, -r * 0.4, sg * r * 1.9, r * 0.5); c.bezierCurveTo(sg * r * 1.4, r * 1.1, sg * r * 0.5, r * 0.6, 0, 0); c.closePath(); ink(c, '#ee5a8a', lw * 0.7); }
      c.fillStyle = '#ffd0e0'; for (const [x, y] of [[-r * 1.2, -r * 0.1], [r * 1.25, 0], [-r * 0.8, r * 0.45], [r * 0.7, -r * 0.45]]) { c.beginPath(); c.arc(x, y, r * 0.22, 0, TAU); c.fill(); }
      c.beginPath(); c.arc(0, 0, r * 0.45, 0, TAU); ink(c, '#d83a6a', lw * 0.7);
      c.restore();
    }
  } finally { c.restore(); }
}
// soot smudges on the face (goggles) and frost on the whiskers (ice): drawn over the face, under the hat. F: { nose [x, y],
// cheek [x, y] (the far-side cheek), s }
export function costumeFace(ctx, kind, F, lw, t, o = {}) {
  const c = ctx, s = F.s || 1;
  if (kind === 'goggles') {
    c.save(); c.fillStyle = 'rgba(40,32,36,0.45)';
    for (const [x, y, rx, ry, r] of [[F.cheek[0], F.cheek[1], 5 * s, 2.6 * s, 0.3], [F.nose[0] - 6 * s, F.nose[1] - 6 * s, 3.4 * s, 2 * s, -0.4], [F.cheek[0] - 22 * s, F.cheek[1] + 3 * s, 4 * s, 2 * s, 0.6]]) { c.beginPath(); c.ellipse(x, y, rx, ry, r, 0, TAU); c.fill(); }
    c.restore();
  } else if (kind === 'ice') { // frost on the whisker tips: little pale crystals
    c.save(); c.fillStyle = '#e8f6ff'; c.strokeStyle = '#7ab4d8'; c.lineWidth = Math.max(0.6, lw * 0.4);
    for (const [x, y] of F.tips || []) { c.beginPath(); for (let i = 0; i < 6; i++) { const a = (i / 6) * TAU + 0.3, r = (i % 2 ? 1.2 : 2.6) * s; c.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r); } c.closePath(); c.fill(); c.stroke(); }
    c.restore();
  }
}
// ------------------------------------------------------------------ round the neck
export function costumeNeck(ctx, kind, N, lw, t, o = {}) {
  const c = ctx, s = N.s || 1, x = N.x, y = N.y, w = N.w;
  c.save(); c.lineCap = 'round'; c.lineJoin = 'round';
  try {
    if (kind === 'ice') { // a scarf: a band across the neck and a tail that flutters behind
      const fl = o.calm ? 0.3 : 0.5 + 0.5 * Math.sin(t * 6), fl2 = o.calm ? 0 : Math.sin(t * 6 - 1.2);
      const tail = () => { c.beginPath(); c.moveTo(x - w * 0.7, y - 1 * s); c.bezierCurveTo(x - w * 1.3, y + 6 * s, x - w * 1.8 - 4 * fl * s, y + 10 * s + 3 * fl2 * s, x - w * 2.2 - 6 * fl * s, y + 14 * s + 4 * fl2 * s); c.lineTo(x - w * 2.0 - 6 * fl * s, y + 22 * s + 4 * fl2 * s); c.bezierCurveTo(x - w * 1.5, y + 18 * s, x - w * 1.0, y + 12 * s, x - w * 0.4, y + 6 * s); c.closePath(); };
      tail(); ink(c, '#d8333a', lw);
      const band = () => { c.beginPath(); c.moveTo(x - w, y - 4 * s); c.quadraticCurveTo(x, y + 4 * s, x + w, y - 5 * s); c.lineTo(x + w * 0.96, y + 5 * s); c.quadraticCurveTo(x, y + 13 * s, x - w * 1.02, y + 6 * s); c.closePath(); };
      band(); ink(c, '#e8463c', lw);
      c.save(); band(); c.clip(); c.fillStyle = '#fff4ea'; for (let i = -3; i <= 3; i++) { c.save(); c.translate(x + i * 8 * s, y + 4 * s); c.rotate(0.5); c.fillRect(-1.6 * s, -12 * s, 3.2 * s, 24 * s); c.restore(); } c.restore();
      c.beginPath(); for (let i = 0; i < 4; i++) { const k = 0.2 + i * 0.2; c.moveTo(x - w * (2.2 - 0.05 * i) - 6 * fl * s, y + (14 + 2 * i) * s + 4 * fl2 * s); c.lineTo(x - w * (2.3 - 0.05 * i) - 6 * fl * s - 3 * s, y + (16 + 2 * i) * s + 4 * fl2 * s); } c.lineWidth = lw * 0.9; c.strokeStyle = '#a81e26'; c.stroke(); // fringe
    } else if (kind === 'sea') { // a string of shells
      c.beginPath(); c.moveTo(x - w, y - 2 * s); c.quadraticCurveTo(x, y + 9 * s, x + w, y - 3 * s); c.lineWidth = lw * 0.9; c.strokeStyle = '#6a4a2a'; c.stroke();
      const cols = ['#ffb0a0', '#fff0d6', '#ffd27a', '#fff0d6', '#ffb0a0'];
      for (let i = 0; i < 5; i++) {
        const k = (i + 0.5) / 5, px = x - w + 2 * w * k, py = y - 2 * s + 4 * (1 - (2 * k - 1) ** 2) * 2.6 * s, r = (i === 2 ? 4.6 : 3.4) * s;
        c.save(); c.translate(px, py + r * 0.6); c.rotate((k - 0.5) * 0.6);
        c.beginPath(); c.moveTo(0, -r * 0.9); c.bezierCurveTo(r * 1.3, -r * 0.6, r * 1.2, r * 0.9, 0, r); c.bezierCurveTo(-r * 1.2, r * 0.9, -r * 1.3, -r * 0.6, 0, -r * 0.9); c.closePath(); ink(c, cols[i], lw * 0.55);
        c.beginPath(); for (const a of [-0.5, 0, 0.5]) { c.moveTo(0, -r * 0.7); c.lineTo(Math.sin(a) * r * 0.9, r * 0.8); } c.lineWidth = lw * 0.4; c.strokeStyle = '#b06a4a'; c.stroke();
        c.restore();
      }
    } else if (kind === 'cave' || kind === 'goggles') { // a neckerchief knotted at the front
      const col = kind === 'cave' ? '#3f7fd0' : '#d8392e', dot = kind === 'cave' ? '#d6e8ff' : '#ffe0d0';
      const band = () => { c.beginPath(); c.moveTo(x - w, y - 3 * s); c.quadraticCurveTo(x, y + 4 * s, x + w, y - 4 * s); c.lineTo(x + w * 0.95, y + 3 * s); c.lineTo(x + w * 0.25, y + 16 * s); c.lineTo(x - w * 0.4, y + 6 * s); c.quadraticCurveTo(x - w * 0.8, y + 4 * s, x - w * 1.02, y + 3 * s); c.closePath(); };
      band(); ink(c, col, lw);
      c.save(); band(); c.clip(); c.fillStyle = dot; for (const [dx, dy] of [[-0.6, 0.2], [-0.1, 0.5], [0.4, 0.3], [0.25, 0.9], [0.8, 0.0]]) { c.beginPath(); c.arc(x + dx * w, y + dy * 10 * s, 1.5 * s, 0, TAU); c.fill(); } c.restore();
      c.beginPath(); c.arc(x + w * 0.62, y - 0.5 * s, 3 * s, 0, TAU); ink(c, col, lw * 0.7); // the knot
    }
  } finally { c.restore(); }
}
