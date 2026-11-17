// Shaped rings (v3.3 M10): square, hex and spiral rings are drawn by the shared ring painter (render/ringart.js), which
// lays every band, seam and bevel out in the ring's (rad, angle) coordinates through ringPt. This file keeps the
// rocking vault's gauge. ctx is in world space (metres, y up).
import { TAU } from '../sim/geom.js';
import { rockAt } from '../sim/shapes.js';

// The rocking vault: a spirit level over the vault shows the lean, and before each swing two chunky arrows round the
// vault pulse the way it is about to lean (fair warning, like the hot glow before thorns spring out).
export function drawRockHud(ctx, sim, k, t) {
  const K = sim.rock;
  if (!K) return;
  const R = rockAt(K, sim.t), px = 1 / k, top = sim.outerR + 0.42;
  // spirit level: a vial that leans with the vault, the bubble runs to the high end
  ctx.save();
  ctx.translate(0, top);
  ctx.rotate(R.a);
  const w = 0.95, h = 0.2;
  ctx.fillStyle = '#5a3a20';
  ctx.strokeStyle = '#1e120a';
  ctx.lineWidth = Math.max(2 * px, 0.02);
  ctx.beginPath(); ctx.roundRect(-w / 2 - 0.08, -h / 2 - 0.06, w + 0.16, h + 0.12, 0.08); ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#c8f06a';
  ctx.beginPath(); ctx.roundRect(-w / 2, -h / 2, w, h, h / 2); ctx.fill();
  ctx.strokeStyle = 'rgba(30,50,10,0.8)';
  ctx.lineWidth = Math.max(1.2 * px, 0.012);
  ctx.stroke();
  ctx.beginPath(); ctx.moveTo(-0.1, -h / 2); ctx.lineTo(-0.1, h / 2); ctx.moveTo(0.1, -h / 2); ctx.lineTo(0.1, h / 2); ctx.stroke();
  const bx = Math.max(-1, Math.min(1, -R.a / K.amp)) * (w / 2 - h / 2);
  ctx.fillStyle = '#ffffff';
  ctx.beginPath(); ctx.ellipse(bx, 0, h * 0.62, h * 0.36, 0, 0, TAU); ctx.fill();
  ctx.restore();
  if (!(R.warn > 0) || !R.next) return;
  // warning arrows on both sides, curling the way the vault will turn
  const dir = Math.sign(R.next), pulse = 0.55 + 0.45 * Math.sin(t * 14), rr = sim.outerR + 0.3;
  ctx.save();
  ctx.globalAlpha = Math.min(1, R.warn * 2) * pulse;
  ctx.strokeStyle = '#ff9d2e';
  ctx.fillStyle = '#ff9d2e';
  ctx.lineCap = 'round';
  for (const mid of [0, Math.PI]) {
    const a0 = mid - dir * 0.3, a1 = mid + dir * 0.3;
    ctx.lineWidth = Math.max(0.2, 9 * px);
    ctx.strokeStyle = '#2a1408';
    ctx.beginPath(); ctx.arc(0, 0, rr, Math.min(a0, a1), Math.max(a0, a1)); ctx.stroke();
    ctx.lineWidth = Math.max(0.12, 5 * px);
    ctx.strokeStyle = '#ff9d2e';
    ctx.beginPath(); ctx.arc(0, 0, rr, Math.min(a0, a1), Math.max(a0, a1)); ctx.stroke();
    const hx = rr * Math.cos(a1), hy = rr * Math.sin(a1), tx = -Math.sin(a1) * dir, ty = Math.cos(a1) * dir, nx = Math.cos(a1), ny = Math.sin(a1), hs = Math.max(0.3, 12 * px);
    ctx.beginPath();
    ctx.moveTo(hx + tx * hs * 1.3, hy + ty * hs * 1.3);
    ctx.lineTo(hx + nx * hs, hy + ny * hs);
    ctx.lineTo(hx - nx * hs, hy - ny * hs);
    ctx.closePath();
    ctx.lineWidth = Math.max(0.04, 2 * px);
    ctx.strokeStyle = '#2a1408';
    ctx.fill();
    ctx.stroke();
  }
  ctx.restore();
}
