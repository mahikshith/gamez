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

// Boss portrait fitted into the rect (x, y, w, h), bottom-anchored, with a gentle breathe and bob. bossId: 'fox', 'snake',
// 'blizzard', 'golem', 'salamander', 'eagle', 'foxking' (or the full 'boss_*' id). Returns false if not loaded.
export function drawBossCard(ctx, bossId, x, y, w, h, t = 0) {
  try {
    const id = String(bossId).startsWith('boss_') ? bossId : 'boss_' + bossId;
    const im = get(id);
    if (!im || !(w > 0) || !(h > 0)) return false;
    const k = Math.min(w / im.naturalWidth, h / im.naturalHeight);
    const breathe = 1 + 0.02 * Math.sin(t * 2.2), bob = Math.sin(t * 1.5) * h * 0.012; // breathe from the feet up
    ctx.save();
    ctx.translate(x + w / 2, y + h - h * 0.02 + bob);
    ctx.scale(1, breathe);
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    const dw = im.naturalWidth * k * 0.98, dh = im.naturalHeight * k * 0.98;
    ctx.drawImage(im, -dw / 2, -dh, dw, dh);
    ctx.restore();
    return true;
  } catch (e) {
    return false;
  }
}
