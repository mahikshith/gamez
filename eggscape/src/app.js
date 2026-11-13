// Android WebView proof shell glue. Everything here is a no-op unless EGG_APP is set:
// by the build (`build.mjs --target app` defines __APP__) or by the shell / a test via window.EGG_APP = true.
/* global __APP__ */
const isApp = () => (typeof __APP__ !== 'undefined' && __APP__) || (typeof window !== 'undefined' && window.EGG_APP === true);

// Haptics: through the native bridge when the shell offers it, navigator.vibrate otherwise.
export function vibrate(ms) {
  try {
    const b = typeof window !== 'undefined' && window.EggApp;
    if (isApp() && b && typeof b.vibrate === 'function') { b.vibrate(ms | 0); return; }
    if (navigator.vibrate) navigator.vibrate(ms);
  } catch (_) { /* haptics are optional */ }
}

// ---- FPS overlay: tap the top-left corner 5 times within 2 s to toggle. Zero cost while hidden (no loop, no DOM).
function fpsOverlay() {
  const WIN = 10000;
  let el = null, raf = 0, ft = [], lastT = 0, lastShow = 0;
  const stop = () => { if (raf) cancelAnimationFrame(raf); raf = 0; if (el) { el.remove(); el = null; } ft = []; };
  const tick = (now) => {
    raf = requestAnimationFrame(tick);
    if (lastT) ft.push({ t: now, d: now - lastT });
    lastT = now;
    while (ft.length && now - ft[0].t > WIN) ft.shift();
    if (now - lastShow < 250 || !ft.length || !el) return;
    lastShow = now;
    const n = ft.length;
    let sum = 0, worst = 0;
    for (const f of ft) { sum += f.d; if (f.d > worst) worst = f.d; }
    const cur = ft.slice(-10).reduce((a, f) => a + f.d, 0) / Math.min(10, n);
    const sorted = ft.map((f) => f.d).sort((a, b) => a - b);
    const refresh = 1000 / sorted[Math.floor(sorted.length * 0.1)];
    const cv = document.getElementById('game');
    el.textContent = `FPS ${(1000 / cur).toFixed(0)}  avg10s ${(1000 / (sum / n)).toFixed(1)}\nworst ${worst.toFixed(1)} ms (10s)\nrefresh ~${refresh.toFixed(0)} Hz\ncanvas ${cv ? cv.width + 'x' + cv.height : '?'}  dpr ${window.devicePixelRatio}`;
  };
  const start = () => {
    el = document.createElement('div');
    el.style.cssText = 'position:fixed;left:max(8px,env(safe-area-inset-left));top:max(60px,env(safe-area-inset-top));z-index:99999;pointer-events:none;white-space:pre;font:12px/1.35 monospace;color:#9f9;background:rgba(0,0,0,.6);padding:4px 7px;border-radius:6px';
    document.body.appendChild(el);
    lastT = 0; lastShow = 0;
    raf = requestAnimationFrame(tick);
  };
  const toggle = () => (el ? stop() : start());
  let taps = [];
  window.addEventListener('pointerdown', (e) => {
    if (e.clientX > 56 || e.clientY > 56) { taps = []; return; }
    const now = performance.now();
    taps = taps.filter((t) => now - t < 2000);
    taps.push(now);
    if (taps.length >= 5) { taps = []; toggle(); }
  }, true);
}

// installApp(handleBack): handleBack() returns true when the game consumed the back press.
// The shell calls window.__eggBack() and exits on a second press within 2 s when it returns false.
export function installApp(handleBack) {
  if (!isApp()) return;
  window.__eggBack = () => { try { return !!handleBack(); } catch (_) { return false; } };
  fpsOverlay();
}
