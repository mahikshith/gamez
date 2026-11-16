// Art lab bundle: exposes the game's renderers to a blank page for icon / sheet rendering (tools/artlab/render.cjs).
import * as hen from '../../src/render/hen.js';
import * as title from '../../src/render/title.js';
import * as allies from '../../src/render/allies.js';
import * as ui from '../../src/ui/ui.js';
import * as skins from '../../src/render/skins.js';
import * as snake from '../../src/render/snake.js';
import fontUrl from '../../assets/fonts/fredoka-600-latin.woff2';
window.ART = { hen, title, allies, ui, skins, snake, fontUrl };
window.ARTREADY = (async () => { const f = new FontFace('Fredoka', `url(${fontUrl})`, { weight: '600' }); document.fonts.add(await f.load()); })();
