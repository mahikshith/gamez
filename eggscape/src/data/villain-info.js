// "Who's in this vault": one entry for every villain, boss, creature and hazard that can appear in levels 1-60, the
// practice vaults and the Wonder Vaults. Written from the sim (src/sim/*.js), not from memory: `does` is what the sim
// makes it do, `beat` the counter the sim actually honours. Plain words, at most ~70 characters a line.
// Boss attack counters reuse the in-game tip toasts (render/bossmoves.js, owl.js, reef.js, levels.js tips) so the
// wording matches what the player has already seen.
// group: boss | creature | hazard. Bosses list their attacks by sim name; the panel shows only the ones the level uses
// (sim/boss.js ATTACK_NAME gives the display names; 'heat' is a phase flag, named here).
// A hazard here is something that acts on its own over time (falls, strikes, blows, grows, pumps, or is thrown/spat
// out of a portal). Plain thorns, walls, doors, grates, honey and gears are the board, not hazards.
//
// villainKinds(level, sim) lists what is in a level: from the level data, plus anything the sim has live.
// tools/info-check.cjs fails the build check if a level carries a villain/hazard the table does not cover.

import { CREEP_KIND } from '../sim/creeper.js'; // 0.8.18 the creeper family's kinds
export const VILLAIN_INFO = {
  // ---------------------------------------------------------------- bosses
  'boss:weasel': {
    group: 'boss', name: 'The Weasel',
    does: 'Pops up from tunnels, throws orbs at your eggs and steals one.',
    beat: 'Trap it inside a ring, then hit it. Each saved egg staggers it.',
    attacks: {
      pop: 'Dirt flies first. Roll an egg into him to bonk him, or wait.',
      throw: 'Not all of them help! Keep eggs off the thorn and curse orbs.',
      throw2: 'Two at once. Keep eggs off the thorn and curse orbs.',
    },
  },
  'boss:snake': {
    group: 'boss', name: 'Serpent Hollow',
    does: 'A big slow snake and a small fast one hunt your eggs together.',
    beat: 'Lure them with a chick, then run eggs down in rock skin.',
  },
  'boss:blizzard': {
    group: 'boss', name: 'Baron von Brr',
    does: 'A frost gecko in the vault: his lick cracks an egg and freezes it.',
    beat: 'Strikes and stone stop him. Each saved egg cancels his wind-up.',
    attacks: {
      gale: 'His wind shoves eggs and turns free rings. Hold a ring; stone eggs stay put.',
      freeze: 'He licks a wall of his channel: it locks for 4 s. Use the others.',
      icicles: 'Turn the ring above an egg to swing its icicle away.',
    },
  },
  'boss:golem': {
    group: 'boss', name: 'Duke Quartz',
    does: 'A crystal thorn-back: drops crystal spikes, and his ram cracks eggs.',
    beat: 'Roll a stone egg into him: he flips over and loses his attack.',
    more: 'He duels his cousin Spike on sight: the loser is down for 5 s.',
    attacks: {
      stomp: 'The vault shakes and walls rise. Go round, or smash with stone.',
      punch: 'His tail spins a wall of his channel a quarter turn. Keep clear.',
      cage: 'Turn either ring of that channel to shear the crystals off.',
      shards: 'Turn a solid wall over your egg, or roll it out of the wedge.',
    },
  },
  'boss:salamander': {
    group: 'boss', name: 'Lava Salamander',
    does: 'Spits lava rocks at your eggs and heats whole rings red-hot.',
    beat: 'Use the holes its rocks melt. Each saved egg staggers it.',
    attacks: {
      rock: 'Roll the egg off the glowing mark. A water egg cools rocks.',
      rock2: 'Two rocks at once. Roll eggs off the glowing marks.',
      magma: 'Get your eggs off the glowing ring in time. Its thorns burn.',
      whip: 'Hold that ring as the whip lands and it barely moves.',
      heat: 'An egg that waits ~9 s in one channel cracks. Keep moving.',
      spit: 'He glows and spits an ember through a gap: turn that gap away.', // 0.8.18
      fire: 'A red flame orb or lava makes him white-hot. Water cools him.', // 0.8.18
    },
  },
  'boss:eagle': {
    group: 'boss', name: 'Storm Eagle',
    does: 'Dives for eggs, aims lightning under them and beats up gusts.',
    beat: 'Bring a wall over the egg it dives at: it bonks and gets dizzy.',
    attacks: {
      dive: 'Turn a ring during the warning so a wall covers the egg.',
      wgust: 'Put a wall end in the way, or ride the gust to a gap.',
      bolt: 'When the ring under an egg crackles, turn it away.',
      bolt2: 'Two rings crackle. Turn both eggs away from the sparks.',
    },
  },
  'boss:ratking': {
    group: 'boss', name: 'The Rat King',
    does: 'Pounces through gaps, throws orbs and fogs a ring. Rats help.',
    beat: 'Trap him behind a turned ring and hit him: he spits an egg out.',
    attacks: {
      throw: 'Not all of them help! Keep eggs off the thorn and curse orbs.',
      throw2: 'Two at once. Keep eggs off the thorn and curse orbs.',
      fog: 'Fog lifts in a few seconds: remember where the gaps were.',
    },
  },
  'boss:kingcrab': {
    group: 'boss', name: 'King Crab',
    does: 'Thrusts its claws in through lined-up gaps and drags eggs out.',
    beat: 'Turn the ring while a claw is in: it sticks. Then hit the claw.',
    attacks: {
      snap: 'Turn that gap away, or shut it on the claw and hit it.',
      snap2: 'Both claws, two rings deep. Break up the lined-up gaps.',
      bubbles: 'Move your egg out of the plume’s way, or ride it.',
      barnacles: 'Turn that ring a quarter turn, bump them twice, or blast.',
      whirl: 'Turn that ring against the current to slow it.',
      silt: 'It hides part of the vault for a while. A jelly’s glow helps.',
    },
  },
  'boss:raccoon': { // 0.8.17 bandit
    group: 'boss', name: 'Bandit the Raccoon',
    does: 'Sits on a ring and cranks eggs up to him.',
    beat: 'Turn his ring hard against him. Three times!',
  },
  'boss:gator': {
    group: 'boss', name: 'Grandpa Gator',
    does: 'His tail sweep shakes every ring; his death roll spins one.',
    beat: 'When he lies dizzy, drop an egg on him or pepper him.',
    attacks: {
      sweep: 'Every ring jolts round. Then he is dizzy: hit him now.',
      roll: 'He spins the ring under your lead egg, then lies dizzy.',
    },
  },
  'boss:owl': {
    group: 'boss', name: 'Clockwork Owl',
    does: 'Swoops at outer eggs, winds the rings round, drops gear bombs.',
    beat: 'An iron egg in its talons jams a gear. Thunderclap stalls it.',
    attacks: {
      swoop: 'Turn the outer gap away and it hits the brass.',
      wind: 'The rings with arrows spin a quarter turn: plan for it.',
      gears: 'Turn the ring to carry the bomb away from your eggs.',
      gears2: 'Two bombs. Carry them away, or under thorns you want gone.',
    },
  },
  // ---------------------------------------------------------------- creatures
  snake: {
    group: 'creature', name: 'Snake',
    does: 'Slides in and eats eggs. It crosses rings only at lined-up gaps.',
    beat: 'Turn gaps away from its head. Stone, rock skin or fire repel it.',
  },
  weasel: {
    group: 'creature', name: 'Weasel',
    does: 'Crouches under a gap, then pounces through it to steal an egg.',
    beat: 'Turn the gap away as it crouches: it bonks. Trap it, then hit it.',
  },
  rats: {
    group: 'creature', name: 'Rats',
    does: 'Roll eggs along the floor to their hole. An egg in there is gone.',
    beat: 'Turn a gap under the rolling egg: free help. Light, water scare them.',
  },
  octopus: {
    group: 'creature', name: 'Octopus',
    does: 'Hunts eggs, squirts ink to hide them, then carries one off.',
    beat: 'Water, a zap or a glow flash makes it let go of the egg.',
  },
  fish: {
    group: 'creature', name: 'Fish school',
    does: 'Swim round a channel and sweep eggs along like a current.',
    beat: 'Drop an egg on them: they scatter and stop pushing for a bit.',
  },
  frog: {
    group: 'creature', name: 'Frog',
    does: 'Hops ring to ring, plugs gaps. Its tongue snatches eggs and orbs.',
    beat: 'Turn a wall into its tongue: bonk! Drop an egg on it: it spits.',
  },
  penguin: { // 0.8.17 pip
    group: 'creature', name: 'Pip the Penguin',
    does: 'Belly-slides the ice, shoves eggs ahead and tucks a still one away.',
    beat: 'Turn a wall or sponge into his slide: bonk, he drops it unharmed.',
  },
  monkey: { // 0.8.17 coco
    group: 'creature', name: 'Coco the Monkey',
    does: 'Rides a ring, grabs eggs with his tail, throws banana peels.',
    beat: 'Flick his ring hard: he flies off and lets the egg go.',
  },
  eagle: {
    group: 'creature', name: 'Eagle',
    does: 'Dives through outer-ring gaps, snatches an egg, drops it from high.',
    beat: 'When its shadow locks on, turn a wall over that egg. It eats snakes.',
  },
  salamander: {
    group: 'creature', name: 'Lava salamander',
    does: 'Coils, then snaps: it eats an egg at its snout. Its fire heats walls.',
    beat: 'Turn its ring to carry it off. A stone egg breaks its bite. Water cools it.',
  },
  emberspit: { // 0.8.18 lava: the salamander's ember spit
    group: 'creature', name: 'Ember spit',
    does: 'He glows, a spark runs up his back, and he spits an ember at an egg.',
    beat: 'Turn the gap out of his line: it splats on the wall. Water douses it.',
    more: 'The ember pool cracks an egg once. It burns thorns away.',
  },
  fireup: { // 0.8.18 lava: the salamander's fire-up
    group: 'creature', name: 'White-hot',
    does: 'He gulps a red flame orb (or steps in lava) and goes white-hot.',
    beat: 'Grab the flame orb first. Water cools him at once: he sulks.',
    more: 'Then he is quicker, breathes twice as far, and his feet burn thorns.',
  },
  frostsal: {
    group: 'creature', name: 'Frost salamander',
    does: 'Its bite cracks an egg and freezes it solid. Its breath ices a wall.',
    beat: 'Turn its ring to carry it off. A fire orb or lava melts it for a while.',
  },
  faceoff: {
    group: 'creature', name: 'Fire against frost',
    does: 'When the two salamanders meet in a channel they fight, not your eggs.',
    beat: 'Turn their ring to bring them together: both are knocked out.',
  },
  spike: {
    group: 'creature', name: 'Spike the thorn-back',
    does: 'Drops thorns behind him and rams eggs: every ram cracks the shell.',
    beat: 'A stone egg flips him. Turn the ring under a thorn fast to shake it.',
    more: 'He duels the Duke on sight. Weaken one first to pick the winner.',
  },
  chameleon: {
    group: 'creature', name: 'Sly the chameleon',
    does: 'Crawls in and steals power orbs with his tongue. Never eggs.',
    beat: 'Grab orbs first. Feed him the black flame: he coughs one back up.',
    more: 'Strikes, stuns and a Stone egg stop him. Sitting still, he fades.',
  },
  hermit: {
    group: 'creature', name: 'Hermit crab',
    does: 'Tucks an egg in its shell and walks it away from the nearest gap.',
    beat: 'Turn a gap under it: the egg drops free. Or bump or zap the crab.',
  },
  puffer: {
    group: 'creature', name: 'Pufferfish',
    does: 'Swells over a gap and plugs it. Its spines crack a fast egg.',
    beat: 'Slow eggs bounce off it softly. A thorn poke or a zap pops it.',
  },
  jelly: {
    group: 'creature', name: 'Jellyfish',
    does: 'Drifts right through the walls. Its sting cracks eggs it touches.',
    beat: 'Water washes it away; the live ring or a zap stuns it.',
  },
  urchin: { // 0.8.17 urchin
    group: 'creature', name: 'Spike the sea urchin',
    does: 'Puffs up, then dashes at an egg and cracks it. His roll cracks too.',
    beat: 'Shut the gap he aims through: SPLAT! He lies on his back a while.',
    more: 'A chick or a Stone egg flips him too. Asleep, he is harmless.',
  },
  gator: {
    group: 'creature', name: 'Alligator',
    does: 'Asleep he is a log to roll over. Awake he bites eggs at his gap.',
    beat: 'Turn the gap away from his jaws. Pepper makes him sneeze and go.',
  },
  turtle: {
    group: 'creature', name: 'Snapping turtle',
    does: 'Clamps an egg: safe from everything, but stuck, and it blocks.',
    beat: 'Drop an egg on its shell, or use a stone or iron egg: it flips.',
  },
  mosquito: {
    group: 'creature', name: 'Mosquito swarm',
    does: 'Latches onto an egg and lifts it back up for a few seconds.',
    beat: 'Fire, pepper or the laser scatter them. Stone eggs are too heavy.',
  },
  spider: {
    group: 'creature', name: 'Clockwork spider',
    does: 'Crawls along its ring to the gap nearest an egg and webs it shut.',
    beat: 'Slip eggs past while it spins. Fire, iron or laser tear its webs.',
  },
  beetle: {
    group: 'creature', name: 'Wind-up beetle',
    does: 'Turn his ring to wind him: he marches that way, pushing eggs.',
    beat: 'He crushes thorns in his path. Unwound, he is a wall.',
  },
  jack: {
    group: 'creature', name: 'Spring jack',
    does: 'Pops any egg that rolls over its lid back up and onward.',
    beat: 'Park it just short of a gap to launch eggs. Heavy eggs jam it.',
  },
  // ---------------------------------------------------------------- hazards
  icicles: {
    group: 'hazard', name: 'Icicles',
    does: 'Grow over an egg, shake, then drop: a crack and a slippery patch.',
    beat: 'Turn the ring they hang from to swing them away before they fall.',
  },
  lava: {
    group: 'hazard', name: 'Lava rocks',
    does: 'Crash onto a ring, blast nearby eggs, then melt a hole for 5 s.',
    beat: 'Move eggs off the glow, then use the hole. Water eggs cool them.',
  },
  lightning: {
    group: 'hazard', name: 'Lightning',
    does: 'A ring section flickers, then a bolt cracks eggs and locks it.',
    beat: 'Turn eggs away from the flicker. A locked ring holds still: use it.',
  },
  gusts: {
    group: 'hazard', name: 'Gusts',
    does: 'Streaks warn you, then wind shoves every loose egg along a ring.',
    beat: 'Put a wall end in the way. Stone eggs are too heavy to blow.',
  },
  embers: {
    group: 'hazard', name: 'Embers',
    does: 'Sparks drift down through the gaps and crack an egg they land on.',
    beat: 'Keep a solid ring over your eggs. A water egg puts embers out.',
  },
  quake: {
    group: 'hazard', name: 'Quakes',
    does: 'Every few seconds the vault shakes and loose eggs hop about.',
    beat: 'Park eggs on honey or in a dip before it hits, then move.',
  },
  rain: {
    group: 'hazard', name: 'Rain',
    does: 'Wet rings lose their grip: eggs slide much further than usual.',
    beat: 'Turn in small steps and let eggs settle before the next move.',
  },
  current: {
    group: 'hazard', name: 'Current',
    does: 'A steady sideways push on every egg. Duck eggs float along on it.',
    beat: 'Let it carry eggs to a gap, and park the rest against a wall.',
  },
  popthorns: {
    group: 'hazard', name: 'Pop-up thorns',
    does: 'Forge spikes pump in and out of a ring on a steady beat.',
    beat: 'Count the beat and pass while they are down.',
  },
  vines: {
    group: 'hazard', name: 'Thorn vines',
    does: 'Creep across a gap and seal it with thorns, then grow back.',
    beat: 'Drop through before it closes. Fire burns the vine back.',
  },
  creeper: { // 0.8.18 (sim/creeper.js)
    group: 'hazard', name: 'Thorn creeper',
    does: 'Crawls along a ring edge. A baby shoves eggs aside; a grown one cracks them.',
    beat: 'Pass while it curls up at an end. Fire burns it to a stump.',
  },
  swampvine: { // 0.8.18 the creeper family: the bayou's form (the thorn creeper's rule)
    group: 'hazard', name: 'Swamp vine',
    does: 'Crawls to and fro along a ring edge. Its thorny head cracks eggs.',
    beat: 'Pass while it curls up at an end. Fire burns it to a stump.',
  },
  frostcrawler: { // 0.8.18 the creeper family: frozen lake and blizzard
    group: 'hazard', name: 'Frost crawler',
    does: 'Ice spikes crawl along a ring edge. A hit cracks an egg and shoves it.',
    beat: 'Pass while it rests at an end. Fire melts it to a puddle.',
  },
  lavaflow: { // 0.8.18 the creeper family: the volcano's form
    group: 'hazard', name: 'Lava flow',
    does: 'Hot lava creeps along a ring edge. An egg resting on it heats up and cracks.',
    beat: 'Roll across, never stop on it. A water egg cools it to crust.',
  },
  anemone: { // 0.8.18 the creeper family: the reef's form
    group: 'hazard', name: 'Stinging anemone',
    does: 'Drifts along a ring edge, open and stinging. It reaches far.',
    beat: 'Pass while it is shut at an end. Fire or a stone makes it flinch shut.',
  },
  spark: { // 0.8.18 the creeper family: the storm's form
    group: 'hazard', name: 'Rim spark',
    does: 'Races along a ring edge and zaps eggs.',
    beat: 'It rests long at each end: pass then. A stone grounds it.',
  },
  sawtooth: { // 0.8.18 the creeper family: the clockwork form
    group: 'hazard', name: 'Saw tooth',
    does: 'A saw wheel runs along a ring edge and cracks eggs.',
    beat: 'Pass while it stops at an end. A stone knocks it off.',
  },
  shard: { // 0.8.18 the creeper family: the crystal cave's form
    group: 'hazard', name: 'Crawling shard',
    does: 'A crystal crawls along a ring edge. Its spikes crack eggs.',
    beat: 'Pass while it rests at an end. A stone shatters it.',
  },
  doors: { // 2026-11-20 first-five ladder: gate doors left world 1, so their first level (L31) teaches them here
    group: 'hazard', name: 'Gate doors',
    does: 'A sliding door shuts a gap, then opens again on a steady beat.',
    beat: 'Park the egg over the door and let it drop when it opens.',
  },
  curse: {
    group: 'hazard', name: 'Curse orb',
    does: 'A thief’s trick: grab it and the fuse runs double for 6 s.',
    beat: 'Steer eggs round it. The hourglass stops even a cursed fuse.',
  },
  thornorb: {
    group: 'hazard', name: 'Thorn ball',
    does: 'A floating orb that cracks the egg that touches it. Ouch.',
    beat: 'Steer eggs round it: it only hurts if an egg takes it.',
  },
};

export const ATTACK_EXTRA = { heat: 'Rising heat', spit: 'Ember spit', fire: 'Fire-up' }; // phase flags shown as an attack (names not in sim/boss.js ATTACK_NAME)

const CREATURE_KEYS = ['snake', 'weasel', 'rats', 'octopus', 'fish', 'frog', 'eagle', 'salamander', 'chameleon', 'hermit', 'puffer', 'jelly', 'gator', 'turtle', 'mosquito', 'spider', 'beetle', 'jack'];
CREATURE_KEYS.push('penguin'); // 0.8.17 pip
CREATURE_KEYS.push('urchin'); // 0.8.17 urchin
CREATURE_KEYS.push('monkey'); // 0.8.17 coco
const listOf = (v) => (!v ? [] : Array.isArray(v) ? v : [v]);
const HAZARD_ORBS = { curse: 'curse', thorn: 'thornorb' };

// the boss kind of a level (null when it has no boss fight)
export const bossOf = (L) => (L && L.bossFight && (L.bossFight.kind || L.boss)) || null;

// the attacks a level's boss uses, in the order they first come (plus 'heat' when a phase has it)
export function bossAttacks(L) {
  const F = L && L.bossFight, out = [];
  if (!F) return out;
  for (const P of F.phases || []) {
    for (const a of P.attacks || []) if (!out.includes(a)) out.push(a);
    if (P.heat && !out.includes('heat')) out.push('heat');
    if (P.spit && !out.includes('spit')) out.push('spit'); // 0.8.18 the salamander's powers in the boss's later phases
    if (P.fire && !out.includes('fire')) out.push('fire');
  }
  return out;
}

// Every kind present in level L (bosses first, then creatures, then hazards). sim (optional): the live Sim, which adds
// anything it is running that the level data does not name (and is how a boss's summoned creatures are found).
export function villainKinds(L, sim = null) {
  if (!L) return [];
  const boss = bossOf(L), set = new Set();
  if (boss) set.add('boss:' + boss);
  for (const k of CREATURE_KEYS) {
    const n = listOf(L[k]).length;
    if (!n) continue;
    if (k === 'snake' && boss === 'snake') continue; // the snakes ARE Serpent Hollow
    if (k === 'eagle' && boss === 'eagle') continue; // the level's eagle is the Storm Eagle
    if (k === 'salamander' && boss === 'salamander' && n === 1) continue; // its one salamander is the boss
    if (k === 'salamander') { // 0.8.14: fire and frost are two kinds, and together they are a third thing to know
      const fr = listOf(L[k]).filter((S) => S && S.kind === 'frost').length;
      if (n - fr > 0) set.add('salamander');
      if (fr) set.add('frostsal');
      if (fr && n - fr > 0 && !boss) set.add('faceoff');
      if (listOf(L[k]).some((S) => S && S.kind !== 'frost' && S.spit)) set.add('emberspit'); // 0.8.18
      if (listOf(L[k]).some((S) => S && S.kind !== 'frost' && S.fireup)) set.add('fireup');
      continue;
    }
    set.add(k);
  }
  if (sim) {
    const live = (a) => Array.isArray(a) && a.length > 0;
    if (live(sim.snakes) && boss !== 'snake') set.add('snake');
    if (sim.eagle && boss !== 'eagle') set.add('eagle');
    for (const T of sim.thieves || []) if (!T.boss) set.add(T.kind === 'weasel' ? 'weasel' : 'rats');
    if (live(sim.octos)) set.add('octopus');
    if (live(sim.schools)) set.add('fish');
    if (live(sim.frogs)) set.add('frog');
    if (live(sim.pips)) set.add('penguin'); // 0.8.17 pip
    if (live(sim.cocos)) set.add('monkey'); // 0.8.17 coco
    if (live(sim.sals) && !(boss === 'salamander' && sim.sals.length === 1) && sim.sals.some((C) => C.sp === 'sal' && C.kind !== 'frost')) set.add('salamander'); // L15's frost gecko and L20's thorn-backs are not salamanders
    if ((sim.sals || []).some((C) => C.sp === 'sal' && C.kind === 'frost')) set.add('frostsal');
    if ((sim.sals || []).some((C) => C.sp === 'sal' && !C.boss && C.spit)) set.add('emberspit'); // 0.8.18 (the boss's are attack lines)
    if ((sim.sals || []).some((C) => C.sp === 'sal' && !C.boss && C.fu)) set.add('fireup');
    if ((sim.sals || []).some((C) => C.role === 'spike')) set.add('spike');
    if (live(sim.hermits)) set.add('hermit');
    if (live(sim.puffs)) set.add('puffer');
    if (live(sim.jellies)) set.add('jelly');
    if (live(sim.urchins)) set.add('urchin'); // 0.8.17 urchin
    if ((sim.gators || []).some((G) => !G.boss)) set.add('gator');
    if (live(sim.turtles)) set.add('turtle');
    if (live(sim.mosqs)) set.add('mosquito');
    if (sim.cw) { if (live(sim.cw.sp)) set.add('spider'); if (live(sim.cw.bt)) set.add('beetle'); if (live(sim.cw.jk)) set.add('jack'); }
  }
  if (L.bossFight && L.bossFight.spike) set.add('spike'); // L20: the Duke's cousin
  // hazards
  if (L.icicles) set.add('icicles');
  if (L.lava) set.add('lava');
  if (L.gusts || L.wind) set.add('gusts');
  if (L.weather === 'thunder') set.add('lightning');
  if (L.weather === 'current') set.add('current');
  if (L.weather === 'embers' || L.weather === 'quake' || L.weather === 'rain') set.add(L.weather); // Daily Vault weathers
  const rings = L.rings || [];
  if (rings.some((r) => r.retract)) set.add('popthorns');
  if (rings.some((r) => r.vine || (r.gaps || []).some((g) => g.vine))) set.add('vines');
  for (const r of rings) if (r.creep) set.add(CREEP_KIND[r.creep.form] || 'creeper'); // 0.8.18 the creeper family: its world's form
  if (rings.some((r) => (r.gaps || []).some((g) => g.shut))) set.add('doors');
  const orbTypes = [...(L.orbs || []).map((o) => o.type), ...(L.portals || []).flatMap((p) => p.emit || []), ...((L.bossFight && L.bossFight.throws) || [])];
  for (const [t, k] of Object.entries(HAZARD_ORBS)) if (orbTypes.includes(t)) set.add(k);
  const order = Object.keys(VILLAIN_INFO);
  return [...set].filter((k) => VILLAIN_INFO[k]).sort((a, b) => order.indexOf(a) - order.indexOf(b)).concat([...set].filter((k) => !VILLAIN_INFO[k])); // an unknown kind stays in the list (last) so the check sees it
}
