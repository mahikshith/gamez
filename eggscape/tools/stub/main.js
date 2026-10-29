// Throwaway test stub (not part of the game): proves pipeline + portal adapter.
import { portal } from '../../src/sdk/portal.js';
const c = document.getElementById('game');
const ctx = c.getContext('2d');
c.width = innerWidth; c.height = innerHeight;
ctx.fillStyle = '#e8b44c'; ctx.fillRect(40, 40, 120, 120);
const t0 = performance.now();
window.__stub = { portal: portal.name, initMs: -1 };
portal.loadingStart();
portal.init().then(async () => {
  window.__stub.initMs = Math.round(performance.now() - t0);
  portal.loadingDone();
  const l = document.getElementById('loading'); if (l) l.remove();
  portal.gameplayStart(); portal.gameplayStart(); portal.gameplayStop();
  portal.save('{"a":1}');
  await portal.commercialBreak();
  window.__stub.rewarded = await portal.rewarded('x');
  await new Promise((r) => setTimeout(r, 700));
  window.__stub.save = await portal.loadSave();
  window.__stub.done = true;
});
