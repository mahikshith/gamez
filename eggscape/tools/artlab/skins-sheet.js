// every hen skin, idle, on the game's sky (QA sheet)
ctx.fillStyle = '#9cc8e8'; ctx.fillRect(0, 0, W, H);
const ids = window.SKIN_IDS || ['classic', 'santa', 'snowy', 'elf', 'reindeer', 'cocoa', 'royal', 'golden'];
const cols = 4, cw = W / cols, ch = H / Math.ceil(ids.length / cols);
ids.forEach((id, i) => {
  ART.hen.setHenSkin(id);
  const x = (i % cols) * cw + cw / 2, y = Math.floor(i / cols) * ch + ch * 0.58, key = 'sk' + id;
  for (let t = 0; t <= 1; t += 1 / 30) ART.hen.drawHenAnim(ctx, window.MOOD || 'idle', -999, -999, 10, t, { key, face: 1 });
  ART.hen.drawHenAnim(ctx, window.MOOD || 'idle', x, y, ch * 0.62, 1 + 1 / 30, { key, face: 1 });
  ctx.fillStyle = '#123'; ctx.font = '600 22px Fredoka'; ctx.textAlign = 'center'; ctx.fillText(id, x, Math.floor(i / cols) * ch + ch - 14);
});
ART.hen.setHenSkin('classic');
