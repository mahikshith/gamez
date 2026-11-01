// Raster sprites (sliced from the approved reference sheets by tools/slice-sprites.py). Each is an inlined WebP data URL.
// Everything here fails soft: not loaded / missing id -> false, and callers fall back to their code-drawn art.
import u_orb_fire_red from '../../assets/sprites/orb_fire_red.webp';
import u_orb_fire_black from '../../assets/sprites/orb_fire_black.webp';
import u_orb_fire_green from '../../assets/sprites/orb_fire_green.webp';
import u_orb_fire_gold from '../../assets/sprites/orb_fire_gold.webp';
import u_orb_stone from '../../assets/sprites/orb_stone.webp';
import u_orb_bubble from '../../assets/sprites/orb_bubble.webp';
import u_orb_water from '../../assets/sprites/orb_water.webp';
import u_orb_thunder from '../../assets/sprites/orb_thunder.webp';
import u_orb_thorn from '../../assets/sprites/orb_thorn.webp';
import u_orb_magnet from '../../assets/sprites/orb_magnet.webp';
import u_orb_twin from '../../assets/sprites/orb_twin.webp';
import u_orb_golden from '../../assets/sprites/orb_golden.webp';
import u_orb_hourglass from '../../assets/sprites/orb_hourglass.webp';
import u_orb_feather from '../../assets/sprites/orb_feather.webp';
import u_orb_rockskin from '../../assets/sprites/orb_rockskin.webp';
import u_orb_foxcurse from '../../assets/sprites/orb_foxcurse.webp';
import u_hen_dance from '../../assets/sprites/hen_dance.webp';
import u_hen_worried from '../../assets/sprites/hen_worried.webp';
import u_hen_cry from '../../assets/sprites/hen_cry.webp';
import u_hen_proud from '../../assets/sprites/hen_proud.webp';
import u_fox_evil from '../../assets/sprites/fox_evil.webp';
import u_fox_laugh from '../../assets/sprites/fox_laugh.webp';
import u_fox_cry from '../../assets/sprites/fox_cry.webp';
import u_fox_shock from '../../assets/sprites/fox_shock.webp';
import u_boss_fox from '../../assets/sprites/boss_fox.webp';
import u_boss_snake from '../../assets/sprites/boss_snake.webp';
import u_boss_blizzard from '../../assets/sprites/boss_blizzard.webp';
import u_boss_golem from '../../assets/sprites/boss_golem.webp';
import u_boss_salamander from '../../assets/sprites/boss_salamander.webp';
import u_boss_eagle from '../../assets/sprites/boss_eagle.webp';
import u_boss_foxking from '../../assets/sprites/boss_foxking.webp';
import u_win_hen from '../../assets/sprites/win_hen.webp';

const SRC = {
  orb_fire_red: u_orb_fire_red, orb_fire_black: u_orb_fire_black, orb_fire_green: u_orb_fire_green, orb_fire_gold: u_orb_fire_gold, orb_stone: u_orb_stone, orb_bubble: u_orb_bubble, orb_water: u_orb_water, orb_thunder: u_orb_thunder, orb_thorn: u_orb_thorn, orb_magnet: u_orb_magnet, orb_twin: u_orb_twin, orb_golden: u_orb_golden, orb_hourglass: u_orb_hourglass, orb_feather: u_orb_feather, orb_rockskin: u_orb_rockskin, orb_foxcurse: u_orb_foxcurse, hen_dance: u_hen_dance, hen_worried: u_hen_worried, hen_cry: u_hen_cry, hen_proud: u_hen_proud, fox_evil: u_fox_evil, fox_laugh: u_fox_laugh, fox_cry: u_fox_cry, fox_shock: u_fox_shock, boss_fox: u_boss_fox, boss_snake: u_boss_snake, boss_blizzard: u_boss_blizzard, boss_golem: u_boss_golem, boss_salamander: u_boss_salamander, boss_eagle: u_boss_eagle, boss_foxking: u_boss_foxking, win_hen: u_win_hen,
};

const IMG = {}; // id -> HTMLImageElement, created on first use

function get(id) {
  try {
    let im = IMG[id];
    if (im === undefined) {
      const u = SRC[id];
      if (!u || typeof Image === 'undefined') return (IMG[id] = null);
      im = IMG[id] = new Image();
      im.src = u;
    }
    return im && im.complete && im.naturalWidth > 0 ? im : null;
  } catch (e) {
    return null;
  }
}

export function spriteReady(id) {
  return !!get(id);
}

// Draw sprite `id` centred on (cx, cy), height h, aspect kept. Returns false if it isn't loaded.
export function drawSprite(ctx, id, cx, cy, h) {
  try {
    const im = get(id);
    if (!im || !(h > 0)) return false;
    const w = (h * im.naturalWidth) / im.naturalHeight;
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(im, cx - w / 2, cy - h / 2, w, h);
    return true;
  } catch (e) {
    return false;
  }
}

// ---- life for flat sprites -------------------------------------------------------------------------------------------
// A sprite cannot change pose, so it is moved instead: breathing squash and stretch from the feet, a bob, a little
// sway, hops that squash on landing, shakes for anger and sobs, and an entrance pop with overshoot. Reduced motion
// (setSpriteCalm, mirrored from the save by main.js) holds every sprite still.
let CALM = false;
export function setSpriteCalm(v) {
  CALM = !!v;
}
export const isSpriteCalm = () => CALM;
const easeOutBack = (x) => 1 + 2.70158 * Math.pow(x - 1, 3) + 1.70158 * Math.pow(x - 1, 2);

// Transform for `mode` at time t: {sx, sy, dx, dy, rot} in units of the sprite height (dx, dy) and radians; pivot = feet.
function aliveXf(mode, t, ph, amp) {
  let sx = 1, sy = 1, dx = 0, dy = 0, rot = 0;
  const br = Math.sin(t * 2.4 + ph);
  switch (mode) {
    case 'hop': { // bouncy hops: stretch in the air, squash when landing
      const f = (t * 1.5 + ph) % 1, air = f < 0.6 ? Math.sin((f / 0.6) * Math.PI) : 0;
      const land = f >= 0.6 ? Math.max(0, 1 - (f - 0.6) / 0.18) : 0;
      dy = -0.1 * air * amp;
      sy = 1 + 0.07 * air * amp - 0.13 * land * amp;
      sx = 1 - 0.04 * air * amp + 0.09 * land * amp;
      rot = Math.sin(f * Math.PI * 2) * 0.06 * amp;
      break;
    }
    case 'shake': { // anger / sneer: bursts of trembling over a tense breath
      const burst = Math.pow(Math.max(0, Math.sin(t * 2.6 + ph)), 2);
      dx = Math.sin(t * 52) * 0.02 * burst * amp;
      rot = Math.sin(t * 41) * 0.06 * burst * amp + Math.sin(t * 1.7 + ph) * 0.02;
      sy = 1 + 0.04 * Math.sin(t * 9 + ph) * amp + 0.025 * br;
      sx = 1 - 0.015 * Math.sin(t * 9 + ph) * amp;
      break;
    }
    case 'cry': { // sobbing: quick heaves, a shiver and a droop that sways
      const s = Math.sin(t * 8.5 + ph), h = Math.max(0, s);
      dy = -0.05 * h * amp;
      sy = 1 + 0.05 * h * amp - 0.025 * (1 - h) * amp;
      sx = 1 - 0.02 * h * amp;
      dx = Math.sin(t * 33) * 0.006 * amp;
      rot = Math.sin(t * 4.2 + ph) * 0.07 * amp;
      break;
    }
    case 'laugh': { // belly laugh: fast bounce and rock
      const s = Math.sin(t * 9 + ph);
      dy = -Math.abs(s) * 0.045 * amp;
      rot = s * 0.07 * amp;
      sy = 1 + 0.04 * Math.abs(s) * amp;
      sx = 1 - 0.025 * Math.abs(s) * amp;
      break;
    }
    case 'dance': { // happy sway with little hops
      const s = Math.sin(t * 5 + ph);
      dy = -Math.abs(s) * 0.05 * amp;
      rot = s * 0.09 * amp;
      sy = 1 + 0.04 * Math.abs(s) * amp;
      sx = 1 - 0.02 * Math.abs(s) * amp;
      break;
    }
    default: // breathe: feet planted, chest rises, slow sway, tiny bob
      sy = 1 + 0.05 * br * amp;
      sx = 1 - 0.025 * br * amp;
      dy = -0.02 * (0.5 + 0.5 * Math.sin(t * 1.5 + ph)) * amp;
      rot = Math.sin(t * 1.3 + ph) * 0.04 * amp;
  }
  return { sx, sy, dx, dy, rot };
}

// Draw sprite `id` centred on (cx, cy), height h, alive. mode: 'breathe' (default), 'hop', 'shake', 'cry', 'laugh', 'dance'.
// o.age (seconds since it appeared) adds an entrance pop: scale-up with overshoot, a small settling tilt, a quick fade-in.
// o.popFrom (0..1) is the pop's starting scale (default 0; a sprite swap uses ~0.85 so it does not vanish). o.amp scales the motion, o.phase offsets it so two sprites do not move in lockstep. Returns false if not loaded.
export function drawSpriteAlive(ctx, id, cx, cy, h, t = 0, mode = 'breathe', o = {}) {
  try {
    if (!get(id) || !(h > 0)) return false;
    const amp = o.amp == null ? 1 : o.amp;
    const x = CALM ? { sx: 1, sy: 1, dx: 0, dy: 0, rot: 0 } : aliveXf(mode, t, o.phase || 0, amp);
    let a = 1;
    if (o.age != null && o.age < 0.6 && !CALM) {
      const f = o.popFrom || 0, u = Math.max(0, Math.min(1, o.age / 0.5)), p = Math.max(0.001, f + (1 - f) * easeOutBack(u));
      x.sx *= p; x.sy *= p; x.rot += (1 - u) * -0.25 * (1 - f);
      a = f > 0 ? 1 : Math.max(0, Math.min(1, o.age * 8));
    }
    ctx.save();
    ctx.globalAlpha *= a;
    ctx.translate(cx + x.dx * h, cy + h / 2 + x.dy * h); // pivot at the feet
    ctx.rotate(x.rot);
    ctx.scale(x.sx, x.sy);
    const ok = drawSprite(ctx, id, 0, -h / 2, h);
    ctx.restore();
    return ok;
  } catch (e) {
    return false;
  }
}

// Boss portrait fitted into the rect (x, y, w, h), bottom-anchored, with a gentle breathe and bob. bossId: 'fox', 'snake',
// 'blizzard', 'golem', 'salamander', 'eagle', 'foxking' (or the full 'boss_*' id). Returns false if not loaded.
export function drawBossCard(ctx, bossId, x, y, w, h, t = 0, age = null) {
  try {
    const id = String(bossId).startsWith('boss_') ? bossId : 'boss_' + bossId;
    const im = get(id);
    if (!im || !(w > 0) || !(h > 0)) return false;
    const k = Math.min(w / im.naturalWidth, h / im.naturalHeight);
    const dh = im.naturalHeight * k * 0.96, dw = im.naturalWidth * k * 0.96;
    // each boss moves in character: the fox sneers (tremble), snake and eagle sway, golem and salamander are heavy breathers
    const mode = bossId === 'fox' || bossId === 'foxking' || bossId === 'boss_fox' || bossId === 'boss_foxking' ? 'shake' : 'breathe';
    const sway = /snake|eagle/.test(String(bossId)) ? 1.8 : /golem|salamander/.test(String(bossId)) ? 0.8 : 1;
    // soft shadow breathing with the sprite
    ctx.save();
    ctx.globalAlpha = 0.22;
    ctx.fillStyle = '#000';
    ctx.beginPath();
    ctx.ellipse(x + w / 2, y + h - h * 0.015, dw * 0.32, h * 0.04, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    return drawSpriteAlive(ctx, id, x + w / 2, y + h - h * 0.02 - dh / 2, dh, t, mode, { amp: sway, age });
  } catch (e) {
    return false;
  }
}
