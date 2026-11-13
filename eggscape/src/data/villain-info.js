// "Who's in this vault": one entry for every villain, boss, creature and hazard that can appear in levels 1-50, the
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
    does: 'A frost gecko on the outer ring: he blows gales, freezes a ring, flicks icicles.',
    beat: 'Each egg you save cancels the attack it is winding up.',
    attacks: {
      gale: 'Turn a wall into the wind first. Stone is too heavy to blow.',
      freeze: 'One ring locks solid for 4 s. Plan your drop on the others.',
      icicles: 'Turn the ring above an egg to swing its icicle away.',
    },
  },
  'boss:golem': {
    group: 'boss', name: 'Crystal Golem',
    does: 'Stomps up crystal walls and cages, rains shards, punches rings.',
    beat: 'Keep saving eggs: each one staggers him and cancels his attack.',
    attacks: {
      stomp: 'The vault shakes and walls rise. Go round, or smash with stone.',
      punch: 'A ring spins a quarter turn and ignores you. Keep eggs clear.',
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
    does: 'Hops ring to ring, plugs gaps, eats orbs and chicks. Never eggs.',
    beat: 'Eggs land softly on it. A flaming egg or dash chick scares it.',
  },
  eagle: {
    group: 'creature', name: 'Eagle',
    does: 'Dives through outer-ring gaps, snatches an egg, drops it from high.',
    beat: 'When its shadow locks on, turn a wall over that egg. It eats snakes.',
  },
  salamander: {
    group: 'creature', name: 'Lava salamander',
    does: 'Breathes fire on the wall ahead: that red-hot patch cracks eggs.',
    beat: 'Turn the ring it rides to aim the fire at thorns. Water cools it.',
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
    does: 'Winds down to the gap nearest an egg and webs it shut for ~9 s.',
    beat: 'Its web catches eggs with no crack. Fire, iron or laser tear it.',
  },
  beetle: {
    group: 'creature', name: 'Wind-up beetle',
    does: 'Shoves eggs along its floor for ~6 s, then runs down and stops.',
    beat: 'Stopped, it is a wall. Turn its ring ~70° to wind it up again.',
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

export const ATTACK_EXTRA = { heat: 'Rising heat' }; // phase flags shown as an attack (names not in sim/boss.js ATTACK_NAME)

const CREATURE_KEYS = ['snake', 'weasel', 'rats', 'octopus', 'fish', 'frog', 'eagle', 'salamander', 'hermit', 'puffer', 'jelly', 'gator', 'turtle', 'mosquito', 'spider', 'beetle', 'jack'];
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
    if (live(sim.sals) && !(boss === 'salamander' && sim.sals.length === 1)) set.add('salamander');
    if (live(sim.hermits)) set.add('hermit');
    if (live(sim.puffs)) set.add('puffer');
    if (live(sim.jellies)) set.add('jelly');
    if ((sim.gators || []).some((G) => !G.boss)) set.add('gator');
    if (live(sim.turtles)) set.add('turtle');
    if (live(sim.mosqs)) set.add('mosquito');
    if (sim.cw) { if (live(sim.cw.sp)) set.add('spider'); if (live(sim.cw.bt)) set.add('beetle'); if (live(sim.cw.jk)) set.add('jack'); }
  }
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
  const orbTypes = [...(L.orbs || []).map((o) => o.type), ...(L.portals || []).flatMap((p) => p.emit || []), ...((L.bossFight && L.bossFight.throws) || [])];
  for (const [t, k] of Object.entries(HAZARD_ORBS)) if (orbTypes.includes(t)) set.add(k);
  const order = Object.keys(VILLAIN_INFO);
  return [...set].filter((k) => VILLAIN_INFO[k]).sort((a, b) => order.indexOf(a) - order.indexOf(b)).concat([...set].filter((k) => !VILLAIN_INFO[k])); // an unknown kind stays in the list (last) so the check sees it
}
