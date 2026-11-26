// 0.8.18 (weasel818): a creature drawn bigger than its sim body (Pip, Spike) can reach past the ring above its channel
// into the next channel, where it would sit over that ring and under that channel's eggs. drawInChannel draws what lies
// on its own side of the ring's far face at full strength and only a faint ghost of what reaches past it (none on
// PERF.low). ctx is world space with the vault's middle at the origin. rB: the far face's radius; out: true when the
// channel above lies outward (water levels, where "up" is away from the middle); ghost: the ghost's alpha (0 = none).
import { PERF } from '../perf.js';

export function drawInChannel(ctx, rB, out, ghost, draw) {
  const keep = (inside) => { ctx.beginPath(); if (!inside) ctx.rect(-1e4, -1e4, 2e4, 2e4); ctx.arc(0, 0, rB, 0, Math.PI * 2); ctx.clip(inside ? 'nonzero' : 'evenodd'); };
  ctx.save(); keep(out); draw(); ctx.restore();
  if (ghost > 0.02 && !PERF.low) { ctx.save(); keep(!out); ctx.globalAlpha *= ghost; draw(); ctx.restore(); }
}
