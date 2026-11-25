// The simulator smoke run (CI only, debug builds only): the shell runs this in the page when the environment variable
// EGG_TEST_SCRIPT holds it. It needs the dev page (window.__egg). It walks the real game by itself in real time, so the
// run's screenshots show the app on an iPhone: the first-run title, the map, a level card, a level in play, the win
// page with its celebration, the Lucky Spin.
(function () {
  var w = function (ms) { return new Promise(function (r) { setTimeout(r, ms); }); };
  (async function () {
    while (!(window.__egg && __egg.G && ['title', 'levels', 'play'].indexOf(__egg.G.screen) >= 0)) await w(200);
    var E = __egg, i;
    await w(12000); // the title as a new player meets it
    var st = {}; for (i = 1; i < 6; i++) st[i] = 3;
    E.setSave({ unlocked: 6, stars: st, age: '13+', wallet: { coins: 900 }, spin: { wins: 1, bank: 1, n: 5 } });
    var s = E.save; for (i = 1; i <= 60; i++) s.intro[i] = 1;
    s.strikeSeen = new Proxy({}, { get: function () { return 1; } }); s.seen = new Proxy(s.seen || {}, { get: function () { return 1; } });
    E.G.screen = 'title'; E.press('levels'); await w(12000); // the map
    E.start(5); await w(11000); // the level card
    for (i = 0; i < 4 && E.G.screen === 'intro'; i++) { E.press(i % 2 ? 'inext' : 'go'); await w(400); }
    if (E.G.screen === 'intro') E.G.screen = 'play';
    await w(16000); // the level in play
    E.showResult('win', 3, null, 0, { goals: [{ long: '2 of 3 eggs home', ok: true, res: '3 home' }, { long: 'Lose no eggs', ok: true, res: 'None lost' }, { long: 'No cracks', ok: true, res: 'None' }], prevBest: 5000, hotB: [] });
    await w(26000); // the celebration, then the win page
    E.press('spin'); await w(12000); // the Lucky Spin
  })();
})();
