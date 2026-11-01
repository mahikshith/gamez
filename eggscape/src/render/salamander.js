// The lava salamander: one species of the crawler rig (see crawlers.js for the options).
// drawSalamander(ctx, x, y, s, t, opts): snout at (x, y), s = snout-to-hips px (in game: 1.8 m * k).
// Poses: 'walk' | 'idle' | 'hiss' | 'breath' | 'dazed' | 'flee' | 'cool'.
import { drawCrawler, crawlerAnim } from './crawlers.js';

export const drawSalamander = (ctx, x, y, s, t, opts) => drawCrawler(ctx, x, y, s, t, opts, 'salamander');
export const salamanderAnim = crawlerAnim;
export const SALAMANDER_LEN = 1.96; // snout to tail tip, in units of s
