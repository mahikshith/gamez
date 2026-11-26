// Teaching moments (0.8.18, the owner: "whenever a villain enters the game, we are showing information for a split second
// ... let the user turn the rings ... with a proper finger animation, for only one or two times ... Give a split second or
// 1 or 2 seconds for them to see what is going on ... if they skipped the level they might not have seen the villain").
// The guidelines are in docs/teaching.md. This file is pure (no canvas, no sim): the rules, the table of lessons and the
// clock arithmetic, so tools/test-teach.mjs can prove them. src/main.js plays the moment (lesson*).
//
// A SUBJECT is a villain, a hazard or a power move that used to raise a text tip (its old tip key), or 'lv:<id>' for a
// level's own opening caption. save.met[subject] counts the MEETINGS: one per level try in which it showed up, wherever
// that is (a skipped level cannot hide a lesson: the first meeting is simply somewhere else). save.metOk[subject] = 1 once
// the player answered a moment by doing the gesture himself.
//
// A MOMENT: the world's time eases to TEACH.scale in TEACH.easeIn s, holds up to TEACH.hold s, eases back in TEACH.easeOut
// s. The level clock (the fuse) does not burn while it lasts (sim.clockHold, the same for every player), for at most
// TEACH.clockCap s of sim time per moment, so a subject can give back at most meetings x clockCap s in a player's life.
// Player input stays live: the gesture done for real ends the moment at once ("understood").
export const TEACH = {
  meetings: 2, // moments on the first two meetings only
  scale: 0.2, // the world's speed while the moment holds
  easeIn: 0.15, hold: 1.5, holdShort: 0.6, easeOut: 0.25, snapOut: 0.12, // s (wall); snapOut: the answer ends it
  gap: 6, // s from the end of one moment to the start of the next
  tail: 5, // s of fuse left under which no moment starts
  clockCap: 1.5, // s of sim time per moment the fuse may stand still
  wait: 8, // s a wanted moment may wait (spacing, a busy screen, a finger on another ring) before it is dropped
  turnOk: 0.12, // rad: the player's own turn of the lesson ring that counts as the answer
};

// The gesture vocabulary (docs/teaching.md):
//   away  the finger drags the ring under the subject so the gap near it moves AWAY (no gap lines up for it)
//   open  the finger takes the nearest gap of that ring and drags it TO the subject (a way through, a drop)
//   spin  the finger turns the ring the subject sits on or rides (steer it, wind it, shake it off, against his crank)
//   tap   the finger taps a thing (the fire a vine fears)
//   look  no gesture: the spotlight and slow motion alone, with at most three words under it
//   none  no moment at all: the creature's own pop-up in the world already says it (a reaction, not a threat)
// ring: which ring the gesture is on. floor = the ring just outside the subject (its channel's floor), own = the ring
// nearest its radius (the one it sits on), outer = the outermost ring, ev = the event's own ring (floor when it has none).
// Each row: [gesture, ring, words]. Keys are the old tip keys (G.predToast / once(key, ...)).
const L = (g, ring = 'floor', w = '') => ({ g, ring, w });
export const LESSONS = {
  // predators (main.js predEvent, handleEvents)
  snake: L('away'), // A snake! Turn the rings so no gap lines up for it.
  vineClose: L('tap', 'ev'), // Thorn vines seal a gap ... Fire burns them back. (the finger taps the fire)
  laserFoe: L('look', 'own', 'Laser stuns them'),
  gust: L('look', 'own', 'Wind pushes eggs'),
  clash: L('none'), venomHole: L('look', 'own', 'Holes work too'), barrier: L('look', 'own', 'Venom melts walls'),
  eagle: L('away', 'outer'), eagleGrab: L('none'), eagleFeather: L('none'), bossThrow: L('look', 'own', 'Not all help'),
  // the salamander and the crawlers (main.js salEvent)
  salIn: L('spin'), salFire: L('look', 'own', 'Red-hot wall'), salCool: L('none'), salLava: L('none'),
  salRival: L('none'), salCoil: L('spin'), salFrostBite: L('look', 'own', 'Frozen stuck'), salFrost: L('look', 'own', 'Ice: eggs slide'),
  salFace: L('none'), thornIn: L('look', 'own', 'Stone flips him'), spikeIn: L('look', 'own', 'Drops thorns'),
  salSpit: L('away', 'ev'), // 0.8.18 ember spit: x, y is where his line crosses the ring between: turn that gap out of his line
  salFireUp: L('tap', 'own'), // 0.8.18 fire-up (white-hot): the finger taps the water that cools him (src/lesson.js tapTarget)
  thornHip: L('away'), thornDuel: L('look', 'own', 'Pick a winner'), chamIn: L('look', 'own', 'Feed black flame'),
  geckoIn: L('look', 'own', 'Icy feet'), geckoLick: L('look', 'own', 'Frozen stuck'),
  // frog (render/frog.js)
  frog: L('look', 'own', 'Plugs gaps'), frogPlug: L('none'), frogLick: L('look', 'own', 'Orb in danger'), frogScare: L('none'), frogBounce: L('none'),
  // sea (render/sea.js)
  octIn: L('look', 'own', 'Carries eggs off'), octInk: L('look', 'own', 'Wait it out'), octGrab: L('none'),
  fishScatter: L('none'), fishIn: L('look', 'own', 'Fish push eggs'),
  // bayou (render/bayou.js)
  gator: L('away'), gdizzy: L('open', 'own'), turtle: L('open', 'own'), mosq: L('look', 'own', 'Fire scatters them'),
  // thieves (render/thieves.js)
  thiefRat: L('open'), thiefWeasel: L('away'), thiefKing: L('spin'), thiefGap: L('none'), thiefTrapped: L('look', 'own', 'Now hit it'),
  thiefStash: L('look', 'own', 'Bonk it back'), ratSquabble: L('look', 'own', 'Move eggs now'),
  // Bandit the raccoon (render/banditplay.js via main.js banditLesson: his ring, against his crank)
  bandit: L('spin', 'bandit'), banditSack: L('spin', 'bandit'), banditCatch: L('look', 'own', 'Caught, not broken'), banditWhistle: L('look', 'own', 'Weasel coming'),
  // reef (render/reef.js)
  hermit: L('open'), puffer: L('look', 'own', 'Thorn pops it'), jelly: L('look', 'own', 'Stings crack eggs'), kcStuck: L('look', 'own', 'Hit the claw'),
  kcBub: L('look', 'own', 'Dodge or ride'), kcWhirl: L('spin', 'ev'), kcBar: L('spin', 'ev'), kcSiltTip: L('none'),
  // the clockwork cast and the owl (render/clockwork.js, render/owl.js)
  cwSpider: L('look', 'own', 'Slip past'), cwBeetle: L('spin'), cwJack: L('look', 'own', 'It bounces eggs'),
  owlSwoop: L('away', 'outer'), owlWind: L('look', 'own', 'Arrow rings spin'), owlGears: L('spin'),
  // boss moves (render/bossmoves.js)
  mvCage: L('spin'), mvMagma: L('look', 'own', 'Hot ring'), mvWhip: L('spin', 'ev'), mvDive: L('away', 'outer'),
  mvGust: L('look', 'own', 'Wind pushes eggs'), mvPop: L('look', 'own', 'Roll into him'), mvShards: L('away'),
  // 0.8.17 creatures that never had a tip (their first telegraph is the meeting)
  pip: L('away'), // Pip the penguin slides: turn the gap away from his slide
  coco: L('spin', 'own'), // Coco the monkey rides a ring: turn that ring against him (a hard flick throws him off)
  urchin: L('open'), // Spike the urchin puffs at an egg: open the gap behind the egg
  // a level's opening caption: the finger brings a gap to the egg it is about (main.js lessonLevel)
  lv: L('open'),
};
export const lessonOf = (subject) => LESSONS[subject] || (String(subject).startsWith('lv:') ? LESSONS.lv : null);

// ---- meetings
const metOf = (save, s) => ((save && save.met && save.met[s]) | 0);
export function newRun() { return { seen: {}, n: {}, lastEnd: -1e9, active: null, moments: 0 }; }
// the subject showed up in this level try: count the meeting once per try; returns this meeting's number (1, 2, ...)
export function meet(save, run, subject) {
  if (run.n[subject]) return run.n[subject];
  save.met = save.met && typeof save.met === 'object' ? save.met : {};
  const n = Math.min(99, metOf(save, subject) + 1);
  save.met[subject] = n;
  run.n[subject] = n;
  return n;
}

// Is this appearance a teaching moment? ctx:
//   now (s, wall), timeLeft (s of fuse left, null without a fuse), held (index of the ring under a finger, or null),
//   ring (the lesson's ring index, or null), adapt (Settings "Adaptive help", on unless false), calm (save.calm), busy
//   (a card, the fuse intro, a modal: wait), replayWon (the level was won before)
// Returns null or the plan { subject, n, hold, calm, lean, dim }.
export function want(save, run, subject, ctx) {
  const spec = lessonOf(subject);
  if (!spec || spec.g === 'none') return null;
  const n = run.n[subject] || metOf(save, subject) + 1; // the meeting this is (counted by meet, or about to be)
  const adapt = ctx.adapt !== false;
  if (n > (adapt ? TEACH.meetings : 1)) return null; // the first two meetings only (adaptive help off: the first)
  if (ctx.replayWon && n > TEACH.meetings) return null;
  if (run.taught && run.taught[subject]) return null; // one moment per subject per try
  if (run.active || ctx.busy) return null; // one at a time
  if (ctx.now - run.lastEnd < TEACH.gap) return null; // never two within 6 s
  if (ctx.timeLeft != null && ctx.timeLeft < TEACH.tail) return null; // never in the last 5 s
  if (ctx.held != null && ctx.held !== ctx.ring) return null; // never while a finger turns another ring
  const ok = save && save.metOk && save.metOk[subject];
  const hold = !adapt || (n > 1 && ok) ? TEACH.holdShort : TEACH.hold; // answered once already: the second is short
  const calm = !!ctx.calm;
  return { subject, n, hold, calm, lean: !calm, dim: calm ? 'soft' : 'spot', g: spec.g, words: spec.w };
}

// ---- the moment's clock (wall seconds since it began; `out` = when it started easing back, null while it holds)
const ss = (x) => { x = Math.max(0, Math.min(1, x)); return x * x * (3 - 2 * x); };
export function begin(run, plan, now) {
  const m = { ...plan, t0: now, age: 0, out: null, outLen: TEACH.easeOut, simIn: 0, done: false, ok: false };
  run.active = m;
  run.taught = run.taught || {};
  run.taught[plan.subject] = 1;
  run.moments++;
  return m;
}
export function length(m) { return m.out != null ? m.out + m.outLen : TEACH.easeIn + m.hold + TEACH.easeOut; }
// the world's time scale at the moment's age: 1 -> scale in easeIn, hold, back to 1 from wherever it was when it let go
const inScale = (age) => (age < TEACH.easeIn ? 1 + (TEACH.scale - 1) * ss(age / TEACH.easeIn) : TEACH.scale);
export function scaleAt(m, age = m.age) {
  if (age < 0) return 1;
  const outAt = m.out != null ? m.out : TEACH.easeIn + m.hold, outLen = m.out != null ? m.outLen : TEACH.easeOut;
  if (age < outAt) return inScale(age);
  const s0 = inScale(outAt);
  return age >= outAt + outLen ? 1 : s0 + (1 - s0) * ss((age - outAt) / outLen);
}
// 0..1 how much of the moment shows (dim, spotlight, finger): in with the slow-down, out with the speed-up
export function showAt(m, age = m.age) {
  const outAt = m.out != null ? m.out : TEACH.easeIn + m.hold, outLen = m.out != null ? m.outLen : TEACH.easeOut;
  return ss(age / TEACH.easeIn) * (1 - ss((age - outAt) / outLen));
}
// advance by dt of wall time; returns true when the moment is over
export function tick(m, dt) { m.age += dt; return (m.done = m.age >= length(m)); }
// the player answered (ok) or tapped it away: ease back now, quicker when answered
export function finish(m, ok) {
  if (m.out != null) return;
  m.ok = !!ok;
  m.out = m.age;
  m.outLen = ok ? TEACH.snapOut : TEACH.easeOut;
}
export function end(save, run, m, now) {
  if (m.ok) { save.metOk = save.metOk && typeof save.metOk === 'object' ? save.metOk : {}; save.metOk[m.subject] = 1; }
  run.active = null;
  run.lastEnd = now;
}
// the fuse stands still for the whole moment, up to clockCap s of sim time (main.js adds each sim step to m.simIn)
export function holdsClock(m) { return !!m && !m.done && m.simIn < TEACH.clockCap - 1e-9; }
