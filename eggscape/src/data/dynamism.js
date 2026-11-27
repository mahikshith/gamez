// The villain dynamism table (0.8.19): one row per villain kind that its sim reads its temper from, and that a level
// constructor can read to budget a level (docs/dynamism.md). Same fields for every villain:
//   tempo  travel speed while it has a target, x today's hunting speed
//   rest   s it may idle between two actions while a target exists (lower = meaner)
//   tell   s of visible warning before a move that can cost an egg (never under TELL_MIN after scaling: fairness)
//   snatch s from "egg in reach" to "egg taken" (the player's window)
//   chase  0..1 how hard it re-targets and follows when the player moves the egg away (1 = at once, across rings)
//   threat 1..10 how much pressure it puts on a level (set by hand, checked by the hardness tables)
//   moves  what it can do (docs/dynamism.md says each in one line)
// DYN_MODE scales tempo, rest, tell and snatch per mode; tokens / breather are the menace director's (sim/menace.js).
// A level may carry `dyn: { salamander: { tempo: 1.2 } }`: multipliers on its row.
export const TELL_MIN = 0.45;
export const DYN = {
  // --- crawlers and the frog (aggroB)
  // the lava salamander: hunts the leading egg, tongue lash in line, lava dive to a far channel, bite at the snout, breath at a wall
  salamander: { tempo: 1.15, rest: 0.9, tell: 0.7, snatch: 1.3, chase: 1, threat: 6, moves: ['walk', 'climb', 'breath', 'lash', 'dive', 'bite', 'fireup'] },
  // the frost salamander (L28, L29): the fire one's walk and climb, an icing breath and the frost bite (no tongue, no dive)
  salFrost: { tempo: 1.1, rest: 1.3, tell: 0.85, snatch: 1.0, chase: 0.7, threat: 4, moves: ['walk', 'climb', 'icebreath', 'frostbite'] },
  // the frost gecko (L18 boss body): walks the ring tops, icy feet, a lick freezes an egg to its ring, then a nip cracks it
  gecko: { tempo: 1.1, rest: 1.0, tell: 1.4, snatch: 2.15, chase: 0.8, threat: 5, moves: ['rimwalk', 'icyfeet', 'lick', 'nip'] },
  // the thorn-backs (L24: Duke Quartz and Spike): drop thorns behind, hip-check at the snout, spike roll down the channel
  thornback: { tempo: 1.15, rest: 1.2, tell: 0.9, snatch: 1.4, chase: 0.6, threat: 5, moves: ['drop', 'hip', 'roll'] },
  // the chameleon (L31, L34): orbs only; vanishes, crosses unseen, pops up by the orb, tongue
  chameleon: { tempo: 2.2, rest: 2.2, tell: 0.6, snatch: 0.6, chase: 1, threat: 3, moves: ['ghost', 'pop', 'tongue'] },
  // the frog (L9, L49, L52): hops between channels, licks orbs, snatches an egg into its cheeks and spits it
  frog: { tempo: 1.2, rest: 3.2, tell: 0.7, snatch: 0.95, chase: 0.7, threat: 4, moves: ['hop', 'lick', 'snatch', 'spit'] },
  // the volcano (lava world weather and the salamander boss's volley): bombs on marked ring sections
  volcano: { tempo: 0.67, rest: 9, tell: 1.8, snatch: 0, chase: 0, threat: 2, moves: ['bomb', 'volley'] },
};
export const DYN_MODE = {
  easy: { tempo: 0.85, rest: 1.3, tell: 1.25, snatch: 1.25, tokens: 1, breather: 5 },
  medium: { tokens: 1, breather: 3.5 },
  hard: { tempo: 1.1, rest: 0.85, tell: 0.9, snatch: 0.9, tokens: 2, breather: 2.5 },
};
const SCALED = ['tempo', 'rest', 'tell', 'snatch'];
// DYN[kind] x DYN_MODE[mode], then a level's own multipliers (over: level.dyn[kind])
export function dyn(kind, mode = 'medium', over) {
  const r = DYN[kind];
  if (!r) return null;
  const M = DYN_MODE[mode] || DYN_MODE.medium, out = { ...r };
  for (const f of SCALED) out[f] = r[f] * (M[f] ?? 1) * ((over && over[f]) ?? 1);
  for (const f of ['chase', 'threat']) if (over && over[f] != null) out[f] = r[f] * over[f];
  out.tell = Math.max(TELL_MIN, out.tell);
  return out;
}
