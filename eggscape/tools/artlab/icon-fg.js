// Icon round 2 foreground (transparent): the game's own hen in her gasp, the game's violet snake coming down for her
// eggs. Composited over a crop of a real in-game vault (tools/artlab/compose-icon.py).
const A = window.ICON_ARGS || {};
const S = W / 1024; ctx.save(); ctx.scale(S, S);
// the snake: from the top right, an S down toward the eggs, head low, mouth open
const pts = [];
const hx = A.hx ?? 610, hy = A.hy ?? 470;
for (let i = 0; i <= 40; i++) { const v = i / 40; pts.push({ x: hx + v * 520 + Math.sin(v * 5.5) * 70 * (1 - v * 0.3), y: hy - v * 640 + Math.sin(v * 3.2) * 30 }); }
ART.snake.drawSnake(ctx, pts, A.sr ?? 30, 1.3, { skin: 'violet', mouthOpen: A.mo ?? 0.8, wave: 0, thick: 1.1, head: A.head ?? 6.4 });
// eggs huddled bottom right
const ef = ART.title.drawEggFriend;
ef(ctx, A.e1x ?? 700, 930, 150, { kind: 'classic', rot: 0.15, face: 'scared' });
ef(ctx, A.e2x ?? 840, 950, 140, { kind: 'quail', rot: -0.1, seed: 3, face: 'scared' });
// the hen, big, left, in her gasp
const h = A.hh ?? 900;
for (let t = 0; t <= (A.ht ?? 0.8); t += 1 / 60) ART.hen.drawHenAnim(ctx, A.mood || 'gasp', -9999, -9999, 10, t, { key: 'icon', face: 1 });
ART.hen.drawHenAnim(ctx, A.mood || 'gasp', A.hxp ?? 300, A.hyp ?? 690, h, (A.ht ?? 0.8) + 1 / 60, { key: 'icon', face: 1, shadow: 0 });
ctx.restore();
