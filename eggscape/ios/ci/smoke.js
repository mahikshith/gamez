// The simulator smoke run (CI only, debug builds only): the shell runs this in the page when the environment variable
// EGG_TEST_SCRIPT holds it. It needs the dev page (window.__egg). It walks the real game by itself in real time:
// the first-run title, then a save at level 6, the level card, a level played by the planner bot, the win page, the map.
(function () {
  var w = function (ms) { return new Promise(function (r) { setTimeout(r, ms); }); };
  var log = function (s) { try { document.title = 'smoke: ' + s; } catch (e) {} };
  (async function () {
    while (!(window.__egg && __egg.G && ['title', 'levels', 'play'].indexOf(__egg.G.screen) >= 0)) await w(200);
    var E = __egg, i;
    log('title'); await w(9000);
    var st = {}; for (i = 1; i < 6; i++) st[i] = 3;
    E.setSave({ unlocked: 6, stars: st, age: '13+', wallet: { coins: 900 }, spin: { wins: 1, bank: 1, n: 5 } });
    for (i = 1; i <= 60; i++) E.save.intro[i] = 1;
    E.start(5); log('card'); await w(9000);
    for (i = 0; i < 4 && E.G.screen === 'intro'; i++) { E.press(i % 2 ? 'inext' : 'go'); await w(400); }
    if (E.G.screen === 'intro') E.G.screen = 'play';
    log('play'); await w(6000);
    E.G.autoplay = true;
    for (i = 0; i < 150 && E.G.screen === 'play'; i++) await w(1000);
    log('result ' + E.G.screen); await w(26000);
    if (E.G.screen === 'win') { E.press('next'); log('map'); await w(12000); }
    log('done ' + E.G.screen);
  })();
})();
